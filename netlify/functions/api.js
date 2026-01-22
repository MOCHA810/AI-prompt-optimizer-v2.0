// netlify/functions/api.js
// 运行环境：Node.js 18+ (Netlify Default)
// 功能：作为中间层代理，隐藏 API Key，处理 CORS，组装 Prompt

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
// 使用目前公开可用的 Gemini 2.0 Flash Experimental 版本
// 如果该模型不可用，可回退至 'gemini-1.5-pro'
const MODEL_NAME = 'gemini-2.0-flash-exp';

/**
 * 核心调用函数：后端负责与 Google 通信
 */
async function callGemini(apiKey, prompt, schema = null) {
  const url = `${BASE_URL}/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
  
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7
    }
  };

  if (schema) {
    body.generationConfig.responseMimeType = "application/json";
    body.generationConfig.responseSchema = schema;
  }

  // 使用 Node.js 原生 fetch (Node 18+)
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    // 透传 Google 的错误信息，但在前端显示时会脱敏
    throw new Error(errData.error?.message || `Google API Error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!text) {
    throw new Error("AI returned empty response");
  }

  return text;
}

exports.handler = async function(event, context) {
  // 1. 安全检查：仅允许 POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // 2. 环境检查：获取 API Key
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("Critical Error: API_KEY is missing in Netlify Environment Variables.");
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Server Configuration Error: API Key not found." })
    };
  }

  try {
    // 3. 解析请求
    if (!event.body) throw new Error("Missing request body");
    const { action, input, qaPairs } = JSON.parse(event.body);

    if (!input) throw new Error("Missing 'input' field");

    let resultText = "";
    let resultJson = null;

    // 4. 路由逻辑：根据 action 执行不同的 Prompt 工程
    // --- 快速模式 ---
    if (action === 'fast') {
      const prompt = `
        Act as an expert prompt engineer. 
        Transform the following raw user input into a single, high-quality, structured AI prompt in Simplified Chinese.
        
        Raw Input: "${input}"
        
        Rules:
        1. Output ONLY the optimized prompt. No chat.
        2. Professional, neutral tone.
        3. Structure clearly.
      `;
      resultText = await callGemini(apiKey, prompt);
    } 
    
    // --- 澄清模式：生成问题 ---
    else if (action === 'clarify_questions') {
      const prompt = `
        Analyze this input: "${input}"
        Identify up to 3 ambiguous strategic decisions.
        Generate 2-3 multiple choice questions in Simplified Chinese to clarify direction.
        
        Output JSON format:
        {
          "questions": [
            { "id": "q1", "text": "Question?", "options": [{ "id": "o1", "label": "Label", "value": "Value" }] }
          ]
        }
      `;
      
      const schema = {
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

      resultText = await callGemini(apiKey, prompt, schema);
      
      try {
        resultJson = JSON.parse(resultText);
      } catch (e) {
        console.error("JSON Parse Fail", resultText);
        throw new Error("AI failed to return valid JSON");
      }
    }

    // --- 澄清模式：最终生成 ---
    else if (action === 'clarify_final') {
      const qaContext = (qaPairs || []).map(qa => `Q: ${qa.question}\nSelected: ${qa.answer}`).join("\n\n");
      const prompt = `
        Act as an expert prompt engineer.
        Create a final optimized prompt based on Input and Strategic Choices.
        
        Input: "${input}"
        Choices:
        ${qaContext}
        
        Output Simplified Chinese prompt only. Markdown format.
      `;
      resultText = await callGemini(apiKey, prompt);
    } 
    
    else {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ message: "Unknown action type" }) 
      };
    }

    // 5. 成功响应
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(resultJson || { result: resultText })
    };

  } catch (error) {
    console.error("Function Execution Error:", error);
    
    // 区分系统错误和业务错误
    const statusCode = error.message.includes("Google API Error") ? 502 : 400;
    
    return {
      statusCode: statusCode,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: error.message || "Internal Server Error" })
    };
  }
};