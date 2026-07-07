import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, generateToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { username, password, name, classId } = await request.json();

    // 必填字段验证
    if (!username || !password || !name) {
      return NextResponse.json(
        { error: "用户名、密码和姓名不能为空" },
        { status: 400 }
      );
    }

    // 密码长度验证
    if (password.length < 6) {
      return NextResponse.json(
        { error: "密码至少需要6个字符" },
        { status: 400 }
      );
    }

    // 用户名唯一性检查
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "用户名已存在" },
        { status: 400 }
      );
    }

    // 班级存在性检查
    if (classId) {
      const classExists = await prisma.class.findUnique({
        where: { id: classId },
      });
      if (!classExists) {
        return NextResponse.json(
          { error: "所选班级不存在" },
          { status: 400 }
        );
      }
    }

    // 创建用户（角色固定为 STUDENT）
    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
        role: "STUDENT",
        classId: classId || null,
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        classId: true,
      },
    });

    // 生成 token（自动登录）
    const token = generateToken({ userId: user.id, role: user.role });

    return NextResponse.json({ token, user }, { status: 201 });
  } catch (error: any) {
    // Prisma 唯一约束错误
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "用户名已存在" },
        { status: 400 }
      );
    }
    console.error("Register error:", error);
    return NextResponse.json({ error: "注册失败" }, { status: 500 });
  }
}
