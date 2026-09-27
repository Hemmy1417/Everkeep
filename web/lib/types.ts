/**
 * The shapes contracts/everkeep.py writes, field for field. A test fixture
 * built from these types is a shape the chain can produce.
 */

export type OrgState = "ACTIVE" | "PAUSED" | "DISSOLVING" | "DISSOLVED";
export type WorkOrderState =
  | "PROPOSED" | "ACTIVE" | "DECIDED" | "UNDER_APPEAL" | "PAYMENT_RELEASABLE"
  | "SETTLED" | "CLOSED_UNPAID" | "CANCELLED";
export type Outcome = "ACCEPTED" | "REJECTED" | "UNDETERMINED";
export type RequirementStatus = "SATISFIED" | "NOT_SATISFIED" | "NOT_ESTABLISHED" | "NOT_APPLICABLE";
export type Lifecycle = "APPEALABLE" | "APPEALED" | "SUPERSEDED" | "FINALIZED";
export type Role = "PROVIDER" | "INSPECTOR" | "STEWARD";
export type EvidenceKind = "IMAGE" | "DOCUMENT" | "TEXT_DECLARATION" | "REFERENCE";

export interface Principle { id: string; text: string; applies_to: string[] }
export interface Criterion { id: string; text: string }
export interface EvidenceRule { maintenance_type: string; type: string; min_count: number }

export interface Constitution {
  organization_id: string;
  version: number;
  organization_name: string;
  mission: string;
  supported_infrastructure_types: string[];
  eligibility_rules: { approved_maintenance_types: string[]; inspection_report_required_for: string[] };
  maintenance_principles: Principle[];
  evidence_requirements: EvidenceRule[];
  funding_rules: { max_payment_wei: string; max_open_work_orders: number; reserve_floor_wei: string };
  emergency_rules: { emergency_max_payment_wei: string; emergency_appeal_window_seconds: number };
  appeal_rules: { appeal_window_seconds: number; evidence_period_seconds: number; max_appeals_per_work_order: number };
  governance: { stewards: string[]; motion_window_seconds: number; dissolution_beneficiary: string };
  proposed_by: string;
  proposed_at: string;
  effective_at: string | null;
}

export interface Motion {
  kind: "AMENDMENT" | "DISSOLUTION";
  state: "PENDING" | "ENACTED" | "WITHDRAWN";
  proposed_by: string;
  proposed_at: string;
  window_ends: string;
  objected_by: string | null;
  objection: string;
  decided_at: string | null;
  version?: number;
  reason?: string;
  enacted_by?: string;
}

export interface Organization {
  organization_id: string;
  founder: string;
  state: OrgState;
  constitution_version: number;
  constitution_count: number;
  motion: Motion | null;
  motions: Motion[];
  created_at: string;
  escrow_wei: string;
  funded_wei: string;
  committed_wei: string;
  releasable_wei: string;
  paid_wei: string;
  returned_wei: string;
  dissolved_at: string | null;
  name: string;
  mission: string;
  stewards: string[];
  available_wei: string;
  spendable_wei: string;
  open_work_orders: number;
  asset_count: number;
  work_order_count: number;
  provider_count: number;
  pending_decisions: number;
  open_appeals: number;
  now: string;
}

export interface Provider {
  address: string;
  organization_id: string;
  name: string;
  maintenance_types: string[];
  authorized_at: string;
  authorized_by: string;
  revoked_at: string | null;
  first_authorized_at: string;
}

export interface ServiceEntry {
  work_order_id: string;
  maintenance_type: string;
  title: string;
  outcome: string;
  decision_id: string | null;
  at: string;
}

export interface Asset {
  asset_id: string;
  organization_id: string;
  asset_type: string;
  name: string;
  description: string;
  location_reference: string;
  operator: string;
  technical_profile: string;
  installation_date: string;
  maintenance_interval_days: number;
  inspector: string;
  inspector_accepted_at: string | null;
  enrolled_at: string;
  enrolled_by: string;
  constitution_version: number;
  retired_at: string | null;
  last_serviced_at: string | null;
  open_work_orders: number;
  work_orders: string[];
  service_log: ServiceEntry[];
  status: "MONITORING" | "SERVICE_DUE" | "UNDER_MAINTENANCE" | "RETIRED";
  next_service_due: string | null;
}

export interface Terms {
  version: number;
  title: string;
  maintenance_type: string;
  description: string;
  requirements: string;
  specification: string;
  acceptance_criteria: Criterion[];
  required_evidence: Array<{ type: string; min_count: number }>;
  budget_wei: string;
  payment_wei: string;
  deadline: string;
}

export interface Appeal {
  decision_id: string;
  by: "STEWARD" | "PROVIDER";
  opened_by: string;
  reason: string;
  opened_at: string;
  mark: number;
  evidence_ends: string;
}

export interface Evidence {
  evidence_id: string;
  work_order_id: string;
  organization_id: string;
  asset_id: string;
  work_order_version: number;
  role: Role;
  kind: EvidenceKind;
  submitter: string;
  submitted_at: string;
  content_hash: string;
  bytes: number;
  view?: string;
  doc_type?: string;
  title?: string;
  description?: string;
  capture_timestamp?: string;
  location_reference?: string;
  source_reference?: string;
  reference_type?: string;
  url?: string;
  claimed_hash?: string;
}

export interface WorkOrder {
  work_order_id: string;
  organization_id: string;
  asset_id: string;
  provider: string;
  provider_authorized_at: string;
  created_by: string;
  constitution_version: number;
  emergency: boolean;
  state: WorkOrderState;
  committed_wei: string;
  versions: Terms[];
  current_version: number;
  pending_version: number | null;
  decisions: string[];
  current_decision_id: string | null;
  appeals_used: number;
  appeal: Appeal | null;
  created_at: string;
  accepted_at: string | null;
  settlement: { wei: string; to: string; at: string; by: string } | null;
  closed_at: string | null;
  close_reason: string | null;
  evidence: Record<string, Evidence[]>;
  now: string;
}

export interface WorkOrderSummary {
  work_order_id: string;
  organization_id: string;
  asset_id: string;
  provider: string;
  state: WorkOrderState;
  title: string;
  maintenance_type: string;
  payment_wei: string;
  deadline: string;
  constitution_version: number;
  current_version: number;
  pending_version: number | null;
  decision_count: number;
  current_outcome: Outcome | null;
  created_at: string;
}

export interface Observation {
  evidence_id: string;
  view: string;
  role: string;
  seen: boolean;
  shows: string;
  text: string[];
  readings: Array<{ quantity: string; value: string; unit: string }>;
  same_asset_doubts: string;
  change: string;
}

export interface Decision {
  decision_id: string;
  snapshot_id: string;
  kind: "ASSESSMENT" | "READJUDICATION";
  organization_id: string;
  asset_id: string;
  work_order_id: string;
  work_order_version: number;
  constitution_version: number;
  provider: string;
  payment_wei: string;
  decided_at: string;
  requested_by: string;
  outcome: Outcome;
  requirements: Array<{ id: string; source: "CONSTITUTION" | "WORK_ORDER" | "SYSTEM"; text: string; status: RequirementStatus }>;
  failed: string[];
  not_established: string[];
  evidence_sufficient: boolean;
  conflicts_detected: boolean;
  needs_appeal: boolean;
  appeal_of: string | null;
  appeal: { by: string; opened_by: string; reason: string; opened_at: string } | null;
  lifecycle: Lifecycle;
  appeal_window_ends: string;
  appeals_left: number;
  finalized_at: string | null;
  superseded_by: string | null;
  notes: {
    reasoning: string;
    conflict_note: string;
    raw: Record<string, string>;
    basis: Record<string, string[]>;
    requirement_notes: Record<string, string>;
    observations: Observation[];
    finalized_undecided_on_appeal?: boolean;
  };
}

export interface Snapshot {
  snapshot_id: string;
  decision_id: string;
  organization_id: string;
  constitution_version: number;
  asset_id: string;
  work_order_id: string;
  work_order_version: number;
  evaluated_at: string;
  evidence_count: number;
  evidence: Array<{ evidence_id: string; kind: string; type: string; role: string; content_hash: string; new_on_appeal: boolean }>;
}

export interface Config {
  ruleset: string;
  infrastructure_types: string[];
  maintenance_types: string[];
  image_views: string[];
  document_types: string[];
  reference_types: string[];
  inspector_documents: string[];
  requirement_types: string[];
  system_requirements: Criterion[];
  decision_rule: string[];
  limits: {
    max_stewards: number; max_principles: number; max_criteria: number; max_evidence_rules: number;
    max_versions: number; min_payment_wei: string; window_seconds: [number, number];
    stale_appeal_seconds: number; max_image_bytes: number; max_text_chars: number;
    quotas: Record<Role, { IMAGE: number; TEXT: number }>; appeal_additions: { IMAGE: number; TEXT: number };
  };
}

export interface Stats {
  organization: number; asset: number; work_order: number; evidence: number; decision: number;
  settled: number; settled_wei: string;
}

export interface EventRow { n: number; kind: string; subject: string; detail: string; at: string; by: string }
export interface EventsPage { total: number; events: EventRow[] }
export interface Refund { owed: string; paid: string }
