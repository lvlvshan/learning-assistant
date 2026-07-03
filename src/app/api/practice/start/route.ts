import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/auth";

// POST /api/practice/start - 开始练习
export async function POST(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "STUDENT") {
    return NextResponse.json({ error: "仅学生可开始练习" }, { status: 403 });
  }

  try {
    const { subjectId, count = 10 } = await request.json();
    if (!subjectId) {
      return NextResponse.json({ error: "请选择科目" }, { status: 400 });
    }

    // 从题库中选取已审核的题目
    const kpIds = await prisma.knowledgePoint.findMany({
      where: { subjectId },
      select: { id: true },
    });

    if (kpIds.length === 0) {
      return NextResponse.json({ error: "该科目暂无知识点" }, { status: 400 });
    }

    const questions = await prisma.question.findMany({
      where: {
        knowledgePointId: { in: kpIds.map(kp => kp.id) },
        reviewedByTeacher: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (questions.length === 0) {
      return NextResponse.json({ error: "该科目暂无已审核的题目，请联系老师" }, { status: 400 });
    }

    // 随机选取 count 道题（不足则取全部）
    const selectedCount = Math.min(count, questions.length);
    const shuffled = [...questions].sort(() => Math.random() - 0.5).slice(0, selectedCount);

    // 创建练习会话
    const session = await prisma.exerciseSession.create({
      data: {
        studentId: auth.userId,
        subjectId,
        totalQuestions: selectedCount,
        correctCount: 0,
        score: 0,
      },
    });

    return NextResponse.json({
      session: {
        id: session.id,
        totalQuestions: session.totalQuestions,
        status: session.status,
        startedAt: session.startedAt,
      },
      questions: selectedCount,
    });
  } catch (error) {
    console.error("Start practice error:", error);
    return NextResponse.json({ error: "开始练习失败" }, { status: 500 });
  }
}
