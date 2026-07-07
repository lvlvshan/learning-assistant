import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/auth";
import { chatWithJSON } from "@/lib/ai/provider";
import { REGENERATE_QUESTIONS_SYSTEM } from "@/lib/ai/prompts";
import { QuestionGenerationResult } from "@/lib/ai/types";

// POST /api/practice/[id]/regenerate - 针对薄弱点重新出题
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "STUDENT") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { id } = await context.params;

  const session = await prisma.exerciseSession.findUnique({
    where: { id },
    include: {
      answers: { include: { question: { include: { knowledgePoint: true } } } },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "练习不存在" }, { status: 404 });
  }

  if (session.studentId !== auth.userId) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  if (session.status !== "COMPLETED") {
    return NextResponse.json({ error: "请先完成当前练习" }, { status: 400 });
  }

  // 获取分析结果中的薄弱点
  let weaknessData: any = {};
  try {
    weaknessData = JSON.parse(session.weaknessData || "{}");
  } catch {}

  const weakPoints = weaknessData.weakPoints || [];
  const nextRoundFocus = weaknessData.nextRoundFocus || [];

  // 构建薄弱知识点描述
  let weakKpDescription = "";
  if (weakPoints.length > 0) {
    weakKpDescription = weakPoints
      .map((wp: any) => `${wp.knowledgePoint}（掌握度：${wp.masteryLevel}%，薄弱层次：${(wp.bloomLevels || []).join("、")}）`)
      .join("；");
  } else {
    // 如果没有明确薄弱点，使用错题关联的知识点
    const wrongAnswers = session.answers.filter(a => !a.isCorrect);
    const wrongKps = [...new Set(wrongAnswers.map(a => a.question.knowledgePoint?.name).filter(Boolean))];
    weakKpDescription = wrongKps.join("、") || "需要巩固的知识点";
  }

  // 调用 AI 重新生成题目
  try {
    const result = await chatWithJSON<QuestionGenerationResult>(
      REGENERATE_QUESTIONS_SYSTEM,
      `学生当前练习得分：${session.score}分
      薄弱知识点：${weakKpDescription}
      需重点关注的认知层次：${nextRoundFocus.join("、") || "APPLY、ANALYZE"}
      需要生成的题目数量：5`
    );

    if (!result.questions || result.questions.length === 0) {
      return NextResponse.json({ error: "AI 未能生成题目" }, { status: 500 });
    }

    // 查找薄弱知识点的 ID
    let targetKpId = "";
    if (weakPoints.length > 0) {
      const kp = await prisma.knowledgePoint.findFirst({
        where: { name: { contains: weakPoints[0].knowledgePoint }, subjectId: session.subjectId },
      });
      if (kp) targetKpId = kp.id;
    }

    if (!targetKpId) {
      const firstKp = await prisma.knowledgePoint.findFirst({
        where: { subjectId: session.subjectId },
      });
      if (firstKp) targetKpId = firstKp.id;
    }

    // 保存 AI 生成的题目到题库（默认未审核）
    const savedQuestions = await Promise.all(
      result.questions.map((q) =>
        prisma.question.create({
          data: {
            knowledgePointId: targetKpId,
            type: q.type || "MULTIPLE_CHOICE",
            content: q.content,
            options: JSON.stringify(q.options || []),
            correctAnswer: q.correctAnswer || "",
            difficulty: q.difficulty || "MEDIUM",
            bloomLevel: q.bloomLevel || "REMEMBER",
            aiGenerated: true,
            reviewedByTeacher: false,
            aiReviewStatus: "PENDING",
            createdById: auth.userId,
          },
        })
      )
    );

    // 自动 AI 评审（同步等待完成）
    try {
      const { aiReviewQuestions } = await import("@/lib/ai/review");
      await aiReviewQuestions(savedQuestions.map((q) => q.id));
    } catch (reviewErr) {
      console.error("AI auto-review failed (non-blocking):", reviewErr);
    }

    // 创建新的练习会话（基于薄弱点）
    const newSession = await prisma.exerciseSession.create({
      data: {
        studentId: auth.userId,
        subjectId: session.subjectId,
        totalQuestions: savedQuestions.length,
        correctCount: 0,
        score: 0,
      },
    });

    // 记录 AI 日志
    await prisma.aIGenerationLog.create({
      data: {
        type: "GENERATE_QUESTION",
        provider: "openai-compatible",
        responsePreview: JSON.stringify(result).slice(0, 200),
      },
    });

    return NextResponse.json({
      newSession: {
        id: newSession.id,
        totalQuestions: newSession.totalQuestions,
        status: newSession.status,
      },
      questions: savedQuestions.length,
      focusAreas: nextRoundFocus,
    });
  } catch (error: any) {
    console.error("Regenerate error:", error);
    return NextResponse.json(
      { error: `重新出题失败：${error.message}` },
      { status: 500 }
    );
  }
}
