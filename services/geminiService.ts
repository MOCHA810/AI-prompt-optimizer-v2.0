import { ClarificationResponse, ClarificationQuestion } from "../types";

// 使用原生 fetch 替代 SDK，以避免浏览器环境下的版本和兼容性问题
// 原生 fetch 更轻量且在纯前端环境更稳定

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// Helper to determine model based on task
// 使用当前最先进且公开可用的模型 Gemini 2.0 Flash
// 它比 1.5 Pro 更快更强，且符合“不使用 1.5 Flash”的要求
const MODEL_FAST = 'gemini-2.0-flash';
const MODEL_SMART = 'gemini-2.0-flash'; 

/**
 * 通用的 fetch 包装函数
 */
async function callGeminiAPI(
  apiKey: string,
  model: string,
  promptText: string,
  responseSchema?: any
): Promise<string> {
  // 移除可能导致 url 解析问题的空格
  const cleanKey = apiKey.trim();
  const url = `${BASE_URL}/models/${model}:generateContent?key=${cleanKey}`;

  const body: any = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {}
  };

  if (responseSchema) {
    body.generationConfig.responseMimeType = "application/json";
    body.generationConfig.responseSchema = responseSchema;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      // 关键修复：避免在 Netlify 等环境下因 Referrer 策略导致 API Key 校验失败
      // 如果 Key 没有设置 Referrer 限制，这通常能解决问题
      referrerPolicy: 'no-referrer'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // 提取最准确的错误信息
      const backendMessage = errorData.error?.message;
      const statusText = response.statusText;
      
      // 构造一个包含状态码的 Error，方便上层判断
      throw new Error(JSON.stringify({
        status: response.status,
        message: backendMessage || `请求失败 (${response.status} ${statusText})`
      }));
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("AI 未返回任何文本内容 (Empty Response)");
    }

    return text;
  } catch (error: any) {
    console.error("Gemini API Error details:", error);
    throw error; // 继续抛出，让 UI 层处理
  }
}

export const generateFastPrompt = async (userInput: string, apiKey: string): Promise<string> => {
  if (!apiKey) throw new Error("缺少 API Key");

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

  return callGeminiAPI(apiKey, MODEL_FAST, prompt);
};

export const generateClarificationQuestions = async (userInput: string, apiKey: string): Promise<ClarificationQuestion[]> => {
  if (!apiKey) throw new Error("缺少 API Key");

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
    5. Return valid JSON only with keys: "id", "text", "options" (array of "id", "label", "value").
  `;

  // Schema for structured output
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
                  value: { type: "STRING" },
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
  };

  const text = await callGeminiAPI(apiKey, MODEL_SMART, prompt, schema);

  try {
    const json = JSON.parse(text) as ClarificationResponse;
    return json.questions || [];
  } catch (e) {
    console.error("JSON Parse Error", e);
    throw new Error("解析澄清问题失败，AI 返回格式异常。");
  }
};

export const generateFinalClarifiedPrompt = async (
  originalInput: string,
  qaPairs: { question: string; answer: string }[],
  apiKey: string
): Promise<string> => {
  if (!apiKey) throw new Error("缺少 API Key");

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

  return callGeminiAPI(apiKey, MODEL_SMART, prompt);
};