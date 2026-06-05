import { create } from "zustand";

export interface CompileRun {
  prompt: string;
  timestamp: string;
  status: "SUCCESS" | "FAILED" | "NEEDS_CLARIFICATION" | "CONFLICT" | "REPAIRING";
  output: any;
}

interface CompilerStore {
  prompt: string;
  setPrompt: (prompt: string) => void;
  activeView: "workbench" | "code" | "sandbox" | "benchmarks";
  setActiveView: (view: "workbench" | "code" | "sandbox" | "benchmarks") => void;
  compiling: boolean;
  setCompiling: (compiling: boolean) => void;
  currentStage: string;
  setCurrentStage: (stage: string) => void;
  compilerOutput: any;
  setCompilerOutput: (output: any) => void;
  stageStatuses: Record<string, "pending" | "processing" | "success" | "warning" | "failed">;
  setStageStatuses: (statuses: Record<string, "pending" | "processing" | "success" | "warning" | "failed">) => void;
  updateStageStatus: (stage: string, status: "pending" | "processing" | "success" | "warning" | "failed") => void;
  latencies: Record<string, number>;
  setLatencies: (latencies: Record<string, number>) => void;
  updateLatency: (stage: string, latency: number) => void;
  forceMock: boolean;
  setForceMock: (forceMock: boolean) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  runHistory: CompileRun[];
  addRunHistory: (run: CompileRun) => void;
  clearHistory: () => void;
}

export const useCompilerStore = create<CompilerStore>((set) => ({
  prompt: "Build a CRM with login, contacts, dashboard, role-based access, subscription plans, payments and analytics.",
  setPrompt: (prompt) => set({ prompt }),
  activeView: "workbench",
  setActiveView: (activeView) => set({ activeView }),
  compiling: false,
  setCompiling: (compiling) => set({ compiling }),
  currentStage: "intent",
  setCurrentStage: (currentStage) => set({ currentStage }),
  compilerOutput: null,
  setCompilerOutput: (compilerOutput) => set({ compilerOutput }),
  stageStatuses: {
    intent: "pending",
    ast: "pending",
    ir: "pending",
    architecture: "pending",
    schemas: "pending",
    bindings: "pending",
    validation: "pending",
    repair: "pending",
    verification: "pending",
    runtime: "pending",
  },
  setStageStatuses: (stageStatuses) => set({ stageStatuses }),
  updateStageStatus: (stage, status) =>
    set((state) => ({
      stageStatuses: { ...state.stageStatuses, [stage]: status },
    })),
  latencies: {},
  setLatencies: (latencies) => set({ latencies }),
  updateLatency: (stage, latency) =>
    set((state) => ({
      latencies: { ...state.latencies, [stage]: latency },
    })),
  forceMock: true,
  setForceMock: (forceMock) => set({ forceMock }),
  apiKey: "",
  setApiKey: (apiKey) => set({ apiKey }),
  showSettings: false,
  setShowSettings: (showSettings) => set({ showSettings }),
  runHistory: [],
  addRunHistory: (run) =>
    set((state) => ({
      runHistory: [run, ...state.runHistory].slice(0, 10), // Keep last 10 runs
    })),
  clearHistory: () => set({ runHistory: [] }),
}));
