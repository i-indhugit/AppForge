import pytest
from app.schemas import (
  ASTSchema, ASTNode,
  IntermediateRepresentation, IREntity, IRField,
  FullSchema,
  UISchema, UIPage, UIComponent,
  APISchema, APIEndpoint,
  DBSchema, DBTable, DBColumn,
  AuthSchema, AuthRole,
  BusinessRulesSchema, BusinessRule,
  CompilerOutput,
  ExecutionVerification
)
from app.pipeline.stage2_ir import run_stage as run_stage2
from app.pipeline.stage5_validator import validate_schemas
from app.pipeline.stage6_repair import programmatically_patch
from app.pipeline.stage7_verification import run_stage as run_stage7

def test_stage2_ast_to_ir_derivation():
  # AST nodes list input
  ast = ASTSchema(nodes=[
    ASTNode(type="Entity", name="User"),
    ASTNode(type="Entity", name="Contact"),
    ASTNode(type="Page", name="Dashboard"),
    ASTNode(type="Service", name="AuthService"),
    ASTNode(type="Event", name="UserRegistered")
  ])
  
  output = CompilerOutput(prompt="dummy prompt")
  output.status = "SUCCESS"
  output.ast = ast
  
  # Run Stage 2 deterministic python mapping
  output = run_stage2(output)
  assert output.ir is not None
  
  ir = output.ir
  assert len(ir.entities) == 2
  assert ir.entities[0].name == "User"
  # Check derived user entity columns
  user_cols = {f.name for f in ir.entities[0].fields}
  assert "email" in user_cols
  assert "role" in user_cols
  
  assert ir.entities[1].name == "Contact"
  contact_cols = {f.name for f in ir.entities[1].fields}
  assert "first_name" in contact_cols
  assert "user_id" in contact_cols
  
  assert "Dashboard" in ir.pages
  assert "AuthService" in ir.services
  assert "UserRegistered" in ir.events

def test_stage5_validation_checks():
  # Consistent schemas
  schemas = FullSchema(
    ui=UISchema(pages=[
      UIPage(name="Dashboard", route="/dashboard", components=[]),
      UIPage(name="Contacts", route="/contacts", components=[
        UIComponent(name="contact_form", type="form", props={"fields": ["first_name", "email"], "submit_label": "Save"})
      ])
    ]),
    api=APISchema(endpoints=[
      APIEndpoint(path="/api/contacts", method="POST", request_body_schema={"first_name": "string", "email": "string"}, response_schema={"id": "integer"}, description="Create contact")
    ]),
    db=DBSchema(tables=[
      DBTable(name="users", columns=[
        DBColumn(name="id", type="integer", primary_key=True),
        DBColumn(name="email", type="string", nullable=False),
        DBColumn(name="hashed_password", type="string", nullable=False),
        DBColumn(name="role", type="string", nullable=False)
      ]),
      DBTable(name="contacts", columns=[
        DBColumn(name="id", type="integer", primary_key=True),
        DBColumn(name="user_id", type="integer", foreign_key="users.id"),
        DBColumn(name="first_name", type="string", nullable=False),
        DBColumn(name="email", type="string", nullable=False)
      ])
    ]),
    auth=AuthSchema(roles=[
      AuthRole(name="admin", permissions=[])
    ]),
    business=BusinessRulesSchema(rules=[])
  )
  
  report = validate_schemas(
    schemas,
    roles_list=["admin"],
    services_list=["ContactService"],
    entities_list=["User", "Contact"],
    pages_list=["Dashboard", "Contacts"]
  )
  assert report.status == "pass"

def test_stage6_patch_system():
  # UI has field 'phone', API doesn't.
  schemas = FullSchema(
    ui=UISchema(pages=[
      UIPage(name="Contacts", route="/contacts", components=[
        UIComponent(name="contact_form", type="form", props={"fields": ["first_name", "phone"], "submit_label": "Save"})
      ])
    ]),
    api=APISchema(endpoints=[
      APIEndpoint(path="/api/contacts", method="POST", request_body_schema={"first_name": "string"}, response_schema={"id": "integer"}, description="Create contact")
    ]),
    db=DBSchema(tables=[
      DBTable(name="contacts", columns=[
        DBColumn(name="id", type="integer", primary_key=True),
        DBColumn(name="first_name", type="string", nullable=False)
      ])
    ]),
    auth=AuthSchema(roles=[
      AuthRole(name="admin", permissions=[])
    ]),
    business=BusinessRulesSchema(rules=[])
  )
  
  roles = ["admin"]
  services = ["ContactService"]
  entities = ["Contact"]
  pages = ["Contacts"]
  
  # 1. Validation fails due to UI field mismatch
  report1 = validate_schemas(schemas, roles, services, entities, pages)
  assert report1.status == "fail"
  
  # 2. Patch 1: Repairs UI-API mismatch
  repaired1, patches1 = programmatically_patch(schemas, report1)
  assert len(patches1) > 0
  assert patches1[0].error_type == "field_mismatch"
  assert "phone" in patches1[0].after
  
  # 3. Validation fails due to API-DB column mismatch
  report2 = validate_schemas(repaired1, roles, services, entities, pages)
  assert report2.status == "fail"
  
  # 4. Patch 2: Repairs API-DB mismatch
  repaired2, patches2 = programmatically_patch(repaired1, report2)
  assert len(patches2) > 0
  assert "phone" in patches2[0].after
  
  # 5. Validation passes!
  report3 = validate_schemas(repaired2, roles, services, entities, pages)
  assert report3.status == "pass"

def test_stage7_verification_failed_invalid_sql():
  output = CompilerOutput(prompt="prompt")
  output.status = "SUCCESS"
  output.schemas = FullSchema(
    ui=UISchema(pages=[]),
    api=APISchema(endpoints=[]),
    db=DBSchema(tables=[
      DBTable(name="contacts", columns=[
        DBColumn(name="-invalid-col-", type="integer")
      ])
    ]),
    auth=AuthSchema(roles=[]),
    business=BusinessRulesSchema(rules=[])
  )
  
  output = run_stage7(output)
  assert output.verification is not None
  assert output.verification.execution_status == "failed"
  assert len(output.verification.errors) > 0
  assert any("SQL syntax error" in err or "syntax error" in err.lower() for err in output.verification.errors)
