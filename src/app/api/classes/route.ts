import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const classes = await prisma.class.findMany({
    include: {
      _count: { select: { students: true } },
    },
    orderBy: [{ grade: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      grade: c.grade,
      studentCount: c._count.students,
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "ADMIN") return forbiddenResponse();

  try {
    const { name, grade } = await request.json();
    if (!name || !grade) {
      return NextResponse.json({ error: "班级名称和年级不能为空" }, { status: 400 });
    }

    const cls = await prisma.class.create({ data: { name, grade } });
    return NextResponse.json({ class: cls }, { status: 201 });
  } catch (error) {
    console.error("Create class error:", error);
    return NextResponse.json({ error: "创建班级失败" }, { status: 500 });
  }
}
