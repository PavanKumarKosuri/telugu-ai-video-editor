import { GoogleGenAI, Type } from '@google/genai';

let ai;
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    chapters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          start: { type: Type.NUMBER },
          end: { type: Type.NUMBER },
        },
        required: ['title', 'start', 'end'],
      },
    },
    captions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          start: { type: Type.NUMBER },
          end: { type: Type.NUMBER },
          text: { type: Type.STRING },
        },
        required: ['start', 'end', 'text'],
      },
    },
    highlights: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          hook: { type: Type.STRING },
          start: { type: Type.NUMBER },
          end: { type: Type.NUMBER },
        },
        required: ['title', 'hook', 'start', 'end'],
      },
    },
  },
  required: ['chapters', 'captions', 'highlights'],
};

export async function analyzeVideo(filePath, mimeType, duration, prompt) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Set GEMINI_API_KEY in .env.local before processing videos.');
  }

  ai ||= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const uploaded = await ai.files.upload({
    file: filePath,
    config: { mimeType },
  });

  try {
    let readyFile = uploaded;
    const deadline = Date.now() + 5 * 60 * 1000;

    while (readyFile.state === 'PROCESSING' && Date.now() < deadline) {
      await sleep(2_000);
      readyFile = await ai.files.get({ name: uploaded.name });
    }

    if (readyFile.state !== 'ACTIVE') {
      throw new Error(`Gemini could not process ${uploaded.displayName || 'the uploaded clip'}.`);
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          { fileData: { fileUri: readyFile.uri, mimeType: readyFile.mimeType } },
          {
            text: `Analyze this video clip. ${prompt ? `Editing request: ${prompt}` : ''}\n` +
              `Return accurate timestamps in seconds, within the ${duration.toFixed(2)}-second clip. ` +
              'Detect spoken dialogue and transcribe it faithfully; use Telugu script for Telugu speech. ' +
              'Create concise topic chapters, caption cues (short readable phrases, normally 1-5 seconds), and up to 5 compelling highlight moments. ' +
              'Do not invent dialogue or events. If speech is unclear, omit that caption.',
          },
        ],
      }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: analysisSchema,
      },
    });

    return JSON.parse(response.text);
  } finally {
    if (uploaded.name) {
      await ai.files.delete({ name: uploaded.name }).catch(() => {});
    }
  }
}
