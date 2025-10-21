export enum AppState {
  UPLOADING = 'UPLOADING',
  CONFIGURING = 'CONFIGURING',
  PROCESSING = 'PROCESSING',
  REVIEWING = 'REVIEWING',
}

export interface VideoFile {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl: string;
  progress: number;
}

export interface Chapter {
  id:string;
  title: string;
  startTime: string;
  endTime: string;
  thumbnailUrl: string;
}

export interface ReelCandidate {
  id: string;
  title: string;
  duration: number;
  aspectRatio: '9:16' | '1:1' | '16:9';
  previewUrl: string;
  hook: string;
  isFavorite: boolean;
}

export interface EditingPlan {
  vlogTitle: string;
  musicStyle: string;
  reelsToGenerate: number;
  keyMoments: string[];
  colorGrade: string;
  customMusicUrl?: string;
  reelAspectRatio: '9:16' | '1:1' | '16:9';
  reelDuration: 15 | 30 | 60;
}