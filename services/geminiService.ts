import { GoogleGenAI, Type } from "@google/genai";

// Initialize the Gemini AI client
// The API key is expected to be set in the environment variables
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const veoPromptSchema = {
  type: Type.OBJECT,
  properties: {
    prompt: { type: Type.STRING, description: "A concise, powerful, and highly descriptive main prompt for the video generation. Synthesize the most critical elements of the story into one compelling sentence." },
    keyword: { type: Type.ARRAY, items: { type: Type.STRING }, description: "An array of essential keywords from the story, including characters, objects, actions, and themes." },
    style: { type: Type.STRING, description: "The visual style. Examples: 'cinematic', 'anime', 'hyperrealistic', 'watercolor', '3D animation', 'vintage film'." },
    tone: { type: Type.STRING, description: "The emotional tone of the video. This should be based on the user's preference if provided, otherwise inferred from the context. Examples: 'dramatic', 'comedic', 'mysterious', 'epic', 'serene', 'suspenseful'." },
    camera: { type: Type.STRING, description: "The type of camera to simulate. Examples: 'DSLR', '8mm film', 'drone', 'security camera', 'handheld'." },
    motion: { type: Type.STRING, description: "The primary camera movement. This should be based on the user's preference if provided, otherwise inferred from the context. Examples: 'slow pan left', 'dolly zoom', 'fast tracking shot', 'static', 'whip pan'." },
    angle: { type: Type.STRING, description: "The camera angle. Examples: 'low angle', 'high angle', 'eye-level', 'dutch angle', 'bird's eye view'." },
    lens: { type: Type.STRING, description: "The type of lens to simulate. Examples: 'wide-angle', 'telephoto', 'macro', 'fisheye'." },
    lighting: { type: Type.STRING, description: "The lighting style. Examples: 'golden hour', 'neon noir', 'soft studio lighting', 'moonlight', 'dramatic shadows'." },
    audio: { type: Type.STRING, description: "Sound design, music, or dialogue. This should integrate the timed dialogue provided by the user. Examples: 'epic orchestral score and character speaks: \"Follow me!\"', 'ambient nature sounds'." },
    setting: { type: Type.STRING, description: "The general environment or setting. Examples: 'futuristic cityscape', 'enchanted forest', 'post-apocalyptic wasteland'." },
    place: { type: Type.STRING, description: "The specific location within the setting. Examples: 'a neon-lit noodle bar', 'a moss-covered ancient ruin', 'an abandoned subway station'." },
    time: { type: Type.STRING, description: "The time of day or era. Examples: 'dusk', 'midnight', '1980s', 'futuristic 2099'." },
    characters: { type: Type.ARRAY, items: { type: Type.STRING }, description: "An array of descriptions for the main characters involved." },
    plot_point: { type: Type.STRING, description: "A one-sentence summary of the core action or event, incorporating the action and dialogue timelines. Example: 'The knight walks while saying \"I will find it\", then points at the audience.'" },
    duration_second: { type: Type.INTEGER, description: "The estimated duration of the video in seconds. This should be automatically calculated from the latest end time found in either the action or dialogue timelines." },
    aspect_ratio: { type: Type.STRING, description: "The aspect ratio of the video. Examples: '16:9', '9:16', '1:1', '4:3'." },
    negative_prompt: { type: Type.STRING, description: "Elements to avoid in the generation. Examples: 'blurry, low quality, watermark, text, signature'." },
  },
  required: [
    "prompt", "keyword", "style", "tone", "camera", "motion", "angle", "lens", "lighting", "audio", "setting", "place", "time", "characters", "plot_point", "duration_second", "aspect_ratio", "negative_prompt"
  ]
};

interface Action {
    startTime: string;
    endTime: string;
    description: string;
}

interface TimedDialogue {
    startTime: string;
    endTime: string;
    dialogueText: string;
}

interface VeoPromptInput {
  actions: Action[];
  timedDialogues: TimedDialogue[];
  cameraMovement: string;
  tone: string;
  image?: {
    data: string; // base64 encoded string
    mimeType: string;
  }
}

export const generateVeoPrompt = async ({ actions, timedDialogues, image, cameraMovement, tone }: VeoPromptInput): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API key is missing. Please set the API_KEY environment variable.");
  }

  const hasValidAction = actions.some(a => a.description.trim());
  const hasValidDialogue = timedDialogues.some(d => d.dialogueText.trim());

  if (!hasValidAction && !hasValidDialogue && !image) {
    throw new Error("Action timeline, dialogue timeline, or an image is required.");
  }

  const parts: any[] = [];
  
  if (image) {
    parts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: image.data,
      },
    });
    parts.push({ text: "The user has provided the above image as a visual reference." });
  }

  if (hasValidAction) {
    const timeline = actions
        .filter(a => a.description.trim())
        .map(a => `- ${a.startTime || '0'}–${a.endTime || '?'} sec: ${a.description.trim()}`)
        .join('\n');
    parts.push({ text: `ACTION TIMELINE:\n${timeline}` });
  }

  if (hasValidDialogue) {
    const dialogueTimeline = timedDialogues
      .filter(d => d.dialogueText.trim())
      .map(d => `- ${d.startTime || '0'}–${d.endTime || '?'} sec: "${d.dialogueText.trim()}"`)
      .join('\n');
    parts.push({ text: `DIALOGUE TIMELINE (IN INDONESIAN):\n${dialogueTimeline}` });
  }


  if (cameraMovement && cameraMovement !== 'Automatic') {
    parts.push({ text: `CAMERA MOVEMENT PREFERENCE: ${cameraMovement}` });
  }

  if (tone && tone !== 'Automatic') {
    parts.push({ text: `TONE PREFERENCE: ${tone}` });
  }

  let systemInstruction = `You are an expert prompt engineer for the Gemini Veo video generation model. Your task is to analyze the provided timelines, image, and preferences, and break them down into a structured JSON format suitable for Veo. Adhere strictly to the provided JSON schema.
IMPORTANT LANGUAGE RULES:
1. All text values in the generated JSON (such as 'prompt', 'style', 'tone', 'camera', 'keyword', etc.) MUST be in English.
2. HOWEVER, for the 'audio' and 'plot_point' fields, any dialogue text taken from the 'DIALOGUE TIMELINE' MUST be preserved and written in its original language, which is Indonesian. For example, if the dialogue is "Mau pergi kemana?", the 'audio' field might be 'A character speaks: "Mau pergi kemana?"'.
OTHER RULES:
- You MUST use the 'ACTION TIMELINE' and 'DIALOGUE TIMELINE' to structure the 'plot_point' and overall 'prompt'.
- The 'duration_second' field in the JSON MUST be set to the latest end time found across both timelines.
- If a 'CAMERA MOVEMENT PREFERENCE' is provided, you MUST use it as the primary source for the 'motion' field. Otherwise, infer the best camera motion from the context.
- If a 'TONE PREFERENCE' is provided, you MUST use it as the primary source for the 'tone' field in the JSON. Otherwise, infer the best tone from the context.
- The 'audio' field should accurately incorporate the Indonesian dialogue from the 'DIALOGUE TIMELINE' along with any other implied sounds.`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: veoPromptSchema,
        systemInstruction: systemInstruction
      },
    });

    const jsonString = response.text;
    
    // Basic validation to ensure we got something that looks like JSON
    if (!jsonString.startsWith('{') && !jsonString.startsWith('[')) {
      throw new Error("The API did not return a valid JSON format.");
    }

    // Pretty-print the JSON
    const parsedJson = JSON.parse(jsonString);
    return JSON.stringify(parsedJson, null, 2);

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        return Promise.reject(`Failed to generate prompt: ${error.message}`);
    }
    return Promise.reject("An unknown error occurred while generating the prompt.");
  }
};