from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

# --- Pipeline Config (Determinism Enforcer) ---
class PipelineConfig(BaseModel):
  deterministic_mode: bool = True
  temperature: float = 0.0

# --- Input Request ---
class CompilerRequest(BaseModel):
  prompt: str
  force_mock: bool = False
  api_key: Optional[str] = None

# --- Stage 1: Intent Extraction ---
class IntentExtraction(BaseModel):
  app_type: str = Field(..., description="Type of application")
  features: List[str] = Field(..., description="Core feature list")
  roles: List[str] = Field(..., description="User roles")
  entities_detected: List[str] = Field(..., description="Key database entities detected")
  constraints: List[str] = Field(..., description="Constraints identified")
  assumptions: List[str] = Field(..., description="Assumptions made")
  status: str = Field("success", description="success, needs_clarification, or conflict")
  questions: Optional[List[str]] = Field(None, description="Vague prompts questions")
  conflicts: Optional[List[str]] = Field(None, description="Contradictory requirement reports")

# --- Stage 2A: AST Builder ---
class ASTNode(BaseModel):
  type: str = Field(..., description="'Entity', 'Page', 'Service', or 'Event'")
  name: str = Field(..., description="Unique node name")
  props: Dict[str, Any] = Field(default_factory=dict, description="Metadata properties")

class ASTSchema(BaseModel):
  nodes: List[ASTNode]

# --- Stage 2: Intermediate Representation (IR) ---
class IRField(BaseModel):
  name: str
  type: str = Field(..., description="'integer', 'string', 'boolean', 'datetime', 'float', 'text'")
  required: bool = True

class IREntity(BaseModel):
  name: str
  fields: List[IRField]

class IntermediateRepresentation(BaseModel):
  entities: List[IREntity] = Field(..., description="Frozen database entities mapping")
  pages: List[str] = Field(..., description="User interface page views")
  services: List[str] = Field(..., description="Backend service boundaries")
  events: List[str] = Field(..., description="Event hooks")
  business_rules: List[str] = Field(..., description="Business constraint namespaces")

# --- Stage 3: Architecture Planning ---
class ArchitecturePlan(BaseModel):
  domain_model: Dict[str, Any]
  user_flows: List[Dict[str, Any]]
  service_dependency_graph: Dict[str, Any]
  data_flow: Dict[str, Any]

# --- Stage 4: Schemas with Explainability ---
# UI Schema
class UIComponent(BaseModel):
  name: str
  type: str # 'table', 'form', 'chart', 'card', 'navbar'
  props: Dict[str, Any] = Field(default_factory=dict)
  reason: Optional[str] = Field(None, description="Explainability field")

class UIPage(BaseModel):
  name: str
  route: str
  components: List[UIComponent]
  reason: Optional[str] = Field(None, description="Explainability field")

class UISchema(BaseModel):
  pages: List[UIPage]
  reason: Optional[str] = Field(None, description="Explainability field")

# API Schema
class APIEndpoint(BaseModel):
  path: str
  method: str
  request_body_schema: Optional[Dict[str, Any]] = None
  response_schema: Dict[str, Any]
  description: str
  reason: Optional[str] = Field(None, description="Explainability field")

class APISchema(BaseModel):
  endpoints: List[APIEndpoint]
  reason: Optional[str] = Field(None, description="Explainability field")

# Database Schema
class DBColumn(BaseModel):
  name: str
  type: str
  nullable: bool = True
  primary_key: bool = False
  foreign_key: Optional[str] = None
  reason: Optional[str] = Field(None, description="Explainability field")

class DBTable(BaseModel):
  name: str
  columns: List[DBColumn]
  reason: Optional[str] = Field(None, description="Explainability field")

class DBSchema(BaseModel):
  tables: List[DBTable]
  reason: Optional[str] = Field(None, description="Explainability field")

# Auth Schema
class AuthRole(BaseModel):
  name: str
  permissions: List[str]
  reason: Optional[str] = Field(None, description="Explainability field")

class AuthSchema(BaseModel):
  roles: List[AuthRole]
  jwt_expiration_minutes: int = 1440
  reason: Optional[str] = Field(None, description="Explainability field")

# Business Logic Schema
class BusinessRule(BaseModel):
  rule_name: str
  entity: str
  trigger: str
  condition: str
  action: str
  reason: Optional[str] = Field(None, description="Explainability field")

class BusinessRulesSchema(BaseModel):
  rules: List[BusinessRule]
  reason: Optional[str] = Field(None, description="Explainability field")

# Full Schema collection
class FullSchema(BaseModel):
  ui: UISchema
  api: APISchema
  db: DBSchema
  auth: AuthSchema
  business: BusinessRulesSchema

# --- Stage 5: Validation ---
class ValidationErrorDetail(BaseModel):
  type: str = Field(..., description="e.g. 'field_mismatch', 'missing_entity'")
  location: str = Field(..., description="Schema node coordinate")
  reason: str = Field(..., description="Validation failure explanation")

class ValidationReport(BaseModel):
  status: str = Field(..., description="'pass' or 'fail'")
  errors: List[ValidationErrorDetail] = Field(default_factory=list)

# --- Stage 6: Targeted Repair Patch System ---
class RepairPatch(BaseModel):
  location: str = Field(..., description="Schema coordinate being patched")
  before: str = Field(..., description="Value prior to patch")
  after: str = Field(..., description="Value post-patch")
  reason: str = Field(..., description="Why this patch is applied")
  error_type: str = Field(..., description="Type of validation error fixed")

class RepairAttempt(BaseModel):
  attempt: int
  patches: List[RepairPatch]
  success: bool

class RepairReport(BaseModel):
  repair_count: int = 0
  history: List[RepairAttempt] = Field(default_factory=list)
  status: str = Field("none", description="'none', 'repaired', or 'failed'")

# --- Stage 7: Execution Verification ---
class ExecutionVerification(BaseModel):
  execution_status: str = Field(..., description="'success' or 'failed'")
  errors: List[str] = Field(default_factory=list)

# --- Stage 8: Runtime Generation ---
class RuntimeResult(BaseModel):
  zip_url: Optional[str] = None
  file_tree: Dict[str, Any] = Field(default_factory=dict)
  preview_data: Dict[str, Any] = Field(default_factory=dict)

# --- Final Output Contract ---
class CompilerOutput(BaseModel):
  prompt: str
  status: str = Field("SUCCESS", description="SUCCESS, FAILED, NEEDS_CLARIFICATION, CONFLICT, REPAIRING")
  pipeline_config: PipelineConfig = Field(default_factory=PipelineConfig)
  intent: Optional[IntentExtraction] = None
  ast: Optional[ASTSchema] = None
  ir: Optional[IntermediateRepresentation] = None
  architecture: Optional[ArchitecturePlan] = None
  schemas: Optional[FullSchema] = None
  validation: Optional[ValidationReport] = None
  repair: Optional[RepairReport] = None
  verification: Optional[ExecutionVerification] = None
  runtime: Optional[RuntimeResult] = None
  logs: List[str] = Field(default_factory=list)
  
  # Metrics
  latency_ms: Dict[str, float] = Field(default_factory=dict)
  token_usage: Dict[str, int] = Field(default_factory=dict)
  estimated_cost: float = 0.0
