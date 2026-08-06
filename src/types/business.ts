export type UserRole = "ADMIN" | "USER";
export type OpportunityStatus = "NOT_STARTED" | "IN_PROGRESS" | "FINISHED";
export type PartyType = "CUSTOMER" | "SUPPLIER";

export type AttachmentRef = { id: string; originalName: string };

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
  account: string;
  password: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LinkedRecord = {
  id: string;
  name: string;
  type: PartyType;
  opportunityId: string | null;
  supplierId: string | null;
  recordFile: AttachmentRef | null;
  createdAt: string;
};
