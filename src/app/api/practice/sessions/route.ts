import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/auth";

// GET /api/practice/sessions - 练习历史
export async function GET(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = request.nextUrl;
  const studentIdParam = searchParams.get("studentId");
  const statusFilter = searchParams.get("status"); // 可选：COMPLETED | IN_PROGRESS

  // 学生只能看自己（必须传自己的 id 或省略）
  if (auth.role === "STUDENT") {
    if (studentIdParam && studentIdParam !== auth.userId) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }
  }

  // 教师/管理员：不传 studentId 时返回全部；传了则限定该学生
  const where: any = {};
  if (studentIdParam) where.studentId = studentIdParam;
  else if (auth.role === "STUDENT") where.studentId = auth.userId;
  if (statusFilter) where.status = statusFilter;

  const sessions = await prisma.exerciseSession.findMany({
    where,
    include: {
      subject: { select: { id: true, name: true } },
      _count: { select: { answers: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ sessions });
}
