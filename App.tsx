import React, { useState, useCallback } from 'react';
import { AppState, VideoFile, Chapter, ReelCandidate } from './types';
import { UploadCloudIcon, VideoIcon, XIcon, WandIcon, FilmIcon, DownloadIcon, MusicIcon, StarIcon } from './components/IconComponents';

const Header = () => (
    <header className="p-4 border-b border-gray-700">
        <div className="container mx-auto flex items-center gap-3">
            <FilmIcon className="w-8 h-8 text-indigo-400"/>
            <h1 className="text-2xl font-bold tracking-tight">AI Telugu Video Compiler</h1>
        </div>
    </header>
);

const FileUploader = ({ onFilesAdded, onError }: { onFilesAdded: (files: VideoFile[]) => void; onError: (message: string) => void }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            processFiles(Array.from(e.target.files));
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files) {
            processFiles(Array.from(e.dataTransfer.files));
        }
    };

    const processFiles = (files: File[]) => {
        const invalidFiles = files.filter(file => !file.type.startsWith('video/'));
        if (invalidFiles.length > 0) {
            onError('Only video files can be uploaded.');
        }
        const videoFiles = files
            .filter(file => file.type.startsWith('video/'))
            .filter(file => {
                if (file.size > 500 * 1024 * 1024) {
                    onError(`${file.name} is larger than the 500 MB per-clip limit.`);
                    return false;
                }
                return true;
            })
            .map(file => ({
                id: crypto.randomUUID(),
                file,
                name: file.name,
                size: file.size,
                previewUrl: URL.createObjectURL(file),
                progress: 0,
            }));
        if(videoFiles.length > 5) {
            videoFiles.forEach(file => URL.revokeObjectURL(file.previewUrl));
            onError('You can upload up to 5 clips per project.');
        } else if(videoFiles.length > 0) {
            onFilesAdded(videoFiles);
        }
    };

    const highlight = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const unhighlight = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    return (
        <div 
            className={`w-full max-w-3xl mx-auto mt-10 p-8 border-2 border-dashed rounded-xl transition-all duration-300 ${isDragging ? 'border-indigo-400 bg-gray-800/50' : 'border-gray-600'}`}
            onDrop={handleDrop}
            onDragOver={highlight}
            onDragLeave={unhighlight}
        >
            <div className="flex flex-col items-center justify-center text-center">
                <UploadCloudIcon className="w-16 h-16 text-gray-500 mb-4" />
                <h3 className="text-xl font-semibold text-gray-200">Drag & drop your video clips here</h3>
                <p className="text-gray-400 mt-1">or</p>
                <label htmlFor="file-upload" className="mt-4 px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg cursor-pointer hover:bg-indigo-500 transition-colors">
                    Browse Files
                </label>
                <input id="file-upload" type="file" multiple accept="video/*" className="hidden" onChange={handleFileChange} />
                <p className="text-xs text-gray-500 mt-4">Supports MP4, MOV, AVI, and other major video formats.</p>
            </div>
        </div>
    );
};

interface UploadedFileItemProps {
    file: VideoFile;
    onRemove: (id: string) => void;
}

const UploadedFileItem: React.FC<UploadedFileItemProps> = ({ file, onRemove }) => {
    return (
        <div className="bg-gray-800 p-3 rounded-lg flex items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-center gap-4 truncate">
                <div className="bg-gray-700 w-16 h-10 rounded flex items-center justify-center">
                    <VideoIcon className="w-6 h-6 text-gray-400"/>
                </div>
                <div className="truncate">
                    <p className="text-sm font-medium text-white truncate">{file.name}</p>
                    <p className="text-xs text-gray-400">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={() => onRemove(file.id)} className="text-gray-500 hover:text-red-400 p-1 rounded-full transition-colors">
                    <XIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

const ConfigurationScreen = ({ onStartProcessing, clipsCount }: { onStartProcessing: (prompt: string, preset: string, music: { style: string; file?: File }, reelAspectRatio: '9:16' | '1:1' | '16:9', reelDuration: 15 | 30 | 60) => void, clipsCount: number }) => {
    const [prompt, setPrompt] = useState('Make a 8-min vlog, keep food scenes, remove chitchat, Telugu captions + 3 reels');
    const [selectedMusic, setSelectedMusic] = useState<{ style: string; file?: File }>({ style: 'AI Suggested' });
    const [reelAspectRatio, setReelAspectRatio] = useState<'9:16' | '1:1' | '16:9'>('9:16');
    const [reelDuration, setReelDuration] = useState<15 | 30 | 60>(30);
    
    const presets = ["Cinematic Warm", "Social Punch", "Vintage Film", "Natural & Clean"];
    const musicStyles = ["Cinematic", "Upbeat Lofi", "Telugu Folk", "Ambient"];

    const handleMusicStyleSelect = (style: string) => {
        setSelectedMusic({ style });
    };

    const handleCustomMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedMusic({ style: file.name, file });
            e.target.value = '';
        }
    };

    const startWithPreset = (p: string) => {
        onStartProcessing('', p, selectedMusic, reelAspectRatio, reelDuration);
    }

    const startWithPrompt = () => {
        onStartProcessing(prompt, '', selectedMusic, reelAspectRatio, reelDuration);
    }

    return (
        <div className="container mx-auto px-4 py-8 animate-fade-in">
            <h2 className="text-3xl font-bold text-center">Configure Your Video</h2>
            <p className="text-center text-gray-400 mt-2">You've uploaded {clipsCount} clips. Now, tell the AI how to edit them.</p>

            <div className="max-w-4xl mx-auto mt-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
                        <h3 className="text-xl font-semibold flex items-center gap-2"><WandIcon className="w-6 h-6 text-indigo-400"/> Use a Quick Preset</h3>
                        <p className="text-gray-400 text-sm mt-2 mb-4">Select a style and our AI will handle the rest.</p>
                        <div className="grid grid-cols-2 gap-3">
                            {presets.map(p => (
                                <button key={p} onClick={() => startWithPreset(p)} className="w-full text-center py-3 px-4 bg-gray-700 rounded-lg hover:bg-indigo-600 hover:text-white transition-all font-medium">
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 flex flex-col">
                        <h3 className="text-xl font-semibold">Or, Give Free-Text Instructions</h3>
                        <p className="text-gray-400 text-sm mt-2 mb-4">Describe your desired video in plain language.</p>
                        <textarea 
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="flex-grow bg-gray-900 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
                            placeholder="e.g., 'Create a cinematic travel video with slow-motion shots and Telugu subtitles...'"
                            rows={5}
                        />
                        <button onClick={startWithPrompt} className="mt-4 w-full bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-500 transition-colors">
                            Generate with My Instructions
                        </button>
                    </div>
                </div>

                <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 mt-8">
                    <h3 className="text-xl font-semibold flex items-center gap-2"><MusicIcon className="w-6 h-6 text-indigo-400"/> Select Background Music</h3>
                    <p className="text-gray-400 text-sm mt-2 mb-4">Choose a style, upload your own, or let the AI decide.</p>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        <button onClick={() => handleMusicStyleSelect('AI Suggested')} className={`w-full text-center py-3 px-4 rounded-lg transition-all font-medium ${selectedMusic.style === 'AI Suggested' && !selectedMusic.file ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>
                            AI Suggested
                        </button>
                        {musicStyles.map(style => (
                            <button key={style} onClick={() => handleMusicStyleSelect(style)} className={`w-full text-center py-3 px-4 rounded-lg transition-all font-medium ${selectedMusic.style === style ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                {style}
                            </button>
                        ))}
                        <label htmlFor="music-upload" className="w-full text-center py-3 px-4 bg-gray-700 rounded-lg hover:bg-indigo-600 hover:text-white transition-all font-medium cursor-pointer">
                            Upload
                        </label>
                        <input id="music-upload" type="file" accept="audio/*" className="hidden" onChange={handleCustomMusicUpload} />
                    </div>
                     <p className="text-sm text-gray-400 mt-4 truncate">Selection: <span className="font-medium text-indigo-300">{selectedMusic.style}</span></p>
                </div>
                
                <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 mt-8">
                    <h3 className="text-xl font-semibold flex items-center gap-2"><FilmIcon className="w-6 h-6 text-indigo-400"/> Reel & Shorts Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                        <div>
                            <p className="text-gray-400 text-sm mb-2 font-medium">Aspect Ratio</p>
                             <div className="grid grid-cols-3 gap-3">
                                <button onClick={() => setReelAspectRatio('9:16')} className={`py-3 px-4 rounded-lg font-medium transition-colors ${reelAspectRatio === '9:16' ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>9:16</button>
                                <button onClick={() => setReelAspectRatio('1:1')} className={`py-3 px-4 rounded-lg font-medium transition-colors ${reelAspectRatio === '1:1' ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>1:1</button>
                                <button onClick={() => setReelAspectRatio('16:9')} className={`py-3 px-4 rounded-lg font-medium transition-colors ${reelAspectRatio === '16:9' ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>16:9</button>
                            </div>
                        </div>
                        <div>
                           <p className="text-gray-400 text-sm mb-2 font-medium">Duration</p>
                             <div className="grid grid-cols-3 gap-3">
                                <button onClick={() => setReelDuration(15)} className={`py-3 px-4 rounded-lg font-medium transition-colors ${reelDuration === 15 ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>15s</button>
                                <button onClick={() => setReelDuration(30)} className={`py-3 px-4 rounded-lg font-medium transition-colors ${reelDuration === 30 ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>30s</button>
                                <button onClick={() => setReelDuration(60)} className={`py-3 px-4 rounded-lg font-medium transition-colors ${reelDuration === 60 ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>60s</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


const ProcessingScreen = ({ status }: { status: string }) => (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-fade-in">
        <div className="relative flex items-center justify-center">
            <div className="absolute w-24 h-24 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
            <WandIcon className="w-12 h-12 text-indigo-400"/>
        </div>
        <h2 className="text-2xl font-bold mt-8">AI is working its magic...</h2>
        <p className="text-gray-400 mt-2">{status}</p>
    </div>
);

const ReviewScreen = ({ chapters, reels, videoUrl, videoDownloadUrl, captionsUrl, onToggleFavorite, onDownloadAllReels }: {
    chapters: Chapter[];
    reels: ReelCandidate[];
    videoUrl: string;
    videoDownloadUrl: string;
    captionsUrl: string;
    onToggleFavorite: (id: string) => void;
    onDownloadAllReels: () => void;
}) => {
    const getAspectRatioClass = (ratio: '9:16' | '1:1' | '16:9') => {
        switch (ratio) {
            case '9:16': return 'aspect-[9/16]';
            case '1:1': return 'aspect-square';
            case '16:9': return 'aspect-video';
            default: return 'aspect-[9/16]';
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 animate-fade-in">
            <h2 className="text-3xl font-bold text-center">Review Your AI-Generated Content</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
                <div className="lg:col-span-2">
                    <h3 className="text-xl font-semibold mb-4">Compiled Long-Form Video</h3>
                    <div className="aspect-video bg-black rounded-xl mb-4 overflow-hidden">
                        <video src={videoUrl} controls className="w-full h-full"></video>
                    </div>
                    <div>
                        <h4 className="font-semibold mb-2">AI-Detected Chapters:</h4>
                        <div className="space-y-2">
                            {chapters.map(c => (
                                <div key={c.id} className="bg-gray-800 p-3 rounded-lg flex items-center gap-4">
                                    <img src={c.thumbnailUrl} alt={c.title} className="w-24 h-14 object-cover rounded"/>
                                    <div>
                                        <p className="font-medium">{c.title}</p>
                                        <p className="text-sm text-gray-400">{c.startTime} - {c.endTime}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div>
                    <h3 className="text-xl font-semibold mb-4">Generated Reels</h3>
                    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                        {reels.map(r => (
                            <div key={r.id} className="bg-gray-800 rounded-xl p-3">
                                <div className={`${getAspectRatioClass(r.aspectRatio)} bg-black rounded-lg mb-2 flex items-center justify-center overflow-hidden`}>
                                    <video src={r.previewUrl} controls className="w-full h-full object-cover"></video>
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className="font-semibold text-sm truncate pr-2">{r.title}</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono bg-gray-700 px-1.5 py-0.5 rounded text-gray-300">{r.duration}s</span>
                                        <a href={r.downloadUrl} className="text-xs text-indigo-300 hover:text-white" download>Download</a>
                                        <button onClick={() => onToggleFavorite(r.id)} className={`p-1 rounded-full transition-colors ${r.isFavorite ? 'text-yellow-400 hover:text-yellow-300' : 'text-gray-500 hover:text-yellow-400'}`}>
                                            <StarIcon className="w-5 h-5" filled={r.isFavorite} />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">Hook: "{r.hook}"</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="mt-12 text-center">
                 <h3 className="text-xl font-semibold mb-4">Export Your Files</h3>
                 <div className="flex justify-center items-center gap-4">
                    <a href={videoDownloadUrl} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg transition-colors" download>
                        <DownloadIcon className="w-5 h-5"/> Export Long Video (720p)
                    </a>
                    <button onClick={onDownloadAllReels} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors">
                        <DownloadIcon className="w-5 h-5"/> Export All Reels
                    </button>
                    <a href={captionsUrl} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors" download>
                        <DownloadIcon className="w-5 h-5"/> Download Captions (.srt)
                    </a>
                 </div>
            </div>
        </div>
    );
};


export default function App() {
    const [appState, setAppState] = useState<AppState>(AppState.UPLOADING);
    const [files, setFiles] = useState<VideoFile[]>([]);
    const [processingStatus, setProcessingStatus] = useState('Initializing...');
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [reels, setReels] = useState<ReelCandidate[]>([]);
    const [videoUrl, setVideoUrl] = useState('');
    const [videoDownloadUrl, setVideoDownloadUrl] = useState('');
    const [captionsUrl, setCaptionsUrl] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const handleFilesAdded = useCallback((newFiles: VideoFile[]) => {
        if (files.length + newFiles.length > 5) {
            newFiles.forEach(file => URL.revokeObjectURL(file.previewUrl));
            setErrorMessage('You can upload up to 5 clips per project.');
            return;
        }
        setErrorMessage('');
        setAppState(AppState.CONFIGURING);
        setFiles(prev => [...prev, ...newFiles]);
    }, [files]);

    const handleRemoveFile = useCallback((id: string) => {
        const removed = files.find(file => file.id === id);
        if (removed) URL.revokeObjectURL(removed.previewUrl);
        const remaining = files.filter(file => file.id !== id);
        setFiles(remaining);
        if (!remaining.length) setAppState(AppState.UPLOADING);
    }, [files]);
    
    const handleToggleFavoriteReel = useCallback((id: string) => {
        setReels(prevReels => 
            prevReels.map(reel => 
                reel.id === id ? { ...reel, isFavorite: !reel.isFavorite } : reel
            )
        );
    }, []);

    const startProcessing = useCallback(async (prompt: string, preset: string, music: { style: string; file?: File }, reelAspectRatio: '9:16' | '1:1' | '16:9', reelDuration: 15 | 30 | 60) => {
        setAppState(AppState.PROCESSING);
        setErrorMessage('');
        setProcessingStatus('Uploading clips...');
        try {
            const form = new FormData();
            files.forEach(({ file }) => form.append('clips', file));
            if (music.file) form.append('music', music.file);
            form.append('prompt', prompt || `Use the ${preset || 'natural'} style. Identify clear chapters, Telugu speech, and engaging highlight moments.`);
            form.append('preset', preset);
            form.append('musicStyle', music.style);
            form.append('aspectRatio', reelAspectRatio);
            form.append('duration', String(reelDuration));
            form.append('reelsToGenerate', '3');

            const created = await new Promise<{ id: string }>((resolve, reject) => {
                const request = new XMLHttpRequest();
                request.open('POST', '/api/jobs');
                request.upload.onprogress = event => {
                    if (event.lengthComputable) {
                        setProcessingStatus(`Uploading clips (${Math.round(event.loaded / event.total * 100)}%)...`);
                    }
                };
                request.onload = () => {
                    const result = JSON.parse(request.responseText || '{}');
                    if (request.status >= 200 && request.status < 300) resolve(result);
                    else reject(new Error(result.error || 'Could not upload clips.'));
                };
                request.onerror = () => reject(new Error('Network error while uploading clips.'));
                request.send(form);
            });

            files.forEach(file => URL.revokeObjectURL(file.previewUrl));
            setFiles([]);
            let job: {
                state: string;
                status: string;
                error?: string;
                result?: {
                    chapters: Chapter[];
                    reels: ReelCandidate[];
                    videoUrl: string;
                    videoDownloadUrl: string;
                    captionsUrl: string;
                };
            };
            do {
                await new Promise(resolve => window.setTimeout(resolve, 1000));
                const response = await fetch(`/api/jobs/${created.id}`);
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Could not retrieve job status.');
                job = result;
                setProcessingStatus(result.status);
                if (job.state === 'failed') throw new Error(job.error || 'Video processing failed.');
            } while (job.state === 'processing');

            if (!job.result) throw new Error('The video job completed without output files.');
            setChapters(job.result.chapters);
            setReels(job.result.reels);
            setVideoUrl(job.result.videoUrl);
            setVideoDownloadUrl(job.result.videoDownloadUrl);
            setCaptionsUrl(job.result.captionsUrl);
            setAppState(AppState.REVIEWING);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Video processing failed.');
            setAppState(AppState.CONFIGURING);
        }
    }, [files]);

    const handleDownloadAllReels = useCallback(() => {
        reels.forEach((reel, index) => {
            window.setTimeout(() => {
                const link = document.createElement('a');
                link.href = reel.downloadUrl;
                link.download = `${reel.title.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || `reel-${index + 1}`}.mp4`;
                document.body.appendChild(link);
                link.click();
                link.remove();
            }, index * 250);
        });
    }, [reels]);

    const renderContent = () => {
        switch (appState) {
            case AppState.UPLOADING:
            case AppState.CONFIGURING:
                 return (
                    <div className="container mx-auto px-4 py-8">
                        {files.length === 0 ? (
                           <FileUploader onFilesAdded={handleFilesAdded} onError={setErrorMessage} />
                        ) : (
                            <div className="max-w-3xl mx-auto">
                                <h2 className="text-2xl font-bold mb-4">Your Clips</h2>
                                <div className="space-y-3 mb-8">
                                    {files.map(f => <UploadedFileItem key={f.id} file={f} onRemove={handleRemoveFile} />)}
                                </div>
                                {appState === AppState.CONFIGURING && <ConfigurationScreen onStartProcessing={startProcessing} clipsCount={files.length} />}
                            </div>
                        )}
                    </div>
                );
            case AppState.PROCESSING:
                return <ProcessingScreen status={processingStatus} />;
            case AppState.REVIEWING:
                return <ReviewScreen chapters={chapters} reels={reels} videoUrl={videoUrl} videoDownloadUrl={videoDownloadUrl} captionsUrl={captionsUrl} onToggleFavorite={handleToggleFavoriteReel} onDownloadAllReels={handleDownloadAllReels} />;
            default:
                return null;
        }
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            <Header />
            <main>
                {errorMessage && <p role="alert" className="max-w-3xl mx-auto mt-6 px-4 text-center text-red-300">{errorMessage}</p>}
                {renderContent()}
            </main>
        </div>
    );
}