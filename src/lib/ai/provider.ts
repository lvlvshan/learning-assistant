import { IAIProvider, AIProviderConfig, Message } from "./types";
import { OpenAICompatibleProvider } from "./openai";
import { prisma } from "../prisma";

let cachedProvider: IAIProvider | null = null;
let cachedConfigKey: string = "";

// 从数据库获取 AI 配置
async function getConfig(): Promise<AIProviderConfig | null> {
  const record = await prisma.systemConfig.findUnique({ where: { key: "ai-config" } });
  if (!record) return null;
  return JSON.parse(record.value) as AIProviderConfig;
}

// 创建 AI 提供商实例（工厂模式）
function createProvider(config: AIProviderConfig): IAIProvider {
  switch (config.provider) {
    case "openai-compatible":
    case "ollama":
      return new OpenAICompatibleProvider(config);
    case "custom":
    default:
      return new OpenAICompatibleProvider(config);
  }
}

// 获取 AI 提供商实例（带缓存）
export async function getAIProvider(): Promise<IAIProvider | null> {
  const config = await getConfig();
  if (!config || !config.enabled || !config.endpoint) return null;

  const configKey = JSON.stringify(config);
  if (configKey !== cachedConfigKey) {
    cachedProvider = createProvider(config);
    cachedConfigKey = configKey;
  }

  return cachedProvider;
}

// 检查 AI 是否可用
export async function isAIAvailable(): Promise<boolean> {
  const config = await getConfig();
  return !!(config?.enabled && config?.endpoint);
}

// 调用 AI（带 JSON 输出要求）
export async function chatWithJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  maxTokensOverride?: number
): Promise<T> {
  const provider = await getAIProvider();
  if (!provider) {
    throw new Error("AI 服务未配置，请联系管理员设置 AI 提供商");
  }

  const messages: Message[] = [
    { role: "system", content: systemPrompt + "\n请严格返回 JSON 格式，不要包含 markdown 代码块标记。" },
    { role: "user", content: userPrompt },
  ];

  const response = await provider.chat(messages, maxTokensOverride);

  // 清理响应（去掉可能的 markdown 代码块标记）
  let cleanResponse = response.trim();
  if (cleanResponse.startsWith("```")) {
    cleanResponse = cleanResponse.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }

  // 修复常见 JSON 语法错误：尾随逗号、缺失闭合括号
  cleanResponse = cleanResponse.replace(/,\s*([}\]])/g, "$1");
  // 补全缺失的闭合括号/大括号
  const openBraces = (cleanResponse.match(/{/g) || []).length;
  const closeBraces = (cleanResponse.match(/}/g) || []).length;
  const openBrackets = (cleanResponse.match(/\[/g) || []).length;
  const closeBrackets = (cleanResponse.match(/\]/g) || []).length;
  if (openBraces > closeBraces) {
    cleanResponse += "}".repeat(openBraces - closeBraces);
  }
  if (openBrackets > closeBrackets) {
    cleanResponse += "]".repeat(openBrackets - closeBrackets);
  }

  try {
    return JSON.parse(cleanResponse) as T;
  } catch {
    throw new Error(`AI 返回格式错误：无法解析 JSON\n响应：${cleanResponse.slice(0, 500)}`);
  }
}
