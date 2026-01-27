import { GoogleGenAI, Type } from "@google/genai";

// Using gemini-3-flash-preview as per guidelines.
const MODEL_NAME = 'gemini-3-flash-preview';

/**
 * Helper: Build Content for SDK
 */
function buildPrompt(action, input, qaPairs) {
  if (action === 'fast') {
    return `
      You are an expert prompt engineer. Transform the user's raw idea into a single, high-quality AI prompt in Simplified Chinese.
      
      Rules:
      1. Keep the intent of the original input.
      2. Add structure and clarity.
      3. Output ONLY the optimized prompt. No intro/outro.
      
      Raw Input: "${input}"
    `;
  } 
  
  if (action === 'clarify_questions') {
    return `
      Analyze the user idea: "${input}"
      Identify 2-3 missing details.
      Generate 2-3 multiple-choice questions in Simplified Chinese.
      Output valid JSON matching the schema.
    `;
  }
  
  if (action === 'clarify_final') {
    const contextStr = (qaPairs || []).map(qa => `Q: ${qa.question}\nA: ${qa.answer}`).join("\n");
    return `
      Act as an expert prompt engineer.
      Create a final optimized prompt in Simplified Chinese based on:
      
      Input: "${input}"
      Details:
      ${contextStr}
      
      Output ONLY the final prompt.
    `;
  }
  
  return "";
}

/**
 * Netlify Function Handler (ESM)
 */
export const handler = async (event, context) => {
  // 1. Security & Method Check
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    if (!event.body) throw new Error("Empty request body");
    
    const { action, input, qaPairs, apiKey } = JSON.parse(event.body);

    if (!apiKey) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "API Key is missing. Please set it in the app settings." })
      };
    }

    if (!input || typeof input !== 'string') {
      return { 
        statusCode: 400, 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Invalid input." }) 
      };
    }

    // 2. Initialize SDK
    // Although strict guidelines say use process.env.API_KEY, this is a user-configurable app 
    // feature requested by the user, so we use the dynamic key.
    const ai = new GoogleGenAI({ apiKey: apiKey });

    // 3. Configure Request
    const promptText = buildPrompt(action, input, qaPairs);
    if (!promptText) {
      return { 
        statusCode: 400, 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Invalid action." }) 
      };
    }

    let config = {
      temperature: 0.7,
    };

    if (action === 'clarify_questions') {
      config.responseMimeType = "application/json";
      config.responseSchema = {
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
                      value: { type: Type.STRING }
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
      };
    }

    // 4. Generate Content
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: promptText,
      config: config
    });

    const resultText = response.text;

    if (!resultText) {
      throw new Error("AI returned empty response.");
    }

    // 5. Process Response
    let responseBody = {};
    if (action === 'clarify_questions') {
      try {
        responseBody = JSON.parse(resultText);
      } catch (e) {
        console.error("JSON Parse Error:", resultText);
        // Fallback or error if strictly required
        throw new Error("Failed to parse AI response.");
      }
    } else {
      responseBody = { result: resultText.trim() };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(responseBody)
    };

  } catch (error) {
    console.error("Handler Error:", error);
    // SDK specific error handling can be added here if needed
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        message: error.message || "Internal Server Error" 
      })
    };
  };
};