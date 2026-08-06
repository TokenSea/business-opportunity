import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth";

export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ message: "未登录" }, { status: 401 }) };
  return { user };
}

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { message: "提交的数据不正确", issues: error.issues },
      { status: 400 },
    );
  }
  console.error(error);
  return NextResponse.json({ message: "服务器处理失败" }, { status: 500 });
}
