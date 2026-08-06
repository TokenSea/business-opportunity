import { verify } from "@node-rs/argon2";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { username: input.username } });
    if (!user?.enabled || !(await verify(user.passwordHash, input.password))) {
      return NextResponse.json({ message: "账号或密码错误" }, { status: 401 });
    }
    await createSession({ id: user.id, username: user.username, role: user.role });
    return NextResponse.json({ id: user.id, username: user.username, role: user.role });
  } catch (error) {
    return apiError(error);
  }
}
