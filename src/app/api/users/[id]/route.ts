import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { userUpdateSchema } from "@/lib/validators";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  if (auth.user.role !== "ADMIN") return NextResponse.json({ message: "无权限" }, { status: 403 });

  try {
    const { id } = await context.params;
    const input = userUpdateSchema.parse(await request.json());
    const user = await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({
        where: { id },
        select: { id: true, username: true, role: true, enabled: true, deletedAt: true },
      });
      if (!current || current.deletedAt) throw new Error("USER_NOT_FOUND");

      const nextRole = input.role ?? current.role;
      const nextEnabled = input.enabled ?? current.enabled;
      if (id === auth.user.id && (nextRole !== "ADMIN" || !nextEnabled)) throw new Error("CANNOT_DISABLE_SELF");

      if (current.role === "ADMIN" && current.enabled && (nextRole !== "ADMIN" || !nextEnabled)) {
        const enabledAdminCount = await tx.user.count({ where: { role: "ADMIN", enabled: true, deletedAt: null } });
        if (enabledAdminCount <= 1) throw new Error("LAST_ENABLED_ADMIN");
      }

      const updated = await tx.user.update({
        where: { id },
        data: { role: nextRole, enabled: nextEnabled },
        select: { id: true, username: true, role: true, enabled: true, createdAt: true },
      });
      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "UPDATE",
          entityType: "USER",
          entityId: id,
          details: {
            username: current.username,
            previousRole: current.role,
            role: updated.role,
            previousEnabled: current.enabled,
            enabled: updated.enabled,
          },
        },
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return NextResponse.json({ message: "账号不存在" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "CANNOT_DISABLE_SELF") {
      return NextResponse.json({ message: "不能停用自己或取消自己的管理员权限" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "LAST_ENABLED_ADMIN") {
      return NextResponse.json({ message: "系统必须至少保留一个启用状态的管理员" }, { status: 400 });
    }
    return apiError(error);
  }
}
