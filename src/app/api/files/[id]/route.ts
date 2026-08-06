import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  const { id } = await context.params;
  const file = await prisma.attachment.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ message: "文件不存在" }, { status: 404 });
  try {
    const data = await readFile(file.filePath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      },
    });
  } catch {
    return NextResponse.json({ message: "文件已丢失" }, { status: 404 });
  }
}
