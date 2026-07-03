import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/auth";
import { chatWithJSON } from "@/lib/ai/provider";
import { ANSWER_EVALUATION_SYSTEM } from "@/lib/ai/prompts";
import { AnswerEvaluation } from "@/lib/ai/types";

// GET /api/practice/[id]/questions - 获取练习题
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { id } = await context.params;

  const session = await prisma.exerciseSession.findUnique({
    where: { id },
    include: {
      subject: { select: { id: true, name: true } },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "练习不存在" }, { status: 404 });
  }

  if (auth.role === "STUDENT" && session.studentId !== auth.userId) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  // 获取该练习关联的题目
  // 从已提交的答案反推，或者直接关联题目
  // 简化方案：获取该科目已审核的题目
  const kpIds = await prisma.knowledgePoint.findMany({
    where: { subjectId: session.subjectId },
    select: { id: true },
  });

  const questions = await prisma.question.findMany({
    where: {
      knowledgePointId: { in: kpIds.map(kp => kp.id) },
      reviewedByTeacher: true,
    },
    orderBy: { createdAt: "desc" },
    take: session.totalQuestions,
  });

  // 获取已提交的答案，标记已回答的题目
  const answers = await prisma.exerciseAnswer.findMany({
    where: { sessionId: id },
  });
  const answeredQuestionIds = new Set(answers.map(a => a.questionId));

  return NextResponse.json({
    session,
    questions: questions.map(q => ({
      id: q.id,
      type: q.type,
      content: q.content,
      options: JSON.parse(q.options),
      bloomLevel: q.bloomLevel,
      difficulty: q.difficulty,
      answered: answeredQuestionIds.has(q.id),
    })),
    answers: answers.map(a => ({
      questionId: a.questionId,
      studentAnswer: a.studentAnswer,
      isCorrect: a.isCorrect,
      score: a.score,
    })),
  });
}
