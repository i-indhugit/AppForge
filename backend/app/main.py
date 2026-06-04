import os
import time
from fastapi import FastAPI, BackgroundTasks, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import settings, get_use_mock_mode
from app.schemas import CompilerRequest, CompilerOutput
from app.services.gemini import gemini_service

# Import Stages
from app.pipeline.stage1_intent import run_stage as run_intent
from app.pipeline.stage2a_ast import run_stage as run_ast
from app.pipeline.stage2_ir import run_stage as run_ir
from app.pipeline.stage3_architecture import run_stage as run_architecture
from app.pipeline.stage4_schema import run_stage as run_schema
from app.pipeline.stage5_validator import run_stage as run_validation
from app.pipeline.stage6_repair import run_stage as run_repair
from app.pipeline.stage7_verification import run_stage as run_verification
from app.pipeline.stage8_runtime import run_stage as run_runtime

# Import Stage 9: Evaluation
from app.pipeline.stage9_evaluation import (
  load_evaluation_results,
  save_evaluation_results,
  run_prompt_through_compiler,
  get_metrics_summary,
  BENCHMARK_PROMPTS
)

app = FastAPI(
  title=settings.APP_NAME,
  description="Upgraded AppForge Deterministic Full-Stack Compiler.",
  version="2.0.0"
)

# CORS Configuration
app.add_middleware(
  CORSMiddleware,
  allow_origins=settings.CORS_ORIGINS,
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

# Serve static downloads directory: backend/static/
static_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
async def root():
  return {
    "status": "online",
    "mock_mode_active": get_use_mock_mode(),
    "gemini_model": settings.GEMINI_MODEL,
    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
  }

@app.post("/api/compile", response_model=CompilerOutput)
async def compile_app(req: CompilerRequest):
  """Deterministic compilation sequence running Stage 1 through Stage 8."""
  # API Key configuration override
  if req.api_key and req.api_key.strip():
    settings.GEMINI_API_KEY = req.api_key
    settings.FORCE_MOCK_MODE = False
    gemini_service.use_mock = False
    try:
      from google import genai
      gemini_service.client = genai.Client(api_key=req.api_key)
    except Exception:
      pass
      
  old_force = settings.FORCE_MOCK_MODE
  if req.force_mock:
    settings.FORCE_MOCK_MODE = True
    gemini_service.use_mock = True
    
  output = CompilerOutput(prompt=req.prompt)
  output.logs.append(f"[Compiler] Starting compilation pipeline for requirement: '{req.prompt}'")
  
  try:
    # Strict execution sequence
    output = run_intent(output)
    output = run_ast(output)
    output = run_ir(output)
    output = run_architecture(output)
    output = run_schema(output)
    output = run_validation(output)
    output = run_repair(output)
    output = run_verification(output)
    output = run_runtime(output)
    
    # Final state mapping
    if output.status not in ["NEEDS_CLARIFICATION", "CONFLICT", "FAILED"]:
      output.status = "SUCCESS"
      
    output.logs.append(f"[Compiler] Pipeline execution completed with state: {output.status}")
    
  except Exception as e:
    output.status = "FAILED"
    output.logs.append(f"[Compiler] Unhandled pipeline compilation failure: {e}")
    
  # Reset config overrides
  if req.force_mock:
    settings.FORCE_MOCK_MODE = old_force
    gemini_service.use_mock = get_use_mock_mode()
    
  return output

# --- Evaluation Framework (Stage 9) Endpoints ---

@app.get("/api/evaluation/benchmarks")
async def get_benchmarks():
  return BENCHMARK_PROMPTS

@app.get("/api/evaluation/results")
async def get_evaluation_results():
  results = load_evaluation_results()
  summary = get_metrics_summary(results)
  return {
    "results": results,
    "summary": summary
  }

def run_suite_background(force_mock: bool):
  results = []
  for p in BENCHMARK_PROMPTS:
    try:
      res = run_prompt_through_compiler(p, force_mock)
      results.append(res)
    except Exception as e:
      print(f"Error compiling benchmark {p['id']}: {e}")
  save_evaluation_results(results)

@app.post("/api/evaluation/run")
async def trigger_evaluation_suite(background_tasks: BackgroundTasks, force_mock: bool = False):
  background_tasks.add_task(run_suite_background, force_mock)
  return {"status": "processing", "message": "Evaluation benchmark suite run started."}

@app.post("/api/evaluation/run/{prompt_id}")
async def trigger_single_evaluation(prompt_id: str, force_mock: bool = False):
  prompt_dict = next((p for p in BENCHMARK_PROMPTS if p["id"] == prompt_id), None)
  if not prompt_dict:
    raise HTTPException(status_code=404, detail="Prompt not found")
    
  res = run_prompt_through_compiler(prompt_dict, force_mock)
  
  results = load_evaluation_results()
  updated = False
  for i, r in enumerate(results):
    if r["id"] == prompt_id:
      results[i] = res
      updated = True
      break
  if not updated:
    results.append(res)
    
  save_evaluation_results(results)
  return {
    "status": "success",
    "result": res,
    "summary": get_metrics_summary(results)
  }

if __name__ == "__main__":
  import uvicorn
  uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
