import { hash } from "@node-rs/argon2";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const input = registerSchema.parse(await request.json());
    const passwordHash = await hash(input.password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const user = await prisma.user.create({
      data: { username: input.username, passwordHash, role: "USER" },
      select: { id: true, username: true, role: true },
    });
    await createSession(user);
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ message: "该账号已被注册" }, { status: 409 });
    }
    return apiError(error);
  }
}
