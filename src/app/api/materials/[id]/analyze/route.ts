import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chatWithJSON } from "@/lib/ai/provider";
import { KNOWLEDGE_EXTRACTION_SYSTEM } from "@/lib/ai/prompts";
import { KnowledgeExtractionResult } from "@/lib/ai/types";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/auth";
import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import path from "path";

// 从上传文件中提取文本
function extractTextFromFile(fileUrl: string): string {
  const filePath = path.join(process.cwd(), "public", fileUrl);
  if (!existsSync(filePath)) {
    throw new Error(`文件不存在: ${fileUrl}`);
  }

  const ext = path.extname(filePath).toLowerCase();

  if ([".pptx", ".ppt", ".pptm"].includes(ext)) {
    // 用 Python 提取 PPTX 文本
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

  throw new Error(`不支持的文件类型: ${ext}（AI 分析仅支持 PPTX 和 TXT 文件）`);
}

// 获取 AI 分析用的文本内容
async function getAnalysisContent(material: any): Promise<string> {
  const isFile = material.type !== "TEXT";

  if (!isFile) {
    // TEXT 类型直接使用 content 字段
    return material.content.slice(0, 5000);
  }

  // 文件类型：从 content 第二行解析文件 URL
  const lines = (material.content || "").split("\n");
  const fileUrl = lines[1]?.trim();
  if (!fileUrl) {
    throw new Error("无法找到文件路径，请重新上传");
  }

  const fileText = extractTextFromFile(fileUrl);
  if (!fileText) {
    throw new Error("未能从文件中提取出文本内容");
  }

  return fileText.slice(0, 5000);
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
      null,
      material.subjectId,
      material.id
    );

    await prisma.aIGenerationLog.create({
      data: {
        type: "EXTRACT_KNOWLEDGE",
        provider: "openai-compatible",
        responsePreview: JSON.stringify(result).slice(0, 200),
        materialId: material.id,
      },
    });

    return NextResponse.json({
      knowledgePoints: savedPoints,
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

async function saveKnowledgePoints(
  points: any[],
  parentId: string | null,
  subjectId: string,
  materialId: string
): Promise<any[]> {
  const saved: any[] = [];

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
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
      const children = await saveKnowledgePoints(p.children, kp.id, subjectId, materialId);
      saved.push({ ...kp, children });
    } else {
      saved.push(kp);
    }
  }

  return saved;
}
