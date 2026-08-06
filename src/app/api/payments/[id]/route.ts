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
    const row = await prisma.payment.update({
      where: { id },
      data: { recordFileId: input.recordFileId },
      include: { recordFile: { select: { id: true, originalName: true } } },
    });
    await prisma.auditLog.create({
      data: { userId: auth.user.id, action: "UPLOAD_RECORD", entityType: "PAYMENT", entityId: id },
    });
    return NextResponse.json(row);
  } catch (error) {
    return apiError(error);
  }
}
