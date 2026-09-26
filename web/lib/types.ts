/**
 * The shapes the contract writes, field for field. Every type here is copied
 * from what contracts/everkeep.py stores or returns, never from what a page
 * would like it to be: a fixture built from these types is a shape the chain
 * can actually produce.
 */

export type OrgState = "ACTIVE" | "PAUSED";
export type AmendmentState = "PROPOSED" | "EFFECTIVE" | "WITHDRAWN";
export type WorkOrderState =
  | "PROPOSED" | "AWAITING_EVIDENCE" | "ACCEPTED" | "REJECTED" | "UNDETERMINED"
  | "APPEALED" | "FINALIZED" | "CLOSED" | "CANCELLED";
export type Decision = "ACCEPTED" | "REJECTED" | "UNDETERMINED";
export type CriterionStatus = "MET" | "NOT_MET" | "UNCLEAR";
export type PrincipleStatus = "SATISFIED" | "VIOLATED" | "NOT_APPLICABLE" | "UNCLEAR";
export type Role = "STEWARD" | "PROVIDER" | "INSPECTOR";
export type ItemKind = "IMAGE" | "DOCUMENT" | "DECLARATION" | "REFERENCE";

export interface Sentence { id: string; text: string }

export interface Constitution {
  organization_id: string;
  version: number;
  organization_name: string;
  mission: string;
  supported_infrastructure_types: string[];
  approved_maintenance_types: string[];
  principles: Sentence[];
  evidence_rules: { min_images: number; inspection_report_required: boolean };
  funding_rules: { max_payment_wei: string; max_open_work_orders: number };
  windows: { appeal_window_seconds: number; amendment_window_seconds: number };
  stewards: string[];
  proposed_by: string;
  proposed_at: string;
  effective_at: string | null;
  ratified_by: string | null;
}

export interface Amendment {
  version: number;
  state: AmendmentState;
  proposed_by: string;
  proposed_at: string;
  window_ends: string;
  objected_by: string | null;
  objection: string;
  decided_at: string | null;
}

export interface Organization {
  organization_id: string;
  founder: string;
  state: OrgState;
  constitution_version: number;
  constitution_count: number;
  amendment: Amendment | null;
  created_at: string;
  paused_at: string | null;
  escrow_wei: string;
  funded_wei: string;
  committed_wei: string;
  paid_wei: string;
  // added by the view
  name: string;
  mission: string;
  stewards: string[];
  available_wei: string;
  open_work_orders: number;
  assets: number;
  work_orders: number;
  now: string;
}

export interface Asset {
  asset_id: string;
  organization_id: string;
  name: string;
  infrastructure_type: string;
  location: string;
  technical_profile: string;
  inspector: string;
  inspector_accepted_at: string | null;
  registered_by: string;
  registered_at: string;
  constitution_version: number;
  work_orders: string[];
  status: "UNDER_MAINTENANCE" | "MONITORING";
}

export interface Terms {
  version: number;
  title: string;
  maintenance_type: string;
  description: string;
  requirements: string;
  acceptance_criteria: Sentence[];
  required_evidence: Array<{ type: string; min_count: number }>;
  payment_wei: string;
  deadline: string;
}

export interface Standing {
  round: number;
  decision: Decision;
  at: string;
  kind: "ASSESSMENT" | "APPEAL" | "APPEAL_LAPSED";
  appealable: boolean;
  appealed: boolean;
  window_ends: string | null;
  item_mark: number;
}

export interface Appeal {
  against: "ACCEPTED" | "REJECTED";
  by: "STEWARD" | "PROVIDER";
  opened_by: string;
  reason: string;
  opened_at: string;
  evidence_ends: string;
  reviewed_round: number;
}

export interface EvidenceItem {
  item_id: string;
  work_order_id: string;
  organization_id: string;
  version: number;
  role: Role;
  kind: ItemKind;
  sha256: string;
  bytes: number;
  filed_at: string;
  filed_by: string;
  caption: string;
  criterion_id: string;
  origin?: string;
  claimed_capture?: string;
  claimed_location?: string;
  doc_type?: string;
  reference?: string;
  reference_type?: string;
  url?: string;
  claimed_sha256?: string;
}

export interface WorkOrder {
  work_order_id: string;
  organization_id: string;
  asset_id: string;
  provider: string;
  created_by: string;
  constitution_version: number;
  state: WorkOrderState;
  committed_wei: string;
  versions: Terms[];
  current_version: number;
  pending_version: number | null;
  version_assessments: number;
  rounds_count: number;
  standing: Standing | null;
  appeal: Appeal | null;
  created_at: string;
  provider_accepted_at: string | null;
  closed_at: string | null;
  close_reason: string | null;
  evidence: Record<string, EvidenceItem[]>;
  now: string;
}

export interface WorkOrderSummary {
  work_order_id: string;
  organization_id: string;
  asset_id: string;
  provider: string;
  title: string;
  maintenance_type: string;
  payment_wei: string;
  deadline: string;
  state: WorkOrderState;
  constitution_version: number;
  current_version: number;
  pending_version: number | null;
  latest_version: number;
  rounds_count: number;
  standing: Standing | null;
  appeal: Appeal | null;
  created_at: string;
}

export interface ImageReading {
  item_id: string;
  role: Role;
  origin: string;
  claimed_criterion: string;
  caption: string;
  readable: boolean;
  shows: string;
  labels: string[];
  concerns: string[];
}

export interface Round {
  round: number;
  work_order_id: string;
  organization_id: string;
  kind: "ASSESSMENT" | "APPEAL";
  version: number;
  constitution_version: number;
  at: string;
  requested_by: string;
  decision: Decision;
  quality: "SUFFICIENT" | "INSUFFICIENT" | "CONFLICTING";
  conflicts_detected: boolean;
  principles: Record<string, PrincipleStatus>;
  criteria: Record<string, CriterionStatus>;
  decisive: { criteria: string[]; principles: string[] };
  evidence: Array<{ item_id: string; kind: ItemKind; role: Role; sha256: string; new: boolean;
                    doc_type: string; criterion_id: string }>;
  new_item_ids: string[];
  reviewed_round: number | null;
  appeal_reason: string;
  notes: {
    reasoning?: string;
    conflict_note?: string;
    principles_raw?: Record<string, string>;
    criteria_raw?: Record<string, string>;
    principle_notes?: Record<string, string>;
    criterion_notes?: Record<string, string>;
    images?: ImageReading[];
  };
}

export interface Config {
  ruleset: string;
  min_payment_wei: string;
  window_seconds: [number, number];
  amendment_window_seconds: [number, number];
  appeal_lapse_seconds: number;
  max_stewards: number;
  max_principles: number;
  max_criteria: number;
  max_image_bytes: number;
  max_text_chars: number;
  max_named: { IMAGE: number; TEXT: number };
  quotas: Record<Role, { IMAGE: number; TEXT: number }>;
  appeal_additions: { IMAGE: number; TEXT: number };
  infrastructure_types: string[];
  maintenance_types: string[];
  image_origins: string[];
  document_types: string[];
  reference_types: string[];
  evidence_requirement_types: string[];
  max_open_work_orders_cap: number;
  max_assessments_per_version: number;
}

export interface Stats {
  organizations: number;
  assets: number;
  work_orders: number;
  items: number;
  rounds: number;
  finalized: number;
  paid_wei: string;
}

export interface Balance { claimable: string; claimed: string }

export interface EventRow { n: number; kind: string; subject: string; detail: string; at: string; by: string }
export interface EventsPage { total: number; events: EventRow[] }
