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
    const encrypted = input.password ? encryptSupplierPassword(input.password) : {};
    const row = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.update({
        where: { id },
        data: { name: input.name, account: input.account, notes: input.notes || null, ...encrypted },
      });
      await Promise.all([
        tx.contract.updateMany({ where: { supplierId: id }, data: { name: input.name } }),
        tx.payment.updateMany({ where: { supplierId: id }, data: { name: input.name } }),
      ]);
      await tx.auditLog.create({
        data: { userId: auth.user.id, action: "UPDATE", entityType: "SUPPLIER", entityId: id },
      });
      return supplier;
    });
    return NextResponse.json({ ...row, encryptedPassword: undefined, passwordIv: undefined, passwordTag: undefined, password: "••••••••" });
  } catch (error) {
    return apiError(error);
  }
}
