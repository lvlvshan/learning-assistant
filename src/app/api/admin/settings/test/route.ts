import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

// AI 提供商测试连接 — 服务端代理，绕过浏览器 CORS 限制
export async function POST(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "ADMIN") return forbiddenResponse();

  try {
    const { endpoint, apiKey, model } = await request.json();

    if (!endpoint) {
      return NextResponse.json({ error: "请填写 API 地址" }, { status: 400 });
    }

    const url = endpoint.replace(/\/$/, "") + "/chat/completions";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "回复'连接成功'四个字" }],
        max_tokens: 50,
      }),
      // 避免长时间等待
      signal: AbortSignal.timeout(15000),
    });

    if (response.ok) {
      return NextResponse.json({ success: true, message: "AI 服务连接成功！" });
    }

    const errorText = await response.text();
    return NextResponse.json(
      { success: false, error: `连接失败 (${response.status}): ${errorText.slice(0, 200)}` },
      { status: response.status },
    );
  } catch (error: any) {
    // 区分超时和其他网络错误
    if (error.name === "TimeoutError") {
      return NextResponse.json({ success: false, error: "连接超时：AI 服务未响应（15 秒）" }, { status: 504 });
    }
    return NextResponse.json(
      { success: false, error: `无法连接到 AI 服务: ${error.message}` },
      { status: 502 },
    );
  }
}
