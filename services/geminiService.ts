import { ClarificationQuestion } from "../types";

// 严格指向 Netlify Function 路径
const BACKEND_URL = "/.netlify/functions/api";

interface ApiError {
  message: string;
}

/**
 * 基础 Fetch 包装器
 * 负责与 Netlify Function 通信，并处理 HTTP 错误
 */
async function postToBackend<T>(payload: object): Promise<T> {
  try {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 防止一些浏览器插件干扰
        'Cache-Control': 'no-cache' 
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      // 提取后端返回的错误信息
      const errorMessage = (data as ApiError).message || `Server Error: ${response.status}`;
      throw new Error(errorMessage);
    }

    return data as T;
  } catch (error: any) {
    // 区分网络错误和 API 错误
    console.error("Backend Request Failed:", error);
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error("网络连接失败，请检查您的网络设置。");
    }
    throw error;
  }
}

// --- 业务方法 ---

export const generateFastPrompt = async (userInput: string): Promise<string> => {
  const data = await postToBackend<{ result: string }>({
    action: 'fast',
    input: userInput
  });
  return data.result;
};

export const generateClarificationQuestions = async (userInput: string): Promise<ClarificationQuestion[]> => {
  const data = await postToBackend<{ questions: ClarificationQuestion[] }>({
    action: 'clarify_questions',
    input: userInput
  });
  return data.questions || [];
};

export const generateFinalClarifiedPrompt = async (
  originalInput: string,
  qaPairs: { question: string; answer: string }[]
): Promise<string> => {
  const data = await postToBackend<{ result: string }>({
    action: 'clarify_final',
    input: originalInput,
    qaPairs: qaPairs
  });
  return data.result;
};
