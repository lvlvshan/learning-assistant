import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "请选择备份文件" }, { status: 400 });
    }

    const text = await file.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "无效的 JSON 文件格式" }, { status: 400 });
    }

    if (!data.users || !data.classes) {
      return NextResponse.json({ error: "无效的备份文件格式" }, { status: 400 });
    }

    // 清空所有表（反向依赖顺序）
    await prisma.aIGenerationLog.deleteMany();
    await prisma.systemConfig.deleteMany();
    await prisma.masteryRecord.deleteMany();
    await prisma.studentWeakness.deleteMany();
    await prisma.exerciseAnswer.deleteMany();
    await prisma.exerciseSession.deleteMany();
    await prisma.question.deleteMany();
    await prisma.knowledgePoint.deleteMany();
    await prisma.materialChunk.deleteMany();
    await prisma.learningMaterial.deleteMany();
    await prisma.subject.deleteMany();
    await prisma.class.deleteMany();
    await prisma.user.deleteMany();

    // 按依赖顺序写入
    await Promise.all([
      prisma.user.createMany({ data: data.users }),
      prisma.class.createMany({ data: data.classes }),
      prisma.subject.createMany({ data: data.subjects }),
      prisma.learningMaterial.createMany({ data: data.materials }),
      prisma.materialChunk.createMany({ data: data.chunks }),
      prisma.knowledgePoint.createMany({ data: data.knowledgePoints }),
      prisma.question.createMany({ data: data.questions }),
      prisma.exerciseSession.createMany({ data: data.sessions }),
      prisma.exerciseAnswer.createMany({ data: data.answers }),
      prisma.studentWeakness.createMany({ data: data.weaknesses }),
      prisma.masteryRecord.createMany({ data: data.masteries }),
      prisma.systemConfig.createMany({ data: data.configs }),
      prisma.aIGenerationLog.createMany({ data: data.logs }),
    ]);

    return NextResponse.json({ message: "数据导入成功" });
  } catch (error: any) {
    console.error("Import error:", error);
    return NextResponse.json({ error: `导入失败：${error.message}` }, { status: 500 });
  }
}
