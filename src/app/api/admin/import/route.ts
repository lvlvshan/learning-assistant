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

    // 按依赖顺序串行写入
    await prisma.user.createMany({ data: data.users });
    await prisma.class.createMany({ data: data.classes });
    await prisma.subject.createMany({ data: data.subjects });
    await prisma.learningMaterial.createMany({ data: data.materials });
    await prisma.materialChunk.createMany({ data: data.chunks });

    // 知识点有自引用关系（parentId），需要拓扑排序确保父节点先插入
    const sortedKPs = sortKnowledgePoints(data.knowledgePoints);
    for (const kp of sortedKPs) {
      await prisma.knowledgePoint.create({ data: kp });
    }

    await prisma.question.createMany({ data: data.questions });
    await prisma.exerciseSession.createMany({ data: data.sessions });
    await prisma.exerciseAnswer.createMany({ data: data.answers });
    await prisma.studentWeakness.createMany({ data: data.weaknesses });
    await prisma.masteryRecord.createMany({ data: data.masteries });
    await prisma.systemConfig.createMany({ data: data.configs });
    await prisma.aIGenerationLog.createMany({ data: data.logs });

    return NextResponse.json({ message: "数据导入成功" });
  } catch (error: any) {
    console.error("Import error:", error);
    return NextResponse.json({ error: `导入失败：${error.message}` }, { status: 500 });
  }
}

/** 按 parentId 排序知识点，确保父节点在子节点之前 */
function sortKnowledgePoints(points: any[]): any[] {
  const map = new Map<string | null, any[]>();
  for (const p of points) {
    const key = p.parentId ?? "__root__";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  const result: any[] = [];
  function dfs(parentKey: string | null) {
    const children = map.get(parentKey) || [];
    for (const child of children) {
      result.push(child);
      dfs(child.id);
    }
  }
  dfs(null);
  return result;
}
