/**
 * MinerU 文档解析 API 客户端
 *
 * 使用 MinerU 精准解析 API（v4）提取 PDF、图片、PPT、Word、Excel 等文件中的文本内容。
 *
 * API 文档参考项目根目录 minerU.txt
 *
 * 流程：
 *   1. POST /api/v4/file-urls/batch → 获取签名上传 URL
 *   2. PUT 上传文件到 OSS（阿里云对象存储）
 *   3. 轮询 GET /api/v4/extract-results/batch/{batch_id} → 等待解析完成
 *   4. 下载返回的 Zip 包 → 内存解压 → 提取 full.md → 转纯文本
 */

import { existsSync, readFileSync } from "fs";
import { basename } from "path";

// ─── 类型定义 ──────────────────────────────────────────────────

interface UploadUrlResult {
  batchId: string;
  fileUrl: string;
  dataId: string;
}

interface BatchItemResult {
  file_name: string;
  state: string;
  full_zip_url?: string;
  err_msg?: string;
  data_id?: string;
  extract_progress?: {
    extracted_pages: number;
    total_pages: number;
    start_time: string;
  };
}

interface BatchQueryResponse {
  code: number;
  msg: string;
  trace_id?: string;
  data: {
    batch_id: string;
    extract_result: BatchItemResult[];
  };
}

interface ErrorResponse {
  code: number;
  msg: string;
  trace_id?: string;
}

// ─── 客户端 ────────────────────────────────────────────────────

export class MinerUClient {
  private token: string;
  private readonly baseUrl = "https://mineru.net/api/v4";
  private readonly defaultTimeout = 300_000; // 5 分钟
  private readonly pollInterval = 3_000; // 3 秒

  constructor(token: string) {
    if (!token) {
      throw new Error("MinerU Token 不能为空");
    }
    this.token = token;
  }

  // ─── HTTP 辅助 ─────────────────────────────────────────────

  private get headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    };
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async request<T>(
    url: string,
    options: RequestInit = {},
  ): Promise<T> {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...(options.headers as Record<string, string>),
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `MinerU API 请求失败 [${res.status}]: ${body.slice(0, 200)}`,
      );
    }

    const result = (await res.json()) as T & ErrorResponse;
    if ("code" in result && (result as ErrorResponse).code !== 0) {
      throw new Error(
        `MinerU API 返回错误 [${(result as ErrorResponse).code}]: ${(result as ErrorResponse).msg}`,
      );
    }

    return result;
  }

  /**
   * 获取文件上传签名 URL
   * POST /api/v4/file-urls/batch
   */
  private async getUploadUrl(
    fileName: string,
    dataId?: string,
  ): Promise<UploadUrlResult> {
    const id = dataId || `mat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const result = await this.request<{
      code: number;
      msg: string;
      data: { batch_id: string; file_urls: string[] };
    }>(`${this.baseUrl}/file-urls/batch`, {
      method: "POST",
      body: JSON.stringify({
        files: [{ name: fileName, data_id: id }],
        model_version: "vlm",
        language: "ch",
        enable_formula: true,
        enable_table: true,
        is_ocr: false,
      }),
    });

    if (!result.data?.file_urls?.length) {
      throw new Error("MinerU 未返回上传链接");
    }

    return {
      batchId: result.data.batch_id,
      fileUrl: result.data.file_urls[0],
      dataId: id,
    };
  }

  /**
   * PUT 上传文件到 OSS
   * 注意：上传时不需要 Content-Type 请求头
   */
  private async uploadFile(uploadUrl: string, filePath: string): Promise<void> {
    if (!existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const fileBuffer = readFileSync(filePath);

    const res = await fetch(uploadUrl, {
      method: "PUT",
      // 不设 Content-Type，MinerU 要求
      body: fileBuffer,
    });

    if (res.status !== 200) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `文件上传到 MinerU 失败 [HTTP ${res.status}]: ${body.slice(0, 200)}`,
      );
    }
  }

  /**
   * 轮询批量解析结果
   * GET /api/v4/extract-results/batch/{batch_id}
   */
  private async pollBatchResult(
    batchId: string,
    dataId: string,
    timeout: number = this.defaultTimeout,
  ): Promise<BatchItemResult> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const result = await this.request<BatchQueryResponse>(
        `${this.baseUrl}/extract-results/batch/${batchId}`,
      );

      const items = result.data?.extract_result || [];
      // 优先按 dataId 匹配，否则取第一个
      const myItem = items.find((i) => i.data_id === dataId) || items[0];

      if (!myItem) {
        await this.sleep(this.pollInterval);
        continue;
      }

      switch (myItem.state) {
        case "done":
          return myItem;
        case "failed":
          return myItem; // 由调用方处理失败
        case "waiting-file":
        case "uploading":
        case "pending":
        case "running":
        case "converting":
          await this.sleep(this.pollInterval);
          continue;
        default:
          await this.sleep(this.pollInterval);
          continue;
      }
    }

    throw new Error(
      `MinerU 文档解析超时 (已等待 ${timeout / 1000}秒)，batch_id=${batchId}`,
    );
  }

  /**
   * 下载解析结果 Zip 包并提取 Markdown 文本
   */
  private async downloadAndExtractText(zipUrl: string): Promise<string> {
    const res = await fetch(zipUrl);
    if (!res.ok) {
      throw new Error(`下载解析结果失败 [HTTP ${res.status}]`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 使用 adm-zip 在内存中解压
    const { default: AdmZip } = await import("adm-zip");
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    // 首选 full.md（Markdown 格式的完整解析结果）
    const mdEntry = entries.find((e: any) => e.entryName.endsWith("full.md"));
    if (mdEntry) {
      const mdContent = mdEntry.getData().toString("utf-8");
      return this.markdownToText(mdContent);
    }

    // 备选 content_list.json（结构化内容列表）
    const jsonEntry = entries.find((e: any) =>
      e.entryName.endsWith("content_list.json"),
    );
    if (jsonEntry) {
      const jsonContent = jsonEntry.getData().toString("utf-8");
      return this.extractTextFromContentList(jsonContent);
    }

    // 最后尝试：任意 .md 或 .txt 文件
    const textEntry = entries.find(
      (e: any) =>
        e.entryName.endsWith(".md") ||
        e.entryName.endsWith(".txt") ||
        e.entryName.endsWith(".html"),
    );
    if (textEntry) {
      const raw = textEntry.getData().toString("utf-8");
      return this.markdownToText(raw);
    }

    throw new Error(
      `无法从 MinerU 解析结果中提取文本（Zip 内含 ${entries.length} 个文件: ${entries.map((e: any) => e.entryName).join(", ")}）`,
    );
  }

  // ─── 公开方法 ─────────────────────────────────────────────

  /**
   * 一站式文档解析：上传 → 等待 → 提取纯文本
   *
   * @param filePath - 本地文件完整路径
   * @param dataId   - 可选的自定义 ID，用于追踪
   * @returns 提取的纯文本内容（前 15000 字符）
   */
  async parseDocument(
    filePath: string,
    dataId?: string,
  ): Promise<{ text: string; taskId: string }> {
    const fileName = basename(filePath);

    if (!existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const startTime = Date.now();

    // Step 1: 获取上传签名 URL
    const { batchId, fileUrl, dataId: resolvedDataId } =
      await this.getUploadUrl(fileName, dataId);

    // Step 2: PUT 上传文件到 OSS
    await this.uploadFile(fileUrl, filePath);

    // Step 3: 轮询解析结果
    const itemResult = await this.pollBatchResult(batchId, resolvedDataId);

    if (itemResult.state === "failed") {
      throw new Error(
        `MinerU 文档解析失败: ${itemResult.err_msg || "未知错误"}`,
      );
    }

    if (!itemResult.full_zip_url) {
      throw new Error("MinerU 解析完成但未返回结果下载链接");
    }

    // Step 4: 下载并提取文本
    const text = await this.downloadAndExtractText(itemResult.full_zip_url);

    const duration = Date.now() - startTime;

    return {
      text: text.slice(0, 15000), // 控制上下文长度
      taskId: itemResult.data_id || resolvedDataId,
    };
  }

  // ─── 文本处理 ─────────────────────────────────────────────

  /**
   * Markdown → 纯文本
   * 移除标记符号，保留段落结构
   */
  private markdownToText(md: string): string {
    if (!md) return "";

    return (
      md
        // 移除 HTML 标签（MinerU 输出有时会含简单 HTML）
        .replace(/<[^>]+>/g, "")
        // 移除标题标记
        .replace(/^#{1,6}\s+/gm, "")
        // 移除加粗和斜体标记
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/__(.+?)__/g, "$1")
        .replace(/_(.+?)_/g, "$1")
        // 移除行内代码和代码块
        .replace(/```[\s\S]*?```/g, "")
        .replace(/`{1,3}[^`]*`{1,3}/g, "")
        // 移除图片标记（保留可能有的 alt 文本描述）
        .replace(/!\[.*?\]\(.*?\)/g, "")
        // 链接保留文本
        .replace(/\[(.+?)\]\(.*?\)/g, "$1")
        // 移除表格线
        .replace(/^\|.+\|$/gm, "")
        .replace(/^\|[-| :]+$/gm, "")
        // 移除分隔线
        .replace(/^[-*_]{3,}$/gm, "")
        // 移除引用标记
        .replace(/^>\s+/gm, "")
        // 移除无序列表标记
        .replace(/^[\s]*[-*+]\s+/gm, "")
        // 移除有序列表标记
        .replace(/^\s*\d+\.\s+/gm, "")
        // 压缩多余空行
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    );
  }

  /**
   * 从 content_list.json 中提取文本
   * content_list.json 包含文档的结构化内容（标题、段落、表格等）
   */
  private extractTextFromContentList(jsonStr: string): string {
    try {
      const content = JSON.parse(jsonStr);

      // content_list.json 通常是数组格式，每个元素包含 text/markdown 字段
      const texts: string[] = [];
      this.collectText(content, texts);
      return texts.join("\n").trim();
    } catch {
      // JSON 解析失败则返回原始字符串的纯文本版本
      return jsonStr
        .replace(/[{}\[\]"\\]/g, "")
        .replace(/[,:]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  private collectText(data: unknown, texts: string[]): void {
    if (typeof data === "string") {
      const trimmed = data.trim();
      if (trimmed.length > 1) texts.push(trimmed);
    } else if (Array.isArray(data)) {
      for (const item of data) {
        this.collectText(item, texts);
      }
    } else if (data !== null && typeof data === "object") {
      const obj = data as Record<string, unknown>;

      // 优先提取文本相关字段
      for (const key of ["text", "content", "markdown", "title", "desc"]) {
        if (typeof obj[key] === "string" && obj[key].trim()) {
          texts.push(obj[key].trim());
        }
      }

      // 递归处理剩余字段
      for (const value of Object.values(obj)) {
        if (typeof value === "object" && value !== null) {
          this.collectText(value, texts);
        }
      }
    }
  }
}
