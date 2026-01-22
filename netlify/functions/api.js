// netlify/functions/api.js
// Serverless Backend for Clarity App
// Environment: Node.js 18+
// Env Vars Required: API_KEY

// 根据最新的 Google GenAI 指南，使用 gemini-3-flash-preview 处理此类文本任务
const MODEL_NAME = 'gemini-3-flash-preview';
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

/**
 * 辅助函数：构造 Google API 请求体
 */
function buildRequestBody(prompt, schema = null) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      // 如果提供了 Schema，强制模型输出 JSON
      responseMimeType: schema ? "application/json" : "text/plain",
    }
  };

  if (schema) {
    body.generationConfig.responseSchema = schema;
  }

  return body;
}

/**
 * 核心业务逻辑
 */
exports.handler = async function(event, context) {
  // 1. 安全与请求校验
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("Critical: API_KEY is missing in server environment.");
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Server configuration error (Missing API Key)." })
    };
  }

  try {
    const { action, input, qaPairs } = JSON.parse(event.body);

    if (!input || typeof input !== 'string') {
      return { statusCode: 400, body: JSON.stringify({ message: "Invalid input." }) };
    }

    // 2. 路由与 Prompt 构建
    let systemPrompt = "";
    let schema = null;

    if (action === 'fast') {
      // 快速模式：直接优化
      systemPrompt = `
        You are an expert prompt engineer. Your task is to transform the user's raw, unstructured idea into a single, high-quality, professional AI prompt in Simplified Chinese.
        
        Rules:
        1. Keep the intent of the original input.
        2. Add necessary structure, context, and tone.
        3. Do NOT output any conversational text. ONLY output the optimized prompt.
        4. If the input is too short, expand it reasonably.
        
        Raw Input: "${input}"
      `;
    } 
    else if (action === 'clarify_questions') {
      // 澄清模式第一步：生成问题 (强制 JSON 结构)
      systemPrompt = `
        Analyze the following user idea: "${input}"
        Identify 2-3 key ambiguities or missing details that would make the prompt better if clarified.
        Generate 2-3 multiple-choice questions to ask the user.
        
        Output MUST be valid JSON matching the schema.
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
                text: { type: "STRING", description: "The question text in Chinese" },
                options: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      id: { type: "STRING" },
                      label: { type: "STRING", description: "Option label in Chinese" },
                      value: { type: "STRING", description: "The value to use in the final prompt" }
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
      // 澄清模式第二步：最终生成
      const contextStr = (qaPairs || []).map(qa => `Question: ${qa.question}\nUser Choice: ${qa.answer}`).join("\n\n");
      systemPrompt = `
        You are an expert prompt engineer.
        Construct a final, highly optimized prompt based on the user's original idea and their clarification choices.
        
        Original Idea: "${input}"
        
        Clarifications:
        ${contextStr}
        
        Output:
        Return ONLY the final optimized prompt in Simplified Chinese. No markdown code blocks unless requested.
      `;
    } 
    else {
      return { statusCode: 400, body: JSON.stringify({ message: "Invalid action." }) };
    }

    // 3. 调用 Google Gemini API
    const apiUrl = `${BASE_URL}/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildRequestBody(systemPrompt, schema))
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google API Error:", response.status, errorText);
      throw new Error(`AI Service Unavailable: ${response.status}`);
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!resultText) {
      throw new Error("Empty response from AI.");
    }

    // 4. 处理返回数据
    let responseBody = {};
    if (action === 'clarify_questions') {
      try {
        // 尝试解析 JSON (虽然使用了 responseSchema，但多一层 try-catch 更安全)
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

  } catch (error) {
    console.error("Handler Error:", error);
    return {
      statusCode: 502, // Bad Gateway (upstream error)
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: error.message || "Internal Server Error" })
    };
  }
};
