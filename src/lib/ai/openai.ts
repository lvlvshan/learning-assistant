import { IAIProvider, Message, AIProviderConfig } from "./types";

// OpenAI 兼容提供商（涵盖 Ollama、DeepSeek、通义千问等）
export class OpenAICompatibleProvider implements IAIProvider {
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async chat(messages: Message[], maxTokensOverride?: number): Promise<string> {
    const endpoint = this.config.endpoint.replace(/\/$/, "") + "/chat/completions";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        max_tokens: maxTokensOverride ?? this.config.maxTokens,
        temperature: this.config.temperature,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }
}

// 自定义提供商 — 由管理员配置完整请求
export class CustomProvider implements IAIProvider {
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async chat(messages: Message[], maxTokensOverride?: number): Promise<string> {
    const provider = new OpenAICompatibleProvider(this.config);
    return provider.chat(messages, maxTokensOverride);
  }
}
