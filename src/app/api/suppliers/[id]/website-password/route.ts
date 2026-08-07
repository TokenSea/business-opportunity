import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { decryptSupplierPassword } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  if (auth.user.role !== "ADMIN") return NextResponse.json({ message: "仅管理员可以查看官网密码" }, { status: 403 });

  try {
    const { id } = await context.params;
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      select: {
        encryptedWebsitePassword: true,
        websitePasswordIv: true,
        websitePasswordTag: true,
      },
    });
    if (!supplier) return NextResponse.json({ message: "供应商不存在" }, { status: 404 });

    const password = supplier.encryptedWebsitePassword && supplier.websitePasswordIv && supplier.websitePasswordTag
      ? decryptSupplierPassword(supplier.encryptedWebsitePassword, supplier.websitePasswordIv, supplier.websitePasswordTag)
      : "";
    return NextResponse.json({ password }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
