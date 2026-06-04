import time
import os
from app.schemas import RuntimeResult, CompilerOutput
from app.services.zip_generator import generate_project_zip, generate_preview_data

def run_stage(output: CompilerOutput) -> CompilerOutput:
  start_time = time.time()
  
  if output.status not in ["success", "SUCCESS"] or not output.schemas:
    output.logs.append("[Stage 8: Runtime] Skipping because schemas are missing or status is not SUCCESS.")
    return output

  output.logs.append("[Stage 8: Runtime] Compiling final validated/verified schemas into downloadable zip codebase...")
  
  try:
    # Resolve static dir: backend/static/
    static_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "static")
    os.makedirs(static_dir, exist_ok=True)
    
    # Generate project files and trees
    zip_bytes, file_explorer = generate_project_zip(output.schemas)
    
    # Write ZIP file
    zip_path = os.path.join(static_dir, "appforge_project.zip")
    with open(zip_path, "wb") as f:
      f.write(zip_bytes)
      
    preview = generate_preview_data(output.schemas)
    
    runtime = RuntimeResult(
      zip_url="/static/appforge_project.zip",
      file_tree=file_explorer,
      preview_data=preview
    )
    output.runtime = runtime
    
    files_count = len(file_explorer.get("contents", {}))
    output.logs.append(f"[Stage 8: Runtime] Verified codebase compiled ({files_count} files). Saved to backend/static/appforge_project.zip")
    
  except Exception as e:
    output.status = "FAILED"
    output.logs.append(f"[Stage 8: Runtime] Runtime generation failure: {e}")
    import traceback
    traceback.print_exc()

  latency = (time.time() - start_time) * 1000
  output.latency_ms["runtime"] = latency
  output.logs.append(f"[Stage 8: Runtime] Completed. Latency: {latency:.1f}ms")
  return output
