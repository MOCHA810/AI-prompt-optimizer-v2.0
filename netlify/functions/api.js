const API_ENDPOINT = "https://api.deepseek.com/chat/completions";
const MODEL_NAME = "deepseek-chat";

/**
 * Helper: Build Messages for OpenAI/DeepSeek Format
 */
function buildMessages(action, input, qaPairs) {
  if (action === 'fast') {
    return [
      {
        role: "system",
        content: `You are an expert prompt engineer. Transform the user's raw idea into a single, high-quality AI prompt in Simplified Chinese.
Rules:
1. Keep the intent of the original input.
2. Add structure and clarity.
3. Output ONLY the optimized prompt. No intro/outro.`
      },
      {
        role: "user",
        content: `Raw Input: "${input}"`
      }
    ];
  } 
  
  if (action === 'clarify_questions') {
    return [
      {
        role: "system",
        content: `You are a helpful assistant. Analyze the user idea and identify 2-3 missing details. 
Generate 2-3 multiple-choice questions in Simplified Chinese to clarify these details.
IMPORTANT: You must output ONLY valid JSON matching this structure:
{
  "questions": [
    {
      "id": "q1",
      "text": "Question text here",
      "options": [
        { "id": "o1", "label": "Option label", "value": "Option value for prompt" }
      ]
    }
  ]
}`
      },
      {
        role: "user",
        content: `User idea: "${input}"`
      }
    ];
  }
  
  if (action === 'clarify_final') {
    const contextStr = (qaPairs || []).map(qa => `Q: ${qa.question}\nA: ${qa.answer}`).join("\n");
    return [
      {
        role: "system",
        content: "You are an expert prompt engineer. Create a final optimized prompt in Simplified Chinese based on the user input and clarified details. Output ONLY the final prompt."
      },
      {
        role: "user",
        content: `Input: "${input}"\n\nClarified Details:\n${contextStr}`
      }
    ];
  }
  
  return [];
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

    // 2. Build Messages
    const messages = buildMessages(action, input, qaPairs);
    if (!messages.length) {
      return { 
        statusCode: 400, 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Invalid action." }) 
      };
    }

    // 3. Prepare DeepSeek API Request
    const isJsonMode = action === 'clarify_questions';
    
    console.log(`Calling DeepSeek: ${MODEL_NAME}, Action: ${action}`);

    // Netlify functions timeout at 10s. We race against 9s.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          messages: messages,
          temperature: 1.2, // DeepSeek recommends slightly higher temp
          response_format: isJsonMode ? { type: "json_object" } : { type: "text" },
          stream: false
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        console.error("DeepSeek API Error:", errText);
        throw new Error(`DeepSeek API Error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("DeepSeek returned empty content.");
      }

      // 4. Process Response to match Frontend Expectations
      let responseBody = {};
      
      if (isJsonMode) {
        try {
          // DeepSeek sometimes wraps JSON in markdown blocks like ```json ... ```
          // We need to clean it just in case, though response_format: json_object usually handles it.
          const cleanJson = content.replace(/```json\n?|```/g, '').trim();
          responseBody = JSON.parse(cleanJson);
          
          // Validate basic structure
          if (!responseBody.questions || !Array.isArray(responseBody.questions)) {
             throw new Error("Invalid JSON structure from AI");
          }
        } catch (e) {
          console.error("JSON Parse Error:", content);
          throw new Error("Failed to parse AI response as JSON.");
        }
      } else {
        responseBody = { result: content.trim() };
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
    console.error("Handler Failure:", error);
    
    // Distinguish between timeout (AbortError) and other errors
    const isTimeout = error.name === 'AbortError' || (error.message && error.message.includes("Timed Out"));
    
    return {
      statusCode: isTimeout ? 504 : 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        message: isTimeout ? "Request timed out (DeepSeek is busy)" : (error.message || "Internal Server Error") 
      })
    };
  };
};