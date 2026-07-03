import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

// 获取系统配置
export async function GET(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "ADMIN") return forbiddenResponse();

  const key = request.nextUrl.searchParams.get("key");
  const config = await prisma.systemConfig.findUnique({
    where: { key: key || "ai-config" },
  });

  return NextResponse.json({
    config: config ? { key: config.key, value: JSON.parse(config.value), description: config.description } : null,
  });
}

// 更新系统配置
export async function PUT(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "ADMIN") return forbiddenResponse();

  try {
    const { key, value, description } = await request.json();

    const config = await prisma.systemConfig.upsert({
      where: { key: key || "ai-config" },
      update: {
        value: JSON.stringify(value),
        ...(description ? { description } : {}),
      },
      create: {
        key: key || "ai-config",
        value: JSON.stringify(value),
        description: description || "",
      },
    });

    return NextResponse.json({
      config: { key: config.key, value: JSON.parse(config.value), description: config.description },
    });
  } catch (error) {
    console.error("Update config error:", error);
    return NextResponse.json({ error: "保存配置失败" }, { status: 500 });
  }
}
