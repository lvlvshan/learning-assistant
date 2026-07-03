import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      classId: true,
      class: { select: { id: true, name: true, grade: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  return NextResponse.json({ user });
}
