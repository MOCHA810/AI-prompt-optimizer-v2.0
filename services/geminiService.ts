import { GoogleGenAI, Type } from "@google/genai";
import { ClarificationQuestion } from "../types";

// Initialize the SDK strictly with process.env.API_KEY as per Google AI Studio environment guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Use Gemini 3 Flash Preview for best performance and structured output
const MODEL_NAME = 'gemini-3-flash-preview';

/**
 * 1. Fast Generation Mode
 * Directly optimizes the user prompt.
 */
export const generateFastPrompt = async (userInput: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `You are an expert prompt engineer. Your task is to transform the user's raw, unstructured idea into a single, high-quality, professional AI prompt in Simplified Chinese.

Rules:
1. Keep the intent of the original input.
2. Add necessary structure, context, and tone.
3. Do NOT output any conversational text. ONLY output the optimized prompt.
4. If the input is too short, expand it reasonably.

Raw Input: "${userInput}"`,
    });

    return response.text || "生成失败，请重试。";
  } catch (error) {
    console.error("Fast Prompt Error:", error);
    throw new Error("AI 服务暂时不可用，请稍后重试。");
  }
};

/**
 * 2. Clarification Mode - Step 1: Generate Questions
 * Uses JSON Schema to force structured output.
 */
export const generateClarificationQuestions = async (userInput: string): Promise<ClarificationQuestion[]> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Analyze the following user idea: "${userInput}"
Identify 2-3 key ambiguities or missing details that would make the prompt better if clarified.
Generate 2-3 multiple-choice questions to ask the user in Simplified Chinese.`,
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
                  text: { type: Type.STRING, description: "The question text in Chinese" },
                  options: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        label: { type: Type.STRING, description: "Option label in Chinese" },
                        value: { type: Type.STRING, description: "The value to use in the final prompt" }
                      },
                      required: ["id", "label", "value"]
                    }
                  }
                },
                required: ["id", "text", "options"]
              }
            }
          },
          required: ["questions"]
        },
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Empty response from AI");
    
    const data = JSON.parse(jsonText);
    return data.questions || [];
  } catch (error) {
    console.error("Clarification Questions Error:", error);
    throw new Error("无法分析您的输入，请尝试更详细的描述。");
  }
};

/**
 * 3. Clarification Mode - Step 2: Final Generation
 * Combines original input and answers to generate the final prompt.
 */
export const generateFinalClarifiedPrompt = async (
  originalInput: string,
  qaPairs: { question: string; answer: string }[]
): Promise<string> => {
  try {
    const contextStr = qaPairs.map(qa => `Question: ${qa.question}\nUser Choice: ${qa.answer}`).join("\n\n");
    
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `You are an expert prompt engineer.
Construct a final, highly optimized prompt in Simplified Chinese based on the user's original idea and their clarification choices.

Original Idea: "${originalInput}"

Clarifications:
${contextStr}

Output:
Return ONLY the final optimized prompt in Simplified Chinese.`,
    });

    return response.text || "生成最终指令失败。";
  } catch (error) {
    console.error("Final Prompt Error:", error);
    throw new Error("生成失败，请重试。");
  }
};
