// AI 调用状态检查与默认配置加载

import { prisma } from "@/lib/prisma";

interface AIConfig {
  provider: string;
  endpoint: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  enabled: boolean;
}

const defaultConfig: AIConfig = {
  provider: "openai-compatible",
  endpoint: "",
  apiKey: "",
  model: "gpt-4o",
  maxTokens: 2048,
  temperature: 0.7,
  enabled: false,
};

let cachedConfig: AIConfig | null = null;

export async function getAIConfig(): Promise<AIConfig> {
  if (cachedConfig) return cachedConfig;

  try {
    const record = await prisma.systemConfig.findUnique({ where: { key: "ai-config" } });
    if (record) {
      cachedConfig = { ...defaultConfig, ...JSON.parse(record.value) };
    } else {
      cachedConfig = defaultConfig;
    }
  } catch {
    cachedConfig = defaultConfig;
  }

  return cachedConfig!;
}

export function clearAIConfigCache() {
  cachedConfig = null;
}
