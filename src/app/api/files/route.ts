import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  if (auth.user.role !== "ADMIN") return NextResponse.json({ message: "仅管理员可以上传附件" }, { status: 403 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ message: "请选择文件" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ message: "文件不能超过 20MB" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ message: "不支持该文件类型" }, { status: 400 });
    }
    const extension = path.extname(file.name).slice(0, 12);
    const storedName = `${randomUUID()}${extension}`;
    const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "storage", "uploads");
    await mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, storedName);
    await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
    const row = await prisma.attachment.create({
      data: {
        originalName: file.name,
        storedName,
        filePath,
        mimeType: file.type,
        fileSize: file.size,
        uploadedById: auth.user.id,
      },
    });
    return NextResponse.json({ id: row.id, originalName: row.originalName }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
