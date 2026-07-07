// AI 调用状态检查与默认配置加载

import { prisma } from "@/lib/prisma";
import type { MinerUConfig } from "./types";

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
  maxTokens: 8192,
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

// ─── MinerU 配置 ─────────────────────────────────────────────

const defaultMinerUConfig: MinerUConfig = {
  token: "",
  enabled: false,
};

/**
 * 加载 MinerU 配置
 * 每次直接读库（访问频率低，无需缓存；缓存可能导致 Turbopack 下路由间不一致）
 */
export async function loadMinerUConfig(): Promise<MinerUConfig> {
  try {
    const record = await prisma.systemConfig.findUnique({
      where: { key: "mineru-config" },
    });
    if (record) {
      return { ...defaultMinerUConfig, ...JSON.parse(record.value) };
    }
  } catch {
    // ignore
  }
  return { ...defaultMinerUConfig };
}

export function clearMinerUConfigCache() {
  // 无缓存可清，保留函数签名以避免调用处报错
}
