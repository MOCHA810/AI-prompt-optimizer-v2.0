import { GoogleGenAI, Type } from "@google/genai";
import { ClarificationResponse, ClarificationQuestion } from "../types";

const apiKey = process.env.API_KEY || '';

// Initialize client only when needed to adhere to lifecycle best practices
const getClient = () => new GoogleGenAI({ apiKey });

// Helper to determine model based on complexity
const MODEL_FAST = 'gemini-3-flash-preview';
const MODEL_SMART = 'gemini-3-pro-preview';

export const generateFastPrompt = async (userInput: string): Promise<string> => {
  if (!apiKey) throw new Error("API Key missing");
  const ai = getClient();

  const prompt = `
    Act as an expert prompt engineer. 
    Transform the following raw, potentially unstructured user input into a single, high-quality, structured AI prompt in Chinese.
    
    Rules:
    1. Output ONLY the optimized prompt in Simplified Chinese. No introductory text.
    2. Use professional, neutral, and clear language.
    3. Remove emotional or filler language.
    4. Structure with clear headers or bullet points if necessary.
    5. Do not ask for clarification; make reasonable professional assumptions.

    Raw Input:
    "${userInput}"
  `;

  const response = await ai.models.generateContent({
    model: MODEL_FAST,
    contents: prompt,
  });

  return response.text || "无法生成指令。";
};

export const generateClarificationQuestions = async (userInput: string): Promise<ClarificationQuestion[]> => {
  if (!apiKey) throw new Error("API Key missing");
  const ai = getClient();

  const prompt = `
    Analyze the following user input for an AI task. 
    Perform an implicit clarification to smooth out rough edges, then identify up to 3 CRITICAL strategic decisions that are ambiguous.
    Generate 2-3 multiple choice questions that will help define the direction, style, or goal of the final prompt.

    User Input: "${userInput}"

    Requirements:
    1. Maximum 3 questions.
    2. Questions must be high-level strategic (e.g., Tone, Depth, Format), not trivial.
    3. Options must be mutually exclusive and significantly distinct.
    4. ALL text (questions and options) MUST be in Simplified Chinese.
    5. Return valid JSON only.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_SMART,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                text: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      label: { type: Type.STRING },
                      value: { type: Type.STRING },
                    },
                    required: ["id", "label", "value"],
                  },
                },
              },
              required: ["id", "text", "options"],
            },
          },
        },
        required: ["questions"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");

  try {
    const json = JSON.parse(text) as ClarificationResponse;
    return json.questions;
  } catch (e) {
    console.error("JSON Parse Error", e);
    throw new Error("Failed to parse clarification questions.");
  }
};

export const generateFinalClarifiedPrompt = async (
  originalInput: string,
  qaPairs: { question: string; answer: string }[]
): Promise<string> => {
  if (!apiKey) throw new Error("API Key missing");
  const ai = getClient();

  const qaContext = qaPairs.map(qa => `Q: ${qa.question}\nChoice: ${qa.answer}`).join("\n\n");

  const prompt = `
    Act as an expert prompt engineer.
    
    Task: Create a final, highly optimized prompt based on the User's Original Input and their Strategic Choices.

    Original Input:
    "${originalInput}"

    Strategic Choices:
    ${qaContext}

    Output Requirements:
    1. Produce a single, cohesive, ready-to-use prompt in Simplified Chinese.
    2. Incorporate the strategic choices naturally into the instructions.
    3. Use a clean, structured format (Markdown).
    4. Tone: Professional, direct, and sophisticated.
    5. Do not explain your reasoning. Output ONLY the final prompt.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_SMART,
    contents: prompt,
  });

  return response.text || "无法生成最终指令。";
};