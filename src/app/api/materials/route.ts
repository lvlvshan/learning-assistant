import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = request.nextUrl;
  const subjectId = searchParams.get("subjectId");

  const where: any = {};
  if (subjectId) where.subjectId = subjectId;
  if (auth.role === "TEACHER") where.authorId = auth.userId;

  const materials = await prisma.learningMaterial.findMany({
    where,
    include: {
      subject: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
      _count: { select: { chunks: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ materials });
}

export async function POST(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "TEACHER" && auth.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  try {
    const { title, content, type, subjectId } = await request.json();

    if (!title || !content || !subjectId) {
      return NextResponse.json({ error: "标题、内容和科目不能为空" }, { status: 400 });
    }

    const material = await prisma.learningMaterial.create({
      data: {
        title,
        content,
        type: type || "TEXT",
        subjectId,
        authorId: auth.userId,
      },
      include: {
        subject: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ material }, { status: 201 });
  } catch (error) {
    console.error("Create material error:", error);
    return NextResponse.json({ error: "创建资料失败" }, { status: 500 });
  }
}
