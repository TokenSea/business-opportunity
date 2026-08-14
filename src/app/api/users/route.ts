import { hash } from "@node-rs/argon2";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { deleteIdsSchema, userSchema } from "@/lib/validators";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  if (auth.user.role !== "ADMIN") return NextResponse.json({ message: "无权限" }, { status: 403 });
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, username: true, role: true, enabled: true, createdAt: true },
  });
  return NextResponse.json(users);
}

export async function DELETE(request: Request) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  if (auth.user.role !== "ADMIN") return NextResponse.json({ message: "无权限" }, { status: 403 });

  try {
    const { ids } = deleteIdsSchema.parse(await request.json());
    if (ids.includes(auth.user.id)) {
      return NextResponse.json({ message: "不能删除当前登录账号" }, { status: 400 });
    }

    const deleted = await prisma.$transaction(async (tx) => {
      const targets = await tx.user.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: { id: true, username: true, role: true, enabled: true },
      });
      const enabledAdminCount = await tx.user.count({ where: { role: "ADMIN", enabled: true, deletedAt: null } });
      const deletingEnabledAdmins = targets.filter((item) => item.role === "ADMIN" && item.enabled).length;
      if (enabledAdminCount - deletingEnabledAdmins < 1) throw new Error("LAST_ENABLED_ADMIN");

      const targetIds = targets.map((item) => item.id);
      if (targetIds.length) {
        await tx.user.updateMany({
          where: { id: { in: targetIds }, deletedAt: null },
          data: { enabled: false, deletedAt: new Date() },
        });
        for (const target of targets) {
          await tx.auditLog.create({
            data: {
              userId: auth.user.id,
              action: "DELETE",
              entityType: "USER",
              entityId: target.id,
              details: { username: target.username, role: target.role },
            },
          });
        }
      }
      return targetIds.length;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ deleted });
  } catch (error) {
    if (error instanceof Error && error.message === "LAST_ENABLED_ADMIN") {
      return NextResponse.json({ message: "系统必须至少保留一个启用状态的管理员" }, { status: 400 });
    }
    return apiError(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  if (auth.user.role !== "ADMIN") return NextResponse.json({ message: "无权限" }, { status: 403 });
  try {
    const input = userSchema.parse(await request.json());
    const passwordHash = await hash(input.password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { username: input.username, passwordHash, role: input.role },
        select: { id: true, username: true, role: true, enabled: true, createdAt: true },
      });
      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "CREATE",
          entityType: "USER",
          entityId: created.id,
          details: { username: created.username, role: created.role },
        },
      });
      return created;
    });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ message: "该账号已存在" }, { status: 409 });
    }
    return apiError(error);
  }
}
