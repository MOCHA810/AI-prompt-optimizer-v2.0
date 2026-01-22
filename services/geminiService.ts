import { ClarificationQuestion } from "../types";

// 指向 Netlify Function 的相对路径
const API_ENDPOINT = "/.netlify/functions/api";

/**
 * 统一的后端请求处理
 * 前端只负责发送 action 和 input，不接触 Key，不接触 Prompt 细节
 */
async function callBackend(payload: any): Promise<any> {
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      // 捕获后端返回的错误信息
      throw new Error(data.message || `请求失败 (${response.status})`);
    }

    return data;
  } catch (error: any) {
    console.error("API Call Failed:", error);
    throw error;
  }
}

export const generateFastPrompt = async (userInput: string): Promise<string> => {
  const data = await callBackend({
    action: 'fast',
    input: userInput
  });
  return data.result;
};

export const generateClarificationQuestions = async (userInput: string): Promise<ClarificationQuestion[]> => {
  const data = await callBackend({
    action: 'clarify_questions',
    input: userInput
  });
  return data.questions || [];
};

export const generateFinalClarifiedPrompt = async (
  originalInput: string,
  qaPairs: { question: string; answer: string }[]
): Promise<string> => {
  const data = await callBackend({
    action: 'clarify_final',
    input: originalInput,
    qaPairs: qaPairs
  });
  return data.result;
};