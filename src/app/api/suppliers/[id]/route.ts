import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { encryptSupplierPassword } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";
import { supplierUpdateSchema } from "@/lib/validators";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  if (auth.user.role !== "ADMIN") return NextResponse.json({ message: "仅管理员可以修改供应商" }, { status: 403 });
  try {
    const { id } = await context.params;
    const input = supplierUpdateSchema.parse(await request.json());
    const websiteEncrypted = input.websitePassword ? encryptSupplierPassword(input.websitePassword) : null;
    const row = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.update({
        where: { id },
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
        data: { userId: auth.user.id, action: "UPDATE", entityType: "SUPPLIER", entityId: id },
      });
      return supplier;
    });
    return NextResponse.json({
      ...row,
      encryptedWebsitePassword: undefined,
      websitePasswordIv: undefined,
      websitePasswordTag: undefined,
      websitePassword: row.encryptedWebsitePassword ? "••••••••" : "",
    });
  } catch (error) {
    return apiError(error);
  }
}
