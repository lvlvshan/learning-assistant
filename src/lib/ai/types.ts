// ─── MinerU 配置 ─────────────────────────────────────────────

/** MinerU 精准解析 API 配置 */
export interface MinerUConfig {
  /** 从 mineru.net API 管理页面申请的 Token */
  token: string;
  /** 是否启用 MinerU 文档解析 */
  enabled: boolean;
}

// ─── AI 提供商配置 ─────────────────────────────────────────────

export interface AIProviderConfig {
  provider: "openai-compatible" | "ollama" | "custom";
  endpoint: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  enabled: boolean;
}

// 消息格式
export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

// AI 提供商接口
export interface IAIProvider {
  chat(messages: Message[]): Promise<string>;
}

// 知识点提取结果
export interface ExtractedKnowledgePoint {
  name: string;
  description: string;
  difficulty: "BASIC" | "INTERMEDIATE" | "ADVANCED";
  children?: ExtractedKnowledgePoint[];
}

export interface KnowledgeExtractionResult {
  knowledgePoints: ExtractedKnowledgePoint[];
}

// 题目生成配置
export interface QuestionGenerationConfig {
  knowledgePoints: { name: string; description: string; difficulty: string }[];
  count: number;
  bloomLevels: string[];
  types: string[];
}

// 生成的题目
export interface GeneratedQuestion {
  type: "MULTIPLE_CHOICE" | "TF" | "FILL_BLANK" | "SHORT_ANSWER";
  content: string;
  options: string[];
  correctAnswer: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  bloomLevel: string;
  explanation: string;
}

export interface QuestionGenerationResult {
  questions: GeneratedQuestion[];
}

// 答案评估结果
export interface AnswerEvaluation {
  isCorrect: boolean;
  score: number;
  analysis: string;
  suggestion: string;
}

export interface SessionAnalysisResult {
  overallScore: number;
  totalQuestions: number;
  correctCount: number;
  weakPoints: { knowledgePoint: string; masteryLevel: number; bloomLevels: string[] }[];
  strongPoints: string[];
  suggestions: string;
  nextRoundFocus: string[];
}

// AI 评审结果
export interface QuestionReviewResult {
  status: "APPROVED" | "NEEDS_REVIEW";
  score: number;        // 0-100 质量评分
  feedback: string;     // 总体评审意见
  issues: string[];     // 发现的问题
  suggestions: string;  // 改进建议
}
