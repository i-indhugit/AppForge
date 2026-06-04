"use client";

import React, { useState, useEffect } from "react";
import { ArrowRight, Database, Play, Plus, RefreshCw, Sparkles } from "lucide-react";

interface AppPreviewProps {
  schemas: any; // FullSchema
  previewData: any; // { pages: [...], records: { ... } }
}

export default function AppPreview({ schemas, previewData }: AppPreviewProps) {
  const [activePage, setActivePage] = useState<string>("");
  const [dbState, setDbState] = useState<Record<string, any[]>>({});
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [notification, setNotification] = useState<string>("");

  // Initialize DB State and select first active page on load
  useEffect(() => {
    if (previewData) {
      if (previewData.records) {
        setDbState(JSON.parse(JSON.stringify(previewData.records)));
      }
      if (previewData.pages && previewData.pages.length > 0) {
        // Find a dashboard page, else use first page
        const dash = previewData.pages.find((p: any) => p.name.toLowerCase() === "dashboard");
        setActivePage(dash ? dash.name : previewData.pages[0].name);
      }
    }
  }, [previewData]);

  if (!previewData || !previewData.pages || previewData.pages.length === 0) {
    return (
      <div className="h-[550px] border border-zinc-900 rounded-xl glass-panel bg-zinc-950/20 flex flex-col items-center justify-center p-6 text-zinc-500 text-sm">
        <Sparkles className="w-8 h-8 text-zinc-700 mb-2 animate-pulse" />
        <span>No runtime preview data available. Compile a valid application requirement first.</span>
      </div>
    );
  }

  const currentPageObj = previewData.pages.find((p: any) => p.name === activePage);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFormSubmit = (compName: string, entityName: string, fields: string[]) => {
    // Determine target table
    // Match table case-insensitive and pluralize/singularize
    let targetTable = entityName.toLowerCase();
    
    // Check which db key matches
    let matchedKey = Object.keys(dbState).find(
      (k) => k === targetTable || k === `${targetTable}s` || targetTable === `${k}s`
    );

    if (!matchedKey) {
      // Create table dynamically in db state if not present
      matchedKey = `${targetTable}s`;
    }

    const newRecord: Record<string, any> = { id: (dbState[matchedKey]?.length || 0) + 1 };
    fields.forEach((f) => {
      newRecord[f] = formData[f] || `Sample ${f}`;
    });
    // Add timestamp or created_at if field is there
    newRecord["created_at"] = new Date().toISOString().split("T")[0];
    newRecord["status"] = formData["status"] || "active";

    setDbState((prev) => ({
      ...prev,
      [matchedKey!]: [newRecord, ...(prev[matchedKey!] || [])],
    }));

    // Trigger success toast
    setNotification(`Successfully added record to '${matchedKey}' in local database!`);
    setTimeout(() => setNotification(""), 3000);

    // Reset Form
    setFormData({});
  };

  return (
    <div className="flex flex-col h-[550px] border border-zinc-900 rounded-xl overflow-hidden glass-panel bg-zinc-950/10">
      {/* Simulation Banner Header */}
      <div className="bg-emerald-500/15 border-b border-emerald-500/20 px-6 py-2.5 flex justify-between items-center text-xs text-emerald-400 font-medium">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 indicator-pulse-success" />
          <span>Interactive Preview Runtime Sandbox (Simulated DB & Services)</span>
        </div>
        {notification && (
          <div className="text-white bg-emerald-500 px-2 py-0.5 rounded text-[10px] animate-bounce">
            {notification}
          </div>
        )}
      </div>

      {/* Dynamic Navigation Bar */}
      <div className="bg-zinc-950 border-b border-zinc-900 px-6 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="text-sm font-bold text-white tracking-wide">
            {schemas?.ui?.pages?.find((p: any) => p.name === activePage)?.name || activePage}
          </div>
          <span className="text-zinc-600 text-xs">/</span>
          <span className="text-[10px] text-zinc-500 font-mono">
            {schemas?.ui?.pages?.find((p: any) => p.name === activePage)?.route || "/"}
          </span>
        </div>
        <div className="flex space-x-2">
          {previewData.pages.map((p: any) => (
            <button
              key={p.name}
              onClick={() => setActivePage(p.name)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activePage === p.name
                  ? "bg-emerald-500 text-zinc-950"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Viewport */}
      <div className="flex-1 p-6 overflow-y-auto bg-zinc-950/40 text-left">
        {currentPageObj ? (
          <div className="space-y-6">
            {currentPageObj.components.map((comp: any, idx: number) => {
              // RENDER stats/card component
              if (comp.type === "card") {
                const metrics = comp.props.metrics || ["Total Items"];
                return (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {metrics.map((metric: string) => {
                      // Lookup simulated count
                      let count = 0;
                      const metric_lower = metric.toLowerCase();
                      for (const [tbl, list] of Object.entries(dbState)) {
                        if (tbl.includes(metric_lower.replace("total ", "").replace("s", "")) || metric_lower.includes(tbl.replace("s", ""))) {
                          count = list.length;
                        }
                      }
                      // fallback dummy count
                      if (count === 0) {
                        count = metric.includes("Revenue") ? 18340 : 142;
                      }

                      return (
                        <div key={metric} className="bg-zinc-900/60 border border-zinc-800 p-5 rounded-xl">
                          <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">{metric}</div>
                          <div className="text-2xl font-bold mt-2 text-white">
                            {metric.includes("Revenue") ? `$${count.toLocaleString()}` : count}
                          </div>
                          <div className="text-emerald-400 text-[10px] mt-1 font-semibold">
                            Simulated Real-time Data
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              // RENDER form component
              if (comp.type === "form") {
                const fields = comp.props.fields || ["name"];
                const submitLabel = comp.props.submit_label || "Save";
                // Infer table name from page
                const entityName = currentPageObj.name.replace("Page", "");

                return (
                  <div key={idx} className="bg-zinc-900/40 border border-zinc-800 p-5 rounded-xl max-w-xl">
                    <h4 className="text-sm font-bold text-white mb-4 flex items-center">
                      <Plus className="w-4 h-4 mr-2 text-emerald-400" />
                      {comp.name.replace("_", " ").toUpperCase()}
                    </h4>
                    <div className="space-y-4">
                      {fields.map((f: string) => (
                        <div key={f}>
                          <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                            {f.replace("_", " ")}
                          </label>
                          <input
                            type="text"
                            value={formData[f] || ""}
                            onChange={(e) => handleInputChange(f, e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 focus:outline-none focus:border-emerald-500 text-xs transition-colors"
                            placeholder={`Enter ${f.replace("_", " ")}`}
                          />
                        </div>
                      ))}
                      <button
                        onClick={() => handleFormSubmit(comp.name, entityName, fields)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold px-4 py-2.5 rounded-lg text-xs w-full transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <span>{submitLabel}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              }

              // RENDER table component
              if (comp.type === "table") {
                const headers = comp.props.headers || ["ID"];
                // Match table keys
                const page_lower = currentPageObj.name.toLowerCase();
                const matchedKey = Object.keys(dbState).find(
                  (k) => page_lower.includes(k.replace("s", "")) || k.includes(page_lower.replace("s", ""))
                );
                const records = matchedKey ? dbState[matchedKey] || [] : [];

                return (
                  <div key={idx} className="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-zinc-800 bg-zinc-900/20 flex justify-between items-center">
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center">
                        <Database className="w-4 h-4 mr-2 text-emerald-400" />
                        {comp.name.replace("_", " ")}
                      </h4>
                      <span className="text-[10px] text-zinc-500 font-mono bg-zinc-950 px-2 py-0.5 rounded">
                        {records.length} records
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-zinc-800">
                        <thead className="bg-zinc-950/80">
                          <tr>
                            {headers.map((h: string) => (
                              <th
                                key={h}
                                className="px-4 py-2.5 text-left text-[10px] font-bold text-zinc-400 uppercase tracking-wider"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800 text-xs text-zinc-300">
                          {records.length > 0 ? (
                            records.map((rec, rIdx) => (
                              <tr key={rIdx} className="hover:bg-zinc-900/20">
                                {headers.map((h: string) => {
                                  // Map headers to fields in record
                                  const fieldKey = h.toLowerCase().replace(" ", "_");
                                  const val = rec[fieldKey] !== undefined ? rec[fieldKey] : rec[h.toLowerCase()] || "-";
                                  
                                  // Status coloring badge helper
                                  if (fieldKey === "status") {
                                    const isLead = val === "lead";
                                    const isInactive = val === "inactive";
                                    const color = isLead ? "text-blue-400 bg-blue-500/10 border-blue-500/20" : isInactive ? "text-zinc-500 bg-zinc-500/10 border-zinc-500/20" : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
                                    return (
                                      <td key={h} className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] border font-medium uppercase ${color}`}>
                                          {val}
                                        </span>
                                      </td>
                                    );
                                  }

                                  return (
                                    <td key={h} className="px-4 py-3 font-medium">
                                      {typeof val === "number" && h.toLowerCase().includes("value") ? `$${val.toLocaleString()}` : val.toString()}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={headers.length} className="px-4 py-8 text-center text-zinc-600 italic">
                                No records found in database table. Use the form to add data.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              }

              // RENDER chart component
              if (comp.type === "chart") {
                const chartType = comp.props.chart_type || "bar";
                return (
                  <div key={idx} className="bg-zinc-900/40 border border-zinc-800 p-5 rounded-xl">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
                      {comp.name.replace("_", " ")}
                    </h4>
                    {/* Render a beautiful responsive SVG chart mock */}
                    <div className="h-44 flex items-end justify-between px-6 pt-4 pb-2 bg-zinc-950/40 border border-zinc-800 rounded-lg">
                      <div className="flex flex-col items-center w-8">
                        <div className="w-full bg-emerald-500/25 border-t-2 border-emerald-400 rounded-t-sm h-[30px]" />
                        <span className="text-[9px] text-zinc-500 mt-2 font-mono">Q1</span>
                      </div>
                      <div className="flex flex-col items-center w-8">
                        <div className="w-full bg-emerald-500/40 border-t-2 border-emerald-400 rounded-t-sm h-[60px]" />
                        <span className="text-[9px] text-zinc-500 mt-2 font-mono">Q2</span>
                      </div>
                      <div className="flex flex-col items-center w-8">
                        <div className="w-full bg-emerald-500/60 border-t-2 border-emerald-400 rounded-t-sm h-[90px]" />
                        <span className="text-[9px] text-zinc-500 mt-2 font-mono">Q3</span>
                      </div>
                      <div className="flex flex-col items-center w-8">
                        <div className="w-full bg-emerald-500 border-t-2 border-emerald-400 rounded-t-sm h-[130px] shadow-lg shadow-emerald-500/10" />
                        <span className="text-[9px] text-zinc-500 mt-2 font-mono">Q4</span>
                      </div>
                    </div>
                    <div className="text-center text-[10px] text-zinc-500 mt-2 italic">
                      Simulated {chartType} distribution data analytics.
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
            Loading preview page...
          </div>
        )}
      </div>
    </div>
  );
}
