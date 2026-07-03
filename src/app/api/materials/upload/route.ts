import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "TEACHER" && auth.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string;
    const subjectId = formData.get("subjectId") as string;

    if (!file || !title || !subjectId) {
      return NextResponse.json({ error: "文件、标题和科目不能为空" }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    let fileType = "TEXT";
    if ([".pdf"].includes(ext)) fileType = "PDF";
    else if ([".ppt", ".pptx", ".pptm"].includes(ext)) fileType = "PPT";
    else if ([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"].includes(ext)) fileType = "IMAGE";
    else if ([".mp4", ".avi", ".mov", ".wmv", ".flv"].includes(ext)) fileType = "VIDEO";

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const timestamp = Date.now();
    const safeName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const filePath = path.join(uploadDir, safeName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const fileUrl = `/uploads/${safeName}`;

    return NextResponse.json({
      file: {
        name: file.name,
        url: fileUrl,
        type: fileType,
        size: file.size,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "上传失败" }, { status: 500 });
  }
}
