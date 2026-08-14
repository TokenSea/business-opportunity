import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { attachFilesSchema } from "@/lib/validators";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  if (auth.user.role !== "ADMIN") return NextResponse.json({ message: "仅管理员可以上传附件" }, { status: 403 });
  try {
    const { id } = await context.params;
    const input = attachFilesSchema.parse(await request.json());
    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
      select: { id: true, _count: { select: { attachments: true } } },
    });
    if (!opportunity) return NextResponse.json({ message: "商机不存在" }, { status: 404 });
    if (opportunity._count.attachments + input.attachmentIds.length > 20) {
      return NextResponse.json({ message: "每个商机最多上传 20 个附件" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.attachment.updateMany({
        where: {
          id: { in: input.attachmentIds },
          uploadedById: auth.user.id,
          opportunityId: null,
          contractId: null,
          paymentId: null,
        },
        data: { opportunityId: id },
      });
      if (result.count !== input.attachmentIds.length) throw new Error("附件关联失败");
      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "UPLOAD_ATTACHMENT",
          entityType: "OPPORTUNITY",
          entityId: id,
          details: { count: result.count },
        },
      });
      return result.count;
    });
    return NextResponse.json({ attached: updated });
  } catch (error) {
    return apiError(error);
  }
}
