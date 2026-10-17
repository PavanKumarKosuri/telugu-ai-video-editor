import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import express from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { analyzeVideo } from './gemini.js';
import { clampInterval, createSrt } from './media.js';

const execFileAsync = promisify(execFile);
const app = express();
const port = Number(process.env.PORT) || 3001;
const storageRoot = path.join(os.tmpdir(), 'telugu-ai-video-editor');
const jobs = new Map();
const maxUploadBytes = 500 * 1024 * 1024;
const videoMimeTypes = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
  'video/x-msvideo',
  'video/3gpp',
]);
const safeExtensions = new Map([
  ['video/mp4', '.mp4'],
  ['video/quicktime', '.mov'],
  ['video/webm', '.webm'],
  ['video/x-matroska', '.mkv'],
  ['video/x-msvideo', '.avi'],
  ['video/3gpp', '.3gp'],
  ['audio/mpeg', '.mp3'],
  ['audio/mp4', '.m4a'],
  ['audio/aac', '.aac'],
  ['audio/wav', '.wav'],
  ['audio/x-wav', '.wav'],
  ['audio/ogg', '.ogg'],
  ['audio/webm', '.webm'],
  ['audio/flac', '.flac'],
]);

const fileExtension = mimeType => safeExtensions.get(mimeType) || '.audio';

await fs.mkdir(storageRoot, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: storageRoot,
    filename: (_request, file, callback) => callback(null, `${crypto.randomUUID()}${fileExtension(file.mimetype)}`),
  }),
  limits: { fileSize: maxUploadBytes, files: 6, fields: 8 },
  fileFilter: (_request, file, callback) => {
    if (file.fieldname === 'clips' && videoMimeTypes.has(file.mimetype)) {
      callback(null, true);
    } else if (file.fieldname === 'music' && file.mimetype.startsWith('audio/')) {
      callback(null, true);
    } else {
      callback(Object.assign(new Error('Unsupported media type. Upload supported video clips and optional audio only.'), { status: 400 }));
    }
  },
});

function updateJob(job, progress, status) {
  job.progress = progress;
  job.status = status;
}

async function runFfmpeg(args) {
  try {
    await execFileAsync('ffmpeg', args, { timeout: 20 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 });
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('FFmpeg is required. Install FFmpeg and make sure ffmpeg and ffprobe are on PATH.');
    }
    throw new Error(error.stderr?.slice(-2000) || 'FFmpeg could not process one of the uploaded clips.');
  }
}

async function getProbe(input, args) {
  try {
    const { stdout } = await execFileAsync('ffprobe', args.concat(input), {
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });
    return stdout.trim();
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('FFprobe is required. Install FFmpeg and make sure ffmpeg and ffprobe are on PATH.');
    }
    throw new Error('An uploaded file could not be read as a video.');
  }
}

async function inspectVideo(input) {
  const duration = Number(await getProbe(input, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
  ]));
  const audioStreams = await getProbe(input, [
    '-v', 'error',
    '-select_streams', 'a',
    '-show_entries', 'stream=codec_type',
    '-of', 'csv=p=0',
  ]);

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('An uploaded clip has an invalid duration.');
  }
  if (duration > 60 * 60) {
    throw new Error('Each uploaded clip must be one hour or shorter.');
  }
  return { duration, hasAudio: Boolean(audioStreams) };
}

function safeLabel(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 120) : fallback;
}

function normalizeAnalysis(raw, duration, offset, fileIndex, fallbackName) {
  const chapters = Array.isArray(raw.chapters) ? raw.chapters : [];
  const captions = Array.isArray(raw.captions) ? raw.captions : [];
  const highlights = Array.isArray(raw.highlights) ? raw.highlights : [];

  return {
    chapters: chapters.map((item, index) => {
      const interval = clampInterval(item, duration);
      return {
        id: `chapter-${fileIndex}-${index}`,
        title: safeLabel(item.title, `Chapter ${index + 1}`),
        startTimeSeconds: interval.start + offset,
        endTimeSeconds: interval.end + offset,
      };
    }).filter(chapter => chapter.endTimeSeconds > chapter.startTimeSeconds),
    captions: captions
      .filter(item => typeof item.text === 'string' && item.text.trim())
      .map(item => {
        const interval = clampInterval(item, duration);
        return {
          start: interval.start + offset,
          end: interval.end + offset,
          text: item.text.trim().slice(0, 500),
        };
      }).filter(caption => caption.end > caption.start),
    highlights: highlights.map((item, index) => {
      const interval = clampInterval(item, duration);
      return {
        id: `reel-${fileIndex}-${index}`,
        title: safeLabel(item.title, fallbackName),
        hook: safeLabel(item.hook, item.title || 'Highlight'),
        start: interval.start + offset,
        end: interval.end + offset,
      };
    }).filter(highlight => highlight.end > highlight.start),
  };
}

function formatClock(seconds) {
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value / 3600)).padStart(2, '0')}:${String(Math.floor(value % 3600 / 60)).padStart(2, '0')}`;
}

function reelDimensions(aspectRatio) {
  if (aspectRatio === '1:1') return '720:720';
  if (aspectRatio === '16:9') return '1280:720';
  return '720:1280';
}

async function normalizeClip(input, output, duration, hasAudio) {
  const args = ['-y', '-i', input];
  if (!hasAudio) {
    args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
  }

  args.push(
    '-map', '0:v:0',
    '-map', hasAudio ? '0:a:0' : '1:a:0',
    '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=30,setsar=1',
    '-af', hasAudio ? 'aresample=44100:async=1:first_pts=0' : 'anull',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-g', '60',
    '-keyint_min', '60',
    '-sc_threshold', '0',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-ac', '2',
    '-t', String(duration),
    '-movflags', '+faststart',
    output,
  );

  await runFfmpeg(args);
}

async function buildJob(job, clips, musicFile, options) {
  const outputDir = path.join(job.directory, 'output');
  await fs.mkdir(outputDir, { recursive: true });
  const clipData = [];
  let timelineOffset = 0;

  for (const [index, file] of clips.entries()) {
    updateJob(job, 10 + index * 10, `Inspecting clip ${index + 1} of ${clips.length}...`);
    const info = await inspectVideo(file.path);
    clipData.push({ ...file, ...info, offset: timelineOffset });
    timelineOffset += info.duration;
  }

  const analyses = [];
  for (const [index, clip] of clipData.entries()) {
    updateJob(job, 20 + Math.round(index / clips.length * 25), `Analyzing clip ${index + 1} of ${clips.length} with Gemini...`);
    const raw = await analyzeVideo(clip.path, clip.mimetype, clip.duration, options.prompt);
    analyses.push(normalizeAnalysis(raw, clip.duration, clip.offset, index, path.basename(clip.originalname, path.extname(clip.originalname))));
  }

  const normalizedPaths = [];
  for (const [index, clip] of clipData.entries()) {
    updateJob(job, 45 + Math.round(index / clips.length * 20), `Preparing clip ${index + 1} of ${clips.length}...`);
    const normalizedPath = path.join(outputDir, `clip-${index}.mp4`);
    await normalizeClip(clip.path, normalizedPath, clip.duration, clip.hasAudio);
    normalizedPaths.push(normalizedPath);
  }

  updateJob(job, 68, 'Compiling the long-form video...');
  const concatList = path.join(outputDir, 'clips.txt');
  await fs.writeFile(concatList, normalizedPaths.map(file => `file '${file.replaceAll("'", "'\\''")}'`).join('\n'));
  const videoPath = path.join(outputDir, 'long-video.mp4');
  await runFfmpeg([
    '-y', '-f', 'concat', '-safe', '0', '-i', concatList,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2',
    '-movflags', '+faststart', videoPath,
  ]);

  if (musicFile) {
    updateJob(job, 75, 'Mixing your background audio...');
    const mixedPath = path.join(outputDir, 'long-video-mixed.mp4');
    await runFfmpeg([
      '-y', '-i', videoPath, '-stream_loop', '-1', '-i', musicFile.path,
      '-filter_complex', '[0:a]volume=1[original];[1:a]volume=0.2[music];[original][music]amix=inputs=2:duration=first:dropout_transition=2[audio]',
      '-map', '0:v:0', '-map', '[audio]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
      '-shortest', '-movflags', '+faststart', mixedPath,
    ]);
    await fs.rename(mixedPath, videoPath);
  }

  const chapters = analyses.flatMap(analysis => analysis.chapters)
    .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
  const captions = analyses.flatMap(analysis => analysis.captions)
    .sort((a, b) => a.start - b.start);
  let highlights = analyses.flatMap(analysis => analysis.highlights)
    .sort((a, b) => a.start - b.start);

  if (!highlights.length) {
    highlights = clipData.slice(0, 3).map((clip, index) => ({
      id: `reel-fallback-${index}`,
      title: path.basename(clip.originalname, path.extname(clip.originalname)),
      hook: 'Clip highlight',
      start: clip.offset,
      end: Math.min(clip.offset + clip.duration, clip.offset + options.duration),
    }));
  }

  const reels = [];
  const maxReels = Math.min(10, Math.max(1, Number(options.reelsToGenerate) || 3));
  for (const [index, highlight] of highlights.slice(0, maxReels).entries()) {
    const start = Math.min(highlight.start, Math.max(0, timelineOffset - 0.1));
    const duration = Math.min(options.duration, Math.max(0.1, timelineOffset - start));
    const filename = `reel-${index + 1}.mp4`;
    const dimensions = reelDimensions(options.aspectRatio);
    const [width, height] = dimensions.split(':');
    updateJob(job, 78 + Math.round(index / Math.max(1, Math.min(highlights.length, maxReels)) * 15), `Rendering reel ${index + 1}...`);
    await runFfmpeg([
      '-y', '-ss', String(start), '-i', videoPath, '-t', String(duration),
      '-vf', `scale=${dimensions}:force_original_aspect_ratio=increase,crop=${width}:${height}`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
      path.join(outputDir, filename),
    ]);
    reels.push({
      id: highlight.id,
      title: highlight.title,
      hook: highlight.hook,
      duration: Math.round(duration),
      aspectRatio: options.aspectRatio,
      previewUrl: `/api/jobs/${job.id}/assets/${filename}`,
      downloadUrl: `/api/jobs/${job.id}/assets/${filename}?download=1`,
      isFavorite: false,
    });
  }

  const srtFile = 'captions.srt';
  await fs.writeFile(path.join(outputDir, srtFile), createSrt(captions), 'utf8');
  for (const chapter of chapters) {
    chapter.startTime = formatClock(chapter.startTimeSeconds);
    chapter.endTime = formatClock(chapter.endTimeSeconds);
    const imageName = `${chapter.id}.jpg`;
    const thumbnailTime = (chapter.startTimeSeconds + chapter.endTimeSeconds) / 2;
    await runFfmpeg([
      '-y', '-ss', String(thumbnailTime), '-i', videoPath,
      '-frames:v', '1', '-q:v', '3', path.join(outputDir, imageName),
    ]);
    chapter.thumbnailUrl = `/api/jobs/${job.id}/assets/${imageName}`;
  }

  return {
    title: safeLabel(options.title, 'Telugu video'),
    chapters,
    reels,
    videoUrl: `/api/jobs/${job.id}/assets/long-video.mp4`,
    videoDownloadUrl: `/api/jobs/${job.id}/assets/long-video.mp4?download=1`,
    captionsUrl: `/api/jobs/${job.id}/assets/${srtFile}?download=1`,
  };
}

app.use(rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
}));

app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));

app.post('/api/jobs', (request, response, next) => {
  upload.fields([{ name: 'clips', maxCount: 5 }, { name: 'music', maxCount: 1 }])(request, response, error => {
    if (error) return next(error);
    const clips = request.files?.clips || [];
    const music = request.files?.music?.[0];
    if (!clips.length) {
      for (const file of Object.values(request.files || {}).flat()) fs.rm(file.path, { force: true }).catch(() => {});
      return response.status(400).json({ error: 'Upload at least one video clip.' });
    }

    const id = crypto.randomUUID();
    const directory = path.join(storageRoot, id);
    const job = { id, directory, progress: 0, status: 'Queued', state: 'processing', result: null, error: null, createdAt: Date.now() };
    jobs.set(id, job);

    (async () => {
      try {
        await fs.mkdir(directory, { recursive: true });
        const storedClips = [];
        for (const [index, file] of clips.entries()) {
          const destination = path.join(directory, `clip-${index}${fileExtension(file.mimetype)}`);
          await fs.rename(file.path, destination);
          storedClips.push({ ...file, path: destination });
        }
        let storedMusic;
        if (music) {
          const destination = path.join(directory, `music${fileExtension(music.mimetype)}`);
          await fs.rename(music.path, destination);
          storedMusic = { ...music, path: destination };
        }
        const aspectRatio = ['9:16', '1:1', '16:9'].includes(request.body.aspectRatio) ? request.body.aspectRatio : '9:16';
        const requestedDuration = Number(request.body.duration);
        const duration = [15, 30, 60].includes(requestedDuration) ? requestedDuration : 30;
        const options = {
          prompt: String(request.body.prompt || '').slice(0, 2000),
          aspectRatio,
          duration,
          title: request.body.title || request.body.preset || 'Telugu video',
          reelsToGenerate: Number(request.body.reelsToGenerate) || 3,
        };
        job.result = await buildJob(job, storedClips, storedMusic, options);
        job.state = 'completed';
        updateJob(job, 100, 'Your video, reels, and captions are ready.');
      } catch (error) {
        job.error = error.message || 'The video could not be processed.';
        job.state = 'failed';
        job.status = 'Processing failed';
        console.error(`Video job ${id} failed:`, error);
      }
    })();

    response.status(202).json({ id, state: job.state, statusUrl: `/api/jobs/${id}` });
  });
});

app.get('/api/jobs/:id', (request, response) => {
  const job = jobs.get(request.params.id);
  if (!job) return response.status(404).json({ error: 'Job not found or expired.' });
  response.json({
    id: job.id,
    state: job.state,
    progress: job.progress,
    status: job.status,
    error: job.error,
    result: job.result,
  });
});

app.get('/api/jobs/:id/assets/:filename', async (request, response, next) => {
  const job = jobs.get(request.params.id);
  const filename = request.params.filename;
  if (!job || path.basename(filename) !== filename || !/^(long-video\.mp4|captions\.srt|reel-\d+\.mp4|chapter-\d+-\d+\.jpg)$/.test(filename)) {
    return response.status(404).json({ error: 'File not found or expired.' });
  }
  const filePath = path.join(job.directory, 'output', filename);
  try {
    await fs.access(filePath);
    if (request.query.download === '1') {
      return response.download(filePath, filename, error => error && next(error));
    }
    return response.sendFile(filePath, error => error && next(error));
  } catch {
    return response.status(404).json({ error: 'File is not available yet.' });
  }
});

app.use(express.static(path.resolve('dist')));
app.get('/{*path}', (_request, response, next) => {
  if (_request.path.startsWith('/api/')) return next();
  response.sendFile(path.resolve('dist/index.html'), error => error && next(error));
});

app.use((error, _request, response, _next) => {
  const status = error instanceof multer.MulterError
    ? error.code === 'LIMIT_FILE_SIZE' ? 413 : 400
    : error.status || 500;
  if (status >= 500) console.error('API request failed:', error);
  response.status(status).json({ error: status >= 500 ? 'Internal server error.' : error.message || 'Request failed.' });
});

const cleanupInterval = setInterval(() => {
  for (const [id, job] of jobs) {
    if (job.state !== 'processing' && Date.now() - job.createdAt > 24 * 60 * 60 * 1000) {
      jobs.delete(id);
      fs.rm(job.directory, { recursive: true, force: true }).catch(() => {});
    }
  }
}, 60 * 60 * 1000);
cleanupInterval.unref();

app.listen(port, () => console.log(`Video editor API listening on http://localhost:${port}`));
