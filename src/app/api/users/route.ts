import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { getAuthFromRequest, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "ADMIN" && auth.role !== "TEACHER") return forbiddenResponse();

  const { searchParams } = request.nextUrl;
  const roleFilter = searchParams.get("role");

  const where = roleFilter ? { role: roleFilter } : {};

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      classId: true,
      class: { select: { id: true, name: true, grade: true } },
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "ADMIN") return forbiddenResponse();

  try {
    const { username, password, name, role: userRole, classId } = await request.json();

    if (!username || !password || !name) {
      return NextResponse.json({ error: "用户名、密码和姓名不能为空" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "密码至少6位" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: "用户名已存在" }, { status: 400 });
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
        role: userRole || "STUDENT",
        classId: classId || null,
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        classId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json({ error: "创建用户失败" }, { status: 500 });
  }
}
