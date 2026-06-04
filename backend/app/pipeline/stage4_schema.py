import time
import json
from app.schemas import FullSchema, CompilerOutput
from app.services.gemini import gemini_service

SYSTEM_INSTRUCTION = """
You are the Schema Generation Stage of the AppForge AI Application Compiler.
Your job is to generate a comprehensive, highly consistent application specification consisting of five schemas:
1. UI Schema: Pages, routes, components, props, and explainability reasons.
2. API Schema: REST endpoints, request/response structures, and explainability reasons.
3. Database Schema: PostgreSQL tables, columns, constraints, foreign keys, and explainability reasons.
4. Auth Schema: Roles and permission mappings, and explainability reasons.
5. Business Rules Schema: Validation triggers, conditions, and explainability reasons.

Input format:
{
  "ir": { ... },
  "architecture": { ... }
}

EXPLAINABILITY RULE:
You MUST specify a 'reason' string attribute explaining why every page, component, endpoint, table, column, role, and business rule exists.

CONSISTENCY RULES:
- Form fields in the UI schema must submit parameters matching API endpoints request bodies.
- Endpoint path resources and request bodies must map to database tables and columns.
- Roles defined in Auth schema must align with intent roles.
- Business rules must reference valid columns in DB schema tables.

Return valid JSON only matching the schema.
"""

def run_stage(output: CompilerOutput) -> CompilerOutput:
  start_time = time.time()
  
  if output.status not in ["success", "SUCCESS"] or not output.ir or not output.architecture:
    output.logs.append("[Stage 4: Schema] Skipping stage because IR or Architecture Plan is missing.")
    return output

  output.logs.append("[Stage 4: Schema] Compiling IR and Architecture into UI, API, DB, Auth, and Business Logic schemas...")
  
  input_data = {
    "ir": output.ir.model_dump(),
    "architecture": output.architecture.model_dump(),
    "roles": output.intent.roles if output.intent else []
  }
  
  schemas, tokens, cost = gemini_service.query_structured(
    prompt=f"Input: {json.dumps(input_data)}",
    system_instruction=SYSTEM_INSTRUCTION,
    response_schema=FullSchema
  )
  
  latency = (time.time() - start_time) * 1000
  output.schemas = schemas
  output.latency_ms["schema"] = latency
  output.token_usage["schema_prompt"] = tokens.get("prompt_tokens", 0)
  output.token_usage["schema_candidates"] = tokens.get("candidates_tokens", 0)
  output.estimated_cost += cost
  
  output.logs.append(
    f"[Stage 4: Schema] Completed. Generated {len(schemas.ui.pages)} pages, "
    f"{len(schemas.api.endpoints)} API endpoints. Explainability tags populated. "
    f"Latency: {latency:.1f}ms"
  )
  return output
