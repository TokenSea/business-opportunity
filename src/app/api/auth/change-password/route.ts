import { hash, verify } from "@node-rs/argon2";
import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { changePasswordSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;

  try {
    const input = changePasswordSchema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { id: auth.user.id }, select: { passwordHash: true } });
    if (!user || !(await verify(user.passwordHash, input.currentPassword))) {
      return NextResponse.json({ message: "当前密码不正确" }, { status: 400 });
    }
    if (await verify(user.passwordHash, input.newPassword)) {
      return NextResponse.json({ message: "新密码不能与当前密码相同" }, { status: 400 });
    }

    const passwordHash = await hash(input.newPassword, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
    await prisma.$transaction([
      prisma.user.update({ where: { id: auth.user.id }, data: { passwordHash } }),
      prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "CHANGE_PASSWORD",
          entityType: "USER",
          entityId: auth.user.id,
          details: { username: auth.user.username },
        },
      }),
    ]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
