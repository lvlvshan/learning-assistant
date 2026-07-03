import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/auth";

// GET /api/questions - 题目列表
export async function GET(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "TEACHER" && auth.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const knowledgePointId = searchParams.get("knowledgePointId");
  const subjectId = searchParams.get("subjectId");
  const bloomLevel = searchParams.get("bloomLevel");
  const type = searchParams.get("type");
  const reviewed = searchParams.get("reviewed"); // "true" | "false"
  const aiGenerated = searchParams.get("aiGenerated"); // "true" | "false"

  const where: any = {};

  if (knowledgePointId) {
    where.knowledgePointId = knowledgePointId;
  }
  if (bloomLevel) {
    where.bloomLevel = bloomLevel;
  }
  if (type) {
    where.type = type;
  }
  if (reviewed === "true") where.reviewedByTeacher = true;
  if (reviewed === "false") where.reviewedByTeacher = false;
  if (aiGenerated === "true") where.aiGenerated = true;
  if (aiGenerated === "false") where.aiGenerated = false;

  // 如果按科目筛选，通过知识点关联
  if (subjectId) {
    const kpIds = await prisma.knowledgePoint.findMany({
      where: { subjectId },
      select: { id: true },
    });
    where.knowledgePointId = { in: kpIds.map((kp) => kp.id) };
  }

  const questions = await prisma.question.findMany({
    where,
    include: {
      knowledgePoint: { select: { id: true, name: true, subjectId: true, subject: { select: { name: true } } } },
      creator: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // 解析 options JSON
  const parsed = questions.map((q) => ({
    ...q,
    options: JSON.parse(q.options),
  }));

  return NextResponse.json({ questions: parsed });
}

// POST /api/questions - 创建题目
export async function POST(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "TEACHER" && auth.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  try {
    const { knowledgePointId, type, content, options, correctAnswer, difficulty, bloomLevel } = await request.json();

    if (!knowledgePointId || !content || !correctAnswer) {
      return NextResponse.json({ error: "知识点、题目内容和正确答案不能为空" }, { status: 400 });
    }

    const question = await prisma.question.create({
      data: {
        knowledgePointId,
        type: type || "MULTIPLE_CHOICE",
        content,
        options: JSON.stringify(options || []),
        correctAnswer,
        difficulty: difficulty || "MEDIUM",
        bloomLevel: bloomLevel || "REMEMBER",
        aiGenerated: false,
        reviewedByTeacher: true,
        createdById: auth.userId,
      },
    });

    return NextResponse.json({
      question: { ...question, options: JSON.parse(question.options) },
    }, { status: 201 });
  } catch (error) {
    console.error("Create question error:", error);
    return NextResponse.json({ error: "创建题目失败" }, { status: 500 });
  }
}
