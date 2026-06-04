import time
import json
from app.schemas import ASTSchema, CompilerOutput
from app.services.gemini import gemini_service

SYSTEM_INSTRUCTION = """
You are the AST Builder Stage of the AppForge AI Application Compiler.
Your job is to convert the extracted high-level Intent into a structured Abstract Syntax Tree (AST).

The AST consists of a list of nodes:
- type: 'Entity' | 'Page' | 'Service' | 'Event'
- name: Unique name of the node (Entity names should be singular PascalCase; Page names singular PascalCase; Service names PascalCase; Event names past tense e.g. UserCreated).
- props: Dictionary of custom properties for that node.

Input format is a JSON of the extracted intent.
Ensure the nodes cover all features.
Return valid JSON only matching the schema.
"""

def run_stage(output: CompilerOutput) -> CompilerOutput:
  start_time = time.time()
  
  if output.status not in ["success", "SUCCESS"] or not output.intent:
    output.logs.append("[Stage 2A: AST] Skipping stage because intent extraction did not succeed.")
    return output

  output.logs.append("[Stage 2A: AST] Building compiler Abstract Syntax Tree (AST) nodes...")
  
  intent_json = json.dumps(output.intent.model_dump())
  
  ast, tokens, cost = gemini_service.query_structured(
    prompt=f"Intent: {intent_json}",
    system_instruction=SYSTEM_INSTRUCTION,
    response_schema=ASTSchema
  )
  
  latency = (time.time() - start_time) * 1000
  output.ast = ast
  output.latency_ms["ast"] = latency
  output.token_usage["ast_prompt"] = tokens.get("prompt_tokens", 0)
  output.token_usage["ast_candidates"] = tokens.get("candidates_tokens", 0)
  output.estimated_cost += cost
  
  output.logs.append(f"[Stage 2A: AST] Completed. Generated {len(ast.nodes)} AST nodes. Latency: {latency:.1f}ms")
  return output
