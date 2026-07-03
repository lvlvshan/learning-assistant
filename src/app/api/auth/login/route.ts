import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, comparePassword, generateToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "用户名和密码不能为空" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    const token = generateToken({ userId: user.id, role: user.role });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        classId: user.classId,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
