import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(6).max(128),
});

export const registerSchema = z.object({
  username: z.string().trim().min(2).max(64),
  password: z.string().min(8).max(128),
});

export const opportunitySchema = z.object({
  customer: z.string().trim().min(1).max(191),
  requirement: z.string().trim().max(10000).optional().default(""),
  source: z.string().trim().max(10000).optional().default(""),
  paymentTerms: z.string().trim().max(500).optional().default(""),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "FINISHED"]),
  progress: z.string().trim().max(10000).optional().default(""),
  notes: z.string().trim().max(10000).optional().default(""),
  attachmentIds: z.array(z.string()).max(20).optional().default([]),
});

export const supplierSchema = z.object({
  name: z.string().trim().min(1).max(191),
  bankAccount: z.string().trim().max(191).optional().default(""),
  websiteAccount: z.string().trim().max(191).optional().default(""),
  websitePassword: z.string().max(500).optional().default(""),
  websiteUrl: z.string().trim().max(2048).optional().default(""),
  notes: z.string().trim().max(10000).optional().default(""),
});

export const supplierUpdateSchema = supplierSchema.extend({
  websitePassword: z.string().max(500).optional().default(""),
});

export const linkedRecordSchema = z.object({
  name: z.string().trim().min(1).max(191),
  notes: z.string().trim().max(10000).optional().default(""),
  type: z.enum(["CUSTOMER", "SUPPLIER"]),
  targetId: z.string().min(1),
  recordFileId: z.string().nullable().optional(),
  attachmentIds: z.array(z.string().min(1)).max(20).optional().default([]),
});

export const linkedRecordUpdateSchema = z.object({
  name: z.string().trim().min(1).max(191),
  notes: z.string().trim().max(10000).optional().default(""),
});

const paymentAmountSchema = z.coerce.number().positive().max(9999999999999.99);

export const paymentRecordSchema = linkedRecordSchema.extend({
  amount: paymentAmountSchema,
});

export const paymentRecordUpdateSchema = linkedRecordUpdateSchema.extend({
  amount: paymentAmountSchema,
});

export const deleteIdsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
});

export const attachFilesSchema = z.object({
  attachmentIds: z.array(z.string().min(1)).min(1).max(20),
});

export const userSchema = z.object({
  username: z.string().trim().min(2).max(64),
  password: z.string().min(8).max(128),
  role: z.enum(["ADMIN", "USER"]).default("USER"),
});
