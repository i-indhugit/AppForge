import time
from app.schemas import (
  IntermediateRepresentation,
  IREntity,
  IRField,
  CompilerOutput
)

def run_stage(output: CompilerOutput) -> CompilerOutput:
  start_time = time.time()
  
  if output.status not in ["success", "SUCCESS"] or not output.ast:
    output.logs.append("[Stage 2: IR] Skipping stage because AST is missing.")
    return output

  output.logs.append("[Stage 2: IR] Compiling AST into Immutable Intermediate Representation (IR)...")
  
  entities = []
  pages = []
  services = []
  events = []
  business_rules = []
  
  # Deterministic mapping loop (no LLM re-interpretation)
  for node in output.ast.nodes:
    if node.type == "Entity":
      # Build fields deterministically based on Entity name
      name_lower = node.name.lower()
      fields = [
        IRField(name="id", type="integer", required=True)
      ]
      
      if name_lower == "user":
        fields.extend([
          IRField(name="email", type="string", required=True),
          IRField(name="hashed_password", type="string", required=True),
          IRField(name="role", type="string", required=True)
        ])
      elif name_lower == "contact":
        fields.extend([
          IRField(name="user_id", type="integer", required=True),
          IRField(name="first_name", type="string", required=True),
          IRField(name="last_name", type="string", required=True),
          IRField(name="email", type="string", required=True),
          IRField(name="phone", type="string", required=False)
        ])
      elif name_lower == "deal":
        fields.extend([
          IRField(name="user_id", type="integer", required=True),
          IRField(name="title", type="string", required=True),
          IRField(name="value", type="float", required=True),
          IRField(name="stage", type="string", required=True)
        ])
      elif name_lower in ["subscription", "billing"]:
        fields.extend([
          IRField(name="user_id", type="integer", required=True),
          IRField(name="plan_id", type="string", required=True),
          IRField(name="status", type="string", required=True)
        ])
      else:
        # Generic entity fields
        if name_lower != "user":
          fields.append(IRField(name="user_id", type="integer", required=True))
        fields.extend([
          IRField(name="name", type="string", required=True),
          IRField(name="created_at", type="datetime", required=False)
        ])
        
      entities.append(IREntity(name=node.name, fields=fields))
      
      # Derive rules deterministically
      business_rules.append(f"validate_{name_lower}_fields")
      
    elif node.type == "Page":
      pages.append(node.name)
    elif node.type == "Service":
      services.append(node.name)
    elif node.type == "Event":
      events.append(node.name)

  # Construct immutable IR
  ir = IntermediateRepresentation(
    entities=entities,
    pages=pages,
    services=services,
    events=events,
    business_rules=business_rules
  )
  
  latency = (time.time() - start_time) * 1000
  output.ir = ir
  output.latency_ms["ir"] = latency
  
  # Append Immutable rule to logs
  output.logs.append("  * RULE ENFORCED: IR is immutable and acts as compiler AST root.")
  output.logs.append(f"[Stage 2: IR] Completed. Created {len(ir.entities)} entities, {len(ir.pages)} pages. Latency: {latency:.1f}ms")
  return output
