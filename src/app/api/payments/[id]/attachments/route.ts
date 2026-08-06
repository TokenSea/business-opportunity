import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { attachFilesSchema } from "@/lib/validators";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const input = attachFilesSchema.parse(await request.json());
    const payment = await prisma.payment.findUnique({
      where: { id },
      select: { id: true, _count: { select: { attachments: true } } },
    });
    if (!payment) return NextResponse.json({ message: "付款记录不存在" }, { status: 404 });
    if (payment._count.attachments + input.attachmentIds.length > 20) {
      return NextResponse.json({ message: "每条付款记录最多上传 20 个附件" }, { status: 400 });
    }

    const attached = await prisma.$transaction(async (tx) => {
      const result = await tx.attachment.updateMany({
        where: {
          id: { in: input.attachmentIds },
          uploadedById: auth.user.id,
          opportunityId: null,
          contractId: null,
          paymentId: null,
        },
        data: { paymentId: id },
      });
      if (result.count !== input.attachmentIds.length) throw new Error("付款附件关联失败");
      await tx.auditLog.create({
        data: { userId: auth.user.id, action: "UPLOAD_ATTACHMENT", entityType: "PAYMENT", entityId: id, details: { count: result.count } },
      });
      return result.count;
    });
    return NextResponse.json({ attached });
  } catch (error) {
    return apiError(error);
  }
}
