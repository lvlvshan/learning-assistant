import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chatWithJSON } from "@/lib/ai/provider";
import { QUESTION_GENERATION_SYSTEM } from "@/lib/ai/prompts";
import { QuestionGenerationResult } from "@/lib/ai/types";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "TEACHER" && auth.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  try {
    const { knowledgePointIds, count = 5, bloomLevels, types } = await request.json();

    if (!knowledgePointIds || knowledgePointIds.length === 0) {
      return NextResponse.json({ error: "请选择知识点" }, { status: 400 });
    }

    // 获取知识点信息
    const knowledgePoints = await prisma.knowledgePoint.findMany({
      where: { id: { in: knowledgePointIds } },
      select: { id: true, name: true, description: true, difficultyLevel: true, subjectId: true },
    });

    if (knowledgePoints.length === 0) {
      return NextResponse.json({ error: "知识点不存在" }, { status: 404 });
    }

    const subjectId = knowledgePoints[0].subjectId;

    // 构建 AI 请求
    const kpInfo = knowledgePoints.map(
      (kp) => `${kp.name}（${kp.description}，难度：${kp.difficultyLevel}）`
    ).join("；");

    const bloomStr = bloomLevels?.length
      ? bloomLevels.join("、")
      : "REMEMBER、UNDERSTAND、APPLY、ANALYZE";
    const typeStr = types?.length
      ? types.join("、")
      : "MULTIPLE_CHOICE、TF、FILL_BLANK";

    // 调用 AI 生成题目
    const result = await chatWithJSON<QuestionGenerationResult>(
      QUESTION_GENERATION_SYSTEM,
      `知识点：${kpInfo}
      需要生成的题目数量：${count}
      需要覆盖的认知层次：${bloomStr}
      允许的题型：${typeStr}
      请确保题目覆盖至少 3 个不同的 Bloom 认知层次。`
    );

    if (!result.questions || result.questions.length === 0) {
      return NextResponse.json({ error: "AI 未能生成题目" }, { status: 500 });
    }

    // 保存到数据库
    const savedQuestions = await Promise.all(
      result.questions.map((q, i) =>
        prisma.question.create({
          data: {
            knowledgePointId: knowledgePointIds[i % knowledgePointIds.length],
            type: q.type || "MULTIPLE_CHOICE",
            content: q.content,
            options: JSON.stringify(q.options || []),
            correctAnswer: q.correctAnswer || "",
            difficulty: q.difficulty || "MEDIUM",
            bloomLevel: q.bloomLevel || "REMEMBER",
            aiGenerated: true,
            reviewedByTeacher: false,
            createdById: auth.userId,
          },
        })
      )
    );

    // 记录 AI 调用
    await prisma.aIGenerationLog.create({
      data: {
        type: "GENERATE_QUESTION",
        provider: "openai-compatible",
        responsePreview: JSON.stringify(result).slice(0, 200),
      },
    });

    return NextResponse.json({
      questions: savedQuestions.map((q) => ({
        ...q,
        options: JSON.parse(q.options),
      })),
      raw: result,
    });
  } catch (error: any) {
    console.error("Generate questions error:", error);
    return NextResponse.json(
      { error: `生成题目失败：${error.message}` },
      { status: 500 }
    );
  }
}
