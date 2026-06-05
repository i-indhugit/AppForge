"use client";

import React, { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  Node,
  Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  MessageSquare,
  FileJson,
  GitBranch,
  Database,
  CheckCircle,
  Wrench,
  Cpu,
  Binary,
  ShieldCheck,
  Layers,
} from "lucide-react";

// Icons mapping for pipeline stages
const STAGE_ICONS: Record<string, any> = {
  intent: MessageSquare,
  ast: Binary,
  ir: FileJson,
  architecture: GitBranch,
  schemas: Database,
  bindings: Layers,
  validation: CheckCircle,
  repair: Wrench,
  verification: ShieldCheck,
  runtime: Cpu,
};

// Type for stage status
export type StageStatus = "pending" | "processing" | "success" | "warning" | "failed";

// Interface for node data
interface PipelineNodeData {
  label: string;
  stageKey: string;
  status: StageStatus;
  latency?: number;
  errorsCount?: number;
  isActive: boolean;
  onClick: (stageKey: string) => void;
}

// Custom Node Component
const CustomPipelineNode = ({ data }: { data: PipelineNodeData }) => {
  const nodeData = data;
  const Icon = STAGE_ICONS[nodeData.stageKey] || MessageSquare;

  // Style properties based on status
  let borderClass = "border-zinc-800 bg-zinc-900/90 text-zinc-500";
  let pulseClass = "";
  let badgeClass = "bg-zinc-800 text-zinc-400";
  let badgeText = "Pending";

  const status = nodeData.status || "pending";

  if (status === "processing") {
    borderClass = "border-blue-500 bg-blue-950/20 text-blue-400 shadow-md shadow-blue-500/10";
    pulseClass = "indicator-pulse-processing bg-blue-500";
    badgeClass = "bg-blue-500/20 text-blue-400";
    badgeText = "Running";
  } else if (status === "success") {
    borderClass = "border-emerald-500 bg-emerald-950/20 text-emerald-400 shadow-md shadow-emerald-500/5";
    pulseClass = "indicator-pulse-success bg-emerald-500";
    badgeClass = "bg-emerald-500/20 text-emerald-400";
    badgeText = "Done";
  } else if (status === "warning") {
    borderClass = "border-amber-500 bg-amber-950/20 text-amber-400 shadow-md shadow-amber-500/5";
    pulseClass = "bg-amber-500";
    badgeClass = "bg-amber-500/20 text-amber-400";
    badgeText = "Warning";
  } else if (status === "failed") {
    borderClass = "border-red-500 bg-red-950/20 text-red-400 shadow-md shadow-red-500/5";
    pulseClass = "bg-red-500";
    badgeClass = "bg-red-500/20 text-red-400";
    badgeText = "Error";
  }

  return (
    <div
      onClick={() => nodeData.onClick?.(nodeData.stageKey)}
      className={`glass-card p-4 rounded-xl border w-[220px] text-left cursor-pointer transition-all ${borderClass} ${
        nodeData.isActive ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-zinc-950 scale-105" : ""
      }`}
    >
      <Handle type="target" position={Position.Left} className="opacity-0" />
      
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg bg-zinc-950/80 border border-white/5">
          <Icon className="w-5 h-5" />
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeClass}`}>
          {badgeText}
        </span>
      </div>

      <div className="text-sm font-semibold text-white tracking-tight mb-1">{nodeData.label}</div>
      
      <div className="flex items-center text-[11px] text-zinc-500 space-x-2">
        {status === "processing" && (
          <div className={`w-1.5 h-1.5 rounded-full ${pulseClass}`} />
        )}
        {status === "success" && nodeData.latency !== undefined && (
          <span>{nodeData.latency.toFixed(0)}ms</span>
        )}
        {status === "failed" && (
          <span className="text-red-400 font-medium">Failed</span>
        )}
        {status === "warning" && nodeData.errorsCount !== undefined && (
          <span className="text-amber-400 font-medium">{nodeData.errorsCount} issues</span>
        )}
        {status === "pending" && <span>Idle</span>}
      </div>

      <Handle type="source" position={Position.Right} className="opacity-0" />
    </div>
  );
};

// Define node types object
const nodeTypes = {
  pipeline: CustomPipelineNode,
};

interface PipelineFlowProps {
  currentStage?: string;
  stageStatuses?: Record<string, StageStatus>;
  latencies?: Record<string, number>;
  errorsCount?: number;
  onSelectStage?: (stageKey: string) => void;
}

export default function PipelineFlow({
  currentStage = "intent",
  stageStatuses = {},
  latencies = {},
  errorsCount = 0,
  onSelectStage = () => {},
}: PipelineFlowProps) {
  // Build Nodes
  const nodes: Node[] = useMemo(() => {
    const stages = [
      { key: "intent", label: "Stage 1: Intent Extraction" },
      { key: "ast", label: "Stage 2A: AST Builder" },
      { key: "ir", label: "Stage 2: Intermediate Rep" },
      { key: "architecture", label: "Stage 3: Arch Planner" },
      { key: "schemas", label: "Stage 4: Schema Gen" },
      { key: "bindings", label: "Stage 5: Binding Layer" },
      { key: "validation", label: "Stage 6: Validation" },
      { key: "repair", label: "Stage 7: Repair Engine" },
      { key: "verification", label: "Stage 8/10: Verification" },
      { key: "runtime", label: "Stage 9/11: Runtime Gen" },
    ];

    return stages.map((s, idx) => ({
      id: s.key,
      type: "pipeline",
      position: { x: idx * 260 + 50, y: 100 },
      data: {
        label: s.label,
        stageKey: s.key,
        status: stageStatuses?.[s.key] || "pending",
        latency: latencies?.[s.key],
        errorsCount: s.key === "validation" ? errorsCount : undefined,
        isActive: currentStage === s.key,
        onClick: onSelectStage,
      },
    }));
  }, [currentStage, stageStatuses, latencies, errorsCount, onSelectStage]);

  // Build Edges
  const edges: Edge[] = useMemo(() => {
    const edgeIds = ["intent", "ast", "ir", "architecture", "schemas", "bindings", "validation", "repair", "verification", "runtime"];
    const result: Edge[] = [];

    for (let i = 0; i < edgeIds.length - 1; i++) {
      const source = edgeIds[i];
      const target = edgeIds[i + 1];
      
      // Edge is animated if the source state is successful or processing
      const sourceStatus = stageStatuses?.[source] || "pending";
      const isAnimated = sourceStatus === "success" || sourceStatus === "processing";

      result.push({
        id: `e-${source}-${target}`,
        source,
        target,
        animated: isAnimated,
        style: {
          stroke: isAnimated ? "#3b82f6" : "rgba(255,255,255,0.08)",
          strokeWidth: 2,
        },
      });
    }
    return result;
  }, [stageStatuses]);

  return (
    <div className="w-full h-full bg-zinc-950/40 relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes as any}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={1.5}
        panOnScroll={false}
        zoomOnScroll={false}
        preventScrolling={true}
        nodesConnectable={false}
        nodesDraggable={false}
        elementsSelectable={false}
      >
        <Background color="#27272a" gap={20} size={1} />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
      <div className="absolute top-4 left-6 pointer-events-none z-10">
        <h4 className="text-sm font-semibold text-white tracking-wide">COMPILER PROCESS PIPELINE</h4>
        <p className="text-[11px] text-zinc-500">Click a stage node to inspect compiled JSON, validation reports, and dynamic code explorer</p>
      </div>
    </div>
  );
}
