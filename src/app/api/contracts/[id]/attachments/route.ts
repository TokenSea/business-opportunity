import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { attachFilesSchema } from "@/lib/validators";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  if (auth.user.role !== "ADMIN") {
    return NextResponse.json({ message: "仅管理员可以上传合同附件" }, { status: 403 });
  }
  try {
    const { id } = await context.params;
    const input = attachFilesSchema.parse(await request.json());
    const contract = await prisma.contract.findUnique({
      where: { id },
      select: { id: true, _count: { select: { attachments: true } } },
    });
    if (!contract) return NextResponse.json({ message: "合同不存在" }, { status: 404 });
    if (contract._count.attachments + input.attachmentIds.length > 20) {
      return NextResponse.json({ message: "每份合同最多上传 20 个附件" }, { status: 400 });
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
        data: { contractId: id },
      });
      if (result.count !== input.attachmentIds.length) throw new Error("合同附件关联失败");
      await tx.auditLog.create({
        data: { userId: auth.user.id, action: "UPLOAD_ATTACHMENT", entityType: "CONTRACT", entityId: id, details: { count: result.count } },
      });
      return result.count;
    });
    return NextResponse.json({ attached });
  } catch (error) {
    return apiError(error);
  }
}
