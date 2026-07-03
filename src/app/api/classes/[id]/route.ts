import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "ADMIN") return forbiddenResponse();

  const { id } = await context.params;
  await prisma.class.delete({ where: { id } });
  return NextResponse.json({ message: "删除成功" });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "ADMIN") return forbiddenResponse();

  const { id } = await context.params;
  const { name, grade } = await request.json();
  const cls = await prisma.class.update({ where: { id }, data: { name, grade } });
  return NextResponse.json({ class: cls });
}
