export interface IntentExtraction {
  app_type: string;
  features: string[];
  roles: string[];
  entities_detected: string[];
  constraints: string[];
  assumptions: string[];
  status: "success" | "needs_clarification" | "conflict";
  questions?: string[];
  conflicts?: string[];
}

export interface ASTNode {
  type: "Entity" | "Page" | "Service" | "Event" | "Role";
  name: string;
  props: Record<string, any>;
}

export interface ASTSchema {
  nodes: ASTNode[];
}

export interface IRField {
  name: string;
  type: "integer" | "string" | "boolean" | "datetime" | "float" | "text";
  required: boolean;
}

export interface IREntity {
  name: string;
  fields: IRField[];
}

export interface IntermediateRepresentation {
  entities: IREntity[];
  pages: string[];
  services: string[];
  events: string[];
  business_rules: string[];
  version: string;
}

export interface ArchitecturePlan {
  domain_model: Record<string, any>;
  user_flows: Array<{ from: string; to: string; action: string }>;
  service_dependency_graph: Record<string, string[]>;
  data_flow: Record<string, any>;
}

export interface UIComponent {
  name: string;
  type: 'table' | 'form' | 'chart' | 'card' | 'navbar' | 'sidebar' | 'header';
  props: Record<string, any>;
  bindings?: string[];
}

export interface UIPage {
  name: string;
  route: string;
  components: UIComponent[];
}

export interface FullSchema {
  ui: { pages: UIPage[] };
  api: { endpoints: Array<{ path: string; method: string; description: string; bindings?: string[] }> };
  db: { tables: Array<{ name: string; columns: any[] }> };
  auth: { roles: Array<{ name: string; permissions: string[] }>; jwt_expiration: number };
  business: { rules: Array<{ rule_name: string; condition: string; action: string }> };
}

export interface BindingLayer {
  ui_to_api: Record<string, string[]>;
  api_to_db: Record<string, string[]>;
  auth_to_roles: Record<string, string[]>;
  pages_to_services: Record<string, string[]>;
}

export interface ValidationReport {
  status: "pass" | "fail";
  errors: Array<{ type: string; location: string; reason: string }>;
}

export interface RepairPatch {
  location: string;
  before: any;
  after: any;
  reason: string;
  error_type: string;
}

export interface RepairReport {
  repair_count: number;
  history: Array<{ attempt: number; patches: RepairPatch[]; success: boolean }>;
  status: "none" | "repaired" | "failed";
}

export interface VerificationReport {
  execution_status: "success" | "failed";
  errors: string[];
  build_report?: {
    package_completeness: boolean;
    import_validity: boolean;
    ts_correctness: boolean;
  };
}

export interface EvaluationMetrics {
  success_rate: number;
  repair_rate: number;
  avg_repairs: number;
  latency_ms: number;
  token_usage: number;
  execution_failure_rate: number;
}

export interface CompilerOutput {
  prompt: string;
  status: "SUCCESS" | "FAILED" | "REPAIRING" | "NEEDS_CLARIFICATION";
  intent?: IntentExtraction;
  ast?: ASTSchema;
  ir?: IntermediateRepresentation;
  architecture?: ArchitecturePlan;
  schemas?: FullSchema;
  bindings?: BindingLayer;
  validation?: ValidationReport;
  repair?: RepairReport;
  verification?: VerificationReport;
  runtime?: {
    zip_url: string;
    file_tree: Record<string, string>;
    preview_data: any;
  };
  evaluation?: EvaluationMetrics;
  logs: string[];
  latency_ms: Record<string, number>;
}
