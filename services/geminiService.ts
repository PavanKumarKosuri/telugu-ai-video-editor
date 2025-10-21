
import { GoogleGenAI, Type } from "@google/genai";
import { EditingPlan } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export async function getEditingPlan(prompt: string): Promise<EditingPlan> {
  try {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Based on the following user request, generate a JSON object outlining a video editing plan. The user wants to compile multiple video clips into a long-form video and generate reels. User request: "${prompt}"`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    vlogTitle: {
                        type: Type.STRING,
                        description: "A catchy, SEO-friendly title for the final long-form video, in Telugu if possible.",
                    },
                    musicStyle: {
                        type: Type.STRING,
                        description: "A short description of the suggested background music style (e.g., 'Upbeat Lofi', 'Cinematic Orchestral', 'Telugu Folk Fusion').",
                    },
                    reelsToGenerate: {
                        type: Type.INTEGER,
                        description: "The number of short-form reels to create from the content.",
                    },
                    keyMoments: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "A list of 3-5 key moments or topics the AI should focus on for highlights and reels (e.g., 'Food tasting part', 'Funny conversation about movies', 'Drone shots').",
                    },
                    colorGrade: {
                        type: Type.STRING,
                        description: "A suggested color grading style (e.g., 'Cinematic Warm', 'Vibrant Social Media', 'Natural Look').",
                    },
                    reelAspectRatio: {
                        type: Type.STRING,
                        description: "The suggested aspect ratio for the reels. Must be one of: '9:16', '1:1', or '16:9'.",
                    },
                    reelDuration: {
                        type: Type.INTEGER,
                        description: "The suggested duration in seconds for the reels. Must be one of: 15, 30, or 60.",
                    }
                },
                required: ["vlogTitle", "musicStyle", "reelsToGenerate", "keyMoments", "colorGrade", "reelAspectRatio", "reelDuration"],
            },
        },
    });

    const jsonString = response.text.trim();
    const plan: EditingPlan = JSON.parse(jsonString);
    // Basic validation for enum-like fields
    if (!['9:16', '1:1', '16:9'].includes(plan.reelAspectRatio)) {
        plan.reelAspectRatio = '9:16';
    }
    if (![15, 30, 60].includes(plan.reelDuration)) {
        plan.reelDuration = 30;
    }
    return plan;
  } catch (error) {
    console.error("Error fetching editing plan from Gemini:", error);
    // Return a fallback plan in case of an API error
    return {
        vlogTitle: "My Awesome Telugu Vlog",
        musicStyle: "Upbeat and Modern",
        reelsToGenerate: 3,
        keyMoments: ["Introduction", "Main Event", "Conclusion"],
        colorGrade: "Natural Look",
        reelAspectRatio: '9:16',
        reelDuration: 30,
    };
  }
}