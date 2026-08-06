import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { removeStoredFiles } from "@/lib/files";
import { prisma } from "@/lib/prisma";
import { deleteIdsSchema, linkedRecordSchema } from "@/lib/validators";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  const rows = await prisma.payment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      recordFile: { select: { id: true, originalName: true, mimeType: true } },
      attachments: { orderBy: { createdAt: "desc" }, select: { id: true, originalName: true, mimeType: true } },
    },
  });
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  try {
    const input = linkedRecordSchema.parse(await request.json());
    const attachmentIds = Array.from(new Set([
      ...input.attachmentIds,
      ...(input.recordFileId ? [input.recordFileId] : []),
    ]));
    const row = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          name: input.name,
          type: input.type,
          opportunityId: input.type === "CUSTOMER" ? input.targetId : null,
          supplierId: input.type === "SUPPLIER" ? input.targetId : null,
          recordFileId: attachmentIds[0] || null,
        },
      });
      if (attachmentIds.length) {
        const attached = await tx.attachment.updateMany({
          where: {
            id: { in: attachmentIds },
            uploadedById: auth.user.id,
            opportunityId: null,
            contractId: null,
            paymentId: null,
          },
          data: { paymentId: payment.id },
        });
        if (attached.count !== attachmentIds.length) throw new Error("付款附件关联失败");
      }
      return tx.payment.findUniqueOrThrow({
        where: { id: payment.id },
        include: {
          recordFile: { select: { id: true, originalName: true, mimeType: true } },
          attachments: { orderBy: { createdAt: "desc" }, select: { id: true, originalName: true, mimeType: true } },
        },
      });
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
    const rows = await prisma.payment.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        recordFile: { select: { id: true, filePath: true } },
        attachments: { select: { id: true, filePath: true } },
      },
    });
    const existingIds = rows.map((row) => row.id);
    const files = Array.from(new Map(rows.flatMap((row) => [
      ...row.attachments,
      ...(row.recordFile ? [row.recordFile] : []),
    ]).map((file) => [file.id, file])).values());
    await prisma.$transaction(async (tx) => {
      await tx.payment.deleteMany({ where: { id: { in: existingIds } } });
      if (files.length) await tx.attachment.deleteMany({ where: { id: { in: files.map((file) => file.id) } } });
      if (existingIds.length) await tx.auditLog.createMany({
        data: existingIds.map((id) => ({ userId: auth.user.id, action: "DELETE", entityType: "PAYMENT", entityId: id })),
      });
    });
    await removeStoredFiles(files.map((file) => file.filePath));
    return NextResponse.json({ deleted: existingIds.length });
  } catch (error) {
    return apiError(error);
  }
}
