import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { encryptSupplierPassword } from "@/lib/encryption";
import { removeStoredFiles } from "@/lib/files";
import { prisma } from "@/lib/prisma";
import { deleteIdsSchema, supplierSchema } from "@/lib/validators";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  const rows = await prisma.supplier.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(rows.map(({
    encryptedWebsitePassword,
    websitePasswordIv,
    websitePasswordTag,
    ...row
  }) => ({
    ...row,
    websitePassword: encryptedWebsitePassword ? "••••••••" : "",
  })));
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  try {
    const input = supplierSchema.parse(await request.json());
    const websiteEncrypted = input.websitePassword ? encryptSupplierPassword(input.websitePassword) : null;
    const row = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.create({
        data: {
          name: input.name,
          bankAccount: input.bankAccount || null,
          websiteAccount: input.websiteAccount || null,
          websiteUrl: input.websiteUrl || null,
          notes: input.notes || null,
          ...(websiteEncrypted ? {
            encryptedWebsitePassword: websiteEncrypted.encryptedPassword,
            websitePasswordIv: websiteEncrypted.passwordIv,
            websitePasswordTag: websiteEncrypted.passwordTag,
          } : {}),
        },
      });
      await tx.auditLog.create({
        data: { userId: auth.user.id, action: "CREATE", entityType: "SUPPLIER", entityId: supplier.id },
      });
      return supplier;
    });
    return NextResponse.json({
      ...row,
      encryptedWebsitePassword: undefined,
      websitePasswordIv: undefined,
      websitePasswordTag: undefined,
      websitePassword: row.encryptedWebsitePassword ? "••••••••" : "",
    }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  try {
    const { ids } = deleteIdsSchema.parse(await request.json());
    const rows = await prisma.supplier.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
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
      ...row.contracts.flatMap((item) => [...item.attachments, ...(item.recordFile ? [item.recordFile] : [])]),
      ...row.payments.flatMap((item) => [...item.attachments, ...(item.recordFile ? [item.recordFile] : [])]),
    ]).map((file) => [file.id, file])).values());

    await prisma.$transaction(async (tx) => {
      await tx.supplier.deleteMany({ where: { id: { in: existingIds } } });
      if (files.length) await tx.attachment.deleteMany({ where: { id: { in: files.map((file) => file.id) } } });
      if (existingIds.length) await tx.auditLog.createMany({
        data: existingIds.map((id) => ({ userId: auth.user.id, action: "DELETE", entityType: "SUPPLIER", entityId: id })),
      });
    });
    await removeStoredFiles(files.map((file) => file.filePath));
    return NextResponse.json({ deleted: existingIds.length });
  } catch (error) {
    return apiError(error);
  }
}
