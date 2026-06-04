"use client";

import React, { useState, useEffect } from "react";
import { Folder, File, ChevronRight, ChevronDown, Copy, Check, Download } from "lucide-react";
import Editor from "@monaco-editor/react";

interface CodeExplorerProps {
  fileTree: Record<string, any>; // Nested tree format: { "folder": { "file.py": "path/to/file.py" } }
  fileContents: Record<string, string>; // Key: "path/to/file.py", Value: "code contents..."
  zipUrl?: string;
}

export default function CodeExplorer({ fileTree, fileContents, zipUrl }: CodeExplorerProps) {
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    backend: true,
    "backend/app": true,
    frontend: true,
    "frontend/pages": true,
    "frontend/components": true,
    database: true,
  });
  const [copied, setCopied] = useState(false);

  // Auto-select first file on load
  useEffect(() => {
    if (fileContents && Object.keys(fileContents).length > 0) {
      const keys = Object.keys(fileContents);
      const defaultKey = keys.find(k => k.includes("README.md")) || keys.find(k => k.includes("main.py")) || keys[0];
      setSelectedFile(defaultKey);
    }
  }, [fileContents]);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  const copyToClipboard = () => {
    if (!selectedFile || !fileContents[selectedFile]) return;
    navigator.clipboard.writeText(fileContents[selectedFile]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to determine language for Monaco editor
  const getLanguage = (filepath: string) => {
    const ext = filepath.split(".").pop() || "";
    switch (ext) {
      case "py":
        return "python";
      case "sql":
        return "sql";
      case "json":
        return "json";
      case "tsx":
      case "ts":
        return "typescript";
      case "css":
        return "css";
      case "md":
        return "markdown";
      default:
        return "plaintext";
    }
  };

  // Helper to render tree nodes recursively
  const renderTree = (node: Record<string, any>, currentPath = "") => {
    return Object.entries(node).map(([key, val]) => {
      const nodePath = currentPath ? `${currentPath}/${key}` : key;
      const isFolder = typeof val === "object";

      if (isFolder) {
        const isExpanded = !!expandedFolders[nodePath];
        return (
          <div key={nodePath} className="select-none">
            <div
              onClick={() => toggleFolder(nodePath)}
              className="flex items-center py-1.5 px-2 hover:bg-zinc-900 rounded-md cursor-pointer text-zinc-400 hover:text-zinc-200 text-xs transition-colors"
            >
              <span className="mr-1 text-zinc-600">
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </span>
              <Folder className="w-4 h-4 mr-2 text-blue-500 fill-blue-500/10" />
              <span className="font-semibold text-zinc-300">{key}</span>
            </div>
            {isExpanded && <div className="pl-3 border-l border-zinc-900 ml-3.5 mt-0.5">{renderTree(val, nodePath)}</div>}
          </div>
        );
      } else {
        const isFileSelected = selectedFile === val;
        return (
          <div
            key={nodePath}
            onClick={() => setSelectedFile(val)}
            className={`flex items-center py-1.5 px-3 rounded-md cursor-pointer text-xs transition-colors ${
              isFileSelected
                ? "bg-blue-600/15 text-blue-400 font-medium"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            }`}
          >
            <File className={`w-3.5 h-3.5 mr-2 ${isFileSelected ? "text-blue-400" : "text-zinc-500"}`} />
            <span>{key}</span>
          </div>
        );
      }
    });
  };

  const activeContent = selectedFile ? fileContents[selectedFile] || "" : "";

  return (
    <div className="flex h-full min-h-[550px] border border-zinc-900 rounded-xl overflow-hidden glass-panel bg-zinc-950/20">
      {/* File Tree Sidebar */}
      <div className="w-64 border-r border-zinc-900 bg-zinc-950/40 p-4 overflow-y-auto select-none">
        <div className="flex justify-between items-center mb-3">
          <h5 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Project Directory</h5>
          {zipUrl && (
            <a
              href={`http://localhost:8000${zipUrl}`}
              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-bold px-2 py-1 rounded text-[9px] uppercase tracking-wide flex items-center space-x-1 transition-all"
            >
              <Download className="w-3 h-3" />
              <span>ZIP</span>
            </a>
          )}
        </div>
        <div className="space-y-1">
          {fileTree && fileTree.tree ? renderTree(fileTree.tree) : (
            <div className="text-zinc-600 text-xs text-center py-8">No files generated yet. Run compiler workbench first.</div>
          )}
        </div>
      </div>

      {/* Code Viewer Panel */}
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-950/10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-900 bg-zinc-950/50">
          <div className="flex items-center space-x-2 min-w-0">
            <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">File path:</span>
            <span className="text-xs text-zinc-300 font-mono truncate">{selectedFile || "None"}</span>
          </div>
          {selectedFile && (
            <button
              onClick={copyToClipboard}
              className="flex items-center space-x-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white px-2.5 py-1.5 rounded-md text-xs border border-zinc-800 transition-all cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Monaco Editor Component */}
        <div className="flex-1 min-h-0 bg-zinc-950/80">
          {selectedFile ? (
            <Editor
              height="100%"
              language={getLanguage(selectedFile)}
              theme="vs-dark"
              value={activeContent}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 12,
                fontFamily: "Fira Code, Source Code Pro, Menlo, Monaco, Consolas, monospace",
                lineNumbers: "on",
                renderWhitespace: "none",
                scrollBeyondLastLine: false,
                wordWrap: "on",
                padding: { top: 16, bottom: 16 },
                cursorStyle: "line",
                automaticLayout: true,
              }}
              loading={
                <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
                  Loading editor preview...
                </div>
              }
            />
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-600 text-xs">
              Select a file from the explorer to view its code inside Monaco Editor
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
