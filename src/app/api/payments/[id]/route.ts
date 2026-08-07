import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { linkedRecordUpdateSchema } from "@/lib/validators";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  if (auth.user.role !== "ADMIN") {
    return NextResponse.json({ message: "仅管理员可以修改付款记录" }, { status: 403 });
  }
  try {
    const { id } = await context.params;
    const input = linkedRecordUpdateSchema.parse(await request.json());
    const row = await prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id }, data: { name: input.name, notes: input.notes || null } });
      await tx.auditLog.create({
        data: { userId: auth.user.id, action: "UPDATE", entityType: "PAYMENT", entityId: id },
      });
      return tx.payment.findUniqueOrThrow({
        where: { id },
        include: {
          recordFile: { select: { id: true, originalName: true, mimeType: true, createdAt: true } },
          attachments: { orderBy: { createdAt: "desc" }, select: { id: true, originalName: true, mimeType: true, createdAt: true } },
        },
      });
    });
    return NextResponse.json(row);
  } catch (error) {
    return apiError(error);
  }
}
