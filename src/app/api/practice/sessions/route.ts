import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/auth";

// GET /api/practice/sessions - 练习历史
export async function GET(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = request.nextUrl;
  const studentId = searchParams.get("studentId") || auth.userId;
  const statusFilter = searchParams.get("status"); // 可选：COMPLETED | IN_PROGRESS

  // 学生只能看自己，老师/admin 可以看所有
  if (auth.role === "STUDENT" && studentId !== auth.userId) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const where: any = { studentId };
  if (statusFilter) where.status = statusFilter;

  const sessions = await prisma.exerciseSession.findMany({
    where,
    include: {
      subject: { select: { id: true, name: true } },
      _count: { select: { answers: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ sessions });
}
