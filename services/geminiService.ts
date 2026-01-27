import { ClarificationQuestion } from "../types";

// Netlify Function Endpoint
const BACKEND_URL = "/.netlify/functions/api";

const STORAGE_KEY = 'clarity_gemini_key';

interface ApiError {
  message: string;
}

/**
 * Fetch with Timeout
 * Handles communication with the Netlify backend.
 */
async function postToBackend<T>(payload: object): Promise<T> {
  const apiKey = localStorage.getItem(STORAGE_KEY);
  
  if (!apiKey) {
    throw new Error("请先点击右上角设置您的 Gemini API Key");
  }

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 20000);

  try {
    // We include the apiKey in the payload
    const finalPayload = { ...payload, apiKey };

    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache' 
      },
      body: JSON.stringify(finalPayload),
      signal: controller.signal
    });
    clearTimeout(id);

    const data = await response.json().catch(() => ({ message: "Invalid JSON response" }));

    if (!response.ok) {
      const errorMessage = (data as ApiError).message || `Server Error: ${response.status}`;
      throw new Error(errorMessage);
    }

    return data as T;
  } catch (error: any) {
    clearTimeout(id);
    console.error("Backend Request Failed:", error);
    
    if (error.name === 'AbortError') {
      throw new Error("请求超时，请重试。");
    }
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error("网络连接失败，请检查您的网络设置。");
    }
    throw error;
  }
}

// --- Business Methods ---

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