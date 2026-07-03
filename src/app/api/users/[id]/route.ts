import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, hashPassword, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "ADMIN" && auth.role !== "TEACHER") return forbiddenResponse();

  const { id } = await context.params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      classId: true,
      class: { select: { id: true, name: true, grade: true } },
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "ADMIN" && auth.role !== "TEACHER") return forbiddenResponse();

  try {
    const { id } = await context.params;
    const { password, classId } = await request.json();

    const updateData: any = {};
    if (classId !== undefined) updateData.classId = classId || null;
    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: "密码至少6位" }, { status: 400 });
      }
      updateData.password = await hashPassword(password);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        classId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ error: "更新用户失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "ADMIN" && auth.role !== "TEACHER") return forbiddenResponse();

  try {
    const { id } = await context.params;

    // 先删除关联数据
    const sessions = await prisma.exerciseSession.findMany({ where: { studentId: id }, select: { id: true } });
    const sessionIds = sessions.map(s => s.id);

    if (sessionIds.length > 0) {
      await prisma.exerciseAnswer.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await prisma.exerciseSession.deleteMany({ where: { id: { in: sessionIds } } });
    }
    await prisma.studentWeakness.deleteMany({ where: { studentId: id } });
    await prisma.masteryRecord.deleteMany({ where: { studentId: id } });
    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error: "删除用户失败" }, { status: 500 });
  }
}
