import time
import os
from app.schemas import RuntimeResult, CompilerOutput
from app.services.zip_generator import generate_project_zip, generate_preview_data

def run_stage(output: CompilerOutput) -> CompilerOutput:
    start_time = time.time()
    
    if output.status != "success" or not output.schemas:
        output.logs.append("[Stage 7: Runtime] Skipping because schemas are missing or compilation status is not success.")
        return output

    output.logs.append("[Stage 7: Runtime] Synthesizing FastAPI, SQLAlchemy, Next.js, and SQL codebase...")
    
    try:
        # Create static downloads dir if not exists
        static_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static")
        os.makedirs(static_dir, exist_ok=True)
        
        # Compile project code into ZIP
        zip_bytes, file_explorer = generate_project_zip(output.schemas)
        
        # Save ZIP file
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
        
        # Check files count
        files_count = len(file_explorer.get("contents", {}))
        output.logs.append(f"[Stage 7: Runtime] Codebase packaged successfully ({files_count} files). Saved to static/appforge_project.zip")
        
    except Exception as e:
        output.status = "failed"
        output.logs.append(f"[Stage 7: Runtime] Runtime compilation failed: {e}")
        import traceback
        traceback.print_exc()

    latency = (time.time() - start_time) * 1000
    output.latency_ms["runtime"] = latency
    output.logs.append(f"[Stage 7: Runtime] Completed. Latency: {latency:.1f}ms")
    return output
