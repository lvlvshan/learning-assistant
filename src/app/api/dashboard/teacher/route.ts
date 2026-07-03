import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/auth";

// GET /api/dashboard/teacher - 教师总看板数据
export async function GET(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "TEACHER" && auth.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  // 获取所有班级
  const classes = await prisma.class.findMany({
    include: { _count: { select: { students: true } } },
  });

  // 获取所有学生
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    select: { id: true, name: true, classId: true },
  });

  // 获取完成的练习
  const sessions = await prisma.exerciseSession.findMany({
    where: { status: "COMPLETED" },
    include: {
      subject: { select: { id: true, name: true } },
      student: { select: { id: true, name: true, classId: true } },
    },
    orderBy: { completedAt: "desc" },
  });

  // 获取所有科目
  const subjects = await prisma.subject.findMany();

  // 总体统计
  const totalStudents = students.length;
  const totalSessions = sessions.length;
  const avgScore =
    totalSessions > 0
      ? Math.round(
          sessions.reduce((sum, s) => sum + s.score, 0) / totalSessions
        )
      : 0;

  // 各科目统计
  const subjectStats = subjects.map((subj) => {
    const subjSessions = sessions.filter((s) => s.subjectId === subj.id);
    const completed = subjSessions.length;
    return {
      id: subj.id,
      name: subj.name,
      totalSessions: completed,
      avgScore:
        completed > 0
          ? Math.round(subjSessions.reduce((sum, s) => sum + s.score, 0) / completed)
          : 0,
    };
  });

  // 各班统计
  const classStats = await Promise.all(
    classes.map(async (cls) => {
      const classStudentIds = students
        .filter((s) => s.classId === cls.id)
        .map((s) => s.id);
      const classSessions = sessions.filter((s) =>
        classStudentIds.includes(s.student.id)
      );
      const completed = classSessions.length;
      const studentCount = classStudentIds.length;
      return {
        id: cls.id,
        name: `${cls.grade} ${cls.name}`,
        studentCount,
        totalSessions: completed,
        avgScore:
          completed > 0
            ? Math.round(
                classSessions.reduce((sum, s) => sum + s.score, 0) / completed
              )
            : 0,
        // 人均练习次数
        sessionsPerStudent:
          studentCount > 0
            ? Math.round((completed / studentCount) * 10) / 10
            : 0,
      };
    })
  );

  // 最近 7 天趋势
  const trend: { date: string; count: number; avgScore: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);

    const daySessions = sessions.filter((s) => {
      if (!s.completedAt) return false;
      return s.completedAt.toISOString().slice(0, 10) === dateStr;
    });

    trend.push({
      date: dateStr,
      count: daySessions.length,
      avgScore:
        daySessions.length > 0
          ? Math.round(
              daySessions.reduce((sum, s) => sum + s.score, 0) /
                daySessions.length
            )
          : 0,
    });
  }

  // 优秀/及格/不及格统计
  const excellent = sessions.filter((s) => s.score >= 90).length;
  const pass = sessions.filter((s) => s.score >= 60 && s.score < 90).length;
  const fail = sessions.filter((s) => s.score < 60).length;

  // 进步最快学生
  type StudentProgress = { id: string; name: string; className: string; sessionsCount: number; avgScore: number; improvement: number };
  const studentStats = await Promise.all(
    students.slice(0, 50).map(async (s) => {
      const studentSessions = sessions
        .filter((sess) => sess.student.id === s.id)
        .sort((a, b) => (a.completedAt?.getTime() || 0) - (b.completedAt?.getTime() || 0));

      const cls = classes.find((c) => c.id === s.classId);
      if (studentSessions.length < 2) {
        return {
          id: s.id,
          name: s.name,
          className: cls ? `${cls.grade} ${cls.name}` : "未分配",
          sessionsCount: studentSessions.length,
          avgScore:
            studentSessions.length > 0
              ? Math.round(
                  studentSessions.reduce((sum, sess) => sum + sess.score, 0) /
                    studentSessions.length
                )
              : 0,
          improvement: 0,
        } as StudentProgress;
      }

      const firstHalf = studentSessions.slice(0, Math.floor(studentSessions.length / 2));
      const secondHalf = studentSessions.slice(Math.floor(studentSessions.length / 2));
      const firstAvg =
        firstHalf.reduce((sum, sess) => sum + sess.score, 0) / firstHalf.length;
      const secondAvg =
        secondHalf.reduce((sum, sess) => sum + sess.score, 0) / secondHalf.length;

      return {
        id: s.id,
        name: s.name,
        className: cls ? `${cls.grade} ${cls.name}` : "未分配",
        sessionsCount: studentSessions.length,
        avgScore:
          studentSessions.length > 0
            ? Math.round(
                studentSessions.reduce((sum, sess) => sum + sess.score, 0) /
                  studentSessions.length
              )
            : 0,
        improvement: Math.round(secondAvg - firstAvg),
      } as StudentProgress;
    })
  );

  const topImprovers = studentStats
    .filter((s) => s.sessionsCount >= 2)
    .sort((a, b) => b.improvement - a.improvement)
    .slice(0, 10)
    .filter((s) => s.improvement > 0);

  const needsAttention = studentStats
    .filter((s) => s.sessionsCount >= 1)
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 10)
    .filter((s) => s.avgScore < 60);

  return NextResponse.json({
    summary: {
      totalStudents,
      totalSessions,
      avgScore,
      excellentCount: excellent,
      passCount: pass,
      failCount: fail,
      excellentRate: totalSessions > 0 ? Math.round((excellent / totalSessions) * 100) : 0,
    },
    subjectStats,
    classStats,
    trend,
    topImprovers,
    needsAttention,
  });
}
