export enum AppMode {
  FAST = 'FAST',
  CLARIFY = 'CLARIFY',
}

export enum AppStatus {
  IDLE = 'IDLE',
  GENERATING_QUESTIONS = 'GENERATING_QUESTIONS', // Clarify Mode Step 1
  AWAITING_INPUT = 'AWAITING_INPUT',             // Clarify Mode Step 2
  GENERATING_RESULT = 'GENERATING_RESULT',       // Final Step
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface QuestionOption {
  id: string;
  label: string;
  value: string;
}

export interface ClarificationQuestion {
  id: string;
  text: string;
  options: QuestionOption[];
}

export interface ClarificationResponse {
  questions: ClarificationQuestion[];
}

export interface GenerationResult {
  prompt: string;
}