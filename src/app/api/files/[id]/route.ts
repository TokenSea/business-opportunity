import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { removeStoredFiles } from "@/lib/files";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  const { id } = await context.params;
  const file = await prisma.attachment.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ message: "文件不存在" }, { status: 404 });
  try {
    const data = await readFile(file.filePath);
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new NextResponse(data, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      },
    });
  } catch {
    return NextResponse.json({ message: "文件已丢失" }, { status: 404 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const file = await prisma.attachment.findUnique({
      where: { id },
      select: { id: true, filePath: true },
    });
    if (!file) return NextResponse.json({ message: "附件不存在" }, { status: 404 });
    await prisma.$transaction(async (tx) => {
      await tx.attachment.delete({ where: { id } });
      await tx.auditLog.create({
        data: { userId: auth.user.id, action: "DELETE_ATTACHMENT", entityType: "ATTACHMENT", entityId: id },
      });
    });
    await removeStoredFiles([file.filePath]);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
