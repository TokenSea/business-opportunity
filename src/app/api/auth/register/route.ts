import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ message: "公开注册已关闭，请联系管理员创建账号" }, { status: 403 });
}
