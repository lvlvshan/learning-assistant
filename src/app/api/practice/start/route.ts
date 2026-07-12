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
    const { subjectId, knowledgePointIds: rawKpIds } = await request.json();
    if (!subjectId) {
      return NextResponse.json({ error: "请选择科目" }, { status: 400 });
    }

    // 确定知识点范围：若传了 knowledgePointIds 则限定，否则查科目下全部
    const kpWhere = (rawKpIds?.length > 0)
      ? { id: { in: rawKpIds as string[] } }
      : { subjectId };

    const kps = await prisma.knowledgePoint.findMany({
      where: kpWhere,
      select: { id: true, name: true },
    });

    if (kps.length === 0) {
      return NextResponse.json({ error: "该科目暂无知识点" }, { status: 400 });
    }

    const questions = await prisma.question.findMany({
      where: {
        knowledgePointId: { in: kps.map(kp => kp.id) },
        aiReviewStatus: "APPROVED",
      },
      orderBy: { createdAt: "desc" },
    });

    if (questions.length === 0) {
      return NextResponse.json({ error: "该科目暂无已审核的题目，请联系老师" }, { status: 400 });
    }

    // 所选知识点下所有已审核题目全部进入练习（不再随机抽样）
    const session = await prisma.exerciseSession.create({
      data: {
        studentId: auth.userId,
        subjectId,
        totalQuestions: questions.length,
        correctCount: 0,
        score: 0,
        knowledgePointIds: JSON.stringify(kps.map(kp => kp.id)),
      },
    });

    return NextResponse.json({
      session: {
        id: session.id,
        totalQuestions: session.totalQuestions,
        status: session.status,
        startedAt: session.startedAt,
      },
      questions: questions.length,
      selectedKnowledgePoints: kps.map(kp => kp.name),
    });
  } catch (error) {
    console.error("Start practice error:", error);
    return NextResponse.json({ error: "开始练习失败" }, { status: 500 });
  }
}
