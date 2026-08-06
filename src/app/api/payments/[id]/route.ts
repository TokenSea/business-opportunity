import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { linkedRecordFileSchema } from "@/lib/validators";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const input = linkedRecordFileSchema.parse(await request.json());
    const row = await prisma.$transaction(async (tx) => {
      const attached = await tx.attachment.updateMany({
        where: { id: input.recordFileId, uploadedById: auth.user.id, opportunityId: null, contractId: null, paymentId: null },
        data: { paymentId: id },
      });
      if (attached.count !== 1) throw new Error("付款附件关联失败");
      await tx.payment.update({ where: { id }, data: { recordFileId: input.recordFileId } });
      await tx.auditLog.create({
        data: { userId: auth.user.id, action: "UPLOAD_RECORD", entityType: "PAYMENT", entityId: id },
      });
      return tx.payment.findUniqueOrThrow({
        where: { id },
        include: {
          recordFile: { select: { id: true, originalName: true, mimeType: true } },
          attachments: { orderBy: { createdAt: "desc" }, select: { id: true, originalName: true, mimeType: true } },
        },
      });
    });
    return NextResponse.json(row);
  } catch (error) {
    return apiError(error);
  }
}
