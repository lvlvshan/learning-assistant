import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 不需要登录的页面路径
const publicPaths = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公开页面路径直接放行
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 页面路由 — 由前端控制认证
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // API 路由 — 由 API 路由自己的辅助函数处理认证
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*"],
};
