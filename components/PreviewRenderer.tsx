"use client";

import React, { useState } from "react";
import { 
  Layout, 
  Table as TableIcon, 
  CheckSquare, 
  BarChart3, 
  CreditCard, 
  Menu, 
  User, 
  Lock,
  ArrowRight,
  LogOut,
  Settings,
  Plus
} from "lucide-react";
import { FullSchema, UIPage, UIComponent } from "../types/compiler";

interface PreviewRendererProps {
  schemas?: FullSchema;
  previewData?: any;
}

export default function PreviewRenderer({ schemas, previewData }: PreviewRendererProps) {
  const [activePage, setActivePage] = useState<string>(schemas?.ui.pages[0]?.name || "");

  if (!schemas || !schemas.ui.pages.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 bg-zinc-950/50 rounded-xl border border-zinc-900 border-dashed p-12">
        <Layout className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-sm font-medium">No application UI schema detected.</p>
        <p className="text-xs opacity-60 mt-1">Compile a requirement to generate the live preview.</p>
      </div>
    );
  }

  const currentPage = schemas.ui.pages.find(p => p.name === activePage) || schemas.ui.pages[0];

  const renderComponent = (comp: UIComponent) => {
    switch (comp.type) {
      case 'navbar':
        return (
          <nav key={comp.name} className="h-14 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md flex items-center justify-between px-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-600 rounded" />
              <span className="font-bold text-sm tracking-tight text-white">AppForge App</span>
            </div>
            <div className="flex items-center gap-4 text-zinc-400">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
            </div>
          </nav>
        );
      case 'sidebar':
        return (
          <aside key={comp.name} className="w-64 border-r border-zinc-800 bg-zinc-900/50 flex flex-col p-4">
            <div className="space-y-1">
              {schemas.ui.pages.map(p => (
                <button
                  key={p.name}
                  onClick={() => setActivePage(p.name)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                    activePage === p.name ? "bg-blue-600/10 text-blue-400 border border-blue-500/20" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                  }`}
                >
                  <Layout className="w-4 h-4" /> {p.name}
                </button>
              ))}
            </div>
          </aside>
        );
      case 'table':
        return (
          <div key={comp.name} className="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">{comp.name}</h3>
              <button className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <table className="w-full text-left text-xs text-zinc-400">
              <thead className="bg-zinc-950/50 text-zinc-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {[1, 2, 3].map(i => (
                  <tr key={i} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-zinc-300">#00{i}</td>
                    <td className="px-4 py-3">Mock Record {i}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Active</span>
                    </td>
                    <td className="px-4 py-3">2026-06-0{i}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'form':
        return (
          <div key={comp.name} className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 max-w-md mx-auto">
            <h3 className="text-lg font-bold text-white mb-4">{comp.name}</h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Email</label>
                <input type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500 transition-colors" placeholder="user@example.com" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Password</label>
                <input type="password" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500 transition-colors" placeholder="••••••••" />
              </div>
              <button className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-500 transition-all">
                Submit
              </button>
            </div>
          </div>
        );
      case 'card':
        return (
          <div key={comp.name} className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-blue-600/10 text-blue-400">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-white">{comp.name}</h3>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">This is a dynamic card component generated by AppForge AI based on your application schema.</p>
          </div>
        );
      default:
        return <div key={comp.name} className="p-4 border border-zinc-800 rounded text-xs text-zinc-600">Component: {comp.name} ({comp.type})</div>;
    }
  };

  return (
    <div className="flex h-full bg-[#050505] rounded-xl border border-zinc-800 overflow-hidden shadow-2xl">
      {/* Sidebar (if present in schema) */}
      {currentPage.components.some(c => c.type === 'sidebar') && 
        renderComponent(currentPage.components.find(c => c.type === 'sidebar')!)
      }

      <div className="flex-1 flex flex-col min-w-0">
        {/* Navbar (if present in schema) */}
        {currentPage.components.some(c => c.type === 'navbar') && 
          renderComponent(currentPage.components.find(c => c.type === 'navbar')!)
        }

        <main className="flex-1 p-8 overflow-y-auto space-y-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">{currentPage.name}</h1>
              <p className="text-xs text-zinc-500 mt-1">Route: <code className="text-blue-400 bg-blue-400/5 px-1 rounded">{currentPage.route}</code></p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentPage.components
              .filter(c => c.type !== 'navbar' && c.type !== 'sidebar')
              .map(renderComponent)
            }
          </div>
        </main>
      </div>
    </div>
  );
}
