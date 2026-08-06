"use client";

import { LockKeyhole, Sparkles, UserRound } from "lucide-react";
import { App, Button, Form, Input } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  async function submit(values: { username: string; password: string }) {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "登录失败");
      router.replace("/");
      router.refresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <App>
      <main className="login-page">
        <section className="login-box">
          <div className="login-brand"><span><Sparkles size={22} /></span>商机云台</div>
          <h1>账号登录</h1>
          <p>登录后管理商机、合同、付款和供应商</p>
          <Form layout="vertical" onFinish={submit} requiredMark={false}>
            <Form.Item name="username" label="账号" rules={[{ required: true, message: "请输入账号" }]}>
              <Input size="large" prefix={<UserRound size={17} />} autoComplete="username" />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
              <Input.Password size="large" prefix={<LockKeyhole size={17} />} autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" size="large" block loading={loading}>登录</Button>
          </Form>
        </section>
      </main>
    </App>
  );
}
