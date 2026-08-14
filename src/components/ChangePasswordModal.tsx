"use client";

import { useMutation } from "@tanstack/react-query";
import { App, Button, Form, Input, Modal } from "antd";
import { KeyRound } from "lucide-react";
import { useState } from "react";

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) {
    window.location.href = "/login";
    throw new Error("登录已过期");
  }
  if (!response.ok) throw new Error(body.message || "请求失败");
  return body as T;
}

export function ChangePasswordModal() {
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<PasswordForm>();
  const mutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: PasswordForm) => requestJson<{ success: boolean }>("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
    onSuccess: () => {
      message.success("密码修改成功");
      setOpen(false);
      form.resetFields();
    },
    onError: (error) => message.error(error.message),
  });

  return <>
    <button type="button" className="user-password-button" aria-label="修改密码" onClick={() => setOpen(true)}><KeyRound size={15} /><span>修改密码</span></button>
    <Modal
      title="修改密码"
      open={open}
      onCancel={() => { setOpen(false); form.resetFields(); }}
      footer={null}
      centered
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false} onFinish={(values) => mutation.mutate(values)}>
        <Form.Item name="currentPassword" label="当前密码" rules={[{ required: true, message: "请输入当前密码" }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item name="newPassword" label="新密码" rules={[{ required: true, message: "请输入新密码" }, { min: 8, message: "密码至少为 8 位" }]}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item name="confirmPassword" label="确认新密码" dependencies={["newPassword"]} rules={[
          { required: true, message: "请再次输入新密码" },
          ({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue("newPassword") === value ? Promise.resolve() : Promise.reject(new Error("两次输入的新密码不一致")); } }),
        ]}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <div className="modal-actions">
          <Button onClick={() => { setOpen(false); form.resetFields(); }}>取消</Button>
          <Button type="primary" htmlType="submit" loading={mutation.isPending}>保存新密码</Button>
        </div>
      </Form>
    </Modal>
  </>;
}
