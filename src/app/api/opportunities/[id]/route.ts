import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { opportunitySchema } from "@/lib/validators";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  if (auth.user.role !== "ADMIN") return NextResponse.json({ message: "仅管理员可以修改商机" }, { status: 403 });
  try {
    const { id } = await context.params;
    const input = opportunitySchema.parse(await request.json());
    const row = await prisma.$transaction(async (tx) => {
      const opportunity = await tx.opportunity.update({
        where: { id },
        data: {
          customer: input.customer,
          requirement: input.requirement || null,
          source: input.source || null,
          paymentTerms: input.paymentTerms || null,
          status: input.status,
          progress: input.progress || null,
          notes: input.notes || null,
        },
      });
      await Promise.all([
        tx.contract.updateMany({ where: { opportunityId: id }, data: { name: input.customer } }),
        tx.payment.updateMany({ where: { opportunityId: id }, data: { name: input.customer } }),
      ]);
      if (input.attachmentIds.length) {
        await tx.attachment.updateMany({
          where: { id: { in: input.attachmentIds }, uploadedById: auth.user.id, opportunityId: null, contractId: null, paymentId: null },
          data: { opportunityId: id },
        });
      }
      await tx.auditLog.create({
        data: { userId: auth.user.id, action: "UPDATE", entityType: "OPPORTUNITY", entityId: id },
      });
      return opportunity;
    });
    return NextResponse.json(row);
  } catch (error) {
    return apiError(error);
  }
}
