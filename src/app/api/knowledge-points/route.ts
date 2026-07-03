import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = request.nextUrl;
  const subjectId = searchParams.get("subjectId");
  const parentId = searchParams.get("parentId");
  const tree = searchParams.get("tree");

  const where: any = {};
  if (subjectId) where.subjectId = subjectId;
  if (parentId === "null" || parentId === "") {
    where.parentId = null;
  } else if (parentId) {
    where.parentId = parentId;
  }

  if (tree === "true") {
    const allPoints = await prisma.knowledgePoint.findMany({
      where: subjectId ? { subjectId } : {},
      orderBy: { orderIndex: "asc" },
    });

    const map = new Map<string, any>();
    const roots: any[] = [];

    allPoints.forEach((p) => map.set(p.id, { ...p, children: [] }));
    allPoints.forEach((p) => {
      const node = map.get(p.id)!;
      if (p.parentId && map.has(p.parentId)) {
        map.get(p.parentId)!.children.push(node);
      } else if (!p.parentId) {
        roots.push(node);
      }
    });

    return NextResponse.json({ knowledgePoints: roots });
  }

  const knowledgePoints = await prisma.knowledgePoint.findMany({
    where,
    orderBy: { orderIndex: "asc" },
    include: {
      _count: { select: { children: true, questions: true } },
    },
  });

  return NextResponse.json({ knowledgePoints });
}

export async function POST(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "TEACHER" && auth.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  try {
    const { name, description, subjectId, parentId, difficultyLevel } = await request.json();

    if (!name || !subjectId) {
      return NextResponse.json({ error: "名称和科目不能为空" }, { status: 400 });
    }

    const lastPoint = await prisma.knowledgePoint.findFirst({
      where: { subjectId, parentId: parentId || null },
      orderBy: { orderIndex: "desc" },
    });

    const knowledgePoint = await prisma.knowledgePoint.create({
      data: {
        name,
        description: description || "",
        subjectId,
        parentId: parentId || null,
        difficultyLevel: difficultyLevel || "BASIC",
        orderIndex: (lastPoint?.orderIndex ?? -1) + 1,
      },
    });

    return NextResponse.json({ knowledgePoint }, { status: 201 });
  } catch (error) {
    console.error("Create knowledge point error:", error);
    return NextResponse.json({ error: "创建知识点失败" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "TEACHER" && auth.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  try {
    const { id, name, description, parentId, difficultyLevel, orderIndex } = await request.json();

    if (!id) return NextResponse.json({ error: "ID 不能为空" }, { status: 400 });

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (parentId !== undefined) data.parentId = parentId || null;
    if (difficultyLevel !== undefined) data.difficultyLevel = difficultyLevel;
    if (orderIndex !== undefined) data.orderIndex = orderIndex;

    const knowledgePoint = await prisma.knowledgePoint.update({ where: { id }, data });
    return NextResponse.json({ knowledgePoint });
  } catch (error) {
    console.error("Update knowledge point error:", error);
    return NextResponse.json({ error: "更新知识点失败" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "TEACHER" && auth.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID 不能为空" }, { status: 400 });

  try {
    // 递归删除所有子知识点
    async function deleteWithChildren(nodeId: string) {
      const children = await prisma.knowledgePoint.findMany({ where: { parentId: nodeId }, select: { id: true } });
      for (const child of children) {
        await deleteWithChildren(child.id);
      }
      // 删除关联的题目（含答题记录）
      const questions = await prisma.question.findMany({ where: { knowledgePointId: nodeId }, select: { id: true } });
      const questionIds = questions.map(q => q.id);
      if (questionIds.length > 0) {
        await prisma.exerciseAnswer.deleteMany({ where: { questionId: { in: questionIds } } });
        await prisma.question.deleteMany({ where: { id: { in: questionIds } } });
      }
      await prisma.studentWeakness.deleteMany({ where: { knowledgePointId: nodeId } });
      await prisma.masteryRecord.deleteMany({ where: { knowledgePointId: nodeId } });
      await prisma.knowledgePoint.delete({ where: { id: nodeId } });
    }

    await deleteWithChildren(id);
    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("Delete knowledge point error:", error);
    return NextResponse.json({ error: "删除知识点失败" }, { status: 500 });
  }
}
