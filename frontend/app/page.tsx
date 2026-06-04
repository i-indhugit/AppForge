"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Play,
  Download,
  AlertTriangle,
  CheckCircle,
  FileJson,
  Layers,
  Wrench,
  Cpu,
  Settings,
  HelpCircle,
  BarChart2,
  Terminal,
  RefreshCw,
  Binary,
  ShieldCheck,
  History,
  Copy,
  Plus,
  BookOpen,
  ArrowRight,
  Database,
  Lock,
  Workflow,
  Search,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import PipelineFlow from "../components/PipelineFlow";
import CodeExplorer from "../components/CodeExplorer";
import AppPreview from "../components/AppPreview";
import { useCompilerStore, CompileRun } from "../store/compilerStore";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function WorkspacePage() {
  const {
    prompt,
    setPrompt,
    activeView,
    setActiveView,
    compiling,
    setCompiling,
    currentStage,
    setCurrentStage,
    compilerOutput,
    setCompilerOutput,
    stageStatuses,
    setStageStatuses,
    updateStageStatus,
    latencies,
    setLatencies,
    updateLatency,
    forceMock,
    setForceMock,
    apiKey,
    setApiKey,
    showSettings,
    setShowSettings,
    runHistory,
    addRunHistory,
  } = useCompilerStore();

  // Workbench local states
  const [activeInspectorTab, setActiveInspectorTab] = useState<"schema" | "validation" | "logs" | "repair">("logs");
  const [schemaFilter, setSchemaFilter] = useState<"ui" | "api" | "db" | "auth" | "business">("ui");

  // Benchmarks dashboard local states
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [runningSuite, setRunningSuite] = useState(false);
  const [runningSingleId, setRunningSingleId] = useState<string | null>(null);

  // Fetch benchmark results
  const fetchDashboardData = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/evaluation/results`);
      if (res.ok) {
        const d = await res.json();
        setDashboardData(d);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    }
  };

  useEffect(() => {
    if (activeView === "benchmarks") {
      fetchDashboardData();
    }
  }, [activeView]);

  // Run all benchmarks
  const triggerSuite = async () => {
    setRunningSuite(true);
    try {
      await fetch(`${API_BASE}/api/evaluation/run`, { method: "POST" });
      alert("Stress tests benchmark suite started in the background! Wait ~10s and refresh.");
    } catch (err) {
      console.error(err);
    } finally {
      setRunningSuite(false);
    }
  };

  // Run single benchmark
  const triggerSingle = async (id: string) => {
    setRunningSingleId(id);
    try {
      const res = await fetch(`${API_BASE}/api/evaluation/run/${id}`, { method: "POST" });
      if (res.ok) {
        await fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRunningSingleId(null);
    }
  };

  // Compiler compile trigger
  const runCompilation = async () => {
    setCompiling(true);
    setCompilerOutput(null);
    setActiveInspectorTab("logs");

    // Reset stages
    const resetStatuses = {
      intent: "processing" as const,
      ast: "pending" as const,
      ir: "pending" as const,
      architecture: "pending" as const,
      schema: "pending" as const,
      validation: "pending" as const,
      repair: "pending" as const,
      verification: "pending" as const,
      runtime: "pending" as const,
    };
    setStageStatuses(resetStatuses);
    setLatencies({});

    try {
      const res = await fetch(`${API_BASE}/api/compile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, force_mock: forceMock, api_key: apiKey }),
      });

      if (!res.ok) throw new Error("Compilation network request failed");
      const data = await res.json();

      // Stages visual simulation loop
      const stages = ["intent", "ast", "ir", "architecture", "schema", "validation", "repair", "verification", "runtime"];
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        setCurrentStage(stage);

        updateStageStatus(stage, "processing");
        await new Promise((resolve) => setTimeout(resolve, 800));

        const stageLatency = data.latency_ms[stage] || 100.0;
        let stageStatus: "pending" | "processing" | "success" | "warning" | "failed" = "success";

        if (stage === "intent" && (data.status === "needs_clarification" || data.status === "conflict")) {
          stageStatus = data.status === "needs_clarification" ? "warning" : "failed";
          updateStageStatus(stage, stageStatus);
          updateLatency(stage, stageLatency);
          setCompilerOutput(data);
          setCompiling(false);
          
          addRunHistory({
            prompt,
            timestamp: new Date().toLocaleTimeString(),
            status: data.status.toUpperCase(),
            output: data,
          });
          return;
        }

        if (stage === "validation") {
          stageStatus = data.validation?.status === "pass" ? "success" : "warning";
          if (stageStatus === "warning") {
            setActiveInspectorTab("validation");
          }
        }

        if (stage === "repair") {
          if (data.repair?.status === "failed") {
            stageStatus = "failed";
          } else if (data.repair?.status === "repaired") {
            stageStatus = "success";
            setActiveInspectorTab("repair");
          } else {
            stageStatus = "pending";
          }
        }

        if (stage === "verification") {
          stageStatus = data.verification?.execution_status === "success" ? "success" : "failed";
        }

        if (stage === "runtime") {
          stageStatus = data.runtime?.zip_url ? "success" : "failed";
        }

        updateStageStatus(stage, stageStatus);
        updateLatency(stage, stageLatency);

        if (stageStatus === "failed") {
          setCompilerOutput(data);
          setCompiling(false);
          addRunHistory({
            prompt,
            timestamp: new Date().toLocaleTimeString(),
            status: "FAILED",
            output: data,
          });
          return;
        }
      }

      setCompilerOutput(data);
      addRunHistory({
        prompt,
        timestamp: new Date().toLocaleTimeString(),
        status: "SUCCESS",
        output: data,
      });

      // Jump to App Sandbox view on completion
      setActiveView("sandbox");
    } catch (err) {
      console.error(err);
      updateStageStatus("intent", "failed");
      setCompiling(false);
    }
  };

  const getStageJson = () => {
    if (!compilerOutput) return null;
    switch (currentStage) {
      case "intent":
        return compilerOutput.intent;
      case "ast":
        return compilerOutput.ast;
      case "ir":
        return compilerOutput.ir;
      case "architecture":
        return compilerOutput.architecture;
      case "schema":
        return compilerOutput.schemas;
      case "validation":
        return compilerOutput.validation;
      case "repair":
        return compilerOutput.repair;
      case "verification":
        return compilerOutput.verification;
      case "runtime":
        return compilerOutput.runtime;
      default:
        return compilerOutput;
    }
  };

  const getSelectedSchemaJson = () => {
    if (!compilerOutput?.schemas) return "{\n  \"message\": \"No schema synthesized yet. Execute compile workflow.\"\n}";
    const schemas = compilerOutput.schemas;
    switch (schemaFilter) {
      case "ui":
        return JSON.stringify(schemas.ui, null, 2);
      case "api":
        return JSON.stringify(schemas.api, null, 2);
      case "db":
        return JSON.stringify(schemas.db, null, 2);
      case "auth":
        return JSON.stringify(schemas.auth, null, 2);
      case "business":
        return JSON.stringify(schemas.business, null, 2);
    }
  };

  const presets = [
    {
      label: "Sales CRM",
      desc: "Contacts, deals, analytics, subscriptions",
      prompt: "Build a CRM with login, contacts, dashboard, role-based access, subscription plans, payments and analytics.",
    },
    {
      label: "LMS Learning Portal",
      desc: "Courses, student modules, gradebooks",
      prompt: "Build an LMS with login, course lists, lesson modules, student enrollments, quiz results, and gradebook dashboard.",
    },
    {
      label: "E-Commerce Suite",
      desc: "Catalogs, cart, checkout, reviews",
      prompt: "Build a Marketplace with login, merchant products, customer cart, secure checkout, order history, and reviews.",
    },
    {
      label: "Fintech Ledger",
      desc: "Bank link, budget card, finance charts",
      prompt: "Build a Fintech app with login, bank account linking, transaction ledger, monthly budget cards, and financial analytics charts.",
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex tech-grid tech-radial relative overflow-hidden">
      
      {/* 1. Sleek VS Code / Retool Left Sidebar (64px wide) */}
      <nav className="w-16 border-r border-zinc-900 bg-zinc-950 flex flex-col items-center justify-between py-6 z-30 shrink-0">
        <div className="flex flex-col items-center space-y-6 w-full">
          {/* Logo */}
          <div className="p-2.5 bg-gradient-to-tr from-blue-600 to-emerald-500 rounded-xl shadow-lg shadow-blue-500/20">
            <Layers className="w-5 h-5 text-white" />
          </div>

          <div className="w-8 h-[1px] bg-zinc-900" />

          {/* Navigation Buttons */}
          <button
            onClick={() => setActiveView("workbench")}
            title="Compiler Workbench"
            className={`p-3 rounded-xl transition-all cursor-pointer group ${
              activeView === "workbench" ? "bg-blue-600/15 text-blue-400 border border-blue-500/20" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Terminal className="w-5 h-5 group-hover:scale-105 transition-transform" />
          </button>

          <button
            onClick={() => setActiveView("code")}
            title="Code Explorer"
            className={`p-3 rounded-xl transition-all cursor-pointer group ${
              activeView === "code" ? "bg-blue-600/15 text-blue-400 border border-blue-500/20" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Cpu className="w-5 h-5 group-hover:scale-105 transition-transform" />
          </button>

          <button
            onClick={() => setActiveView("sandbox")}
            title="Live Sandbox Preview"
            className={`p-3 rounded-xl transition-all cursor-pointer group ${
              activeView === "sandbox" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Sparkles className="w-5 h-5 group-hover:scale-105 transition-transform" />
          </button>

          <button
            onClick={() => setActiveView("benchmarks")}
            title="Benchmark Metrics"
            className={`p-3 rounded-xl transition-all cursor-pointer group ${
              activeView === "benchmarks" ? "bg-blue-600/15 text-blue-400 border border-blue-500/20" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <BarChart2 className="w-5 h-5 group-hover:scale-105 transition-transform" />
          </button>
        </div>

        <div className="flex flex-col items-center space-y-4">
          <button
            onClick={() => setShowSettings(!showSettings)}
            title="Configuration Settings"
            className={`p-3 rounded-xl transition-all cursor-pointer ${
              showSettings ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </nav>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-zinc-900 bg-zinc-950/80 px-8 flex justify-between items-center backdrop-blur-md sticky top-0 z-20">
          <div>
            <h1 className="text-sm font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent uppercase">
              AppForge AI — Software Engineering Compiler Workbench
            </h1>
            <p className="text-[10px] text-zinc-500 font-mono tracking-wider uppercase mt-0.5">
              Natural Language Spec → AST → Intermediate Representation → Verified Codebase
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-[9.5px] font-mono font-semibold px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
              ENVIRONMENT: SANDBOX LOCAL
            </span>
            {compilerOutput?.runtime?.zip_url && (
              <a
                href={`${API_BASE}${compilerOutput.runtime.zip_url}`}
                className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wide flex items-center space-x-1.5 transition-all shadow-md shadow-emerald-500/10"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ZIP PACKAGE</span>
              </a>
            )}
          </div>
        </header>

        {/* Global Settings overlay drawer */}
        {showSettings && (
          <div className="bg-zinc-950/95 border-b border-zinc-900 px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md z-20 transition-all">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="mock-mode"
                  checked={forceMock}
                  onChange={(e) => setForceMock(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                />
                <label htmlFor="mock-mode" className="text-xs text-zinc-300 font-semibold select-none cursor-pointer">
                  Force Instant Preset Mock (Fallback simulation)
                </label>
              </div>
              {!forceMock && (
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-zinc-400">Gemini Key:</span>
                  <input
                    type="password"
                    placeholder="Enter Gemini API Key..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 px-3 py-1 text-xs rounded text-white focus:outline-none focus:border-blue-500 w-44"
                  />
                </div>
              )}
            </div>
            <div className="text-[10px] text-zinc-500">
              Compiler Target Model: <span className="font-semibold text-zinc-300">gemini-2.5-pro</span> (Temperature: 0.0)
            </div>
          </div>
        )}

        {/* View Switching Container */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          
          {/* VIEW 1: COMPILER WORKBENCH (3-Panel IDE style) */}
          {activeView === "workbench" && (
            <div className="h-full flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-zinc-900">
              {/* Left Panel: Inputs, presets, runs */}
              <div className="w-full lg:w-[380px] p-6 flex flex-col overflow-y-auto shrink-0 bg-zinc-950/20">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-1 flex items-center">
                      <BookOpen className="w-4 h-4 mr-1.5 text-blue-400" />
                      App Requirement
                    </h3>
                    <p className="text-[10px] text-zinc-500">Write specifications to execute compilation pipeline.</p>
                  </div>

                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={compiling}
                    className="w-full bg-zinc-950 border border-zinc-900 rounded-xl p-4 text-xs text-white focus:outline-none focus:border-zinc-850 h-32 resize-none leading-relaxed placeholder-zinc-700"
                    placeholder="Build a CRM app with login, contacts, and deal stats tracking dashboard..."
                  />

                  <button
                    onClick={runCompilation}
                    disabled={compiling || !prompt.trim()}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
                  >
                    {compiling ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Compiling Application AST...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Execute Compiler Pipeline</span>
                      </>
                    )}
                  </button>

                  <div className="border-t border-zinc-900 pt-5">
                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Workbench Presets</h4>
                    <div className="grid grid-cols-1 gap-2.5">
                      {presets.map((p) => (
                        <button
                          key={p.label}
                          onClick={() => setPrompt(p.prompt)}
                          disabled={compiling}
                          className="glass-card text-left p-3.5 rounded-xl border border-zinc-900 hover:border-blue-500/20 hover:bg-zinc-900/30 transition-all cursor-pointer"
                        >
                          <div className="text-xs font-bold text-zinc-300 flex justify-between">
                            <span>{p.label}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-zinc-600" />
                          </div>
                          <div className="text-[10px] text-zinc-500 mt-1 leading-normal truncate">{p.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-zinc-900 pt-5">
                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center">
                      <History className="w-3.5 h-3.5 mr-1.5 text-zinc-500" />
                      Session History ({runHistory.length})
                    </h4>
                    {runHistory.length > 0 ? (
                      <div className="space-y-2">
                        {runHistory.map((run, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              setPrompt(run.prompt);
                              setCompilerOutput(run.output);
                            }}
                            className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-900 hover:border-zinc-800 transition-all cursor-pointer text-left space-y-1"
                          >
                            <div className="flex justify-between items-center text-[10px]">
                              <span className={`font-bold px-1.5 py-0.5 rounded ${
                                run.status === "SUCCESS" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                              }`}>
                                {run.status}
                              </span>
                              <span className="text-zinc-600 font-mono">{run.timestamp}</span>
                            </div>
                            <p className="text-[10.5px] text-zinc-400 line-clamp-1 truncate font-medium">{run.prompt}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-[11px] text-zinc-600 italic">No history log available.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Center Panel: Pipeline visualizer */}
              <div className="flex-1 flex flex-col bg-zinc-950/10 min-w-0 relative">
                <div className="flex-1 relative">
                  <PipelineFlow
                    currentStage={currentStage}
                    stageStatuses={stageStatuses}
                    latencies={latencies}
                    errorsCount={compilerOutput?.validation?.errors?.length}
                    onSelectStage={(stage) => {
                      setCurrentStage(stage);
                      setActiveInspectorTab(stage === "validation" ? "validation" : stage === "repair" ? "repair" : "logs");
                    }}
                  />
                </div>
              </div>

              {/* Right Panel: Inspector Tabs */}
              <div className="w-full lg:w-[420px] p-6 flex flex-col overflow-y-auto shrink-0 bg-zinc-950/30">
                <div className="flex-1 flex flex-col min-h-0 space-y-4">
                  
                  {/* Tabs header */}
                  <div className="flex border-b border-zinc-900 pb-2">
                    <button
                      onClick={() => setActiveInspectorTab("logs")}
                      className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                        activeInspectorTab === "logs" ? "border-blue-500 text-blue-400 font-bold" : "border-transparent text-zinc-500"
                      }`}
                    >
                      Logs
                    </button>
                    <button
                      onClick={() => setActiveInspectorTab("schema")}
                      className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                        activeInspectorTab === "schema" ? "border-blue-500 text-blue-400 font-bold" : "border-transparent text-zinc-500"
                      }`}
                    >
                      Schema Viewer
                    </button>
                    <button
                      onClick={() => setActiveInspectorTab("validation")}
                      className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center space-x-1 ${
                        activeInspectorTab === "validation" ? "border-amber-500 text-amber-400 font-bold" : "border-transparent text-zinc-500"
                      }`}
                    >
                      {compilerOutput?.validation?.errors?.length > 0 && (
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                      )}
                      <span>Validation</span>
                    </button>
                    <button
                      onClick={() => setActiveInspectorTab("repair")}
                      className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                        activeInspectorTab === "repair" ? "border-blue-500 text-blue-400 font-bold" : "border-transparent text-zinc-500"
                      }`}
                    >
                      Repair Patches
                    </button>
                  </div>

                  {/* Inspector Contents */}
                  <div className="flex-1 flex flex-col min-h-0">
                    
                    {/* Log tab view */}
                    {activeInspectorTab === "logs" && (
                      <div className="flex-1 flex flex-col min-h-0 bg-zinc-950 p-4 border border-zinc-900 rounded-xl font-mono text-[10px] text-zinc-400 overflow-y-auto leading-relaxed space-y-2 select-text">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pb-2 border-b border-zinc-900 mb-2 flex items-center">
                          <Terminal className="w-3.5 h-3.5 mr-1.5 text-zinc-500" />
                          Compiler Compilation Logs
                        </div>
                        {compilerOutput?.logs?.map((log: string, idx: number) => (
                          <div key={idx} className="hover:text-zinc-200">
                            <span className="text-zinc-700 select-none mr-2 font-semibold">[{idx + 1}]</span>
                            {log}
                          </div>
                        ))}
                        {compiling && (
                          <div className="text-blue-400 animate-pulse flex items-center space-x-1.5">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Compiling next node pipeline...</span>
                          </div>
                        )}
                        {!compiling && !compilerOutput && (
                          <div className="text-zinc-600 italic text-center pt-24">Compiler idle. Ready to execute specification requirement.</div>
                        )}
                      </div>
                    )}

                    {/* Validation errors view */}
                    {activeInspectorTab === "validation" && (
                      <div className="flex-1 flex flex-col min-h-0 bg-zinc-950 p-4 border border-zinc-900 rounded-xl overflow-y-auto">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pb-2 border-b border-zinc-900 mb-4 flex items-center">
                          <AlertTriangle className="w-4 h-4 mr-1.5 text-amber-500" />
                          Stage 5 Validation Consistency Errors
                        </div>
                        {compilerOutput?.validation?.errors && compilerOutput.validation.errors.length > 0 ? (
                          <div className="space-y-3">
                            {compilerOutput.validation.errors.map((err: any, idx: number) => (
                              <div key={idx} className="bg-red-500/10 border border-red-500/25 p-3.5 rounded-xl text-left">
                                <div className="flex items-center space-x-1.5 text-[10px] font-bold text-red-400">
                                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                                  <span>[{err.type.toUpperCase()}] at {err.location}</span>
                                </div>
                                <p className="text-[10.5px] text-zinc-300 font-medium mt-1 leading-normal">
                                  {err.reason}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-24 text-xs text-zinc-500">
                            {compilerOutput ? (
                              <div className="flex flex-col items-center space-y-2">
                                <CheckCircle className="w-6 h-6 text-emerald-500" />
                                <span className="text-emerald-400 font-semibold">Validation checks PASSED cleanly!</span>
                              </div>
                            ) : (
                              "No errors detected. Compile specification first."
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Schema JSON Viewer using read-only Monaco editor */}
                    {activeInspectorTab === "schema" && (
                      <div className="flex-1 flex flex-col min-h-0 bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden">
                        {/* Schema filter header */}
                        <div className="flex items-center justify-between px-4 py-2 bg-zinc-950 border-b border-zinc-900">
                          <div className="text-[10px] font-mono font-bold text-zinc-400 uppercase">Schema type:</div>
                          <select
                            value={schemaFilter}
                            onChange={(e) => setSchemaFilter(e.target.value as any)}
                            className="bg-zinc-900 border border-zinc-800 text-[10.5px] font-semibold text-zinc-300 px-2 py-1 rounded focus:outline-none focus:border-blue-500"
                          >
                            <option value="ui">UI Screen Schema</option>
                            <option value="api">API Endpoint Schema</option>
                            <option value="db">DB Table Schema</option>
                            <option value="auth">Auth Permission Schema</option>
                            <option value="business">Business Rules Schema</option>
                          </select>
                        </div>

                        {/* Monaco editor JSON previewer */}
                        <div className="flex-1 min-h-0">
                          <Editor
                            height="100%"
                            language="json"
                            theme="vs-dark"
                            value={getSelectedSchemaJson()}
                            options={{
                              readOnly: true,
                              minimap: { enabled: false },
                              fontSize: 10,
                              fontFamily: "Fira Code, monospace",
                              padding: { top: 12 },
                              automaticLayout: true,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Repair Engine Attempt visualizer */}
                    {activeInspectorTab === "repair" && (
                      <div className="flex-1 flex flex-col min-h-0 bg-zinc-950 p-4 border border-zinc-900 rounded-xl overflow-y-auto text-left">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pb-2 border-b border-zinc-900 mb-4 flex items-center">
                          <Wrench className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
                          Repair Engine Programmatic Diffs
                        </div>

                        {compilerOutput?.repair?.history && compilerOutput.repair.history.length > 0 ? (
                          <div className="space-y-6">
                            {compilerOutput.repair.history.map((att: any, idx: number) => (
                              <div key={idx} className="space-y-3">
                                <div className="flex justify-between items-center text-[10.5px] border-b border-zinc-900 pb-1 font-mono">
                                  <span className="text-blue-400 font-bold">REPAIR ATTEMPT #{att.attempt}</span>
                                  <span className={att.success ? "text-emerald-400" : "text-red-400"}>
                                    {att.success ? "SUCCESS" : "FAILED"}
                                  </span>
                                </div>
                                <div className="space-y-3">
                                  {att.patches.map((patch: any, pIdx: number) => (
                                    <div key={pIdx} className="bg-zinc-900/60 border border-zinc-800/80 p-3 rounded-lg space-y-2">
                                      <div className="flex justify-between text-[10px] font-mono">
                                        <span className="text-zinc-400 font-semibold">Loc: {patch.location}</span>
                                        <span className="text-amber-500 font-bold bg-amber-500/5 border border-amber-500/10 px-1 rounded">
                                          {patch.error_type}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-zinc-500 italic mt-0.5">Reason: {patch.reason}</p>
                                      
                                      {/* Visual before/after diff blocks */}
                                      <div className="grid grid-cols-2 gap-2 text-[9.5px] font-mono pt-1">
                                        <div className="bg-red-500/10 border border-red-500/20 p-2 rounded text-red-300 whitespace-pre overflow-x-auto select-all">
                                          <div className="text-red-500 font-semibold border-b border-red-500/10 pb-0.5 mb-1">BEFORE</div>
                                          - {patch.before || "null"}
                                        </div>
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded text-emerald-300 whitespace-pre overflow-x-auto select-all">
                                          <div className="text-emerald-400 font-semibold border-b border-emerald-500/10 pb-0.5 mb-1">AFTER</div>
                                          + {patch.after || "null"}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-24 text-xs text-zinc-500 italic">
                            No repairs executed. Validation checks ran with 0 consistency faults.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: CODE IDE EXPLORER */}
          {activeView === "code" && (
            <div className="h-full p-6">
              <CodeExplorer
                fileTree={compilerOutput?.runtime?.file_tree || {}}
                fileContents={compilerOutput?.runtime?.file_tree?.contents || {}}
                zipUrl={compilerOutput?.runtime?.zip_url}
              />
            </div>
          )}

          {/* VIEW 3: LIVE SANDBOX RUNTIME PREVIEW */}
          {activeView === "sandbox" && (
            <div className="h-full p-6">
              <AppPreview
                schemas={compilerOutput?.schemas}
                previewData={compilerOutput?.runtime?.preview_data}
              />
            </div>
          )}

          {/* VIEW 4: STRESS TEST & LATENCY BENCHMARKS */}
          {activeView === "benchmarks" && (
            <div className="p-8 max-w-7xl mx-auto space-y-6 text-left">
              <div className="flex justify-between items-center pb-4 border-b border-zinc-900">
                <div>
                  <h2 className="text-lg font-extrabold tracking-tight">STRESS TESTING & LATENCY MATRIX</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Compiler analysis over 10 normal models and 10 edge case requirements.</p>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={fetchDashboardData}
                    className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white px-3 py-2 rounded-xl text-xs border border-zinc-800 transition-all cursor-pointer font-semibold flex items-center space-x-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sync</span>
                  </button>
                  <button
                    onClick={triggerSuite}
                    disabled={runningSuite}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md shadow-blue-500/10 cursor-pointer"
                  >
                    {runningSuite ? "Suite Executing..." : "Run Benchmark Suite"}
                  </button>
                </div>
              </div>

              {/* KPI metrics row */}
              {dashboardData?.summary && (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="glass-card p-5 rounded-2xl border border-zinc-900 text-left">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Compilation Success</span>
                    <div className="text-2xl font-extrabold mt-2 text-emerald-400">
                      {dashboardData.summary.success_rate?.toFixed(0)}%
                    </div>
                    <p className="text-[9px] text-zinc-500 mt-1">Normal prompt builds passing compiler sandbox verify</p>
                  </div>

                  <div className="glass-card p-5 rounded-2xl border border-zinc-900 text-left">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Average Latency</span>
                    <div className="text-2xl font-extrabold mt-2 text-blue-400">
                      {(dashboardData.summary.avg_latency_ms / 1000)?.toFixed(2)}s
                    </div>
                    <p className="text-[9px] text-zinc-500 mt-1">Average compile duration (Stage 1-8)</p>
                  </div>

                  <div className="glass-card p-5 rounded-2xl border border-zinc-900 text-left">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Initial Schema Faults</span>
                    <div className="text-2xl font-extrabold mt-2 text-amber-500">
                      {dashboardData.summary.validation_failure_rate?.toFixed(0)}%
                    </div>
                    <p className="text-[9px] text-zinc-500 mt-1">Initial validation mismatch frequency</p>
                  </div>

                  <div className="glass-card p-5 rounded-2xl border border-zinc-900 text-left">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Self Repair Success</span>
                    <div className="text-2xl font-extrabold mt-2 text-purple-400">
                      {dashboardData.summary.repair_success_rate?.toFixed(0)}%
                    </div>
                    <p className="text-[9px] text-zinc-500 mt-1">Programmatic mismatch recovery rate</p>
                  </div>

                  <div className="glass-card p-5 rounded-2xl border border-zinc-900 text-left">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Verify Failure Rate</span>
                    <div className="text-2xl font-extrabold mt-2 text-red-500">
                      {dashboardData.summary.execution_failure_rate?.toFixed(0)}%
                    </div>
                    <p className="text-[9px] text-zinc-500 mt-1">Syntax error rejection rate at verification</p>
                  </div>
                </div>
              )}

              {/* Latency stages breakdown and benchmark log list */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* SVG Horizontal Latency Breakdown chart */}
                <div className="lg:col-span-1 glass-panel p-5 rounded-2xl text-left border border-zinc-900">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center">
                    <Workflow className="w-4 h-4 mr-2 text-blue-400" />
                    LATENCY STAGE DURATION (MS)
                  </h3>
                  {dashboardData?.summary?.latency_breakdown_ms ? (
                    <div className="space-y-4">
                      {Object.entries(dashboardData.summary.latency_breakdown_ms).map(([stage, lat]: [string, any]) => {
                        const percent = Math.min((lat / 1500) * 100, 100);
                        let barColor = "bg-blue-500";
                        if (stage === "ast") barColor = "bg-indigo-500";
                        if (stage === "ir") barColor = "bg-cyan-500";
                        if (stage === "architecture") barColor = "bg-sky-500";
                        if (stage === "schema") barColor = "bg-teal-500";
                        if (stage === "validation") barColor = "bg-emerald-500";
                        if (stage === "repair") barColor = "bg-purple-500";
                        if (stage === "verification") barColor = "bg-pink-500";
                        if (stage === "runtime") barColor = "bg-yellow-500";

                        return (
                          <div key={stage} className="space-y-1">
                            <div className="flex justify-between text-[10px] font-mono font-semibold">
                              <span className="text-zinc-400 capitalize">{stage} stage</span>
                              <span className="text-zinc-300">{lat?.toFixed(1)}ms</span>
                            </div>
                            <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-800">
                              <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${percent}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-zinc-600 text-xs italic text-center py-24">No stage latencies calculated. Run benchmark suite.</div>
                  )}
                </div>

                {/* 20-prompt benchmarks specifications matrix */}
                <div className="lg:col-span-2 glass-panel p-5 rounded-2xl border border-zinc-900 flex flex-col min-w-0">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4">SPECIFICATIONS MATRIX</h3>
                  <div className="overflow-x-auto max-h-[400px]">
                    <table className="min-w-full divide-y divide-zinc-900 text-[11px] text-zinc-300 select-text">
                      <thead className="bg-zinc-950 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-bold text-zinc-400 uppercase">ID</th>
                          <th className="px-3 py-2 text-left font-bold text-zinc-400 uppercase">Category</th>
                          <th className="px-3 py-2 text-left font-bold text-zinc-400 uppercase">Prompt</th>
                          <th className="px-3 py-2 text-center font-bold text-zinc-400 uppercase">State</th>
                          <th className="px-3 py-2 text-center font-bold text-zinc-400 uppercase">Verify</th>
                          <th className="px-3 py-2 text-right font-bold text-zinc-400 uppercase">Duration</th>
                          <th className="px-3 py-2 text-right font-bold text-zinc-400 uppercase">Trigger</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900 bg-zinc-950/15">
                        {dashboardData?.results?.map((res: any) => {
                          const isNormal = res.type === "normal";
                          const isProcessing = runningSingleId === res.id;
                          
                          let statusColor = "text-zinc-500 bg-zinc-500/10 border-zinc-500/20";
                          if (res.status === "SUCCESS" || res.status === "success") {
                            statusColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
                          } else if (res.status === "NEEDS_CLARIFICATION" || res.status === "needs_clarification") {
                            statusColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
                          } else if (res.status === "CONFLICT" || res.status === "conflict") {
                            statusColor = "text-rose-400 bg-rose-500/10 border-rose-500/20";
                          } else if (res.status === "FAILED" || res.status === "failed") {
                            statusColor = "text-red-500 bg-red-500/10 border-red-500/20";
                          }

                          let verifyText = "-";
                          let verifyColor = "text-zinc-500";
                          if (res.execution_status === "success") {
                            verifyText = "PASS";
                            verifyColor = "text-emerald-400 font-bold";
                          } else if (res.execution_status === "failed") {
                            verifyText = "FAIL";
                            verifyColor = "text-red-500 font-bold";
                          }

                          return (
                            <tr key={res.id} className="hover:bg-zinc-900/10">
                              <td className="px-3 py-2 font-mono text-zinc-500">{res.id}</td>
                              <td className="px-3 py-2">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] border font-semibold uppercase ${
                                  isNormal ? "text-blue-400 bg-blue-500/10 border-blue-500/20" : "text-purple-400 bg-purple-500/10 border-purple-500/20"
                                }`}>
                                  {res.category}
                                </span>
                              </td>
                              <td className="px-3 py-2 max-w-[200px] truncate" title={res.prompt}>
                                {res.prompt}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className={`px-2 py-0.5 rounded text-[8.5px] border font-bold ${statusColor}`}>
                                  {res.status.toUpperCase()}
                                </span>
                              </td>
                              <td className={`px-3 py-2 text-center font-mono ${verifyColor}`}>
                                {verifyText}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-semibold">
                                {(res.total_latency_ms / 1000).toFixed(2)}s
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  onClick={() => triggerSingle(res.id)}
                                  disabled={isProcessing || runningSuite}
                                  className="p-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-zinc-400 hover:text-white transition-all disabled:opacity-50"
                                >
                                  {isProcessing ? (
                                    <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
                                  ) : (
                                    <Play className="w-3 h-3 fill-current" />
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
