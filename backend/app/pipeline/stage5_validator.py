import time
import re
from typing import List
from app.schemas import ValidationReport, ValidationErrorDetail, CompilerOutput, FullSchema

def validate_schemas(schemas: FullSchema, roles_list: List[str], services_list: List[str], entities_list: List[str], pages_list: List[str]) -> ValidationReport:
  errors = []
  
  # Normalize names
  roles_set = {r.lower() for r in roles_list}
  services_set = {s.lower() for s in services_list}
  entities_set = {e.lower() for e in entities_list}
  pages_set = {p.lower() for p in pages_list}

  db_tables = {t.name.lower(): t for t in schemas.db.tables}
  entity_to_table_map = {}
  for table_name in db_tables:
    entity_to_table_map[table_name] = table_name
    if table_name.endswith("s"):
      entity_to_table_map[table_name[:-1]] = table_name

  # 1. UI-to-API Binding Validation
  for page in schemas.ui.pages:
    # Check if UI page exists in IR pages
    if page.name.lower() not in pages_set and page.name.lower() not in ["login", "signup", "dashboard"]:
      errors.append(ValidationErrorDetail(
        type="missing_ir_page",
        location=f"ui.pages[{page.name}]",
        reason=f"Page '{page.name}' is defined in UI schema, but not registered in immutable IR page list."
      ))

    for comp in page.components:
      if comp.type == "form":
        fields = comp.props.get("fields", [])
        
        # Resolve matching API endpoint
        matching_api = None
        for ep in schemas.api.endpoints:
          if ep.method in ["POST", "PUT"]:
            clean_path = ep.path.lower().replace("/api/", "")
            if page.name.lower() in clean_path or any(entity in clean_path for entity in entity_to_table_map):
              matching_api = ep
              break

        if matching_api:
          req_body = matching_api.request_body_schema or {}
          for field in fields:
            if field not in req_body:
              errors.append(ValidationErrorDetail(
                type="field_mismatch",
                location=f"ui.pages[{page.name}].components[{comp.name}].fields",
                reason=f"UI form field '{field}' submits data, but API endpoint '{matching_api.method} {matching_api.path}' request body is missing this parameter."
              ))
        else:
          errors.append(ValidationErrorDetail(
            type="missing_api_endpoint",
            location=f"ui.pages[{page.name}].components[{comp.name}]",
            reason=f"UI form component '{comp.name}' has no matching POST/PUT API endpoint declared in API Schema."
          ))

  # 2. API-to-DB Mapping Validation & Orphan API Endpoint check
  for idx, ep in enumerate(schemas.api.endpoints):
    path_parts = [p for p in ep.path.lower().split("/") if p and p != "api" and p != "auth"]
    if not path_parts:
      continue
    
    target_entity = path_parts[0]
    
    # Check for Authentication endpoints (which don't map directly to entities)
    if target_entity in ["login", "signup", "token", "logout", "session"]:
      continue
      
    target_table = entity_to_table_map.get(target_entity)
    if not target_table:
      # If endpoint doesn't map to any DB table, it is an orphan API endpoint
      errors.append(ValidationErrorDetail(
        type="orphan_api_endpoint",
        location=f"api.endpoints[{idx}].path",
        reason=f"Orphan API endpoint '{ep.method} {ep.path}' has no matching database table or auth context."
      ))
      continue

    table_obj = db_tables[target_table]
    col_names = {col.name.lower() for col in table_obj.columns}
    
    # Verify request body fields exist in DB table columns
    if ep.method in ["POST", "PUT"] and ep.request_body_schema:
      for field in ep.request_body_schema.keys():
        if field in ["password", "password_confirm"]:
          continue
        if field.lower() not in col_names:
          errors.append(ValidationErrorDetail(
            type="field_mismatch",
            location=f"api.endpoints[{idx}].request_body_schema.{field}",
            reason=f"API request parameter '{field}' does not match any column in database table '{target_table}'."
          ))

  # 3. Auth-role Consistency Validation
  for role in schemas.auth.roles:
    if role.name.lower() not in roles_set:
      errors.append(ValidationErrorDetail(
        type="role_mismatch",
        location=f"auth.roles[{role.name}]",
        reason=f"Auth schema role '{role.name}' is not registered in immutable IR user roles."
      ))

  # 4. Page-to-Service check
  for page in schemas.ui.pages:
    if page.name.lower() in ["login", "signup", "dashboard"]:
      continue
    service_found = False
    for svc in services_set:
      if page.name.lower() in svc or svc.replace("service", "") in page.name.lower():
        service_found = True
        break
    if not service_found:
      errors.append(ValidationErrorDetail(
        type="missing_service_link",
        location=f"ui.pages[{page.name}]",
        reason=f"Page '{page.name}' has no matching service boundary defined in the immutable IR services list."
      ))

  # 5. Service-to-Entity mapping check
  for svc in services_list:
    if svc.lower() == "authservice":
      continue
    entity_found = False
    for ent in entities_list:
      if ent.lower() in svc.lower() or svc.lower().replace("service", "") in ent.lower():
        entity_found = True
        break
    if not entity_found:
      errors.append(ValidationErrorDetail(
        type="orphan_service",
        location=f"ir.services[{svc}]",
        reason=f"Service boundary '{svc}' does not map to any database entity in the immutable IR."
      ))

  status = "fail" if errors else "pass"
  return ValidationReport(status=status, errors=errors)

def run_stage(output: CompilerOutput) -> CompilerOutput:
  start_time = time.time()
  
  if output.status not in ["success", "SUCCESS"] or not output.schemas:
    output.logs.append("[Stage 5: Validation] Skipping validation because schema generation is missing.")
    return output

  output.logs.append("[Stage 5: Validation] Executing strict cross-layer dependency validation checks...")
  
  # Fetch parameters from immutable IR
  roles = output.intent.roles if output.intent else []
  services = output.ir.services if output.ir else []
  entities = [e.name for e in output.ir.entities] if output.ir else []
  pages = output.ir.pages if output.ir else []
  
  report = validate_schemas(output.schemas, roles, services, entities, pages)
  
  latency = (time.time() - start_time) * 1000
  output.validation = report
  output.latency_ms["validation"] = latency
  
  if report.status == "fail":
    # Transit to REPAIRING state as required
    output.status = "REPAIRING"
    output.logs.append(f"[Stage 5: Validation] Strict checks FAILED with {len(report.errors)} errors. Switching state to REPAIRING.")
    for err in report.errors:
      output.logs.append(f"  * ERROR: [{err.type}] at {err.location} - {err.reason}")
  else:
    output.logs.append(f"[Stage 5: Validation] Validation PASSED. Latency: {latency:.1f}ms")
    
  return output
