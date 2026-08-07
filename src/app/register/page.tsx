"use client";

import { LockKeyhole, Sparkles, UserRound } from "lucide-react";
import { App, Button, Form, Input } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type RegisterValues = {
  username: string;
  password: string;
  confirmPassword: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  async function submit({ username, password }: RegisterValues) {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "注册失败");
      router.replace("/");
      router.refresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "注册失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <App>
      <main className="login-page">
        <section className="login-box">
          <div className="login-brand"><span><Sparkles size={22} /></span>商机云台</div>
          <h1>创建账号</h1>
          <p>注册后即可进入商机云台，查看业务信息</p>
          <Form<RegisterValues> layout="vertical" onFinish={submit} requiredMark={false}>
            <Form.Item
              name="username"
              label="账号"
              rules={[
                { required: true, message: "请输入账号" },
                { min: 2, max: 64, message: "账号长度为 2-64 个字符" },
              ]}
            >
              <Input size="large" prefix={<UserRound size={17} />} autoComplete="username" placeholder="请输入账号" />
            </Form.Item>
            <Form.Item
              name="password"
              label="密码"
              rules={[
                { required: true, message: "请输入密码" },
                { min: 8, message: "密码至少为 8 位" },
              ]}
            >
              <Input.Password size="large" prefix={<LockKeyhole size={17} />} autoComplete="new-password" placeholder="至少 8 位" />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              label="确认密码"
              dependencies={["password"]}
              rules={[
                { required: true, message: "请再次输入密码" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("password") === value) return Promise.resolve();
                    return Promise.reject(new Error("两次输入的密码不一致"));
                  },
                }),
              ]}
            >
              <Input.Password size="large" prefix={<LockKeyhole size={17} />} autoComplete="new-password" placeholder="请再次输入密码" />
            </Form.Item>
            <p className="auth-hint">新注册账号默认拥有普通用户权限。</p>
            <Button type="primary" htmlType="submit" size="large" block loading={loading}>注册并登录</Button>
          </Form>
          <p className="auth-footer">已有账号？<Link href="/login">去登录</Link></p>
        </section>
      </main>
    </App>
  );
}
