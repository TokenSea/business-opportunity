import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { removeStoredFiles } from "@/lib/files";
import { deleteIdsSchema, opportunitySchema } from "@/lib/validators";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  const rows = await prisma.opportunity.findMany({
    orderBy: { createdAt: "desc" },
    include: { attachments: { select: { id: true, originalName: true, mimeType: true } } },
  });
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  try {
    const input = opportunitySchema.parse(await request.json());
    const row = await prisma.$transaction(async (tx) => {
      const opportunity = await tx.opportunity.create({
        data: {
          customer: input.customer,
          requirement: input.requirement || null,
          source: input.source || null,
          paymentTerms: input.paymentTerms || null,
          status: input.status,
          progress: input.progress || null,
          notes: input.notes || null,
          createdById: auth.user.id,
        },
      });
      await tx.contract.create({
        data: { name: opportunity.customer, type: "CUSTOMER", opportunityId: opportunity.id },
      });
      await tx.payment.create({
        data: { name: opportunity.customer, type: "CUSTOMER", opportunityId: opportunity.id },
      });
      if (input.attachmentIds.length) {
        await tx.attachment.updateMany({
          where: { id: { in: input.attachmentIds }, uploadedById: auth.user.id, opportunityId: null, contractId: null, paymentId: null },
          data: { opportunityId: opportunity.id },
        });
      }
      await tx.auditLog.create({
        data: { userId: auth.user.id, action: "CREATE", entityType: "OPPORTUNITY", entityId: opportunity.id },
      });
      return opportunity;
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
    const rows = await prisma.opportunity.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        attachments: { select: { id: true, filePath: true } },
        contracts: { select: {
          recordFile: { select: { id: true, filePath: true } },
          attachments: { select: { id: true, filePath: true } },
        } },
        payments: { select: {
          recordFile: { select: { id: true, filePath: true } },
          attachments: { select: { id: true, filePath: true } },
        } },
      },
    });
    const existingIds = rows.map((row) => row.id);
    const files = Array.from(new Map(rows.flatMap((row) => [
      ...row.attachments,
      ...row.contracts.flatMap((item) => [...item.attachments, ...(item.recordFile ? [item.recordFile] : [])]),
      ...row.payments.flatMap((item) => [...item.attachments, ...(item.recordFile ? [item.recordFile] : [])]),
    ]).map((file) => [file.id, file])).values());

    await prisma.$transaction(async (tx) => {
      await tx.opportunity.deleteMany({ where: { id: { in: existingIds } } });
      if (files.length) await tx.attachment.deleteMany({ where: { id: { in: files.map((file) => file.id) } } });
      if (existingIds.length) await tx.auditLog.createMany({
        data: existingIds.map((id) => ({ userId: auth.user.id, action: "DELETE", entityType: "OPPORTUNITY", entityId: id })),
      });
    });
    await removeStoredFiles(files.map((file) => file.filePath));
    return NextResponse.json({ deleted: existingIds.length });
  } catch (error) {
    return apiError(error);
  }
}
