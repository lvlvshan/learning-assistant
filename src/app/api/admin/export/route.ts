import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const [users, classes, subjects, materials, chunks, knowledgePoints, questions, sessions, answers, weaknesses, masteries, configs, logs] = await Promise.all([
    prisma.user.findMany(),
    prisma.class.findMany(),
    prisma.subject.findMany(),
    prisma.learningMaterial.findMany(),
    prisma.materialChunk.findMany(),
    prisma.knowledgePoint.findMany(),
    prisma.question.findMany(),
    prisma.exerciseSession.findMany(),
    prisma.exerciseAnswer.findMany(),
    prisma.studentWeakness.findMany(),
    prisma.masteryRecord.findMany(),
    prisma.systemConfig.findMany(),
    prisma.aIGenerationLog.findMany(),
  ]);

  const data = {
    exportDate: new Date().toISOString(),
    version: "1.0",
    users,
    classes,
    subjects,
    materials,
    chunks,
    knowledgePoints,
    questions,
    sessions,
    answers,
    weaknesses,
    masteries,
    configs,
    logs,
  };

  const jsonStr = JSON.stringify(data, null, 2);
  const filename = `learning-assistant-backup-${Date.now()}.json`;

  return new Response(jsonStr, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
