import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, hashPassword, comparePassword, unauthorizedResponse } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const { oldPassword, newPassword } = await request.json();

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: "请填写旧密码和新密码" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "新密码至少6位" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: auth.userId } });
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    const match = await comparePassword(oldPassword, user.password);
    if (!match) {
      return NextResponse.json({ error: "旧密码不正确" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: auth.userId },
      data: { password: await hashPassword(newPassword) },
    });

    return NextResponse.json({ message: "密码修改成功" });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ error: "修改密码失败" }, { status: 500 });
  }
}
