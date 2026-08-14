import { hash } from "@node-rs/argon2";
import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resetUserPasswordSchema } from "@/lib/validators";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  if (auth.user.role !== "ADMIN") return NextResponse.json({ message: "无权限" }, { status: 403 });

  try {
    const { id } = await context.params;
    const input = resetUserPasswordSchema.parse(await request.json());
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, username: true } });
    if (!target) return NextResponse.json({ message: "账号不存在" }, { status: 404 });

    const passwordHash = await hash(input.password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
    await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { passwordHash } }),
      prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "RESET_PASSWORD",
          entityType: "USER",
          entityId: id,
          details: { username: target.username },
        },
      }),
    ]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
