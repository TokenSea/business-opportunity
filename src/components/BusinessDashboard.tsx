"use client";

import {
  Bell,
  BriefcaseBusiness,
  CircleHelp,
  Download,
  Eye,
  FileText,
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
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Pagination,
  Popover,
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
import type { AttachmentRef, LinkedRecord, Opportunity, OpportunityStatus, PartyType, Supplier } from "@/types/business";

type PageKey = "opportunities" | "contracts" | "payments" | "suppliers";
type VisiblePageKey = "opportunities" | "suppliers";
type OpportunityForm = Omit<Opportunity, "id" | "attachments" | "createdAt" | "updatedAt">;
type SupplierForm = { name: string; account: string; password: string; notes?: string };
type LinkedForm = { record?: UploadFile[] };
type LinkedCreateTarget = { kind: "contracts" | "payments"; type: PartyType; targetId: string; name: string };
type EditableOpportunityField = "customer" | "requirement" | "source" | "paymentTerms" | "progress" | "notes";
type EditableSupplierField = "name" | "account" | "password" | "notes";
type AttachmentKind = "opportunities" | "contracts" | "payments";
const PAGE_SIZE = 8;

const pageInfo: Record<VisiblePageKey, { title: string; subtitle: string }> = {
  opportunities: { title: "商机管理", subtitle: "点击任意商机查看基本信息、合同、付款及相关资料" },
  suppliers: { title: "供应商管理", subtitle: "点击任意供应商查看基本信息、合同与付款记录" },
};

const statusText: Record<OpportunityStatus, string> = {
  NOT_STARTED: "未开始",
  IN_PROGRESS: "进行中",
  FINISHED: "已结束",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

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

function CellText({ value, lines = 1 }: { value?: string | null; lines?: 1 | 2 }) {
  const text = value?.trim();
  if (!text) return <span className="cell-empty">—</span>;
  return <Tooltip title={text} mouseEnterDelay={0.4}>
    <span className={lines === 1 ? "cell-text cell-single-line" : "cell-text cell-multi-line"}>{text}</span>
  </Tooltip>;
}

function EditableTextCell({
  value,
  lines = 1,
  editable,
  label,
  onSave,
}: {
  value?: string | null;
  lines?: 1 | 2;
  editable: boolean;
  label: string;
  onSave: (value: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [saving, setSaving] = useState(false);
  if (!editable) return <CellText value={value} lines={lines} />;

  async function save() {
    setSaving(true);
    try {
      await onSave(draft.trim());
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return <Popover
    open={open}
    onOpenChange={(next) => {
      if (next) setDraft(value || "");
      setOpen(next);
    }}
    trigger="click"
    placement="bottom"
    content={<div className="inline-editor">
      <strong>修改{label}</strong>
      {lines === 2
        ? <Input.TextArea value={draft} onChange={(event) => setDraft(event.target.value)} autoSize={{ minRows: 3, maxRows: 6 }} autoFocus />
        : <Input value={draft} onChange={(event) => setDraft(event.target.value)} onPressEnter={() => void save()} autoFocus />}
      <div className="inline-editor-actions"><Button size="small" onClick={() => setOpen(false)}>取消</Button><Button size="small" type="primary" loading={saving} onClick={() => void save()}>保存</Button></div>
    </div>}
  >
    <button type="button" className="editable-cell-button" aria-label={`修改${label}`}><CellText value={value} lines={lines} /></button>
  </Popover>;
}

function EditablePasswordCell({ editable, onSave }: { editable: boolean; onSave: (value: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const masked = <span className="masked-password">••••••••</span>;
  if (!editable) return masked;

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await onSave(draft);
      setOpen(false);
      setDraft("");
    } finally {
      setSaving(false);
    }
  }

  return <Popover
    open={open}
    onOpenChange={(next) => {
      if (next) setDraft("");
      setOpen(next);
    }}
    trigger="click"
    placement="bottom"
    content={<div className="inline-editor">
      <strong>修改密码</strong>
      <Input.Password value={draft} placeholder="请输入新密码" onChange={(event) => setDraft(event.target.value)} onPressEnter={() => void save()} autoFocus />
      <div className="inline-editor-actions"><Button size="small" onClick={() => setOpen(false)}>取消</Button><Button size="small" type="primary" disabled={!draft} loading={saving} onClick={() => void save()}>保存</Button></div>
    </div>}
  >
    <button type="button" className="editable-cell-button" aria-label="修改密码">{masked}</button>
  </Popover>;
}

function EditableStatusCell({
  value,
  editable,
  onSave,
}: {
  value: OpportunityStatus;
  editable: boolean;
  onSave: (value: OpportunityStatus) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const tag = <Tag className={`status-tag status-${value.toLowerCase()}`}>{statusText[value]}</Tag>;
  if (!editable) return tag;

  async function choose(next: OpportunityStatus) {
    if (next === value) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return <Popover
    open={open}
    onOpenChange={setOpen}
    trigger="click"
    placement="bottom"
    content={<div className="status-editor">
      <strong>选择状态</strong>
      <div className="status-editor-options">{Object.entries(statusText).map(([key, label]) => <button
        type="button"
        key={key}
        className={key === value ? "selected" : ""}
        disabled={saving}
        onClick={() => void choose(key as OpportunityStatus)}
      ><Tag className={`status-tag status-${key.toLowerCase()}`}>{label}</Tag></button>)}</div>
    </div>}
  >
    <button type="button" className="editable-status-button" aria-label="修改状态" onClick={() => setOpen(true)}>{tag}</button>
  </Popover>;
}

export function BusinessDashboard({ user }: { user: SessionUser }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message, modal } = App.useApp();
  const [page, setPage] = useState<VisiblePageKey>("opportunities");
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
  const [linkedOpen, setLinkedOpen] = useState<LinkedCreateTarget | null>(null);
  const [detailTarget, setDetailTarget] = useState<{ kind: VisiblePageKey; id: string } | null>(null);
  const [relatedView, setRelatedView] = useState<"contracts" | "payments">("contracts");
  const [attachmentTarget, setAttachmentTarget] = useState<{ kind: AttachmentKind; id: string } | null>(null);
  const [previewFile, setPreviewFile] = useState<AttachmentRef | null>(null);
  const [opportunityFiles, setOpportunityFiles] = useState<UploadFile[]>([]);
  const [opportunityForm] = Form.useForm<OpportunityForm>();
  const [supplierForm] = Form.useForm<SupplierForm>();

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
  const detailRecord = detailTarget
    ? detailTarget.kind === "opportunities"
      ? opportunities.find((item) => item.id === detailTarget.id)
      : suppliers.find((item) => item.id === detailTarget.id)
    : null;
  const detailContracts = detailTarget
    ? contracts.filter((item) => detailTarget.kind === "opportunities" ? item.opportunityId === detailTarget.id : item.supplierId === detailTarget.id)
    : [];
  const detailPayments = detailTarget
    ? payments.filter((item) => detailTarget.kind === "opportunities" ? item.opportunityId === detailTarget.id : item.supplierId === detailTarget.id)
    : [];
  const managedAttachmentRecord = attachmentTarget
    ? attachmentTarget.kind === "opportunities"
      ? opportunities.find((item) => item.id === attachmentTarget.id)
      : attachmentTarget.kind === "contracts"
        ? contracts.find((item) => item.id === attachmentTarget.id)
        : payments.find((item) => item.id === attachmentTarget.id)
    : null;
  const managedAttachmentName = managedAttachmentRecord
    ? "customer" in managedAttachmentRecord ? managedAttachmentRecord.customer : managedAttachmentRecord.name
    : "";

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
      return requestJson("/api/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      message.success("商机已新增，合同和付款已同步生成");
      setOpportunityOpen(false);
      setOpportunityFiles([]);
      await invalidateBusiness();
    },
    onError: (error) => message.error(error.message),
  });

  const supplierMutation = useMutation({
    mutationFn: (values: SupplierForm) => requestJson("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }),
    onSuccess: async () => {
      message.success("供应商已新增，合同和付款已同步生成");
      setSupplierOpen(false);
      supplierForm.resetFields();
      await invalidateBusiness();
    },
    onError: (error) => message.error(error.message),
  });

  const linkedMutation = useMutation({
    mutationFn: async (values: LinkedForm) => {
      if (!linkedOpen) throw new Error("缺少关联对象");
      const uploaded = await Promise.all((values.record || []).map(uploadFile));
      return requestJson(linkedOpen.kind === "contracts" ? "/api/contracts" : "/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: linkedOpen.name,
          type: linkedOpen.type,
          targetId: linkedOpen.targetId,
          attachmentIds: uploaded.filter(Boolean).map((file) => file!.id),
        }),
      });
    },
    onSuccess: async () => {
      message.success(linkedOpen?.kind === "contracts" ? "合同已新增" : "付款已新增");
      setLinkedOpen(null);
      await invalidateBusiness();
    },
    onError: (error) => message.error(error.message),
  });

  const attachmentMutation = useMutation({
    mutationFn: async ({ kind, rowId, file }: { kind: AttachmentKind; rowId: string; file: File }) => {
      const uploaded = await uploadFile(file);
      if (!uploaded) throw new Error("请选择文件");
      return requestJson<{ attached: number }>(`/api/${kind}/${rowId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachmentIds: [uploaded.id] }),
      });
    },
    onSuccess: async (_, variables) => {
      message.success("附件已上传");
      await queryClient.invalidateQueries({ queryKey: [variables.kind] });
    },
    onError: (error) => message.error(error.message),
  });

  const inlineOpportunityMutation = useMutation({
    mutationFn: ({ row, field, value }: { row: Opportunity; field: EditableOpportunityField | "status"; value: string }) => requestJson(`/api/opportunities/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: row.customer,
        requirement: row.requirement || "",
        source: row.source || "",
        paymentTerms: row.paymentTerms || "",
        status: row.status,
        progress: row.progress || "",
        notes: row.notes || "",
        attachmentIds: [],
        [field]: value,
      }),
    }),
    onSuccess: async () => {
      message.success("字段已更新");
      await invalidateBusiness();
    },
    onError: (error) => message.error(error.message),
  });

  const inlineSupplierMutation = useMutation({
    mutationFn: ({ row, field, value }: { row: Supplier; field: EditableSupplierField; value: string }) => requestJson(`/api/suppliers/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: row.name,
        account: row.account,
        password: "",
        notes: row.notes || "",
        [field]: value,
      }),
    }),
    onSuccess: async () => {
      message.success("字段已更新");
      await invalidateBusiness();
    },
    onError: (error) => message.error(error.message),
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: ({ id }: { id: string; kind: AttachmentKind }) => requestJson(`/api/files/${id}`, { method: "DELETE" }),
    onSuccess: async (_, variables) => {
      message.success("附件已删除");
      await queryClient.invalidateQueries({ queryKey: [variables.kind] });
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
      if (detailTarget?.kind === variables.kind && variables.ids.includes(detailTarget.id)) setDetailTarget(null);
      await invalidateBusiness();
    },
    onError: (error) => message.error(error.message),
  });

  const filteredOpportunities = useMemo(() => opportunities.filter((item) => {
    const text = [item.customer, item.requirement, item.source, item.progress, item.notes].join(" ").toLowerCase();
    return (!keywords.opportunities || text.includes(keywords.opportunities.toLowerCase())) && (status === "ALL" || item.status === status);
  }), [keywords.opportunities, opportunities, status]);

  const filteredSuppliers = useMemo(() => suppliers.filter((item) => {
    const text = [item.name, item.account, item.notes].join(" ").toLowerCase();
    return !keywords.suppliers || text.includes(keywords.suppliers.toLowerCase());
  }), [keywords.suppliers, suppliers]);

  const pagedOpportunities = filteredOpportunities.slice(
    (pageNumbers.opportunities - 1) * PAGE_SIZE,
    pageNumbers.opportunities * PAGE_SIZE,
  );
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

  async function saveOpportunityField(row: Opportunity, field: EditableOpportunityField | "status", value: string) {
    await inlineOpportunityMutation.mutateAsync({ row, field, value });
  }

  async function saveSupplierField(row: Supplier, field: EditableSupplierField, value: string) {
    await inlineSupplierMutation.mutateAsync({ row, field, value });
  }

  function renderAttachmentUpload(kind: AttachmentKind, rowId: string, files: AttachmentRef[]) {
    const variables = attachmentMutation.variables;
    const isUploading = attachmentMutation.isPending && variables?.kind === kind && variables.rowId === rowId;
    return <Tooltip title="点击选择并上传附件" mouseEnterDelay={0.4}>
      <label className={`attachment-upload-trigger${isUploading ? " is-loading" : ""}`}>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
          disabled={isUploading}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) attachmentMutation.mutate({ kind, rowId, file });
            event.currentTarget.value = "";
          }}
        />
        <Paperclip size={14} />
        <span>{isUploading ? "上传中…" : `${files.length} 个附件`}</span>
      </label>
    </Tooltip>;
  }

  const opportunityColumns: TableColumnsType<Opportunity> = [
    { title: "客户", dataIndex: "customer", width: 180, className: "strong-cell", render: (value) => <CellText value={value} /> },
    { title: "需求与现状", dataIndex: "requirement", width: 300, render: (value) => <CellText value={value} lines={2} /> },
    { title: "状态", dataIndex: "status", width: 120, render: (value: OpportunityStatus) => <Tag className={`status-tag status-${value.toLowerCase()}`}>{statusText[value]}</Tag> },
    { title: "当前进展", dataIndex: "progress", width: 280, render: (value) => <CellText value={value} lines={2} /> },
    { title: "合同", width: 90, render: (_, row) => contracts.filter((item) => item.opportunityId === row.id).length },
    { title: "付款", width: 90, render: (_, row) => payments.filter((item) => item.opportunityId === row.id).length },
    { title: "更新时间", dataIndex: "updatedAt", width: 130, render: (value: string) => formatDate(value) },
  ];

  const supplierColumns: TableColumnsType<Supplier> = [
    { title: "名称", dataIndex: "name", width: 220, className: "strong-cell", render: (value) => <CellText value={value} /> },
    { title: "账号", dataIndex: "account", width: 240, render: (value) => <CellText value={value} /> },
    { title: "备注", dataIndex: "notes", width: 360, render: (value) => <CellText value={value} lines={2} /> },
    { title: "合同", width: 90, render: (_, row) => contracts.filter((item) => item.supplierId === row.id).length },
    { title: "付款", width: 90, render: (_, row) => payments.filter((item) => item.supplierId === row.id).length },
    { title: "更新时间", dataIndex: "updatedAt", width: 130, render: (value: string) => formatDate(value) },
  ];

  function openDetail(kind: VisiblePageKey, id: string) {
    setRelatedView("contracts");
    setDetailTarget({ kind, id });
  }

  function closeDetail() {
    setDetailTarget(null);
    setAttachmentTarget(null);
    setRelatedView("contracts");
  }

  function openOpportunityCreate() {
    setOpportunityFiles([]);
    setOpportunityOpen(true);
  }

  function openSupplierCreate() {
    setSupplierOpen(true);
  }

  function openLinked(kind: "contracts" | "payments", type: PartyType, targetId: string, name: string) {
    setLinkedOpen({ kind, type, targetId, name });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const navItems = [
    { key: "opportunities" as const, label: "商机管理", icon: BriefcaseBusiness, count: opportunities.length },
    { key: "suppliers" as const, label: "供应商管理", icon: Warehouse, count: suppliers.length },
  ];

  function renderLinkedSection(kind: "contracts" | "payments", rows: LinkedRecord[]) {
    const isContract = kind === "contracts";
    const label = isContract ? "合同" : "付款";
    const Icon = isContract ? FileSignature : Landmark;
    const targetType: PartyType = detailTarget?.kind === "opportunities" ? "CUSTOMER" : "SUPPLIER";
    const targetName = detailRecord ? ("customer" in detailRecord ? detailRecord.customer : detailRecord.name) : "";

    return <section className="detail-card linked-detail-card">
      <div className="detail-card-heading">
        <div><Icon size={18} /><strong>{label}管理</strong><span>{rows.length} 条</span></div>
        {detailTarget && detailRecord && <Button
          size="small"
          type="primary"
          ghost
          icon={<Plus size={14} />}
          onClick={() => openLinked(kind, targetType, detailTarget.id, targetName)}
        >新增{label}</Button>}
      </div>
      {rows.length === 0
        ? <Empty className="linked-detail-empty" image={Empty.PRESENTED_IMAGE_SIMPLE} description={`暂无${label}记录`} />
        : <div className="linked-detail-list">{rows.map((row, index) => <div className="linked-detail-item" key={row.id}>
          <div className="linked-detail-summary">
            <span className="linked-detail-icon"><Icon size={17} /></span>
            <div><strong>{label}记录 {rows.length - index}</strong><span>创建于 {formatDate(row.createdAt)}</span></div>
          </div>
          <div className="linked-detail-actions">
            {renderAttachmentUpload(kind, row.id, row.attachments)}
            <Button size="small" onClick={() => setAttachmentTarget({ kind, id: row.id })}>管理附件</Button>
            <Button
              size="small"
              danger
              type="text"
              icon={<Trash2 size={14} />}
              loading={deleteMutation.isPending && deleteMutation.variables?.kind === kind && deleteMutation.variables.ids.includes(row.id)}
              onClick={() => modal.confirm({
                title: `删除${label}记录`,
                content: `确认删除这条${label}记录吗？对应的附件也会同步删除。`,
                okText: "删除",
                cancelText: "取消",
                okButtonProps: { danger: true },
                onOk: () => deleteMutation.mutateAsync({ kind, ids: [row.id] }),
              })}
            />
          </div>
        </div>)}</div>}
    </section>;
  }

  function renderManagementSwitch() {
    return <section className="detail-card management-switch-card">
      <div className="detail-card-heading"><div><FileSignature size={18} /><strong>业务管理</strong></div><span>在左侧切换查看</span></div>
      <div className="management-switch-list">
        <button type="button" className={relatedView === "contracts" ? "active" : ""} onClick={() => setRelatedView("contracts")}>
          <span className="management-switch-icon"><FileSignature size={18} /></span>
          <span><strong>合同管理</strong><small>{detailContracts.length} 条合同记录</small></span>
        </button>
        <button type="button" className={relatedView === "payments" ? "active" : ""} onClick={() => setRelatedView("payments")}>
          <span className="management-switch-icon"><Landmark size={18} /></span>
          <span><strong>付款管理</strong><small>{detailPayments.length} 条付款记录</small></span>
        </button>
      </div>
    </section>;
  }

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
                <div className="table-holder"><Table
                  rowKey="id"
                  rowSelection={rowSelectionFor("opportunities")}
                  columns={opportunityColumns}
                  dataSource={pagedOpportunities}
                  loading={opportunitiesQuery.isLoading}
                  pagination={false}
                  tableLayout="fixed"
                  scroll={{ x: 1190 }}
                  onRow={(row) => ({
                    className: "clickable-row",
                    onClick: (event) => {
                      if ((event.target as HTMLElement).closest("button, a, input, label, .ant-checkbox-wrapper")) return;
                      openDetail("opportunities", row.id);
                    },
                  })}
                /></div>
                <div className="table-footer"><span>共 {filteredOpportunities.length} 条</span><Pagination current={pageNumbers.opportunities} total={filteredOpportunities.length} pageSize={PAGE_SIZE} showSizeChanger={false} onChange={(current) => changePage("opportunities", current)} /></div>
              </>}

              {page === "suppliers" && <>
                <div className="table-toolbar"><Button type="primary" icon={<Plus size={16} />} onClick={openSupplierCreate}>新建供应商</Button><Button danger icon={<Trash2 size={16} />} disabled={!selectedIds.suppliers.length} loading={deleteMutation.isPending && deleteMutation.variables?.kind === "suppliers"} onClick={() => confirmDelete("suppliers")}>删除供应商{selectedIds.suppliers.length ? ` (${selectedIds.suppliers.length})` : ""}</Button><div className="toolbar-spacer" /><Input className="search-input" prefix={<Search size={16} />} placeholder="搜索名称、账号或备注" value={keywords.suppliers} onChange={(event) => changeKeyword("suppliers", event.target.value)} allowClear /><Button icon={<RotateCcw size={16} />} onClick={() => changeKeyword("suppliers", "")}>重置</Button></div>
                <div className="table-holder"><Table
                  rowKey="id"
                  rowSelection={rowSelectionFor("suppliers")}
                  columns={supplierColumns}
                  dataSource={pagedSuppliers}
                  loading={suppliersQuery.isLoading}
                  pagination={false}
                  tableLayout="fixed"
                  scroll={{ x: 1130 }}
                  onRow={(row) => ({
                    className: "clickable-row",
                    onClick: (event) => {
                      if ((event.target as HTMLElement).closest("button, a, input, label, .ant-checkbox-wrapper")) return;
                      openDetail("suppliers", row.id);
                    },
                  })}
                /></div>
                <div className="table-footer"><span>共 {filteredSuppliers.length} 条</span><Pagination current={pageNumbers.suppliers} total={filteredSuppliers.length} pageSize={PAGE_SIZE} showSizeChanger={false} onChange={(current) => changePage("suppliers", current)} /></div>
              </>}
            </section>
          </main>
        </div>
      </section>

      <Modal title="新建商机" open={opportunityOpen} onCancel={() => setOpportunityOpen(false)} footer={null} width={760} centered destroyOnHidden styles={{ body: { maxHeight: "calc(100vh - 150px)", overflowY: "auto", paddingRight: 4 } }}>
        <Form
          form={opportunityForm}
          layout="vertical"
          onFinish={(values) => opportunityMutation.mutate(values)}
          requiredMark={false}
          initialValues={{ status: "NOT_STARTED" }}
        >
          <Form.Item name="customer" label="客户" rules={[{ required: true, message: "请输入客户名称" }]}><Input /></Form.Item>
          <div className="two-fields"><Form.Item name="requirement" label="需求与现状"><Input.TextArea rows={3} /></Form.Item><Form.Item name="source" label="商机来源"><Input.TextArea rows={3} /></Form.Item></div>
          <div className="two-fields"><Form.Item name="paymentTerms" label="付款条件"><Input /></Form.Item><Form.Item name="status" label="状态" rules={[{ required: true }]}><Select options={Object.entries(statusText).map(([value, label]) => ({ value, label }))} /></Form.Item></div>
          <div className="two-fields"><Form.Item name="progress" label="进展"><Input.TextArea rows={3} /></Form.Item><Form.Item name="notes" label="备注"><Input.TextArea rows={3} /></Form.Item></div>
          <Form.Item label="附件"><Upload multiple beforeUpload={() => false} fileList={opportunityFiles} onChange={({ fileList }) => setOpportunityFiles(fileList)}><Button icon={<Paperclip size={16} />}>选择附件</Button></Upload></Form.Item>
          <div className="modal-actions"><Button onClick={() => setOpportunityOpen(false)}>取消</Button><Button type="primary" htmlType="submit" loading={opportunityMutation.isPending}>保存商机</Button></div>
        </Form>
      </Modal>

      <Drawer
        rootClassName="business-detail-drawer"
        title={detailRecord ? ("customer" in detailRecord ? `商机详情 · ${detailRecord.customer}` : `供应商详情 · ${detailRecord.name}`) : "详细信息"}
        open={Boolean(detailRecord)}
        onClose={closeDetail}
        placement="right"
        width={480}
        zIndex={900}
        destroyOnHidden
      >
        {detailTarget?.kind === "opportunities" && detailRecord && "customer" in detailRecord && <div className="business-detail">
          <section className="detail-card">
            <div className="detail-card-heading"><div><BriefcaseBusiness size={18} /><strong>基本信息</strong></div><span className="detail-edit-tip">{user.role === "ADMIN" ? "点击字段可直接修改" : "只读"}</span></div>
            <div className="detail-field-grid">
              <div className="detail-field"><span>客户</span><EditableTextCell value={detailRecord.customer} editable={user.role === "ADMIN"} label="客户" onSave={(next) => saveOpportunityField(detailRecord, "customer", next)} /></div>
              <div className="detail-field"><span>状态</span><EditableStatusCell value={detailRecord.status} editable={user.role === "ADMIN"} onSave={(next) => saveOpportunityField(detailRecord, "status", next)} /></div>
              <div className="detail-field detail-field-wide"><span>需求与现状</span><EditableTextCell value={detailRecord.requirement} lines={2} editable={user.role === "ADMIN"} label="需求与现状" onSave={(next) => saveOpportunityField(detailRecord, "requirement", next)} /></div>
              <div className="detail-field"><span>商机来源</span><EditableTextCell value={detailRecord.source} lines={2} editable={user.role === "ADMIN"} label="商机来源" onSave={(next) => saveOpportunityField(detailRecord, "source", next)} /></div>
              <div className="detail-field"><span>付款条件</span><EditableTextCell value={detailRecord.paymentTerms} editable={user.role === "ADMIN"} label="付款条件" onSave={(next) => saveOpportunityField(detailRecord, "paymentTerms", next)} /></div>
              <div className="detail-field detail-field-wide"><span>当前进展</span><EditableTextCell value={detailRecord.progress} lines={2} editable={user.role === "ADMIN"} label="进展" onSave={(next) => saveOpportunityField(detailRecord, "progress", next)} /></div>
              <div className="detail-field detail-field-wide"><span>备注</span><EditableTextCell value={detailRecord.notes} lines={2} editable={user.role === "ADMIN"} label="备注" onSave={(next) => saveOpportunityField(detailRecord, "notes", next)} /></div>
              <div className="detail-field"><span>创建日期</span><b>{formatDate(detailRecord.createdAt)}</b></div>
              <div className="detail-field"><span>更新日期</span><b>{formatDate(detailRecord.updatedAt)}</b></div>
            </div>
          </section>
          {renderManagementSwitch()}
          <section className="detail-card opportunity-files-card">
            <div className="detail-card-heading">
              <div><Paperclip size={18} /><strong>商机附件</strong><span>{detailRecord.attachments.length} 个</span></div>
              <Button size="small" onClick={() => setAttachmentTarget({ kind: "opportunities", id: detailRecord.id })}>管理附件</Button>
            </div>
            <div className="detail-file-preview">{detailRecord.attachments.length
              ? detailRecord.attachments.map((file) => <button type="button" key={file.id} onClick={() => setPreviewFile(file)}><FileText size={15} /><span>{file.originalName}</span></button>)
              : <span>暂无商机附件</span>}
            </div>
          </section>
        </div>}

        {detailTarget?.kind === "suppliers" && detailRecord && "name" in detailRecord && <div className="business-detail">
          <section className="detail-card">
            <div className="detail-card-heading"><div><Warehouse size={18} /><strong>基本信息</strong></div><span className="detail-edit-tip">{user.role === "ADMIN" ? "点击字段可直接修改" : "只读"}</span></div>
            <div className="detail-field-grid">
              <div className="detail-field"><span>供应商名称</span><EditableTextCell value={detailRecord.name} editable={user.role === "ADMIN"} label="名称" onSave={(next) => saveSupplierField(detailRecord, "name", next)} /></div>
              <div className="detail-field"><span>账号</span><EditableTextCell value={detailRecord.account} editable={user.role === "ADMIN"} label="账号" onSave={(next) => saveSupplierField(detailRecord, "account", next)} /></div>
              <div className="detail-field"><span>密码</span><EditablePasswordCell editable={user.role === "ADMIN"} onSave={(next) => saveSupplierField(detailRecord, "password", next)} /></div>
              <div className="detail-field"><span>更新时间</span><b>{formatDate(detailRecord.updatedAt)}</b></div>
              <div className="detail-field detail-field-wide"><span>备注</span><EditableTextCell value={detailRecord.notes} lines={2} editable={user.role === "ADMIN"} label="备注" onSave={(next) => saveSupplierField(detailRecord, "notes", next)} /></div>
            </div>
          </section>
          {renderManagementSwitch()}
        </div>}
      </Drawer>

      <Drawer
        rootClassName="linked-management-drawer"
        title={`${relatedView === "contracts" ? "合同管理" : "付款管理"}${detailRecord ? ` · ${"customer" in detailRecord ? detailRecord.customer : detailRecord.name}` : ""}`}
        open={Boolean(detailRecord)}
        placement="right"
        width={540}
        mask={false}
        closable={false}
        keyboard={false}
        zIndex={901}
        destroyOnHidden
      >
        {relatedView === "contracts"
          ? renderLinkedSection("contracts", detailContracts)
          : renderLinkedSection("payments", detailPayments)}
      </Drawer>

      <Modal
        title="附件管理"
        open={Boolean(managedAttachmentRecord)}
        onCancel={() => { setAttachmentTarget(null); setPreviewFile(null); }}
        footer={null}
        width={640}
        centered
        destroyOnHidden
      >
        {managedAttachmentRecord && attachmentTarget && <div className="attachment-manager">
          <div className="attachment-manager-header">
            <div><strong>{managedAttachmentName}</strong><span>共 {managedAttachmentRecord.attachments.length} 个附件</span></div>
            <label className={`attachment-manager-upload${attachmentMutation.isPending && attachmentMutation.variables?.kind === attachmentTarget.kind && attachmentMutation.variables?.rowId === attachmentTarget.id ? " is-loading" : ""}`}>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                disabled={attachmentMutation.isPending && attachmentMutation.variables?.kind === attachmentTarget.kind && attachmentMutation.variables?.rowId === attachmentTarget.id}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) attachmentMutation.mutate({ kind: attachmentTarget.kind, rowId: attachmentTarget.id, file });
                  event.currentTarget.value = "";
                }}
              />
              <Plus size={15} />
              {attachmentMutation.isPending && attachmentMutation.variables?.kind === attachmentTarget.kind && attachmentMutation.variables?.rowId === attachmentTarget.id ? "上传中…" : "上传附件"}
            </label>
          </div>

          {managedAttachmentRecord.attachments.length === 0
            ? <Empty className="attachment-empty" image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无附件，点击右上角上传" />
            : <div className="attachment-list">{managedAttachmentRecord.attachments.map((file) => <div className="attachment-list-item" key={file.id}>
              <span className="attachment-file-icon"><FileText size={19} /></span>
              <Tooltip title={file.originalName}><span className="attachment-file-name">{file.originalName}</span></Tooltip>
              <Button size="small" icon={<Eye size={14} />} onClick={() => setPreviewFile(file)}>预览</Button>
              <Button size="small" icon={<Download size={14} />} href={`/api/files/${file.id}?download=1`}>下载</Button>
              {user.role === "ADMIN" && <Button
                size="small"
                danger
                type="text"
                icon={<Trash2 size={14} />}
                loading={deleteAttachmentMutation.isPending && deleteAttachmentMutation.variables?.id === file.id}
                onClick={() => modal.confirm({
                  title: "删除附件",
                  content: `确认删除“${file.originalName}”吗？删除后无法恢复。`,
                  okText: "删除",
                  cancelText: "取消",
                  okButtonProps: { danger: true },
                  onOk: () => deleteAttachmentMutation.mutateAsync({ id: file.id, kind: attachmentTarget.kind }),
                })}
              >删除</Button>}
            </div>)}</div>}
          <p className="attachment-manager-tip">支持 PDF、Word、Excel、JPG、PNG、WebP，单个文件最大 20MB。</p>
        </div>}
      </Modal>

      <Modal
        title={previewFile ? `附件预览：${previewFile.originalName}` : "附件预览"}
        open={Boolean(previewFile)}
        onCancel={() => setPreviewFile(null)}
        width={920}
        centered
        destroyOnHidden
        footer={previewFile ? [
          <Button key="close" onClick={() => setPreviewFile(null)}>关闭</Button>,
          <Button key="download" type="primary" icon={<Download size={15} />} href={`/api/files/${previewFile.id}?download=1`}>下载</Button>,
        ] : null}
      >
        {previewFile?.mimeType.startsWith("image/")
          ? <div className="attachment-preview"><img src={`/api/files/${previewFile.id}`} alt={previewFile.originalName} /></div>
          : previewFile?.mimeType === "application/pdf"
            ? <iframe className="attachment-preview-frame" src={`/api/files/${previewFile.id}`} title={previewFile.originalName} />
            : <div className="attachment-preview-unsupported"><FileText size={42} /><strong>该文件格式暂不支持在线预览</strong><span>请点击“下载”后使用本地软件查看。</span></div>}
      </Modal>

      <Modal title="新建供应商" open={supplierOpen} onCancel={() => setSupplierOpen(false)} footer={null} centered destroyOnHidden styles={{ body: { maxHeight: "calc(100vh - 150px)", overflowY: "auto", paddingRight: 4 } }}>
        <Form
          form={supplierForm}
          layout="vertical"
          onFinish={(values) => supplierMutation.mutate(values)}
          requiredMark={false}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入供应商名称" }]}><Input /></Form.Item>
          <Form.Item name="account" label="账号" rules={[{ required: true, message: "请输入账号" }]}><Input /></Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}><Input.Password /></Form.Item>
          <Form.Item name="notes" label="备注"><Input.TextArea rows={4} /></Form.Item>
          <div className="modal-actions"><Button onClick={() => setSupplierOpen(false)}>取消</Button><Button type="primary" htmlType="submit" loading={supplierMutation.isPending}>保存供应商</Button></div>
        </Form>
      </Modal>

      <Modal title={linkedOpen?.kind === "contracts" ? "新建合同" : "新建付款"} open={Boolean(linkedOpen)} onCancel={() => setLinkedOpen(null)} footer={null} centered destroyOnHidden styles={{ body: { maxHeight: "calc(100vh - 150px)", overflowY: "auto", paddingRight: 4 } }}>
        <Form layout="vertical" onFinish={(values) => linkedMutation.mutate(values)} requiredMark={false} clearOnDestroy>
          <div className="linked-create-target"><span>关联对象</span><strong>{linkedOpen?.name}</strong></div>
          <Form.Item name="record" label={linkedOpen?.kind === "contracts" ? "合同附件" : "付款附件"} valuePropName="fileList" getValueFromEvent={(event) => event?.fileList}><Upload multiple maxCount={20} beforeUpload={() => false}><Button icon={<Paperclip size={16} />}>选择附件</Button></Upload></Form.Item>
          <div className="modal-actions"><Button onClick={() => setLinkedOpen(null)}>取消</Button><Button type="primary" htmlType="submit" loading={linkedMutation.isPending}>{linkedOpen?.kind === "contracts" ? "保存合同" : "保存付款"}</Button></div>
        </Form>
      </Modal>
    </App>
  );
}
