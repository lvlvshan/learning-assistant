import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

export async function GET() {
  const subjects = await prisma.subject.findMany({
    include: { _count: { select: { materials: true, knowledgePoints: true } } },
  });

  return NextResponse.json({
    subjects: subjects.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      icon: s.icon,
      materialCount: s._count.materials,
      knowledgePointCount: s._count.knowledgePoints,
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "ADMIN") return forbiddenResponse();

  try {
    const { name, description, icon } = await request.json();
    if (!name) {
      return NextResponse.json({ error: "科目名称不能为空" }, { status: 400 });
    }

    const subject = await prisma.subject.create({
      data: { name, description: description || "", icon: icon || "" },
    });

    return NextResponse.json({ subject }, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "科目名称已存在" }, { status: 400 });
    }
    console.error("Create subject error:", error);
    return NextResponse.json({ error: "创建科目失败" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "ADMIN") return forbiddenResponse();

  try {
    const { id, name, description, icon } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "科目ID不能为空" }, { status: 400 });
    }

    const subject = await prisma.subject.update({
      where: { id },
      data: { ...(name && { name }), ...(description !== undefined && { description }), ...(icon !== undefined && { icon }) },
    });

    return NextResponse.json({ subject });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "科目名称已存在" }, { status: 400 });
    }
    console.error("Update subject error:", error);
    return NextResponse.json({ error: "更新科目失败" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "ADMIN") return forbiddenResponse();

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "科目ID不能为空" }, { status: 400 });
  }

  await prisma.subject.delete({ where: { id } });
  return NextResponse.json({ message: "删除成功" });
}
