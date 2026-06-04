import time
from app.schemas import IntentExtraction, CompilerOutput
from app.services.gemini import gemini_service

SYSTEM_INSTRUCTION = """
You are the Intent Extraction Stage of the AppForge AI Application Compiler.
Your job is to parse the user's natural language software requirements and extract structured intent.

Extract:
1. app_type: What kind of app is this? (e.g. CRM, LMS, Project Management, E-Commerce).
2. features: List of core features request (e.g. authentication, dashboard, contacts).
3. roles: Target user roles (e.g. admin, member, guest).

Failure / Edge Case Handling:
1. VAGUE: If the user prompt is extremely vague (e.g. "build an app for students" or "make a website"), set status to "needs_clarification" and write 3 clear clarification questions in 'questions'.
2. CONFLICTING: If the prompt contains logical contradictions (e.g. "no login but users must have profiles"), set status to "conflict" and list the conflicts in 'conflicts'.
3. INCOMPLETE: If the prompt is normal but leaves out standard details, list the assumptions you made to make it standard in 'assumptions' and set status to 'success'.

Return valid JSON matching the schema.
"""

def run_stage(output: CompilerOutput) -> CompilerOutput:
    start_time = time.time()
    output.logs.append("[Stage 1: Intent Extraction] Starting intent extraction...")
    
    prompt = output.prompt
    
    # Query Gemini
    intent, tokens, cost = gemini_service.query_structured(
        prompt=prompt,
        system_instruction=SYSTEM_INSTRUCTION,
        response_schema=IntentExtraction
    )
    
    # Update metrics
    latency = (time.time() - start_time) * 1000
    output.intent = intent
    output.status = intent.status
    output.latency_ms["intent"] = latency
    output.token_usage["intent_prompt"] = tokens.get("prompt_tokens", 0)
    output.token_usage["intent_candidates"] = tokens.get("candidates_tokens", 0)
    output.estimated_cost += cost
    
    output.logs.append(f"[Stage 1: Intent Extraction] Completed. Status: {intent.status}. Latency: {latency:.1f}ms")
    if intent.status == "needs_clarification":
        output.logs.append(f"[Stage 1: Intent Extraction] Clarification needed: {intent.questions}")
    elif intent.status == "conflict":
        output.logs.append(f"[Stage 1: Intent Extraction] Requirement conflict: {intent.conflicts}")
    else:
        output.logs.append(f"[Stage 1: Intent Extraction] App Type: {intent.app_type}, Roles: {intent.roles}")
        
    return output
