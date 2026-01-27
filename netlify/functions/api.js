// netlify/functions/api.js
// Serverless Backend for Clarity App
// Environment: Node.js 18+
// Env Vars Required: API_KEY

// Using gemini-3-flash-preview as per guidelines.
const MODEL_NAME = 'gemini-3-flash-preview';
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Helper: Build Google API Request Body
 */
function buildRequestBody(prompt, schema = null) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
    }
  };

  // Only set responseMimeType if we strictly need JSON.
  if (schema) {
    body.generationConfig.responseMimeType = "application/json";
    body.generationConfig.responseSchema = schema;
  }

  return body;
}

/**
 * Core Logic
 */
exports.handler = async function(event, context) {
  // 1. Security & Method Check
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("Critical: API_KEY is missing in server environment.");
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Server configuration error (Missing API Key)." })
    };
  }

  try {
    // Parse Body
    if (!event.body) throw new Error("Empty request body");
    const { action, input, qaPairs } = JSON.parse(event.body);

    if (!input || typeof input !== 'string') {
      return { 
        statusCode: 400, 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Invalid input." }) 
      };
    }

    // 2. Route & Prompt Construction
    let systemPrompt = "";
    let schema = null;

    if (action === 'fast') {
      systemPrompt = `
        You are an expert prompt engineer. Transform the user's raw idea into a single, high-quality AI prompt in Simplified Chinese.
        
        Rules:
        1. Keep the intent of the original input.
        2. Add structure and clarity.
        3. Output ONLY the optimized prompt. No intro/outro.
        
        Raw Input: "${input}"
      `;
    } 
    else if (action === 'clarify_questions') {
      systemPrompt = `
        Analyze the user idea: "${input}"
        Identify 2-3 missing details.
        Generate 2-3 multiple-choice questions in Simplified Chinese.
        Output valid JSON matching the schema.
      `;
      
      schema = {
        type: "OBJECT",
        properties: {
          questions: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                id: { type: "STRING" },
                text: { type: "STRING" },
                options: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      id: { type: "STRING" },
                      label: { type: "STRING" },
                      value: { type: "STRING" }
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
    else if (action === 'clarify_final') {
      const contextStr = (qaPairs || []).map(qa => `Q: ${qa.question}\nA: ${qa.answer}`).join("\n");
      systemPrompt = `
        Act as an expert prompt engineer.
        Create a final optimized prompt in Simplified Chinese based on:
        
        Input: "${input}"
        Details:
        ${contextStr}
        
        Output ONLY the final prompt.
      `;
    } 
    else {
      return { 
        statusCode: 400, 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Invalid action." }) 
      };
    }

    // 3. Call Google Gemini API
    const apiUrl = `${BASE_URL}/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
    
    // Set a timeout for the upstream request to avoid Netlify function timeout hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRequestBody(systemPrompt, schema)),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google API Error:", response.status, errorText);
        throw new Error(`AI Service Error: ${response.status}`);
      }

      const data = await response.json();
      const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!resultText) {
        throw new Error("AI returned empty response.");
      }

      // 4. Process Response
      let responseBody = {};
      if (action === 'clarify_questions') {
        try {
          responseBody = JSON.parse(resultText);
        } catch (e) {
          console.error("JSON Parse Error:", resultText);
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

    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }

  } catch (error) {
    console.error("Handler Error:", error);
    const isTimeout = error.name === 'AbortError';
    return {
      statusCode: isTimeout ? 504 : 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        message: isTimeout ? "AI Processing Timeout" : (error.message || "Internal Server Error") 
      })
    };
  };