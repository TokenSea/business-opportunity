"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Form, Input, Modal, Pagination, Select, Switch, Table, Tag, type TableColumnsType } from "antd";
import { KeyRound, Plus, RotateCcw, Search, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { SessionUser } from "@/lib/auth";

type ManagedUser = {
  id: string;
  username: string;
  role: "ADMIN" | "USER";
  enabled: boolean;
  createdAt: string;
};

type CreateUserForm = {
  username: string;
  password: string;
  confirmPassword: string;
  role: "ADMIN" | "USER";
};

type RoleFilter = "ALL" | ManagedUser["role"];
type StatusFilter = "ALL" | "ENABLED" | "DISABLED";
const PAGE_SIZE = 8;

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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AccountManagement({ currentUser }: { currentUser: SessionUser }) {
  const queryClient = useQueryClient();
  const { message, modal } = App.useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [keyword, setKeyword] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [createForm] = Form.useForm<CreateUserForm>();
  const [resetForm] = Form.useForm<{ password: string; confirmPassword: string }>();

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => requestJson<ManagedUser[]>("/api/users"),
  });

  const createMutation = useMutation({
    mutationFn: ({ confirmPassword: _confirmPassword, ...values }: CreateUserForm) => requestJson<ManagedUser>("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }),
    onSuccess: async () => {
      message.success("账号已创建");
      setCreateOpen(false);
      createForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => message.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...values }: { id: string; role?: ManagedUser["role"]; enabled?: boolean }) => requestJson<ManagedUser>(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }),
    onSuccess: async () => {
      message.success("账号状态已更新");
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => message.error(error.message),
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => requestJson<{ success: boolean }>(`/api/users/${id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }),
    onSuccess: () => {
      message.success("密码已重置");
      setResetTarget(null);
      resetForm.resetFields();
    },
    onError: (error) => message.error(error.message),
  });

  const users = usersQuery.data || [];
  const filteredUsers = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return users.filter((item) => {
      const matchesKeyword = !normalized || item.username.toLowerCase().includes(normalized);
      const matchesRole = roleFilter === "ALL" || item.role === roleFilter;
      const matchesStatus = statusFilter === "ALL"
        || (statusFilter === "ENABLED" ? item.enabled : !item.enabled);
      return matchesKeyword && matchesRole && matchesStatus;
    });
  }, [keyword, roleFilter, statusFilter, users]);
  const pagedUsers = useMemo(() => filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredUsers, page]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
    if (page > maxPage) setPage(maxPage);
  }, [filteredUsers.length, page]);

  function confirmRoleChange(row: ManagedUser, role: ManagedUser["role"]) {
    if (role === row.role) return;
    modal.confirm({
      title: "修改账号角色",
      content: `确认将“${row.username}”调整为${role === "ADMIN" ? "管理员" : "普通用户"}吗？`,
      okText: "确认修改",
      cancelText: "取消",
      onOk: () => updateMutation.mutateAsync({ id: row.id, role }),
    });
  }

  function confirmEnabledChange(row: ManagedUser, enabled: boolean) {
    modal.confirm({
      title: enabled ? "启用账号" : "停用账号",
      content: enabled
        ? `确认启用“${row.username}”吗？`
        : `确认停用“${row.username}”吗？停用后该账号将无法继续访问系统。`,
      okText: enabled ? "启用" : "停用",
      cancelText: "取消",
      okButtonProps: enabled ? undefined : { danger: true },
      onOk: () => updateMutation.mutateAsync({ id: row.id, enabled }),
    });
  }

  const columns: TableColumnsType<ManagedUser> = [
    {
      title: "账号",
      dataIndex: "username",
      width: 220,
      className: "strong-cell",
      render: (value: string, row) => <div className="account-name-cell">
        <span>{value.slice(0, 1).toUpperCase()}</span>
        <div><strong>{value}</strong>{row.id === currentUser.id && <small>当前账号</small>}</div>
      </div>,
    },
    {
      title: "角色",
      dataIndex: "role",
      width: 180,
      render: (value: ManagedUser["role"], row) => <Select
        value={value}
        disabled={row.id === currentUser.id || updateMutation.isPending}
        aria-label={`修改${row.username}的角色`}
        options={[{ value: "ADMIN", label: "管理员" }, { value: "USER", label: "普通用户" }]}
        onChange={(role) => confirmRoleChange(row, role)}
      />,
    },
    {
      title: "状态",
      dataIndex: "enabled",
      width: 170,
      render: (enabled: boolean, row) => <div className="account-status-cell">
        <Switch
          checked={enabled}
          disabled={row.id === currentUser.id || updateMutation.isPending}
          aria-label={`${enabled ? "停用" : "启用"}${row.username}`}
          onChange={(checked) => confirmEnabledChange(row, checked)}
        />
        <Tag color={enabled ? "success" : "default"}>{enabled ? "已启用" : "已停用"}</Tag>
      </div>,
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      width: 210,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: "操作",
      key: "actions",
      width: 160,
      render: (_, row) => <Button icon={<KeyRound size={15} />} onClick={() => {
        setResetTarget(row);
      }}>重置密码</Button>,
    },
  ];

  return <>
    <div className="table-toolbar account-toolbar">
      <Button type="primary" className="create-record-button" icon={<Plus size={16} />} onClick={() => {
        setCreateOpen(true);
      }}>新建账号</Button>
      <div className="toolbar-spacer" />
      <Input className="search-input" prefix={<Search size={16} />} placeholder="搜索账号" value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1); }} allowClear />
      <Select
        value={roleFilter}
        aria-label="按角色筛选"
        options={[{ value: "ALL", label: "全部角色" }, { value: "ADMIN", label: "管理员" }, { value: "USER", label: "普通用户" }]}
        onChange={(value: RoleFilter) => { setRoleFilter(value); setPage(1); }}
      />
      <Select
        value={statusFilter}
        aria-label="按状态筛选"
        options={[{ value: "ALL", label: "全部状态" }, { value: "ENABLED", label: "已启用" }, { value: "DISABLED", label: "已停用" }]}
        onChange={(value: StatusFilter) => { setStatusFilter(value); setPage(1); }}
      />
      <Button icon={<RotateCcw size={16} />} onClick={() => { setKeyword(""); setRoleFilter("ALL"); setStatusFilter("ALL"); setPage(1); }}>重置</Button>
    </div>
    <div className="table-holder account-table-holder">
      <Table
        rowKey="id"
        columns={columns}
        dataSource={pagedUsers}
        loading={usersQuery.isLoading}
        pagination={false}
        tableLayout="fixed"
        scroll={{ x: 940 }}
      />
    </div>
    <div className="table-footer"><span>共 {filteredUsers.length} 个账号</span><span className="account-security-note"><ShieldCheck size={15} />账号只能停用，业务及审计记录会被保留</span><Pagination current={page} pageSize={PAGE_SIZE} total={filteredUsers.length} showSizeChanger={false} onChange={setPage} /></div>

    <Modal title="新建账号" open={createOpen} onCancel={() => { setCreateOpen(false); createForm.resetFields(); }} footer={null} centered destroyOnHidden>
      <Form form={createForm} layout="vertical" onFinish={(values) => createMutation.mutate(values)} requiredMark={false} initialValues={{ role: "USER" }}>
        <Form.Item name="username" label="账号" rules={[{ required: true, message: "请输入账号" }, { min: 2, max: 64, message: "账号长度为 2-64 个字符" }]}><Input autoComplete="off" /></Form.Item>
        <Form.Item name="role" label="角色" rules={[{ required: true }]}><Select options={[{ value: "USER", label: "普通用户（只读）" }, { value: "ADMIN", label: "管理员" }]} /></Form.Item>
        <Form.Item name="password" label="初始密码" rules={[{ required: true, message: "请输入初始密码" }, { min: 8, message: "密码至少为 8 位" }]}><Input.Password autoComplete="new-password" /></Form.Item>
        <Form.Item name="confirmPassword" label="确认密码" dependencies={["password"]} rules={[
          { required: true, message: "请再次输入密码" },
          ({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue("password") === value ? Promise.resolve() : Promise.reject(new Error("两次输入的密码不一致")); } }),
        ]}><Input.Password autoComplete="new-password" /></Form.Item>
        <div className="modal-actions"><Button onClick={() => setCreateOpen(false)}>取消</Button><Button type="primary" htmlType="submit" loading={createMutation.isPending}>创建账号</Button></div>
      </Form>
    </Modal>

    <Modal title={resetTarget ? `重置密码 · ${resetTarget.username}` : "重置密码"} open={Boolean(resetTarget)} onCancel={() => { setResetTarget(null); resetForm.resetFields(); }} footer={null} centered destroyOnHidden>
      <Form form={resetForm} layout="vertical" onFinish={(values) => resetTarget && resetMutation.mutate({ id: resetTarget.id, password: values.password })} requiredMark={false}>
        <p className="account-reset-tip">重置后请通过安全渠道将新密码告知该用户。</p>
        <Form.Item name="password" label="新密码" rules={[{ required: true, message: "请输入新密码" }, { min: 8, message: "密码至少为 8 位" }]}><Input.Password autoComplete="new-password" /></Form.Item>
        <Form.Item name="confirmPassword" label="确认新密码" dependencies={["password"]} rules={[
          { required: true, message: "请再次输入新密码" },
          ({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue("password") === value ? Promise.resolve() : Promise.reject(new Error("两次输入的密码不一致")); } }),
        ]}><Input.Password autoComplete="new-password" /></Form.Item>
        <div className="modal-actions"><Button onClick={() => setResetTarget(null)}>取消</Button><Button type="primary" htmlType="submit" loading={resetMutation.isPending}>确认重置</Button></div>
      </Form>
    </Modal>
  </>;
}
