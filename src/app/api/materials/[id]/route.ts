import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/auth";
import { unlink } from "fs/promises";
import path from "path";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { id } = await context.params;
  const material = await prisma.learningMaterial.findUnique({
    where: { id },
    include: {
      subject: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
      chunks: { orderBy: { chunkIndex: "asc" } },
    },
  });

  if (!material) {
    return NextResponse.json({ error: "资料不存在" }, { status: 404 });
  }

  return NextResponse.json({ material });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { id } = await context.params;

  const material = await prisma.learningMaterial.findUnique({ where: { id } });
  if (!material) {
    return NextResponse.json({ error: "资料不存在" }, { status: 404 });
  }

  if (auth.role === "TEACHER" && material.authorId !== auth.userId) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  if (auth.role !== "TEACHER" && auth.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  if (material.fileUrl) {
    try {
      const filePath = path.join(process.cwd(), "public", material.fileUrl);
      await unlink(filePath);
    } catch {}
  }

  await prisma.learningMaterial.delete({ where: { id } });
  return NextResponse.json({ message: "删除成功" });
}
