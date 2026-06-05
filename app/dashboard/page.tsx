"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Sparkles, Play, Download, Settings, History, 
  Layers, Cpu, Database, Layout, Shield, 
  Terminal, RefreshCw, LogOut, Code, Eye,
  Wrench, BarChart2, Binary
} from "lucide-react";
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import PipelineFlow from "@/components/PipelineFlow";
import PreviewRenderer from "@/components/PreviewRenderer";
import CodeExplorer from "@/components/CodeExplorer";
import { useCompilerStore } from "@/store/compilerStore";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"compiler" | "devtools">("compiler");
  const [devToolTab, setDevToolTab] = useState<"json" | "repair" | "benchmarks" | "verification" | "ast" | "ir" | "files">("json");

  // Helper to convert flat file tree to nested tree for CodeExplorer
  const getNestedFileTree = (flatTree: Record<string, string>) => {
    const tree: any = {};
    Object.keys(flatTree).forEach(path => {
      const parts = path.split('/');
      let current = tree;
      parts.forEach((part, i) => {
        if (i === parts.length - 1) {
          current[part] = path;
        } else {
          current[part] = current[part] || {};
          current = current[part];
        }
      });
    });
    return { tree };
  };
  
  const {
    prompt, setPrompt,
    compiling, setCompiling,
    currentStage, setCurrentStage,
    compilerOutput, setCompilerOutput,
    stageStatuses, updateStageStatus,
    latencies,
    apiKey, setApiKey,
    forceMock, setForceMock,
  } = useCompilerStore();

  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('appforge_user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('appforge_token');
    localStorage.removeItem('appforge_user');
    // Clear cookie
    document.cookie = 'appforge_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    router.push('/auth/signin');
  };

  const handleDownloadZip = async () => {
    if (!compilerOutput?.runtime?.file_tree) return;
    
    try {
      const zip = new JSZip();
      const fileTree = compilerOutput.runtime.file_tree;
      const projectName = compilerOutput.intent?.app_type?.toLowerCase().replace(/\s+/g, '-') || 'appforge-project';

      Object.entries(fileTree).forEach(([path, content]) => {
        zip.file(path, content as string);
      });

      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `${projectName}.zip`);
    } catch (err) {
      console.error("ZIP Generation Failed:", err);
      alert("Failed to generate ZIP archive.");
    }
  };

  const startCompilation = async () => {
    if (!prompt) return;
    setCompiling(true);
    
    // 1. Reset all stages to pending
    const stages = [
      'intent', 'ast', 'ir', 'architecture', 'schemas', 
      'bindings', 'validation', 'repair', 'verification', 'runtime'
    ];
    stages.forEach(s => updateStageStatus(s, 'pending'));
    setCurrentStage('intent');

    try {
      // 2. Start visual progress for initial stages
      updateStageStatus('intent', 'processing');
      
      const token = localStorage.getItem('appforge_token');
      const res = await fetch('/api/compile', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          prompt,
          api_key: apiKey,
          force_mock: forceMock
        }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setCompilerOutput(data);
        
        // 3. Animate through the stages using the actual data
        for (const stage of stages) {
          setCurrentStage(stage);
          updateStageStatus(stage, 'processing');
          
          // Small delay for visual effect
          await new Promise(r => setTimeout(r, 300));
          
          // Determine status from data
          let status: "success" | "failed" | "warning" = 'success';
          if (stage === 'validation' && data.validation?.status === 'fail') status = 'warning';
          if (stage === 'repair' && data.repair?.status === 'failed') status = 'failed';
          if (stage === 'verification' && data.verification?.execution_status === 'failed') status = 'failed';
          if (stage === 'runtime' && !data.runtime) status = 'failed';
          
          updateStageStatus(stage, status);
        }
      } else {
        updateStageStatus('intent', 'failed');
        alert(data.error || "Compilation failed");
      }
    } catch (err) {
      console.error("Compilation Error:", err);
      updateStageStatus('intent', 'failed');
    } finally {
      setCompiling(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <header className="h-16 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">AppForge <span className="text-blue-500">AI</span></span>
          <div className="h-4 w-px bg-white/10 mx-2" />
          <span className="text-xs text-gray-500 font-mono bg-white/5 px-2 py-1 rounded border border-white/5">v1.0.0-serverless</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium">{user.name || user.email}</span>
            <span className="text-[10px] text-blue-400 uppercase tracking-widest">{user.role}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <aside className="w-80 border-r border-white/5 bg-[#0a0a0a] p-6 flex flex-col gap-6 overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Compiler Input</label>
              {compilerOutput?.verification?.execution_status && (
                <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                  compilerOutput.verification.execution_status === 'success' 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  <Shield className="w-3 h-3" />
                  {compilerOutput.verification.execution_status}
                </div>
              )}
            </div>
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full h-40 bg-white/5 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none transition-all placeholder:text-gray-700 text-white"
              placeholder="Describe your application requirements..."
            />
            <button 
              onClick={startCompilation}
              disabled={compiling || !prompt}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/10 active:scale-[0.98]"
            >
              {compiling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              {compiling ? "Compiling..." : "Generate Application"}
            </button>
          </div>

          <div className="h-px bg-white/5" />

          <div className="space-y-4">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Project Status</label>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-white/5 border border-white/5 rounded-lg p-3">
                <span className="text-xs text-gray-500">Total Latency</span>
                <span className="text-sm font-mono text-blue-400">
                  {compilerOutput?.latency_ms ? `${Object.values(compilerOutput.latency_ms).reduce((a: any, b: any) => a + b, 0)}ms` : '---'}
                </span>
              </div>
              
              {compilerOutput?.runtime?.file_tree && (
                <button 
                  onClick={handleDownloadZip}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20 mt-4 active:scale-[0.98]"
                >
                  <Download className="w-4 h-4" /> Download Project ZIP
                </button>
              )}
            </div>
          </div>

          <div className="h-px bg-white/5" />

          <div className="space-y-4">
            <button 
              onClick={() => setShowConfig(!showConfig)}
              className="flex items-center justify-between w-full text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-300 transition-colors"
            >
              <span>Configuration</span>
              <Settings className={`w-3 h-3 transition-transform ${showConfig ? 'rotate-90' : ''}`} />
            </button>
            
            {showConfig && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-600 font-bold uppercase">Gemini API Key</label>
                  <input 
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-white"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-gray-600 font-bold uppercase">Force Mock Mode</label>
                  <button 
                    onClick={() => setForceMock(!forceMock)}
                    className={`w-8 h-4 rounded-full transition-colors relative ${forceMock ? 'bg-blue-600' : 'bg-zinc-700'}`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${forceMock ? 'left-4.5' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-auto pt-6">
            <button 
              onClick={() => setActiveTab(activeTab === 'compiler' ? 'devtools' : 'compiler')}
              className={`w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all border ${
                activeTab === 'devtools' 
                ? 'bg-blue-600/10 text-blue-400 border-blue-500/30' 
                : 'bg-white/5 text-gray-500 border-white/10 hover:bg-white/10 hover:text-gray-300'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" /> 
              {activeTab === 'devtools' ? 'Back to Compiler' : 'Developer Tools'}
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden bg-[#050505]">
          {activeTab === 'compiler' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="h-64 border-b border-white/5 relative bg-[#0a0a0a]/50">
                <PipelineFlow 
                  currentStage={currentStage || "intent"}
                  stageStatuses={stageStatuses || {}}
                  latencies={latencies || {}}
                  onSelectStage={(stage) => {
                    setCurrentStage(stage);
                    setActiveTab('devtools');
                    if (['ast', 'ir', 'repair', 'verification'].includes(stage)) {
                      setDevToolTab(stage as any);
                    } else {
                      setDevToolTab('json');
                    }
                  }}
                  errorsCount={compilerOutput?.validation?.errors?.length || 0}
                />
              </div>
              
              <div className="flex-1 p-8 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                    <Eye className="w-5 h-5 text-blue-500" /> 
                    Live Application Preview
                  </h2>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Interactive Sandbox</span>
                  </div>
                </div>
                <div className="flex-1 relative rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
                  <PreviewRenderer 
                    schemas={compilerOutput?.schemas} 
                    previewData={compilerOutput?.runtime?.preview_data} 
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center px-6 border-b border-white/5 bg-[#0a0a0a]">
                {[
                  { id: 'json', label: 'JSON Explorer', icon: Code },
                  { id: 'files', label: 'File Explorer', icon: Database },
                  { id: 'ast', label: 'AST Viewer', icon: Binary },
                  { id: 'ir', label: 'IR Viewer', icon: Cpu },
                  { id: 'repair', label: 'Repair Log', icon: Wrench },
                  { id: 'verification', label: 'Verification', icon: Shield },
                  { id: 'benchmarks', label: 'Benchmarks', icon: BarChart2 },
                ].map(tool => (
                  <button 
                    key={tool.id}
                    onClick={() => setDevToolTab(tool.id as any)}
                    className={`px-4 py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors flex items-center gap-2 ${
                      devToolTab === tool.id 
                      ? 'border-blue-500 text-blue-400' 
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <tool.icon className="w-3.5 h-3.5" /> {tool.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-auto p-8 font-mono text-xs">
                {devToolTab === 'json' && (
                  <div className="space-y-4">
                    <h3 className="text-blue-400 font-bold uppercase tracking-widest">Full Compiler Artifacts</h3>
                    <pre className="bg-white/5 p-6 rounded-xl border border-white/5 text-blue-200">
                      {JSON.stringify(compilerOutput, null, 2) || "// No artifacts generated yet."}
                    </pre>
                  </div>
                )}
                {devToolTab === 'files' && (
                  <div className="h-full flex flex-col gap-4">
                    <h3 className="text-blue-400 font-bold uppercase tracking-widest">Generated Project Source</h3>
                    <div className="flex-1 min-h-0">
                      {compilerOutput?.runtime?.file_tree ? (
                        <CodeExplorer 
                          fileTree={getNestedFileTree(compilerOutput.runtime.file_tree)}
                          fileContents={compilerOutput.runtime.file_tree}
                        />
                      ) : (
                        <div className="bg-white/5 p-12 rounded-xl border border-white/5 text-center text-gray-500">
                          No source code generated yet. Run the compiler to see files.
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {devToolTab === 'ast' && (
                  <div className="space-y-4">
                    <h3 className="text-blue-400 font-bold uppercase tracking-widest">Abstract Syntax Tree</h3>
                    <pre className="bg-white/5 p-6 rounded-xl border border-white/5 text-emerald-200">
                      {JSON.stringify(compilerOutput?.ast, null, 2) || "// No AST generated yet."}
                    </pre>
                  </div>
                )}
                {devToolTab === 'ir' && (
                  <div className="space-y-4">
                    <h3 className="text-blue-400 font-bold uppercase tracking-widest">Intermediate Representation (Immutable)</h3>
                    <pre className="bg-white/5 p-6 rounded-xl border border-white/5 text-amber-200">
                      {JSON.stringify(compilerOutput?.ir, null, 2) || "// No IR generated yet."}
                    </pre>
                  </div>
                )}
                {devToolTab === 'repair' && (
                  <div className="space-y-4">
                    <h3 className="text-blue-400 font-bold uppercase tracking-widest">Repair Engine History</h3>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                      {compilerOutput?.repair?.history?.length ? (
                        <pre className="text-zinc-400">
                          {JSON.stringify(compilerOutput.repair.history, null, 2)}
                        </pre>
                      ) : (
                        <div className="text-center py-12 text-zinc-500">
                          No repair patches applied in this run.
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {devToolTab === 'verification' && (
                  <div className="space-y-4">
                    <h3 className="text-blue-400 font-bold uppercase tracking-widest">Execution Verification Report</h3>
                    <pre className="bg-white/5 p-6 rounded-xl border border-white/5 text-zinc-300">
                      {JSON.stringify(compilerOutput?.verification, null, 2) || "// No verification report available."}
                    </pre>
                  </div>
                )}
                {devToolTab === 'benchmarks' && (
                  <div className="space-y-6">
                    <h3 className="text-blue-400 font-bold uppercase tracking-widest">Evaluation Engine Benchmarks</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Success Rate</div>
                        <div className="text-4xl font-bold text-emerald-400">{compilerOutput?.evaluation?.success_rate || 0}%</div>
                      </div>
                      <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Repair Rate</div>
                        <div className="text-4xl font-bold text-amber-400">{compilerOutput?.evaluation?.repair_rate || 0}%</div>
                      </div>
                      <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Execution Failure</div>
                        <div className="text-4xl font-bold text-red-400">{compilerOutput?.evaluation?.execution_failure_rate || 0}%</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
