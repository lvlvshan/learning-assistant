import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/auth";

// GET /api/questions/[id] - 题目详情
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { id } = await context.params;
  const question = await prisma.question.findUnique({
    where: { id },
    include: {
      knowledgePoint: { select: { id: true, name: true, subjectId: true } },
      creator: { select: { id: true, name: true } },
    },
  });

  if (!question) {
    return NextResponse.json({ error: "题目不存在" }, { status: 404 });
  }

  return NextResponse.json({
    question: { ...question, options: JSON.parse(question.options) },
  });
}

// PUT /api/questions/[id] - 更新题目
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "TEACHER" && auth.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const { knowledgePointId, type, content, options, correctAnswer, difficulty, bloomLevel, reviewedByTeacher, aiReviewStatus } = await request.json();

    const data: any = {};
    if (knowledgePointId !== undefined) data.knowledgePointId = knowledgePointId;
    if (type !== undefined) data.type = type;
    if (content !== undefined) data.content = content;
    if (options !== undefined) data.options = JSON.stringify(options);
    if (correctAnswer !== undefined) data.correctAnswer = correctAnswer;
    if (difficulty !== undefined) data.difficulty = difficulty;
    if (bloomLevel !== undefined) data.bloomLevel = bloomLevel;
    if (reviewedByTeacher !== undefined) data.reviewedByTeacher = reviewedByTeacher;
    if (aiReviewStatus !== undefined) data.aiReviewStatus = aiReviewStatus;

    const question = await prisma.question.update({
      where: { id },
      data,
    });

    return NextResponse.json({ question: { ...question, options: JSON.parse(question.options) } });
  } catch (error) {
    console.error("Update question error:", error);
    return NextResponse.json({ error: "更新题目失败" }, { status: 500 });
  }
}

// DELETE /api/questions/[id] - 删除题目
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "TEACHER" && auth.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  try {
    const { id } = await context.params;

    // 先删除关联的答题记录，再删除题目
    await prisma.exerciseAnswer.deleteMany({ where: { questionId: id } });
    await prisma.question.delete({ where: { id } });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("Delete question error:", error);
    return NextResponse.json({ error: "删除题目失败" }, { status: 500 });
  }
}
