import { hash } from "@node-rs/argon2";
import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { userSchema } from "@/lib/validators";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  if (auth.user.role !== "ADMIN") return NextResponse.json({ message: "无权限" }, { status: 403 });
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, username: true, role: true, enabled: true, createdAt: true },
  });
  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  if (auth.user.role !== "ADMIN") return NextResponse.json({ message: "无权限" }, { status: 403 });
  try {
    const input = userSchema.parse(await request.json());
    const passwordHash = await hash(input.password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const user = await prisma.user.create({
      data: { username: input.username, passwordHash, role: input.role },
      select: { id: true, username: true, role: true, enabled: true, createdAt: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
