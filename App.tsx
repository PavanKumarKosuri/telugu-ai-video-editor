import React, { useCallback, useMemo, useState } from 'react';
import { AppState, Chapter, ReelCandidate, VideoFile } from './types';
import { DownloadIcon, FilmIcon, MusicIcon, StarIcon, UploadCloudIcon, VideoIcon, WandIcon, XIcon } from './components/IconComponents';
import './studio.css';

type AspectRatio = '9:16' | '1:1' | '16:9';
type ReelDuration = 15 | 30 | 60;
type CaptionCue = { start: number; end: number; text: string };
type JobResult = {
    chapters: Chapter[];
    reels: ReelCandidate[];
    captions: CaptionCue[];
    videoUrl: string;
    videoDownloadUrl: string;
    captionsUrl: string;
};

const MAX_CLIPS = 5;
const MAX_FILE_SIZE = 500 * 1024 * 1024;

const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60);
    return `${minutes}:${String(remainder).padStart(2, '0')}`;
};

const Header = ({ appState }: { appState: AppState }) => {
    const steps = [
        { state: AppState.UPLOADING, label: 'Add clips' },
        { state: AppState.CONFIGURING, label: 'Shape the edit' },
        { state: AppState.PROCESSING, label: 'AI studio' },
        { state: AppState.REVIEWING, label: 'Review & export' },
    ];
    const activeStep = appState === AppState.UPLOADING ? 0 : appState === AppState.CONFIGURING ? 1 : appState === AppState.PROCESSING ? 2 : 3;

    return (
        <header className="studio-header">
            <div className="studio-header-inner">
                <a className="brand-lockup" href="/" aria-label="Katha Studio home">
                    <span className="brand-mark"><FilmIcon className="h-5 w-5" /></span>
                    <span><strong>Katha</strong><span className="brand-subtitle">CREATOR STUDIO</span></span>
                </a>
                <nav className="workflow-steps" aria-label="Editing workflow">
                    {steps.map((step, index) => (
                        <div className={`workflow-step ${activeStep === index ? 'is-active' : ''} ${activeStep > index ? 'is-done' : ''}`} key={step.label}>
                            <span className="step-number">{activeStep > index ? '✓' : `0${index + 1}`}</span>
                            <span>{step.label}</span>
                        </div>
                    ))}
                </nav>
                <span className="header-language"><span className="online-dot" /> TELUGU-FIRST AI</span>
            </div>
        </header>
    );
};

const FileUploader = ({ onFilesAdded, onError, remaining }: {
    onFilesAdded: (files: VideoFile[]) => void;
    onError: (message: string) => void;
    remaining: number;
}) => {
    const [isDragging, setIsDragging] = useState(false);

    const processFiles = (files: File[]) => {
        const accepted: VideoFile[] = [];
        files.forEach(file => {
            if (!file.type.startsWith('video/')) {
                onError(`${file.name} isn't a video file.`);
            } else if (file.size > MAX_FILE_SIZE) {
                onError(`${file.name} is larger than the 500 MB per-clip limit.`);
            } else if (accepted.length >= remaining) {
                onError(`This project supports up to ${MAX_CLIPS} clips.`);
            } else {
                accepted.push({
                    id: crypto.randomUUID(),
                    file,
                    name: file.name,
                    size: file.size,
                    previewUrl: URL.createObjectURL(file),
                    progress: 0,
                });
            }
        });
        if (accepted.length) onFilesAdded(accepted);
    };

    return (
        <div
            className={`upload-zone ${isDragging ? 'is-dragging' : ''}`}
            onDrop={event => {
                event.preventDefault();
                setIsDragging(false);
                processFiles(Array.from(event.dataTransfer.files));
            }}
            onDragOver={event => { event.preventDefault(); setIsDragging(true); }}
            onDragLeave={event => { event.preventDefault(); setIsDragging(false); }}
        >
            <div className="upload-art" aria-hidden="true">
                <span className="upload-art-ring"><UploadCloudIcon className="h-8 w-8" /></span>
                <span className="upload-art-spark">✦</span>
            </div>
            <h3>Every great story starts with a clip.</h3>
            <p>Drop your video clips here, or browse your device. We’ll find the moments worth sharing.</p>
            <label className="button button-primary upload-browse" htmlFor="file-upload">Choose video clips</label>
            <input id="file-upload" type="file" multiple accept="video/*" className="sr-only" onChange={event => {
                if (event.target.files) processFiles(Array.from(event.target.files));
                event.target.value = '';
            }} />
            <div className="upload-specs"><span>MP4 · MOV · WEBM</span><span>UP TO 500 MB EACH</span><span>{remaining} {remaining === 1 ? 'SLOT' : 'SLOTS'} LEFT</span></div>
        </div>
    );
};

const ClipList = ({ files, onRemove, onMove, onFilesAdded, onError }: {
    files: VideoFile[];
    onRemove: (id: string) => void;
    onMove: (index: number, direction: -1 | 1) => void;
    onFilesAdded: (files: VideoFile[]) => void;
    onError: (message: string) => void;
}) => {
    const [durations, setDurations] = useState<Record<string, number>>({});
    const totalDuration = (Object.values(durations) as number[]).reduce((sum, duration) => sum + duration, 0);

    return (
        <section className="panel clip-panel">
            <div className="section-heading">
                <div><span className="eyebrow">YOUR FOOTAGE</span><h2>Storyline clips <span className="count-pill">{files.length}/{MAX_CLIPS}</span></h2></div>
                <span className="duration-summary">{totalDuration ? `~${formatDuration(totalDuration)} total` : 'Order sets your story'}</span>
            </div>
            <p className="section-copy">Arrange clips in the order you want them to play. Your original files stay on your device until you start.</p>
            <div className="clip-list">
                {files.map((item, index) => (
                    <article className="clip-row" key={item.id}>
                        <div className="clip-order">{String(index + 1).padStart(2, '0')}</div>
                        <div className="clip-thumb">
                            <video src={item.previewUrl} muted preload="metadata" onLoadedMetadata={event => {
                                const duration = event.currentTarget.duration;
                                if (Number.isFinite(duration)) setDurations(current => ({ ...current, [item.id]: duration }));
                            }} />
                            <span>{durations[item.id] ? formatDuration(durations[item.id]) : 'VIDEO'}</span>
                        </div>
                        <div className="clip-info"><strong title={item.name}>{item.name}</strong><span>{(item.size / (1024 * 1024)).toFixed(1)} MB · Ready to edit</span></div>
                        <div className="clip-actions">
                            <button className="icon-button" aria-label={`Move ${item.name} up`} disabled={index === 0} onClick={() => onMove(index, -1)}>↑</button>
                            <button className="icon-button" aria-label={`Move ${item.name} down`} disabled={index === files.length - 1} onClick={() => onMove(index, 1)}>↓</button>
                            <button className="icon-button remove-button" aria-label={`Remove ${item.name}`} onClick={() => onRemove(item.id)}><XIcon className="h-4 w-4" /></button>
                        </div>
                    </article>
                ))}
            </div>
            {files.length < MAX_CLIPS && (
                <FileUploader onFilesAdded={onFilesAdded} onError={onError} remaining={MAX_CLIPS - files.length} />
            )}
        </section>
    );
};

const ConfigurationScreen = ({ clipsCount, onStart, disabled }: {
    clipsCount: number;
    onStart: (settings: { prompt: string; preset: string; title: string; music?: File; aspectRatio: AspectRatio; duration: ReelDuration; reelCount: number }) => void;
    disabled: boolean;
}) => {
    const [prompt, setPrompt] = useState('Keep the food and family moments. Find the funniest Telugu lines, skip long pauses, and make the story feel warm.');
    const [title, setTitle] = useState('My Telugu story');
    const [preset, setPreset] = useState('Creator story');
    const [music, setMusic] = useState<File>();
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
    const [duration, setDuration] = useState<ReelDuration>(30);
    const [reelCount, setReelCount] = useState(3);

    const presets = [
        { name: 'Creator story', description: 'Natural pacing, warm and personal', icon: '◉' },
        { name: 'Social energy', description: 'Fast cuts, big moments, punchy hooks', icon: '↗' },
        { name: 'Cinematic', description: 'Unhurried, visual, film-inspired mood', icon: '▧' },
    ];

    const start = () => onStart({ prompt, preset, title, music, aspectRatio, duration, reelCount });

    return (
        <section className="panel configuration-panel">
            <div className="section-heading"><div><span className="eyebrow">MAKE IT YOURS</span><h2>Set the creative direction</h2></div><span className="ai-chip"><WandIcon className="h-4 w-4" /> AI ASSISTED</span></div>
            <p className="section-copy">Your clips are understood in context, including Telugu speech. You stay in control of the final cut.</p>
            <label className="field-label" htmlFor="project-title">PROJECT TITLE</label>
            <input id="project-title" className="text-field" maxLength={100} value={title} onChange={event => setTitle(event.target.value)} placeholder="Give your story a name" />

            <div className="field-label spaced-label">START WITH A STYLE</div>
            <div className="preset-grid">
                {presets.map(item => (
                    <button key={item.name} className={`preset-card ${preset === item.name ? 'is-selected' : ''}`} onClick={() => setPreset(item.name)} aria-pressed={preset === item.name}>
                        <span className="preset-icon">{item.icon}</span><strong>{item.name}</strong><span>{item.description}</span>
                    </button>
                ))}
            </div>

            <label className="field-label spaced-label" htmlFor="edit-prompt">TELL KATHA WHAT MATTERS</label>
            <textarea id="edit-prompt" className="text-field prompt-field" maxLength={2000} value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Describe moments to keep, pacing, language, or anything to avoid…" />
            <div className="field-hint">Specific instructions help the AI choose stronger chapters and highlights.</div>

            <div className="option-divider" />
            <div className="options-grid">
                <div>
                    <span className="field-label">REEL FORMAT</span>
                    <div className="segmented-control">
                        {(['9:16', '1:1', '16:9'] as const).map(ratio => <button key={ratio} className={aspectRatio === ratio ? 'is-selected' : ''} onClick={() => setAspectRatio(ratio)} aria-pressed={aspectRatio === ratio}>{ratio}</button>)}
                    </div>
                    <div className="field-hint">Vertical · Square · Landscape</div>
                </div>
                <div>
                    <span className="field-label">MAX REEL LENGTH</span>
                    <div className="segmented-control">
                        {([15, 30, 60] as const).map(value => <button key={value} className={duration === value ? 'is-selected' : ''} onClick={() => setDuration(value)} aria-pressed={duration === value}>{value}s</button>)}
                    </div>
                    <div className="field-hint">Each highlight stays focused on its moment.</div>
                </div>
            </div>
            <div className="option-bottom">
                <div className="reel-count-control">
                    <span className="field-label">REELS TO CREATE</span>
                    <div className="count-stepper">
                        <button aria-label="Create fewer reels" disabled={reelCount <= 1} onClick={() => setReelCount(value => Math.max(1, value - 1))}>−</button>
                        <strong>{reelCount}</strong>
                        <button aria-label="Create more reels" disabled={reelCount >= 10} onClick={() => setReelCount(value => Math.min(10, value + 1))}>+</button>
                    </div>
                </div>
                <div className="music-upload-control">
                    <span className="field-label">BACKGROUND MUSIC</span>
                    <label className="music-file-picker">
                        <MusicIcon className="h-5 w-5" />
                        <span>{music ? music.name : 'Add your own track'}</span>
                        {music && <button type="button" className="clear-music" aria-label="Remove background music" onClick={event => { event.preventDefault(); setMusic(undefined); }}>×</button>}
                        <input type="file" accept="audio/*" className="sr-only" onChange={event => setMusic(event.target.files?.[0])} />
                    </label>
                    <div className="field-hint">Optional · Original audio stays audible</div>
                </div>
            </div>
            <button className="button button-primary generate-button" onClick={start} disabled={disabled || !title.trim() || !clipsCount}>
                <WandIcon className="h-5 w-5" /> Create my first cut <span aria-hidden="true">→</span>
            </button>
            <p className="privacy-note">Your footage is processed privately for this job and automatically removed after 24 hours.</p>
        </section>
    );
};

const ProcessingScreen = ({ status, progress }: { status: string; progress: number }) => (
    <section className="panel processing-panel">
        <div className="processing-orbit"><span /><span /><span /><WandIcon className="h-8 w-8" /></div>
        <span className="eyebrow">KATHA AI STUDIO</span>
        <h2>Your story is taking shape.</h2>
        <p>{status}</p>
        <div className="progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>
        <div className="progress-meta"><span>Processing your footage</span><strong>{progress}%</strong></div>
        <div className="processing-steps">
            {['Understand Telugu dialogue', 'Find chapters & standout moments', 'Build your compilation & reels', 'Prepare captions & exports'].map((step, index) => (
                <div key={step} className={progress >= [20, 45, 68, 95][index] ? 'step-complete' : ''}><span>{progress >= [20, 45, 68, 95][index] ? '✓' : `0${index + 1}`}</span>{step}</div>
            ))}
        </div>
    </section>
);

const ReviewScreen = ({ result, title, onToggleFavorite, onDownloadAllReels, onStartOver }: {
    result: JobResult;
    title: string;
    onToggleFavorite: (id: string) => void;
    onDownloadAllReels: () => void;
    onStartOver: () => void;
}) => {
    const [showAllCaptions, setShowAllCaptions] = useState(false);
    const aspectClass = (ratio: AspectRatio) => ratio === '9:16' ? 'aspect-[9/16]' : ratio === '1:1' ? 'aspect-square' : 'aspect-video';
    const visibleCaptions = showAllCaptions ? result.captions : result.captions.slice(0, 5);

    return (
        <div className="review-layout">
            <div className="review-heading"><div><span className="eyebrow">YOUR FIRST CUT IS READY</span><h1>{title}</h1><p>Review the full story, Telugu captions and social-ready moments.</p></div><button className="button button-quiet" onClick={onStartOver}>＋ New project</button></div>
            <section className="panel main-preview">
                <div className="section-heading"><div><span className="eyebrow">LONG-FORM CUT · 720P</span><h2>The full story</h2></div><a className="button button-primary compact-button" href={result.videoDownloadUrl} download><DownloadIcon className="h-4 w-4" /> Download video</a></div>
                <video src={result.videoUrl} controls preload="metadata" className="long-video-preview" />
                <p className="media-disclaimer">Full clips are compiled in your chosen order. Fine-grained trims and burned-in caption styling are coming next.</p>
            </section>
            <div className="review-columns">
                <section className="panel chapters-panel">
                    <div className="section-heading"><div><span className="eyebrow">A STORY, IN CHAPTERS</span><h2>Moments worth keeping</h2></div><span className="count-pill">{result.chapters.length}</span></div>
                    {result.chapters.length ? <div className="chapter-list">{result.chapters.map(chapter => <article className="chapter-row" key={chapter.id}>
                        <img src={chapter.thumbnailUrl} alt="" loading="lazy" />
                        <div><strong>{chapter.title}</strong><span>{chapter.startTime} – {chapter.endTime}</span></div>
                    </article>)}</div> : <div className="empty-inline">No chapters were detected in this batch.</div>}
                    <div className="caption-heading"><div><span className="eyebrow">TELUGU & ENGLISH</span><h3>Caption transcript</h3></div>{result.captions.length > 5 && <button className="text-button" onClick={() => setShowAllCaptions(value => !value)}>{showAllCaptions ? 'Show less' : `Show all ${result.captions.length}`}</button>}</div>
                    {result.captions.length ? <div className="caption-list">{visibleCaptions.map((cue, index) => <div className="caption-row" key={`${cue.start}-${index}`}><span>{formatDuration(cue.start)}</span><p>{cue.text}</p></div>)}</div> : <div className="empty-inline">No clear dialogue was detected. Export an empty SRT or try a clip with cleaner speech.</div>}
                    <a href={result.captionsUrl} className="button button-secondary captions-download" download><DownloadIcon className="h-4 w-4" /> Export subtitles (.srt)</a>
                </section>
                <section className="panel reels-panel">
                    <div className="section-heading"><div><span className="eyebrow">READY FOR SOCIAL</span><h2>Highlight reels</h2></div><span className="count-pill">{result.reels.length}</span></div>
                    {result.reels.length ? <div className="reel-list">{result.reels.map(reel => <article className="reel-card" key={reel.id}>
                        <div className={`reel-preview ${aspectClass(reel.aspectRatio)}`}><video src={reel.previewUrl} controls preload="metadata" /></div>
                        <div className="reel-copy"><div><strong>{reel.title}</strong><span>{reel.duration}s · {reel.aspectRatio}</span></div><button className={`favorite-button ${reel.isFavorite ? 'is-favorite' : ''}`} aria-label={reel.isFavorite ? 'Remove from favorites' : 'Add to favorites'} onClick={() => onToggleFavorite(reel.id)}><StarIcon className="h-5 w-5" filled={reel.isFavorite} /></button></div>
                        <p className="reel-hook">“{reel.hook}”</p>
                        <a href={reel.downloadUrl} className="reel-download" download><DownloadIcon className="h-4 w-4" /> Download reel</a>
                    </article>)}</div> : <div className="empty-inline">No highlight moments were found in this batch.</div>}
                    {result.reels.length > 1 && <button onClick={onDownloadAllReels} className="button button-secondary all-reels-button"><DownloadIcon className="h-4 w-4" /> Download all reels</button>}
                </section>
            </div>
            <div className="review-footer"><span>Made with Katha <b>✦</b> Built for stories in every language.</span><a href="mailto:hello@katha.studio">Share feedback</a></div>
        </div>
    );
};

export default function App() {
    const [appState, setAppState] = useState<AppState>(AppState.UPLOADING);
    const [files, setFiles] = useState<VideoFile[]>([]);
    const [processingStatus, setProcessingStatus] = useState('Getting things ready...');
    const [processingProgress, setProcessingProgress] = useState(0);
    const [result, setResult] = useState<JobResult>();
    const [errorMessage, setErrorMessage] = useState('');
    const [projectTitle, setProjectTitle] = useState('My Telugu story');
    const [uploadProgress, setUploadProgress] = useState(0);

    const handleFilesAdded = useCallback((newFiles: VideoFile[]) => {
        setFiles(previous => {
            if (previous.length + newFiles.length > MAX_CLIPS) {
                newFiles.forEach(file => URL.revokeObjectURL(file.previewUrl));
                setErrorMessage(`This project supports up to ${MAX_CLIPS} clips.`);
                return previous;
            }
            setErrorMessage('');
            setAppState(AppState.CONFIGURING);
            return [...previous, ...newFiles];
        });
    }, []);

    const removeFile = useCallback((id: string) => {
        setFiles(previous => {
            const removed = previous.find(file => file.id === id);
            if (removed) URL.revokeObjectURL(removed.previewUrl);
            const remaining = previous.filter(file => file.id !== id);
            if (!remaining.length) setAppState(AppState.UPLOADING);
            return remaining;
        });
    }, []);

    const moveFile = useCallback((index: number, direction: -1 | 1) => {
        setFiles(previous => {
            const nextIndex = index + direction;
            if (nextIndex < 0 || nextIndex >= previous.length) return previous;
            const next = [...previous];
            [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
            return next;
        });
    }, []);

    const startProcessing = useCallback(async (settings: {
        prompt: string; preset: string; title: string; music?: File; aspectRatio: AspectRatio; duration: ReelDuration; reelCount: number;
    }) => {
        setAppState(AppState.PROCESSING);
        setErrorMessage('');
        setProjectTitle(settings.title);
        setProcessingProgress(0);
        setProcessingStatus('Uploading your clips...');
        setUploadProgress(0);

        try {
            const form = new FormData();
            files.forEach(({ file }) => form.append('clips', file));
            if (settings.music) form.append('music', settings.music);
            form.append('prompt', `${settings.prompt}\nEditing style: ${settings.preset}`);
            form.append('preset', settings.preset);
            form.append('title', settings.title);
            form.append('aspectRatio', settings.aspectRatio);
            form.append('duration', String(settings.duration));
            form.append('reelsToGenerate', String(settings.reelCount));

            const created = await new Promise<{ id: string }>((resolve, reject) => {
                const request = new XMLHttpRequest();
                request.open('POST', '/api/jobs');
                request.upload.onprogress = event => {
                    if (event.lengthComputable) {
                        const progress = Math.round(event.loaded / event.total * 100);
                        setUploadProgress(progress);
                        setProcessingProgress(Math.round(progress * 0.15));
                        setProcessingStatus(`Uploading your footage · ${progress}%`);
                    }
                };
                request.onload = () => {
                    let response: { id?: string; error?: string };
                    try { response = JSON.parse(request.responseText || '{}'); }
                    catch { reject(new Error('The server returned an unreadable response.')); return; }
                    if (request.status >= 200 && request.status < 300 && response.id) resolve({ id: response.id });
                    else reject(new Error(response.error || 'Could not upload clips.'));
                };
                request.onerror = () => reject(new Error('Network error while uploading clips.'));
                request.onabort = () => reject(new Error('The upload was interrupted.'));
                request.send(form);
            });

            let job: { state: string; status: string; progress: number; error?: string; result?: JobResult };
            do {
                await new Promise(resolve => window.setTimeout(resolve, 1200));
                const response = await fetch(`/api/jobs/${created.id}`);
                const status = await response.json();
                if (!response.ok) throw new Error(status.error || 'Could not retrieve job status.');
                job = status;
                setProcessingStatus(status.status);
                setProcessingProgress(Math.max(15, status.progress || 0));
                if (job.state === 'failed') throw new Error(job.error || 'Video processing failed.');
            } while (job.state === 'processing');

            if (!job.result) throw new Error('The video job completed without output files.');
            setResult(job.result);
            setProcessingProgress(100);
            files.forEach(file => URL.revokeObjectURL(file.previewUrl));
            setFiles([]);
            setAppState(AppState.REVIEWING);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Video processing failed.');
            setAppState(files.length ? AppState.CONFIGURING : AppState.UPLOADING);
        }
    }, [files]);

    const handleDownloadAllReels = useCallback(() => {
        result?.reels.forEach((reel, index) => {
            window.setTimeout(() => {
                const link = document.createElement('a');
                link.href = reel.downloadUrl;
                link.download = `${reel.title.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || `reel-${index + 1}`}.mp4`;
                document.body.appendChild(link);
                link.click();
                link.remove();
            }, index * 300);
        });
    }, [result]);

    const handleStartOver = () => {
        setResult(undefined);
        setProjectTitle('My Telugu story');
        setFiles([]);
        setErrorMessage('');
        setAppState(AppState.UPLOADING);
    };

    const handleToggleFavorite = useCallback((id: string) => {
        setResult(previous => previous ? {
            ...previous,
            reels: previous.reels.map(reel => reel.id === id ? { ...reel, isFavorite: !reel.isFavorite } : reel),
        } : previous);
    }, []);

    const clipCountLabel = useMemo(() => `${files.length} ${files.length === 1 ? 'clip' : 'clips'}`, [files.length]);

    return (
        <div className="studio-shell">
            <Header appState={appState} />
            <main className="studio-main">
                {errorMessage && <div className="error-banner" role="alert"><span>!</span><p>{errorMessage}</p><button aria-label="Dismiss error" onClick={() => setErrorMessage('')}>×</button></div>}
                {(appState === AppState.UPLOADING || appState === AppState.CONFIGURING) && (
                    <>
                        <section className="welcome-heading">
                            <div><span className="eyebrow">A LITTLE MAGIC. A LOT OF YOU.</span><h1>Your stories deserve<br /><em>a bigger stage.</em></h1><p>Turn raw footage into a Telugu-first story and scroll-stopping reels. You direct. Katha does the heavy lifting.</p></div>
                            <div className="welcome-badge"><span>కథ</span><small>YOUR STORY<br />YOUR WAY</small></div>
                        </section>
                        <div className="workspace-grid">
                            <div className="workspace-main">
                                <ClipList files={files} onRemove={removeFile} onMove={moveFile} onFilesAdded={handleFilesAdded} onError={setErrorMessage} />
                                {files.length > 0 && <ConfigurationScreen clipsCount={files.length} onStart={startProcessing} disabled={appState === AppState.PROCESSING} />}
                            </div>
                            <aside className="studio-sidebar">
                                <section className="sidebar-card project-summary"><span className="eyebrow">THIS PROJECT</span><strong>{clipCountLabel}</strong><p>Up to 5 clips · 500 MB each</p><div className="summary-divider" /><span className="summary-note"><span className="online-dot" /> Your files are private</span></section>
                                <section className="sidebar-card creator-note"><span className="note-icon">“</span><span className="eyebrow">MADE FOR YOUR VOICE</span><p>Telugu speech, local context, and the little moments that make your story yours.</p><span className="note-script">నీ కథ. నీ స్వరం.</span></section>
                                <section className="sidebar-card safety-note"><strong>Before you begin</strong><p>Clips are uploaded for Gemini analysis and FFmpeg editing. Job files are automatically deleted after 24 hours.</p><a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">How AI processing works ↗</a></section>
                            </aside>
                        </div>
                    </>
                )}
                {appState === AppState.PROCESSING && <ProcessingScreen status={processingStatus} progress={processingProgress} />}
                {appState === AppState.REVIEWING && result && <ReviewScreen result={result} title={projectTitle} onToggleFavorite={handleToggleFavorite} onDownloadAllReels={handleDownloadAllReels} onStartOver={handleStartOver} />}
            </main>
            <footer className="studio-footer"><span>✦ KATHA STUDIO</span><span>Thoughtfully made for stories in Telugu and beyond.</span><span>VERSION 01 · CREATOR PREVIEW</span></footer>
        </div>
    );
}
