import time
import json
from app.schemas import ArchitecturePlan, CompilerOutput
from app.services.gemini import gemini_service

SYSTEM_INSTRUCTION = """
You are the Architecture Planner Stage of the AppForge AI Application Compiler.
Your job is to take the Intermediate Representation (IR) and generate a detailed architecture plan.

The architecture plan must contain:
1. domain_model:
   - entities: List of the entity names matching IR.
   - relations: Foreign-key relationships (one-to-many, many-to-one, one-to-one, many-to-many) with a 'reason' attribute explaining the association.
2. user_flows: List of step-by-step UI actions.
3. service_dependency_graph: Map of service components (from IR) and their dependency array.
4. data_flow: High-level overview of inputs, servers, and DB transaction flows.

Input format is a JSON of the immutable IR.
Ensure the output is strictly consistent with the entities in the IR.
Return valid JSON only matching the schema.
"""

def run_stage(output: CompilerOutput) -> CompilerOutput:
  start_time = time.time()
  
  if output.status not in ["success", "SUCCESS"] or not output.ir:
    output.logs.append("[Stage 3: Architecture] Skipping stage because IR is missing.")
    return output

  output.logs.append("[Stage 3: Architecture] Generating system architecture diagrams and service graphs...")
  
  ir_json = json.dumps(output.ir.model_dump())
  
  arch, tokens, cost = gemini_service.query_structured(
    prompt=f"IR: {ir_json}",
    system_instruction=SYSTEM_INSTRUCTION,
    response_schema=ArchitecturePlan
  )
  
  latency = (time.time() - start_time) * 1000
  output.architecture = arch
  output.latency_ms["architecture"] = latency
  output.token_usage["architecture_prompt"] = tokens.get("prompt_tokens", 0)
  output.token_usage["architecture_candidates"] = tokens.get("candidates_tokens", 0)
  output.estimated_cost += cost
  
  output.logs.append(f"[Stage 3: Architecture] Completed. Service dependency graph has {len(arch.service_dependency_graph)} entries. Latency: {latency:.1f}ms")
  return output
