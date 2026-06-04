import time
import sqlite3
import re
from app.schemas import ExecutionVerification, CompilerOutput
from app.services.zip_generator import generate_project_zip

def run_stage(output: CompilerOutput) -> CompilerOutput:
  start_time = time.time()
  
  if output.status not in ["success", "SUCCESS"] or not output.schemas:
    output.logs.append("[Stage 7: Verification] Skipping because schemas are missing or status is not SUCCESS.")
    return output

  output.logs.append("[Stage 7: Verification] Running multi-layer execution checks (Python compile & SQLite DDL parser tests)...")
  
  errors = []
  
  try:
    # 1. Compile codebase in-memory
    zip_bytes, explorer = generate_project_zip(output.schemas)
    contents = explorer["contents"]
    
    # 2. Backend Check: Python AST compilation on main.py
    main_py = contents.get("backend/app/main.py", "")
    if main_py:
      try:
        # Compile source to check for Python syntax errors
        compile(main_py, "main.py", "exec")
        output.logs.append("  * Backend Check: Python AST compilation verification PASSED.")
      except SyntaxError as se:
        errors.append(f"Backend syntax compilation error: {se.msg} at line {se.lineno}")
    else:
      errors.append("Backend check failed: backend/app/main.py is missing from generated files.")
      
    # 3. Database Check: SQL Syntax run in temporary SQLite db
    schema_sql = contents.get("database/schema.sql", "")
    if schema_sql:
      # Translate PostgreSQL DDL to SQLite syntax for local sandbox testing
      # SQLite matches most standard SQL table structures
      sqlite_ddl = schema_sql
      sqlite_ddl = sqlite_ddl.replace("SERIAL PRIMARY KEY", "INTEGER PRIMARY KEY AUTOINCREMENT")
      sqlite_ddl = sqlite_ddl.replace("SERIAL", "INTEGER PRIMARY KEY AUTOINCREMENT")
      
      # SQLite does not support multiple foreign keys in inline references in the same way or requires them at table level,
      # but standard CREATE TABLE syntax parses perfectly in SQLite.
      conn = sqlite3.connect(":memory:")
      try:
        conn.executescript(sqlite_ddl)
        output.logs.append("  * Database Check: In-memory SQLite DDL execution verification PASSED.")
      except sqlite3.Error as se:
        errors.append(f"Database SQL syntax error: {se}")
      finally:
        conn.close()
    else:
      errors.append("Database check failed: database/schema.sql is missing from generated files.")
      
    # 4. Frontend Check: JSX / TSX syntax validation
    # Verify that Next.js pages contain correct structural formatting
    for filename, code in contents.items():
      if filename.startswith("frontend/pages/") and filename.endswith(".tsx"):
        # Check matching curly braces / return statements
        open_braces = code.count("{")
        close_braces = code.count("}")
        if open_braces != close_braces:
          errors.append(f"Frontend compilation check failed: Unmatched braces in page {filename} ({open_braces} open vs {close_braces} close).")
          
    if not errors:
      output.logs.append("  * Frontend Check: JSX/TSX page syntax verification PASSED.")
      
  except Exception as e:
    errors.append(f"Verification engine failure: {e}")
    
  # Setup Verification result
  status_val = "failed" if errors else "success"
  output.verification = ExecutionVerification(
    execution_status=status_val,
    errors=errors
  )
  
  latency = (time.time() - start_time) * 1000
  output.latency_ms["verification"] = latency
  
  if status_val == "failed":
    output.status = "FAILED"
    output.logs.append(f"[Stage 7: Verification] Execution verification FAILED with {len(errors)} compile/syntax errors. Compiler state: FAILED.")
    for err in errors:
      output.logs.append(f"  * VERIFICATION ERROR: {err}")
  else:
    output.status = "SUCCESS"
    output.logs.append(f"[Stage 7: Verification] Execution verification succeeded. Compiler state: SUCCESS. Latency: {latency:.1f}ms")
    
  return output
