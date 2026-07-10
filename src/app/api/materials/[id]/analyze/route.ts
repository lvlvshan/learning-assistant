import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chatWithJSON } from "@/lib/ai/provider";
import { KNOWLEDGE_EXTRACTION_SYSTEM } from "@/lib/ai/prompts";
import { KnowledgeExtractionResult } from "@/lib/ai/types";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/auth";
import { loadMinerUConfig } from "@/lib/ai/config";
import { MinerUClient } from "@/lib/mineru";
import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import path from "path";

const MAX_CONTENT_LENGTH = 15000; // MinerU 提取文本上限
const MAX_LEGACY_LENGTH = 10000;  // 原有提取方案上限

/** MinerU 精准解析 API 支持的所有文件类型 */
const MINERU_SUPPORTED_TYPES = new Set(["PDF", "PPT", "IMAGE", "DOC", "XLSX"]);

// ─── 传统文件提取（降级方案）───────────────────────────────────

function extractTextFromFile(fileUrl: string): string {
  const filePath = path.join(process.cwd(), "public", fileUrl);
  if (!existsSync(filePath)) {
    throw new Error(`文件不存在: ${fileUrl}`);
  }

  const ext = path.extname(filePath).toLowerCase();

  if ([".pptx", ".ppt", ".pptm"].includes(ext)) {
    const scriptPath = path.join(process.cwd(), "scripts", "extract_pptx.py");
    const result = execSync(`python "${scriptPath}" "${filePath}"`, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return result.trim();
  }

  if ([".txt"].includes(ext)) {
    return readFileSync(filePath, "utf-8").trim();
  }

  throw new Error(`不支持的文件类型: ${ext}（内置提取仅支持 PPTX 和 TXT 文件，其他格式请启用 MinerU 文档解析）`);
}

// ─── 解析文件 URL ─────────────────────────────────────────────

/** 从 material.content 中提取文件 URL（格式: "[文件] 名 (类型)\\n/uploads/xxx"） */
function extractFileUrl(material: any): string {
  const lines = (material.content || "").split("\n");
  const url = lines[1]?.trim();
  if (!url) throw new Error("无法找到文件路径，请重新上传");
  return url;
}

/** 获取文件的绝对路径 */
function getAbsolutePath(fileUrl: string): string {
  return path.join(process.cwd(), "public", fileUrl);
}

// ─── 获取 AI 分析用的文本内容 ─────────────────────────────────

async function getAnalysisContent(material: any): Promise<string> {
  const { type, title, content } = material;

  // ── 分支1：TEXT 类型 → 直接取 content 字段 ──────────────────
  if (type === "TEXT") {
    return (content || "").slice(0, MAX_LEGACY_LENGTH);
  }

  // ── 分支2：MinerU 支持的文件类型 ────────────────────────────
  if (MINERU_SUPPORTED_TYPES.has(type)) {
    const mineruConfig = await loadMinerUConfig();

    if (mineruConfig.enabled && mineruConfig.token) {
      // MinerU 已启用 → 尝试解析
      try {
        const fileUrl = extractFileUrl(material);
        const filePath = getAbsolutePath(fileUrl);
        if (!existsSync(filePath)) {
          throw new Error(`文件不存在: ${fileUrl}`);
        }

        const client = new MinerUClient(mineruConfig.token);
        const { text } = await client.parseDocument(filePath);
        if (text) {
          console.log(`[MinerU] 成功解析: ${title}, 提取 ${text.length} 字符`);
          return text.slice(0, MAX_CONTENT_LENGTH);
        }
        throw new Error("MinerU 返回了空内容");
      } catch (err: any) {
        // PPT 有传统降级方案，其他类型没有
        if (type === "PPT") {
          console.warn(`[MinerU] 解析失败，降级到传统方案: ${err.message}`);
          // 下面走 fallback
        } else {
          throw new Error(
            `MinerU 文档解析失败: ${err.message}。请检查 MinerU 配置或文件格式。`,
          );
        }
      }
    } else {
      // MinerU 未启用 → PPT 可以降级，其他类型报错
      if (type !== "PPT") {
        throw new Error(
          `该文件类型(${type})需要启用 MinerU 文档解析服务才能提取文本。请在系统设置中配置并启用 MinerU。`,
        );
      }
      // PPT 降级到下方传统方案
    }
  }

  // ── 分支3：非 MinerU 类型（VIDEO 等）→ 传统方案 ────────────
  // 也作为 PPT 降级兜底入口
  const fileUrl = extractFileUrl(material);
  const fileText = extractTextFromFile(fileUrl);
  if (!fileText) {
    throw new Error("未能从文件中提取出文本内容");
  }

  return fileText.slice(0, MAX_LEGACY_LENGTH);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "TEACHER" && auth.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { id } = await context.params;
  const material = await prisma.learningMaterial.findUnique({ where: { id } });
  if (!material) {
    return NextResponse.json({ error: "资料不存在" }, { status: 404 });
  }

  // 解析请求体（前端传递的 rootId）
  let body: any = {};
  try {
    body = await request.json();
  } catch { /* 无请求体 */ }

  const targetRootId = body?.rootId;

  // 确定目标节点：使用指定 nodeId 或按资料标题查重/新建根节点
  let rootKP: any;
  if (targetRootId) {
    rootKP = await prisma.knowledgePoint.findUnique({ where: { id: targetRootId } });
    if (!rootKP) {
      return NextResponse.json({ error: "指定的节点无效" }, { status: 400 });
    }
  } else {
    const existingRoot = await prisma.knowledgePoint.findFirst({
      where: { name: material.title, subjectId: material.subjectId, parentId: null },
    });
    if (existingRoot) {
      rootKP = existingRoot;
    } else {
      rootKP = await prisma.knowledgePoint.create({
        data: {
          name: material.title,
          description: `来自资料「${material.title}」的知识点`,
          subjectId: material.subjectId,
          parentId: null,
          difficultyLevel: "BASIC",
          orderIndex: 0,
        },
      });
    }
  }

  try {
    const content = await getAnalysisContent(material);

    const result = await chatWithJSON<KnowledgeExtractionResult>(
      KNOWLEDGE_EXTRACTION_SYSTEM,
      `资料标题：${material.title}\n\n资料内容：${content}`,
    );

    if (!result.knowledgePoints || result.knowledgePoints.length === 0) {
      return NextResponse.json({ error: "AI 未能提取出知识点" }, { status: 500 });
    }

    const savedPoints = await saveKnowledgePoints(
      result.knowledgePoints,
      rootKP.id,
      material.subjectId,
    );

    const allPoints = [{ ...rootKP, children: savedPoints }];

    await prisma.aIGenerationLog.create({
      data: {
        type: "EXTRACT_KNOWLEDGE",
        provider: "openai-compatible",
        responsePreview: JSON.stringify(result).slice(0, 200),
        materialId: material.id,
      },
    });

    return NextResponse.json({
      knowledgePoints: allPoints,
      raw: result,
    });
  } catch (error: any) {
    console.error("AI analysis error:", error);
    return NextResponse.json(
      { error: `AI 分析失败：${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * 递归保存知识点：同名去重，子节点合并
 * @param points - AI 提取的知识点列表
 * @param parentId - 父节点 ID（始终指向已存在的节点）
 * @param subjectId - 科目 ID
 */
async function saveKnowledgePoints(
  points: any[],
  parentId: string,
  subjectId: string,
): Promise<any[]> {
  const saved: any[] = [];

  for (let i = 0; i < points.length; i++) {
    const p = points[i];

    // 查重：同 parentId + 同名 + 同科目
    const existing = await prisma.knowledgePoint.findFirst({
      where: { name: p.name, parentId, subjectId },
      include: { children: { orderBy: { orderIndex: "asc" } } },
    });

    if (existing) {
      // 复用已有知识点，更新描述和难度
      const kp = await prisma.knowledgePoint.update({
        where: { id: existing.id },
        data: {
          description: p.description ? p.description : existing.description,
          difficultyLevel: p.difficulty || existing.difficultyLevel,
        },
      });

      // 递归合并子节点：将已有子节点注入到 AI 结果中继续 merge
      if (p.children && p.children.length > 0) {
        // 已有子节点作为兜底，与 AI 新提取的子节点一起递归合并
        const allChildren = [...p.children, ...existing.children];
        const mergedChildren = await saveKnowledgePoints(allChildren, kp.id, subjectId);
        saved.push({ ...kp, children: mergedChildren });
      } else {
        // AI 没有新子节点，保留已有子节点
        saved.push({ ...kp, children: existing.children });
      }
    } else {
      // 新建知识点
      const kp = await prisma.knowledgePoint.create({
        data: {
          name: p.name,
          description: p.description || "",
          subjectId,
          parentId,
          difficultyLevel: p.difficulty || "BASIC",
          orderIndex: i,
        },
      });

      if (p.children && p.children.length > 0) {
        const children = await saveKnowledgePoints(p.children, kp.id, subjectId);
        saved.push({ ...kp, children });
      } else {
        saved.push(kp);
      }
    }
  }

  return saved;
}
