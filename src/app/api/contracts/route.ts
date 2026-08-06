import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { removeStoredFiles } from "@/lib/files";
import { prisma } from "@/lib/prisma";
import { deleteIdsSchema, linkedRecordSchema } from "@/lib/validators";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  const rows = await prisma.contract.findMany({
    orderBy: { createdAt: "desc" },
    include: { recordFile: { select: { id: true, originalName: true } } },
  });
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  try {
    const input = linkedRecordSchema.parse(await request.json());
    const row = await prisma.contract.create({
      data: {
        name: input.name,
        type: input.type,
        opportunityId: input.type === "CUSTOMER" ? input.targetId : null,
        supplierId: input.type === "SUPPLIER" ? input.targetId : null,
        recordFileId: input.recordFileId || null,
      },
      include: { recordFile: { select: { id: true, originalName: true } } },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  try {
    const { ids } = deleteIdsSchema.parse(await request.json());
    const rows = await prisma.contract.findMany({
      where: { id: { in: ids } },
      select: { id: true, recordFile: { select: { id: true, filePath: true } } },
    });
    const existingIds = rows.map((row) => row.id);
    const recordFiles = rows.map((row) => row.recordFile).filter((file): file is NonNullable<typeof file> => Boolean(file));
    await prisma.$transaction(async (tx) => {
      await tx.contract.deleteMany({ where: { id: { in: existingIds } } });
      if (recordFiles.length) await tx.attachment.deleteMany({ where: { id: { in: recordFiles.map((file) => file.id) } } });
      if (existingIds.length) await tx.auditLog.createMany({
        data: existingIds.map((id) => ({ userId: auth.user.id, action: "DELETE", entityType: "CONTRACT", entityId: id })),
      });
    });
    await removeStoredFiles(recordFiles.map((file) => file.filePath));
    return NextResponse.json({ deleted: existingIds.length });
  } catch (error) {
    return apiError(error);
  }
}
