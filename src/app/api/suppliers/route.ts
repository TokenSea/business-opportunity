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
  return NextResponse.json(rows.map(({ encryptedPassword, passwordIv, passwordTag, ...row }) => ({
    ...row,
    password: "••••••••",
  })));
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  try {
    const input = supplierSchema.parse(await request.json());
    const encrypted = encryptSupplierPassword(input.password);
    const row = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.create({
        data: { name: input.name, account: input.account, notes: input.notes || null, ...encrypted },
      });
      await tx.contract.create({
        data: { name: supplier.name, type: "SUPPLIER", supplierId: supplier.id },
      });
      await tx.payment.create({
        data: { name: supplier.name, type: "SUPPLIER", supplierId: supplier.id },
      });
      await tx.auditLog.create({
        data: { userId: auth.user.id, action: "CREATE", entityType: "SUPPLIER", entityId: supplier.id },
      });
      return supplier;
    });
    return NextResponse.json({ ...row, encryptedPassword: undefined, passwordIv: undefined, passwordTag: undefined, password: "••••••••" }, { status: 201 });
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
        contracts: { select: { recordFile: { select: { id: true, filePath: true } } } },
        payments: { select: { recordFile: { select: { id: true, filePath: true } } } },
      },
    });
    const existingIds = rows.map((row) => row.id);
    const recordFiles = rows.flatMap((row) => [
      ...row.contracts.map((item) => item.recordFile),
      ...row.payments.map((item) => item.recordFile),
    ]).filter((file): file is NonNullable<typeof file> => Boolean(file));

    await prisma.$transaction(async (tx) => {
      await tx.supplier.deleteMany({ where: { id: { in: existingIds } } });
      if (recordFiles.length) await tx.attachment.deleteMany({ where: { id: { in: recordFiles.map((file) => file.id) } } });
      if (existingIds.length) await tx.auditLog.createMany({
        data: existingIds.map((id) => ({ userId: auth.user.id, action: "DELETE", entityType: "SUPPLIER", entityId: id })),
      });
    });
    await removeStoredFiles(recordFiles.map((file) => file.filePath));
    return NextResponse.json({ deleted: existingIds.length });
  } catch (error) {
    return apiError(error);
  }
}
