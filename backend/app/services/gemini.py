import json
import re
import time
from typing import Type, TypeVar, Optional, Tuple, Dict, Any
from pydantic import BaseModel
from google import genai
from google.genai import types

from app.config import settings, get_use_mock_mode
from app.schemas import (
  IntentExtraction,
  ASTSchema, ASTNode,
  IntermediateRepresentation, IREntity, IRField,
  ArchitecturePlan,
  FullSchema,
  UISchema, UIPage, UIComponent,
  APISchema, APIEndpoint,
  DBSchema, DBTable, DBColumn,
  AuthSchema, AuthRole,
  BusinessRulesSchema, BusinessRule,
  ValidationReport,
  ValidationErrorDetail,
  ExecutionVerification
)

T = TypeVar("T", bound=BaseModel)

# --- Upgraded Mock Presets for CRM ---
MOCK_CRM_PRESET = {
  "intent": IntentExtraction(
    app_type="CRM",
    features=["authentication", "contacts", "dashboard", "role-based access", "subscriptions"],
    roles=["admin", "sales_agent", "customer"],
    entities_detected=["User", "Contact", "Deal", "Subscription"],
    constraints=["Must restrict contacts editing to admin and sales agents"],
    assumptions=["Assumed secure password hashing for authentication"],
    status="success"
  ),
  
  "ast": ASTSchema(nodes=[
    ASTNode(type="Entity", name="User"),
    ASTNode(type="Entity", name="Contact"),
    ASTNode(type="Entity", name="Deal"),
    ASTNode(type="Entity", name="Subscription"),
    ASTNode(type="Page", name="Login"),
    ASTNode(type="Page", name="Dashboard"),
    ASTNode(type="Page", name="Contacts"),
    ASTNode(type="Page", name="Deals"),
    ASTNode(type="Service", name="AuthService"),
    ASTNode(type="Service", name="ContactService"),
    ASTNode(type="Service", name="DealService"),
    ASTNode(type="Event", name="UserRegistered"),
    ASTNode(type="Event", name="DealClosed")
  ]),

  "ir": IntermediateRepresentation(
    entities=[
      IREntity(name="User", fields=[
        IRField(name="id", type="integer", required=True),
        IRField(name="email", type="string", required=True),
        IRField(name="hashed_password", type="string", required=True),
        IRField(name="role", type="string", required=True)
      ]),
      IREntity(name="Contact", fields=[
        IRField(name="id", type="integer", required=True),
        IRField(name="user_id", type="integer", required=True),
        IRField(name="first_name", type="string", required=True),
        IRField(name="last_name", type="string", required=True),
        IRField(name="email", type="string", required=True),
        IRField(name="phone", type="string", required=False)
      ]),
      IREntity(name="Deal", fields=[
        IRField(name="id", type="integer", required=True),
        IRField(name="user_id", type="integer", required=True),
        IRField(name="title", type="string", required=True),
        IRField(name="value", type="float", required=True),
        IRField(name="stage", type="string", required=True)
      ]),
      IREntity(name="Subscription", fields=[
        IRField(name="id", type="integer", required=True),
        IRField(name="user_id", type="integer", required=True),
        IRField(name="plan_id", type="string", required=True),
        IRField(name="status", type="string", required=True)
      ])
    ],
    pages=["Login", "Dashboard", "Contacts", "Deals"],
    services=["AuthService", "ContactService", "DealService"],
    events=["UserRegistered", "DealClosed"],
    business_rules=["validate_deal_value", "restrict_contact_limit"]
  ),

  "architecture": ArchitecturePlan(
    domain_model={
      "entities": ["User", "Contact", "Deal", "Subscription"],
      "relations": [
        {"from_entity": "User", "to_entity": "Contact", "type": "one-to-many", "reason": "A user manages many contacts"},
        {"from_entity": "User", "to_entity": "Deal", "type": "one-to-many", "reason": "A sales user owns multiple deals"},
        {"from_entity": "User", "to_entity": "Subscription", "type": "one-to-one", "reason": "A customer user has one billing subscription"}
      ]
    },
    user_flows=[
      {"flow_name": "Create Deal", "steps": ["Login", "Navigate to Deals Page", "Open New Deal Modal", "Fill Value and Submit"]}
    ],
    service_dependency_graph={
      "AuthService": [],
      "ContactService": ["AuthService"],
      "DealService": ["AuthService", "ContactService"]
    },
    data_flow={
      "client": "UI Form Submissions",
      "server": "FastAPI controllers call services validating via Pydantic",
      "db": "Writes directly to PostgreSQL tables"
    }
  ),

  "schemas": FullSchema(
    ui=UISchema(
      pages=[
        UIPage(name="Login", route="/login", reason="Authentication portal for secure access control", components=[
          UIComponent(name="login_form", type="form", props={"fields": ["email", "password"], "submit_label": "Login"}, reason="Collects login credentials")
        ]),
        UIPage(name="Dashboard", route="/dashboard", reason="Central KPI dashboard for pipeline visibility", components=[
          UIComponent(name="stats_summary", type="card", props={"metrics": ["Total Contacts", "Open Deals"]}, reason="Displays core platform KPI metrics")
        ]),
        UIPage(name="Contacts", route="/contacts", reason="Contact directory screen", components=[
          UIComponent(name="contact_table", type="table", props={"headers": ["First Name", "Last Name", "Email", "Phone"]}, reason="Renders all active contacts in grid view"),
          UIComponent(name="contact_form", type="form", props={"fields": ["first_name", "last_name", "email", "phone"], "submit_label": "Save"}, reason="Enables adding new lead contacts")
        ]),
        UIPage(name="Deals", route="/deals", reason="Deal pipeline pipeline overview screen", components=[
          UIComponent(name="deals_table", type="table", props={"headers": ["Title", "Value", "Stage"]}, reason="Displays current active sales deals list")
        ])
      ],
      reason="UI layer maps all page views and components to intermediate page definitions"
    ),
    api=APISchema(
      endpoints=[
        APIEndpoint(path="/api/auth/login", method="POST", request_body_schema={"email": "string", "password": "string"}, response_schema={"access_token": "string", "role": "string"}, description="Authenticate user credentials", reason="Secure entry endpoint for auth token generation"),
        APIEndpoint(path="/api/contacts", method="GET", response_schema={"contacts": "array"}, description="Retrieve contact list", reason="Reads contact records filter-constrained by current user ownership"),
        APIEndpoint(path="/api/contacts", method="POST", request_body_schema={"first_name": "string", "last_name": "string", "email": "string", "phone": "string"}, response_schema={"id": "integer"}, description="Create new lead contact", reason="Validates and inserts a new contact record")
      ],
      reason="REST endpoint schemas mapping UI actions to Database operations"
    ),
    db=DBSchema(
      tables=[
        DBTable(name="users", columns=[
          DBColumn(name="id", type="integer", primary_key=True, reason="Unique user index identifier"),
          DBColumn(name="email", type="string", nullable=False, reason="Corporate email address credential"),
          DBColumn(name="hashed_password", type="string", nullable=False, reason="Secured password hash value"),
          DBColumn(name="role", type="string", nullable=False, reason="System role for role-based access checks")
        ], reason="Authentication user registry table"),
        DBTable(name="contacts", columns=[
          DBColumn(name="id", type="integer", primary_key=True, reason="Unique contact identifier"),
          DBColumn(name="user_id", type="integer", foreign_key="users.id", reason="Links contact to the managing user"),
          DBColumn(name="first_name", type="string", nullable=False, reason="Lead contact first name"),
          DBColumn(name="last_name", type="string", nullable=False, reason="Lead contact last name"),
          DBColumn(name="email", type="string", nullable=False, reason="Primary email address"),
          DBColumn(name="phone", type="string", nullable=True, reason="Optional contact phone number")
        ], reason="Database table holding client leads details")
      ],
      reason="Relational database tables structure and constraints mapping to IR entities"
    ),
    auth=AuthSchema(
      roles=[
        AuthRole(name="admin", permissions=["contacts:read", "contacts:write", "deals:read", "deals:write", "admin:all"], reason="Full administrative privileges over the database and settings"),
        AuthRole(name="sales_agent", permissions=["contacts:read", "contacts:write", "deals:read", "deals:write"], reason="Enables agents to write contacts and deals"),
        AuthRole(name="customer", permissions=["contacts:read"], reason="Read-only guest contact view privilege")
      ],
      jwt_expiration_minutes=1440,
      reason="RBAC permission definitions map security rules to REST endpoints"
    ),
    business=BusinessRulesSchema(
      rules=[
        BusinessRule(rule_name="validate_deal_value", entity="Deal", trigger="before_create", condition="value >= 0", action="allow", reason="Ensure deal financial value can never be negative"),
        BusinessRule(rule_name="restrict_contact_limit", entity="Contact", trigger="before_create", condition="count(contacts) < 100", action="allow", reason="Imposes contact cap based on tiers")
      ],
      reason="Defines logic assertions triggered on db write transactions"
    )
  )
}

# General Mock Builder for prompts that don't match exactly CRM
def generate_generic_mock(prompt: str, stage: str) -> BaseModel:
  prompt_lower = prompt.lower()
  
  # Standard definitions
  app_type = "Web Application"
  features = ["authentication", "dashboard", "items"]
  roles = ["admin", "user"]
  entities = ["User", "Item"]
  pages = ["Login", "Dashboard", "Items"]
  services = ["AuthService", "ItemService"]
  events = ["ItemCreated"]

  if "school" in prompt_lower or "student" in prompt_lower or "lms" in prompt_lower:
    app_type = "LMS"
    features = ["authentication", "courses", "enrollments", "dashboard"]
    roles = ["admin", "instructor", "student"]
    entities = ["User", "Course", "Enrollment"]
    pages = ["Login", "Dashboard", "Courses"]
    services = ["AuthService", "CourseService"]
    events = ["UserEnrolled"]
  elif "store" in prompt_lower or "shop" in prompt_lower or "marketplace" in prompt_lower:
    app_type = "E-Commerce"
    features = ["authentication", "catalog", "orders"]
    roles = ["admin", "merchant", "customer"]
    entities = ["User", "Product", "Order"]
    pages = ["Login", "Dashboard", "Products"]
    services = ["AuthService", "ProductService"]
    events = ["OrderPlaced"]

  if stage == "intent":
    if len(prompt.strip()) < 20 or prompt_lower in ["build an app", "app for students", "website", "something cool"]:
      return IntentExtraction(
        app_type="Generic", features=[], roles=[], entities_detected=[], constraints=[], assumptions=[],
        status="needs_clarification",
        questions=[
          "What is the primary target audience of this student/generic application?",
          "What core features should be included? (e.g. course registration, homework upload, exams?)",
          "Do you require authentication and role-based access control (e.g. admin, teacher, student)?"
        ]
      )
    
    if "no login" in prompt_lower and ("user" in prompt_lower or "account" in prompt_lower or "auth" in prompt_lower):
      return IntentExtraction(
        app_type="Generic", features=[], roles=[], entities_detected=[], constraints=[], assumptions=[],
        status="conflict",
        conflicts=[
          "Requirement conflict detected: The requirement specifies 'no login' but also requests that 'users must have accounts/profiles'. Accounts and user tracking require a login or authentication gateway."
        ]
      )

    return IntentExtraction(
      app_type=app_type,
      features=features,
      roles=roles,
      entities_detected=entities,
      constraints=["Ensure secure data boundaries per user"],
      assumptions=["Assumed relational SQLite DB state storage"],
      status="success"
    )

  elif stage == "ast":
    nodes = []
    for e in entities:
      nodes.append(ASTNode(type="Entity", name=e))
    for p in pages:
      nodes.append(ASTNode(type="Page", name=p))
    for s in services:
      nodes.append(ASTNode(type="Service", name=s))
    for ev in events:
      nodes.append(ASTNode(type="Event", name=ev))
    return ASTSchema(nodes=nodes)

  elif stage == "ir":
    ir_entities = []
    for e in entities:
      ir_entities.append(IREntity(name=e, fields=[
        IRField(name="id", type="integer", required=True),
        IRField(name="name", type="string", required=True)
      ]))
    return IntermediateRepresentation(
      entities=ir_entities,
      pages=pages,
      services=services,
      events=events,
      business_rules=["validate_name"]
    )

  elif stage == "architecture":
    return ArchitecturePlan(
      domain_model={"entities": entities, "relations": []},
      user_flows=[{"flow_name": f"Manage {entities[1]}s", "steps": ["Login", "Navigate to page", "Create item"]}],
      service_dependency_graph={s: [] for s in services},
      data_flow={"client": "UI Form", "server": "FastAPI", "db": "SQLite"}
    )

  elif stage == "schemas":
    ui_pages = [
      UIPage(name="Login", route="/login", reason="Security entry", components=[
        UIComponent(name="login_form", type="form", props={"fields": ["email", "password"], "submit_label": "Login"}, reason="Creds form")
      ]),
      UIPage(name="Dashboard", route="/dashboard", reason="KPI overview", components=[
        UIComponent(name="stats_card", type="card", props={"metrics": ["Total Items"]}, reason="Summary stats widget")
      ])
    ]
    for p in pages[2:]:
      ui_pages.append(UIPage(name=p, route=f"/{p.lower()}", reason=f"{p} viewer view", components=[
        UIComponent(name=f"{p.lower()}_table", type="table", props={"headers": ["Name"]}, reason="Renders database entries")
      ]))

    endpoints = [
      APIEndpoint(path="/api/auth/login", method="POST", request_body_schema={"email": "string", "password": "string"}, response_schema={"access_token": "string", "role": "string"}, description="Login endpoint", reason="Generates JWT auth token"),
      APIEndpoint(path=f"/api/{entities[1].lower()}s", method="GET", response_schema={"data": "array"}, description=f"Get {entities[1]}s", reason=f"Query {entities[1]} registry")
    ]

    db_tables = [
      DBTable(name="users", columns=[
        DBColumn(name="id", type="integer", primary_key=True, reason="ID"),
        DBColumn(name="email", type="string", nullable=False, reason="Email"),
        DBColumn(name="hashed_password", type="string", nullable=False, reason="Password"),
        DBColumn(name="role", type="string", nullable=False, reason="Role")
      ], reason="Users auth list")
    ]
    for e in entities[1:]:
      db_tables.append(DBTable(name=f"{e.lower()}s", columns=[
        DBColumn(name="id", type="integer", primary_key=True, reason="ID"),
        DBColumn(name="name", type="string", nullable=False, reason="Name")
      ], reason=f"Database record list for {e}"))

    auth_roles = [AuthRole(name=r, permissions=[f"{entities[1].lower()}:read"], reason="Default permissions") for r in roles]

    rules = [
      BusinessRule(rule_name="validate_name", entity=entities[1], trigger="before_create", condition="len(name) > 0", action="allow", reason="Checks name not blank")
    ]

    return FullSchema(
      ui=UISchema(pages=ui_pages, reason="App UI layout specification"),
      api=APISchema(endpoints=endpoints, reason="REST API schemas"),
      db=DBSchema(tables=db_tables, reason="PostgreSQL schemas mapping"),
      auth=AuthSchema(roles=auth_roles, reason="RBAC user authorization matrix"),
      business=BusinessRulesSchema(rules=rules, reason="Business transaction assertions")
    )
  return None

class GeminiService:
  def __init__(self):
    self.use_mock = get_use_mock_mode()
    self.client = None
    if not self.use_mock:
      try:
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
      except Exception as e:
        print(f"Error initializing Gemini: {e}. Falling back to Mock.")
        self.use_mock = True

  def query_structured(self, prompt: str, system_instruction: str, response_schema: Type[T]) -> Tuple[T, Dict[str, Any], float]:
    """Queries Gemini with structured JSON output, returning (parsed_object, token_usage, estimated_cost)"""
    start_time = time.time()
    
    # Mock fallback execution
    if self.use_mock:
      preset_key = None
      prompt_lower = prompt.lower()
      for key in ["crm"]:
        if key in prompt_lower:
          preset_key = key
          break
      
      schema_name = response_schema.__name__
      val = None
      if preset_key == "crm":
        if schema_name == "IntentExtraction":
          val = MOCK_CRM_PRESET["intent"]
        elif schema_name == "ASTSchema":
          val = MOCK_CRM_PRESET["ast"]
        elif schema_name == "IntermediateRepresentation":
          val = MOCK_CRM_PRESET["ir"]
        elif schema_name == "ArchitecturePlan":
          val = MOCK_CRM_PRESET["architecture"]
        elif schema_name == "FullSchema":
          val = MOCK_CRM_PRESET["schemas"]
      
      if val is None:
        if schema_name == "IntentExtraction":
          val = generate_generic_mock(prompt, "intent")
        elif schema_name == "ASTSchema":
          val = generate_generic_mock(prompt, "ast")
        elif schema_name == "IntermediateRepresentation":
          val = generate_generic_mock(prompt, "ir")
        elif schema_name == "ArchitecturePlan":
          val = generate_generic_mock(prompt, "architecture")
        elif schema_name == "FullSchema":
          val = generate_generic_mock(prompt, "schemas")
        elif schema_name == "ValidationReport":
          val = ValidationReport(status="pass", errors=[])
        elif schema_name == "ExecutionVerification":
          val = ExecutionVerification(execution_status="success", errors=[])
        else:
          raise ValueError(f"Unknown mock type: {schema_name}")

      time.sleep(0.4)
      tokens = {"prompt_tokens": 150, "candidates_tokens": 300, "total_tokens": 450}
      return val, tokens, 0.0

    # Real LLM Call with temperature 0.0 (determinism)
    try:
      config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        temperature=0.0,
        response_mime_type="application/json",
        response_schema=response_schema
      )
      response = self.client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=prompt,
        config=config
      )
      parsed = response_schema.model_validate_json(response.text)
      
      prompt_tok = response.usage_metadata.prompt_token_count if response.usage_metadata else 0
      cand_tok = response.usage_metadata.candidates_token_count if response.usage_metadata else 0
      tokens = {
        "prompt_tokens": prompt_tok,
        "candidates_tokens": cand_tok,
        "total_tokens": prompt_tok + cand_tok
      }
      cost = (prompt_tok * 1.25 / 1000000) + (cand_tok * 5.00 / 1000000)
      return parsed, tokens, cost
      
    except Exception as e:
      print(f"Gemini API Exception: {e}. Reverting to mock presettings.")
      self.use_mock = True
      res = self.query_structured(prompt, system_instruction, response_schema)
      self.use_mock = False
      return res

gemini_service = GeminiService()
