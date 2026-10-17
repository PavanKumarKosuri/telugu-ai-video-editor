# AI Telugu Video Compiler

A Telugu-first creator studio with a React/Vite frontend and Node API for analyzing video clips, compiling a 720p story cut, centering social reels on detected highlights, reviewing captions, and exporting media.

## Requirements

- Node.js 22 or newer
- FFmpeg and FFprobe installed and available on `PATH`
- A Gemini API key with access to the Gemini Files API and `gemini-2.5-flash`

## Run locally

1. Install packages: `npm install`
2. Put `GEMINI_API_KEY=your-key` in `.env.local` (this file is ignored by Git).
3. In one terminal, run `npm run dev:server`.
4. In another terminal, run `npm run dev` and open the Vite URL (normally `http://localhost:3000`).

The Vite development server proxies `/api` requests to the local API on port 3001. For production, run `npm run build`, then `npm run server`; the API serves the built frontend and its endpoints on port 3001. Set `PORT` to change the API port.

Run unit tests with `npm test`.

## MVP behavior and limitations

- Upload up to five supported clips, each no larger than 500 MB. Jobs and generated outputs are stored temporarily on the server and removed after 24 hours; they are not backed up or shared across server instances.
- Gemini analyzes each clip for Telugu/English captions, chapter titles, and highlight timestamps. FFmpeg normalizes and concatenates all uploaded clips, extracts the selected highlight reels, generates chapter thumbnails, and writes an SRT caption file.
- Choose and reorder up to five clips, give the AI creative direction, pick reel aspect ratio, maximum duration and count, review a transcript, favorite highlights, and download the generated outputs.
- The long video is currently a 720p concatenation of the complete clips; it does not yet remove unwanted sections, burn captions into the video, or apply visual color-grade presets. Only uploaded custom music is mixed into the final video; the named music styles are not generated audio.
- Processing requires network access to Gemini. Keep the API key in the server environment; it is never embedded in the frontend bundle. Uploaded video is sent to Gemini for analysis.
- Use a private, persistent storage provider, authentication, quotas, and a background job queue before exposing this prototype to multiple users or deploying it publicly.
