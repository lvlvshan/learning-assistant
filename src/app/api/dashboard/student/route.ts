import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/auth";

// GET /api/dashboard/student - 学生个人看板
export async function GET(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const studentId = request.nextUrl.searchParams.get("studentId") || auth.userId;

  if (auth.role === "STUDENT" && studentId !== auth.userId) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      name: true,
      class: { select: { id: true, name: true, grade: true } },
    },
  });

  if (!student) {
    return NextResponse.json({ error: "学生不存在" }, { status: 404 });
  }

  // 练习统计
  const sessions = await prisma.exerciseSession.findMany({
    where: { studentId, status: "COMPLETED" },
    include: { subject: { select: { name: true } } },
    orderBy: { completedAt: "asc" },
  });

  const totalSessions = sessions.length;
  const totalQuestions = sessions.reduce((sum, s) => sum + s.totalQuestions, 0);
  const correctCount = sessions.reduce((sum, s) => sum + s.correctCount, 0);
  const avgScore =
    totalSessions > 0
      ? Math.round(sessions.reduce((sum, s) => sum + s.score, 0) / totalSessions)
      : 0;
  const correctRate = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  // 各科目统计
  const subjects = await prisma.subject.findMany();
  const subjectStats = subjects.map((subj) => {
    const subjSessions = sessions.filter((s) => s.subjectId === subj.id);
    const count = subjSessions.length;
    return {
      name: subj.name,
      sessionsCount: count,
      avgScore:
        count > 0
          ? Math.round(subjSessions.reduce((sum, s) => sum + s.score, 0) / count)
          : 0,
    };
  });

  // 成绩趋势
  const scoreTrend = sessions.map((s, i) => ({
    index: i + 1,
    score: s.score,
    subject: s.subject?.name || "未知",
    date: s.completedAt?.toISOString().slice(0, 10) || "",
  }));

  // 薄弱知识点
  const weaknesses = await prisma.studentWeakness.findMany({
    where: { studentId },
    include: { knowledgePoint: { select: { name: true, subjectId: true } } },
    orderBy: { masteryLevel: "asc" },
  });

  // 掌握度雷达图数据 (按知识点分组)
  const masteryDistribution = [
    { range: "优秀(≥90%)", count: 0 },
    { range: "良好(75-89%)", count: 0 },
    { range: "及格(60-74%)", count: 0 },
    { range: "薄弱(<60%)", count: 0 },
  ];

  weaknesses.forEach((w) => {
    if (w.masteryLevel >= 90) masteryDistribution[0].count++;
    else if (w.masteryLevel >= 75) masteryDistribution[1].count++;
    else if (w.masteryLevel >= 60) masteryDistribution[2].count++;
    else masteryDistribution[3].count++;
  });

  return NextResponse.json({
    student,
    summary: { totalSessions, totalQuestions, correctCount, avgScore, correctRate },
    subjectStats,
    scoreTrend,
    weaknesses,
    masteryDistribution,
  });
}
