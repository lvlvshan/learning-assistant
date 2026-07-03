import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/auth";

// GET /api/students/[id]/stats - 单个学生学习统计
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { id } = await context.params;

  if (auth.role === "STUDENT" && id !== auth.userId) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const student = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      username: true,
      class: { select: { id: true, name: true, grade: true } },
      createdAt: true,
    },
  });

  if (!student) {
    return NextResponse.json({ error: "学生不存在" }, { status: 404 });
  }

  const sessions = await prisma.exerciseSession.findMany({
    where: { studentId: id, status: "COMPLETED" },
    include: { subject: { select: { name: true } } },
    orderBy: { completedAt: "asc" },
  });

  const weaknesses = await prisma.studentWeakness.findMany({
    where: { studentId: id },
    include: { knowledgePoint: { select: { name: true, subjectId: true } } },
    orderBy: { masteryLevel: "asc" },
  });

  const totalSessions = sessions.length;
  const avgScore =
    totalSessions > 0
      ? Math.round(sessions.reduce((sum, s) => sum + s.score, 0) / totalSessions)
      : 0;

  const scoreTrend = sessions.map((s, i) => ({
    index: i + 1,
    score: s.score,
    subject: s.subject?.name || "未知",
    date: s.completedAt?.toISOString().slice(0, 10) || "",
  }));

  const subjectBreakdown = await Promise.all(
    (await prisma.subject.findMany()).map(async (subj) => {
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
    })
  );

  return NextResponse.json({
    student,
    summary: { totalSessions, avgScore },
    scoreTrend,
    subjectBreakdown,
    weaknesses,
  });
}
