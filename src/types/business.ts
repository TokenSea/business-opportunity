export type UserRole = "ADMIN" | "USER";
export type OpportunityStatus = "NOT_STARTED" | "IN_PROGRESS" | "FINISHED";
export type PartyType = "CUSTOMER" | "SUPPLIER";

export type AttachmentRef = { id: string; originalName: string; mimeType: string; createdAt: string };

export type Opportunity = {
  id: string;
  customer: string;
  requirement: string | null;
  source: string | null;
  paymentTerms: string | null;
  status: OpportunityStatus;
  progress: string | null;
  notes: string | null;
  attachments: AttachmentRef[];
  createdAt: string;
  updatedAt: string;
};

export type Supplier = {
  id: string;
  name: string;
  bankAccount: string | null;
  websiteAccount: string | null;
  websitePassword: string;
  websiteUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LinkedRecord = {
  id: string;
  name: string;
  notes: string | null;
  type: PartyType;
  opportunityId: string | null;
  supplierId: string | null;
  recordFile: AttachmentRef | null;
  attachments: AttachmentRef[];
  createdAt: string;
  updatedAt: string;
};
