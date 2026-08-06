"use client";

import {
  Bell,
  BriefcaseBusiness,
  CircleHelp,
  FileSignature,
  Landmark,
  LogOut,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Warehouse,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Form,
  Input,
  Modal,
  Pagination,
  Select,
  Table,
  Tag,
  Tooltip,
  Upload,
  type TableColumnsType,
  type UploadFile,
} from "antd";
import { useRouter } from "next/navigation";
import { useMemo, useState, type Key } from "react";
import type { SessionUser } from "@/lib/auth";
import type { LinkedRecord, Opportunity, OpportunityStatus, PartyType, Supplier } from "@/types/business";

type PageKey = "opportunities" | "contracts" | "payments" | "suppliers";
type OpportunityForm = Omit<Opportunity, "id" | "attachments" | "createdAt" | "updatedAt">;
type SupplierForm = { name: string; account: string; password: string; notes?: string };
type LinkedForm = { type: PartyType; targetId: string; record?: UploadFile[] };
const PAGE_SIZE = 8;

const pageInfo: Record<PageKey, { title: string; subtitle: string }> = {
  opportunities: { title: "商机管理", subtitle: "集中维护客户需求、跟进进展及相关资料" },
  contracts: { title: "合同管理", subtitle: "统一查看客户与供应商的合同记录" },
  payments: { title: "付款管理", subtitle: "统一查看客户与供应商的付款记录" },
  suppliers: { title: "供应商管理", subtitle: "维护供应商名称、账号、密码与备注" },
};

const statusText: Record<OpportunityStatus, string> = {
  NOT_STARTED: "未开始",
  IN_PROGRESS: "进行中",
  FINISHED: "已结束",
};

const deleteLabels: Record<PageKey, string> = {
  opportunities: "商机",
  contracts: "合同",
  payments: "付款",
  suppliers: "供应商",
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

async function uploadFile(file?: UploadFile | File) {
  const rawFile = file instanceof File ? file : file?.originFileObj;
  if (!rawFile) return null;
  const form = new FormData();
  form.append("file", rawFile);
  return requestJson<{ id: string; originalName: string }>("/api/files", { method: "POST", body: form });
}

function RecordLink({ record, empty }: { record: LinkedRecord["recordFile"]; empty: string }) {
  if (!record) return <span className="muted-record">{empty}</span>;
  return <Tooltip title={record.originalName} mouseEnterDelay={0.4}>
    <a className="record-link" href={`/api/files/${record.id}`}><Paperclip size={14} /><span>{record.originalName}</span></a>
  </Tooltip>;
}

function CellText({ value, lines = 1 }: { value?: string | null; lines?: 1 | 2 }) {
  const text = value?.trim();
  if (!text) return <span className="cell-empty">—</span>;
  return <Tooltip title={text} mouseEnterDelay={0.4}>
    <span className={lines === 1 ? "cell-text cell-single-line" : "cell-text cell-multi-line"}>{text}</span>
  </Tooltip>;
}

export function BusinessDashboard({ user }: { user: SessionUser }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message, modal } = App.useApp();
  const [page, setPage] = useState<PageKey>("opportunities");
  const [keywords, setKeywords] = useState<Record<PageKey, string>>({
    opportunities: "",
    contracts: "",
    payments: "",
    suppliers: "",
  });
  const [status, setStatus] = useState<OpportunityStatus | "ALL">("ALL");
  const [pageNumbers, setPageNumbers] = useState<Record<PageKey, number>>({
    opportunities: 1,
    contracts: 1,
    payments: 1,
    suppliers: 1,
  });
  const [selectedIds, setSelectedIds] = useState<Record<PageKey, string[]>>({
    opportunities: [],
    contracts: [],
    payments: [],
    suppliers: [],
  });
  const [opportunityOpen, setOpportunityOpen] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [linkedOpen, setLinkedOpen] = useState<"contracts" | "payments" | null>(null);
  const [editingOpportunity, setEditingOpportunity] = useState<Opportunity | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [opportunityFiles, setOpportunityFiles] = useState<UploadFile[]>([]);
  const [linkedType, setLinkedType] = useState<PartyType>("CUSTOMER");
  const [opportunityForm] = Form.useForm<OpportunityForm>();
  const [supplierForm] = Form.useForm<SupplierForm>();
  const [linkedForm] = Form.useForm<LinkedForm>();

  const opportunitiesQuery = useQuery({
    queryKey: ["opportunities"],
    queryFn: () => requestJson<Opportunity[]>("/api/opportunities"),
  });
  const contractsQuery = useQuery({ queryKey: ["contracts"], queryFn: () => requestJson<LinkedRecord[]>("/api/contracts") });
  const paymentsQuery = useQuery({ queryKey: ["payments"], queryFn: () => requestJson<LinkedRecord[]>("/api/payments") });
  const suppliersQuery = useQuery({ queryKey: ["suppliers"], queryFn: () => requestJson<Supplier[]>("/api/suppliers") });

  const opportunities = opportunitiesQuery.data || [];
  const contracts = contractsQuery.data || [];
  const payments = paymentsQuery.data || [];
  const suppliers = suppliersQuery.data || [];

  const invalidateBusiness = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
      queryClient.invalidateQueries({ queryKey: ["contracts"] }),
      queryClient.invalidateQueries({ queryKey: ["payments"] }),
      queryClient.invalidateQueries({ queryKey: ["suppliers"] }),
    ]);
  };

  const opportunityMutation = useMutation({
    mutationFn: async (values: OpportunityForm) => {
      const uploaded = await Promise.all(opportunityFiles.map(uploadFile));
      const body = { ...values, attachmentIds: uploaded.filter(Boolean).map((file) => file!.id) };
      return requestJson(editingOpportunity ? `/api/opportunities/${editingOpportunity.id}` : "/api/opportunities", {
        method: editingOpportunity ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      message.success(editingOpportunity ? "商机已更新" : "商机已新增，合同和付款已同步生成");
      setOpportunityOpen(false);
      setEditingOpportunity(null);
      setOpportunityFiles([]);
      await invalidateBusiness();
    },
    onError: (error) => message.error(error.message),
  });

  const supplierMutation = useMutation({
    mutationFn: (values: SupplierForm) => requestJson(editingSupplier ? `/api/suppliers/${editingSupplier.id}` : "/api/suppliers", {
      method: editingSupplier ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }),
    onSuccess: async () => {
      message.success(editingSupplier ? "供应商已更新" : "供应商已新增，合同和付款已同步生成");
      setSupplierOpen(false);
      setEditingSupplier(null);
      await invalidateBusiness();
    },
    onError: (error) => message.error(error.message),
  });

  const linkedMutation = useMutation({
    mutationFn: async (values: LinkedForm) => {
      const entities = values.type === "CUSTOMER" ? opportunities : suppliers;
      const entity = entities.find((item) => item.id === values.targetId);
      const recordFile = await uploadFile(values.record?.[0]);
      return requestJson(linkedOpen === "contracts" ? "/api/contracts" : "/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: entity ? ("customer" in entity ? entity.customer : entity.name) : "",
          type: values.type,
          targetId: values.targetId,
          recordFileId: recordFile?.id || null,
        }),
      });
    },
    onSuccess: async () => {
      message.success(linkedOpen === "contracts" ? "合同已新增" : "付款已新增");
      setLinkedOpen(null);
      await invalidateBusiness();
    },
    onError: (error) => message.error(error.message),
  });

  const recordMutation = useMutation({
    mutationFn: async ({ kind, rowId, file }: { kind: "contracts" | "payments"; rowId: string; file: File }) => {
      const recordFile = await uploadFile(file);
      if (!recordFile) throw new Error("请选择文件");
      return requestJson(`/api/${kind}/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordFileId: recordFile.id }),
      });
    },
    onSuccess: async (_, variables) => {
      message.success(variables.kind === "contracts" ? "合同记录已保存" : "付款记录已保存");
      await queryClient.invalidateQueries({ queryKey: [variables.kind] });
    },
    onError: (error) => message.error(error.message),
  });

  const attachmentMutation = useMutation({
    mutationFn: async ({ opportunityId, file }: { opportunityId: string; file: File }) => {
      const uploaded = await uploadFile(file);
      if (!uploaded) throw new Error("请选择文件");
      return requestJson<{ attached: number }>(`/api/opportunities/${opportunityId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachmentIds: [uploaded.id] }),
      });
    },
    onSuccess: async () => {
      message.success("附件已上传");
      await queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: (error) => message.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ kind, ids }: { kind: PageKey; ids: string[] }) => requestJson<{ deleted: number }>(`/api/${kind}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }),
    onSuccess: async (result, variables) => {
      message.success(`已删除 ${result.deleted} 条${deleteLabels[variables.kind]}记录`);
      setSelectedIds((previous) => ({ ...previous, [variables.kind]: [] }));
      changePage(variables.kind, 1);
      await invalidateBusiness();
    },
    onError: (error) => message.error(error.message),
  });

  const filteredOpportunities = useMemo(() => opportunities.filter((item) => {
    const text = [item.customer, item.requirement, item.source, item.progress, item.notes].join(" ").toLowerCase();
    return (!keywords.opportunities || text.includes(keywords.opportunities.toLowerCase())) && (status === "ALL" || item.status === status);
  }), [keywords.opportunities, opportunities, status]);

  const filteredContracts = useMemo(() => contracts.filter((item) => {
    const text = `${item.name} ${item.type === "CUSTOMER" ? "客户" : "供应商"}`.toLowerCase();
    return !keywords.contracts || text.includes(keywords.contracts.toLowerCase());
  }), [contracts, keywords.contracts]);

  const filteredPayments = useMemo(() => payments.filter((item) => {
    const text = `${item.name} ${item.type === "CUSTOMER" ? "客户" : "供应商"}`.toLowerCase();
    return !keywords.payments || text.includes(keywords.payments.toLowerCase());
  }), [keywords.payments, payments]);

  const filteredSuppliers = useMemo(() => suppliers.filter((item) => {
    const text = [item.name, item.account, item.notes].join(" ").toLowerCase();
    return !keywords.suppliers || text.includes(keywords.suppliers.toLowerCase());
  }), [keywords.suppliers, suppliers]);

  const pagedOpportunities = filteredOpportunities.slice(
    (pageNumbers.opportunities - 1) * PAGE_SIZE,
    pageNumbers.opportunities * PAGE_SIZE,
  );
  const pagedContracts = filteredContracts.slice((pageNumbers.contracts - 1) * PAGE_SIZE, pageNumbers.contracts * PAGE_SIZE);
  const pagedPayments = filteredPayments.slice((pageNumbers.payments - 1) * PAGE_SIZE, pageNumbers.payments * PAGE_SIZE);
  const pagedSuppliers = filteredSuppliers.slice((pageNumbers.suppliers - 1) * PAGE_SIZE, pageNumbers.suppliers * PAGE_SIZE);

  function changePage(key: PageKey, current: number) {
    setPageNumbers((previous) => ({ ...previous, [key]: current }));
  }

  function changeKeyword(key: PageKey, value: string) {
    setKeywords((previous) => ({ ...previous, [key]: value }));
    changePage(key, 1);
  }

  function rowSelectionFor(key: PageKey) {
    return {
      columnWidth: 48,
      preserveSelectedRowKeys: true,
      selectedRowKeys: selectedIds[key],
      onChange: (keys: Key[]) => setSelectedIds((previous) => ({ ...previous, [key]: keys.map(String) })),
    };
  }

  function confirmDelete(kind: PageKey) {
    const ids = selectedIds[kind];
    if (!ids.length) return;
    const cascades = kind === "opportunities" || kind === "suppliers";
    modal.confirm({
      title: `删除已选${deleteLabels[kind]}`,
      content: cascades
        ? `确认删除已选的 ${ids.length} 条记录吗？对应的合同、付款和上传文件也会同步删除。`
        : `确认删除已选的 ${ids.length} 条记录吗？对应的上传文件也会同步删除。`,
      okText: "删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: () => deleteMutation.mutateAsync({ kind, ids }),
    });
  }

  const opportunityColumns: TableColumnsType<Opportunity> = [
    { title: "客户", dataIndex: "customer", width: 160, className: "strong-cell", render: (value) => <CellText value={value} /> },
    { title: "需求与现状", dataIndex: "requirement", width: 270, render: (value) => <CellText value={value} lines={2} /> },
    { title: "商机来源", dataIndex: "source", width: 250, render: (value) => <CellText value={value} lines={2} /> },
    { title: "付款条件", dataIndex: "paymentTerms", width: 170, render: (value) => <CellText value={value} /> },
    { title: "状态", dataIndex: "status", width: 120, render: (value: OpportunityStatus) => <Tag className={`status-tag status-${value.toLowerCase()}`}>{statusText[value]}</Tag> },
    { title: "进展", dataIndex: "progress", width: 260, render: (value) => <CellText value={value} lines={2} /> },
    { title: "备注", dataIndex: "notes", width: 230, render: (value) => <CellText value={value} lines={2} /> },
    {
      title: "附件",
      dataIndex: "attachments",
      width: 140,
      fixed: "right",
      render: (files: Opportunity["attachments"], row) => {
        const isUploading = attachmentMutation.isPending && attachmentMutation.variables?.opportunityId === row.id;
        return <Tooltip title="点击选择并上传附件" mouseEnterDelay={0.4}>
          <label className={`attachment-upload-trigger${isUploading ? " is-loading" : ""}`}>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
              disabled={isUploading}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) attachmentMutation.mutate({ opportunityId: row.id, file });
                event.currentTarget.value = "";
              }}
            />
            <Paperclip size={14} />
            <span>{isUploading ? "上传中…" : `${files.length} 个附件`}</span>
          </label>
        </Tooltip>;
      },
    },
    { title: "操作", width: 90, fixed: "right", render: (_, row) => <Button type="link" size="small" onClick={() => openOpportunityEdit(row)}>编辑</Button> },
  ];

  const linkedColumns = (kind: "contracts" | "payments", empty: string): TableColumnsType<LinkedRecord> => [
    { title: "名称", dataIndex: "name", width: "32%", className: "strong-cell", render: (value) => <CellText value={value} /> },
    { title: "类型", dataIndex: "type", width: "35%", render: (value: PartyType) => <Tag className={`party-tag ${value === "CUSTOMER" ? "party-customer" : "party-supplier"}`}>{value === "CUSTOMER" ? "客户" : "供应商"}</Tag> },
    {
      title: kind === "contracts" ? "合同记录" : "付款记录",
      dataIndex: "recordFile",
      width: "33%",
      render: (value, row) => <div className="record-cell">
        <RecordLink record={value} empty={empty} />
        <Upload
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
          showUploadList={false}
          beforeUpload={(file) => {
            recordMutation.mutate({ kind, rowId: row.id, file });
            return false;
          }}
        >
          <Button type="link" size="small" loading={recordMutation.isPending}>{value ? "更换" : "上传记录"}</Button>
        </Upload>
      </div>,
    },
  ];

  const supplierColumns: TableColumnsType<Supplier> = [
    { title: "名称", dataIndex: "name", width: "25%", className: "strong-cell", render: (value) => <CellText value={value} /> },
    { title: "账号", dataIndex: "account", width: "25%", render: (value) => <CellText value={value} /> },
    { title: "密码", dataIndex: "password", width: "20%", render: () => <span className="masked-password">••••••••</span> },
    { title: "备注", dataIndex: "notes", width: "25%", render: (value) => <CellText value={value} lines={2} /> },
    { title: "操作", width: "5%", render: (_, row) => <Button type="link" size="small" onClick={() => openSupplierEdit(row)}>编辑</Button> },
  ];

  function openOpportunityCreate() {
    setEditingOpportunity(null);
    setOpportunityFiles([]);
    setOpportunityOpen(true);
  }

  function openOpportunityEdit(row: Opportunity) {
    setEditingOpportunity(row);
    setOpportunityFiles([]);
    setOpportunityOpen(true);
  }

  function openSupplierCreate() {
    setEditingSupplier(null);
    setSupplierOpen(true);
  }

  function openSupplierEdit(row: Supplier) {
    setEditingSupplier(row);
    setSupplierOpen(true);
  }

  function openLinked(kind: "contracts" | "payments") {
    setLinkedType("CUSTOMER");
    setLinkedOpen(kind);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const navItems = [
    { key: "opportunities" as const, label: "商机管理", icon: BriefcaseBusiness, count: opportunities.length },
    { key: "contracts" as const, label: "合同管理", icon: FileSignature, count: contracts.length },
    { key: "payments" as const, label: "付款管理", icon: Landmark, count: payments.length },
    { key: "suppliers" as const, label: "供应商管理", icon: Warehouse, count: suppliers.length },
  ];

  const entityOptions = linkedType === "CUSTOMER"
    ? opportunities.map((item) => ({ value: item.id, label: item.customer }))
    : suppliers.map((item) => ({ value: item.id, label: item.name }));

  return (
    <App>
      <section className="app-shell">
        <header className="global-header">
          <div className="brand"><span className="brand-mark"><Sparkles size={20} /></span><span>商机云台</span></div>
          <nav className="header-links"><button>首页</button><button>关于</button></nav>
          <div className="header-actions"><button aria-label="通知"><Bell size={18} /></button><button aria-label="帮助"><CircleHelp size={18} /></button></div>
          <div className="user-summary"><span>{user.username.slice(0, 1).toUpperCase()}</span><div><b>{user.username}</b><small>{user.role === "ADMIN" ? "管理员" : "普通用户"}</small></div><button aria-label="退出登录" onClick={logout}><LogOut size={17} /></button></div>
        </header>
        <div className="workspace">
          <aside className="sidebar">
            {navItems.map((item) => <button key={item.key} className={page === item.key ? "active" : ""} onClick={() => setPage(item.key)}><item.icon size={18} /><span>{item.label}</span><small>{item.count}</small></button>)}
          </aside>
          <main className="main-area">
            <section className="business-panel">
              <div className="panel-heading"><h1>{pageInfo[page].title}</h1><p>{pageInfo[page].subtitle}</p></div>

              {page === "opportunities" && <>
                <div className="table-toolbar">
                  <Button type="primary" icon={<Plus size={16} />} onClick={openOpportunityCreate}>新建商机</Button>
                  <Button danger icon={<Trash2 size={16} />} disabled={!selectedIds.opportunities.length} loading={deleteMutation.isPending && deleteMutation.variables?.kind === "opportunities"} onClick={() => confirmDelete("opportunities")}>删除商机{selectedIds.opportunities.length ? ` (${selectedIds.opportunities.length})` : ""}</Button>
                  <div className="toolbar-spacer" />
                  <Input className="search-input" prefix={<Search size={16} />} placeholder="搜索客户、需求或进展" value={keywords.opportunities} onChange={(event) => changeKeyword("opportunities", event.target.value)} allowClear />
                  <Select value={status} onChange={(value) => { setStatus(value); changePage("opportunities", 1); }} options={[{ value: "ALL", label: "全部状态" }, ...Object.entries(statusText).map(([value, label]) => ({ value, label }))]} />
                  <Button icon={<RotateCcw size={16} />} onClick={() => { changeKeyword("opportunities", ""); setStatus("ALL"); }}>重置</Button>
                </div>
                <div className="table-holder"><Table rowKey="id" rowSelection={rowSelectionFor("opportunities")} columns={opportunityColumns} dataSource={pagedOpportunities} loading={opportunitiesQuery.isLoading} pagination={false} tableLayout="fixed" scroll={{ x: 1798 }} /></div>
                <div className="table-footer"><span>共 {filteredOpportunities.length} 条</span><Pagination current={pageNumbers.opportunities} total={filteredOpportunities.length} pageSize={PAGE_SIZE} showSizeChanger={false} onChange={(current) => changePage("opportunities", current)} /></div>
              </>}

              {page === "contracts" && <>
                <div className="table-toolbar"><Button type="primary" icon={<Plus size={16} />} onClick={() => openLinked("contracts")}>新建合同</Button><Button danger icon={<Trash2 size={16} />} disabled={!selectedIds.contracts.length} loading={deleteMutation.isPending && deleteMutation.variables?.kind === "contracts"} onClick={() => confirmDelete("contracts")}>删除合同{selectedIds.contracts.length ? ` (${selectedIds.contracts.length})` : ""}</Button><div className="toolbar-spacer" /><Input className="search-input" prefix={<Search size={16} />} placeholder="搜索名称或类型" value={keywords.contracts} onChange={(event) => changeKeyword("contracts", event.target.value)} allowClear /><Button icon={<RotateCcw size={16} />} onClick={() => changeKeyword("contracts", "")}>重置</Button></div>
                <div className="table-holder"><Table className="linked-table" rowKey="id" rowSelection={rowSelectionFor("contracts")} columns={linkedColumns("contracts", "暂无合同记录")} dataSource={pagedContracts} loading={contractsQuery.isLoading} pagination={false} tableLayout="fixed" /></div>
                <div className="table-footer"><span>共 {filteredContracts.length} 条</span><Pagination current={pageNumbers.contracts} total={filteredContracts.length} pageSize={PAGE_SIZE} showSizeChanger={false} onChange={(current) => changePage("contracts", current)} /></div>
              </>}

              {page === "payments" && <>
                <div className="table-toolbar"><Button type="primary" icon={<Plus size={16} />} onClick={() => openLinked("payments")}>新建付款</Button><Button danger icon={<Trash2 size={16} />} disabled={!selectedIds.payments.length} loading={deleteMutation.isPending && deleteMutation.variables?.kind === "payments"} onClick={() => confirmDelete("payments")}>删除付款{selectedIds.payments.length ? ` (${selectedIds.payments.length})` : ""}</Button><div className="toolbar-spacer" /><Input className="search-input" prefix={<Search size={16} />} placeholder="搜索名称或类型" value={keywords.payments} onChange={(event) => changeKeyword("payments", event.target.value)} allowClear /><Button icon={<RotateCcw size={16} />} onClick={() => changeKeyword("payments", "")}>重置</Button></div>
                <div className="table-holder"><Table className="linked-table" rowKey="id" rowSelection={rowSelectionFor("payments")} columns={linkedColumns("payments", "暂无付款记录")} dataSource={pagedPayments} loading={paymentsQuery.isLoading} pagination={false} tableLayout="fixed" /></div>
                <div className="table-footer"><span>共 {filteredPayments.length} 条</span><Pagination current={pageNumbers.payments} total={filteredPayments.length} pageSize={PAGE_SIZE} showSizeChanger={false} onChange={(current) => changePage("payments", current)} /></div>
              </>}

              {page === "suppliers" && <>
                <div className="table-toolbar"><Button type="primary" icon={<Plus size={16} />} onClick={openSupplierCreate}>新建供应商</Button><Button danger icon={<Trash2 size={16} />} disabled={!selectedIds.suppliers.length} loading={deleteMutation.isPending && deleteMutation.variables?.kind === "suppliers"} onClick={() => confirmDelete("suppliers")}>删除供应商{selectedIds.suppliers.length ? ` (${selectedIds.suppliers.length})` : ""}</Button><div className="toolbar-spacer" /><Input className="search-input" prefix={<Search size={16} />} placeholder="搜索名称、账号或备注" value={keywords.suppliers} onChange={(event) => changeKeyword("suppliers", event.target.value)} allowClear /><Button icon={<RotateCcw size={16} />} onClick={() => changeKeyword("suppliers", "")}>重置</Button></div>
                <div className="table-holder"><Table rowKey="id" rowSelection={rowSelectionFor("suppliers")} columns={supplierColumns} dataSource={pagedSuppliers} loading={suppliersQuery.isLoading} pagination={false} tableLayout="fixed" scroll={{ x: 1148 }} /></div>
                <div className="table-footer"><span>共 {filteredSuppliers.length} 条</span><Pagination current={pageNumbers.suppliers} total={filteredSuppliers.length} pageSize={PAGE_SIZE} showSizeChanger={false} onChange={(current) => changePage("suppliers", current)} /></div>
              </>}
            </section>
          </main>
        </div>
      </section>

      <Modal title={editingOpportunity ? "编辑商机" : "新建商机"} open={opportunityOpen} onCancel={() => setOpportunityOpen(false)} footer={null} width={760} centered destroyOnHidden styles={{ body: { maxHeight: "calc(100vh - 150px)", overflowY: "auto", paddingRight: 4 } }}>
        <Form
          form={opportunityForm}
          layout="vertical"
          onFinish={(values) => opportunityMutation.mutate(values)}
          requiredMark={false}
          initialValues={editingOpportunity ? {
            customer: editingOpportunity.customer,
            requirement: editingOpportunity.requirement || "",
            source: editingOpportunity.source || "",
            paymentTerms: editingOpportunity.paymentTerms || "",
            status: editingOpportunity.status,
            progress: editingOpportunity.progress || "",
            notes: editingOpportunity.notes || "",
          } : { status: "NOT_STARTED" }}
        >
          <Form.Item name="customer" label="客户" rules={[{ required: true, message: "请输入客户名称" }]}><Input /></Form.Item>
          <div className="two-fields"><Form.Item name="requirement" label="需求与现状"><Input.TextArea rows={3} /></Form.Item><Form.Item name="source" label="商机来源"><Input.TextArea rows={3} /></Form.Item></div>
          <div className="two-fields"><Form.Item name="paymentTerms" label="付款条件"><Input /></Form.Item><Form.Item name="status" label="状态" rules={[{ required: true }]}><Select options={Object.entries(statusText).map(([value, label]) => ({ value, label }))} /></Form.Item></div>
          <div className="two-fields"><Form.Item name="progress" label="进展"><Input.TextArea rows={3} /></Form.Item><Form.Item name="notes" label="备注"><Input.TextArea rows={3} /></Form.Item></div>
          <Form.Item label="附件"><Upload multiple beforeUpload={() => false} fileList={opportunityFiles} onChange={({ fileList }) => setOpportunityFiles(fileList)}><Button icon={<Paperclip size={16} />}>选择附件</Button></Upload></Form.Item>
          <div className="modal-actions"><Button onClick={() => setOpportunityOpen(false)}>取消</Button><Button type="primary" htmlType="submit" loading={opportunityMutation.isPending}>保存商机</Button></div>
        </Form>
      </Modal>

      <Modal title={editingSupplier ? "编辑供应商" : "新建供应商"} open={supplierOpen} onCancel={() => setSupplierOpen(false)} footer={null} centered destroyOnHidden styles={{ body: { maxHeight: "calc(100vh - 150px)", overflowY: "auto", paddingRight: 4 } }}>
        <Form
          form={supplierForm}
          layout="vertical"
          onFinish={(values) => supplierMutation.mutate(values)}
          requiredMark={false}
          initialValues={editingSupplier ? {
            name: editingSupplier.name,
            account: editingSupplier.account,
            password: "",
            notes: editingSupplier.notes || "",
          } : undefined}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入供应商名称" }]}><Input /></Form.Item>
          <Form.Item name="account" label="账号" rules={[{ required: true, message: "请输入账号" }]}><Input /></Form.Item>
          <Form.Item name="password" label={editingSupplier ? "密码（不修改可留空）" : "密码"} rules={[{ required: !editingSupplier, message: "请输入密码" }]}><Input.Password placeholder={editingSupplier ? "留空则保留原密码" : ""} /></Form.Item>
          <Form.Item name="notes" label="备注"><Input.TextArea rows={4} /></Form.Item>
          <div className="modal-actions"><Button onClick={() => setSupplierOpen(false)}>取消</Button><Button type="primary" htmlType="submit" loading={supplierMutation.isPending}>保存供应商</Button></div>
        </Form>
      </Modal>

      <Modal title={linkedOpen === "contracts" ? "新建合同" : "新建付款"} open={Boolean(linkedOpen)} onCancel={() => setLinkedOpen(null)} footer={null} centered destroyOnHidden styles={{ body: { maxHeight: "calc(100vh - 150px)", overflowY: "auto", paddingRight: 4 } }}>
        <Form form={linkedForm} layout="vertical" onFinish={(values) => linkedMutation.mutate(values)} requiredMark={false} initialValues={{ type: "CUSTOMER" }}>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}><Select options={[{ value: "CUSTOMER", label: "客户" }, { value: "SUPPLIER", label: "供应商" }]} onChange={(value) => { setLinkedType(value); linkedForm.setFieldValue("targetId", undefined); }} /></Form.Item>
          <Form.Item name="targetId" label="名称" rules={[{ required: true, message: "请选择名称" }]}><Select showSearch optionFilterProp="label" options={entityOptions} placeholder="请选择关联对象" /></Form.Item>
          <Form.Item name="record" label={linkedOpen === "contracts" ? "合同记录" : "付款记录"} valuePropName="fileList" getValueFromEvent={(event) => event?.fileList}><Upload maxCount={1} beforeUpload={() => false}><Button icon={<Paperclip size={16} />}>选择文件</Button></Upload></Form.Item>
          <div className="modal-actions"><Button onClick={() => setLinkedOpen(null)}>取消</Button><Button type="primary" htmlType="submit" loading={linkedMutation.isPending}>{linkedOpen === "contracts" ? "保存合同" : "保存付款"}</Button></div>
        </Form>
      </Modal>
    </App>
  );
}
