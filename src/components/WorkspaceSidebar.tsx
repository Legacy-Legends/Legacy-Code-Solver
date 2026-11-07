import React from 'react';
import {
  GitFork,
  FolderGit2,
  Network,
  ListTree,
  Radar,
  FileCode,
  ShieldAlert,
} from 'lucide-react';
import { GraphNode, ImpactAnalysis } from '../types/index';

export type InvestigationTab = 'graph' | 'hierarchy' | 'blast';

interface WorkspaceSidebarProps {
  activeTab: InvestigationTab;
  onSelectTab: (tab: InvestigationTab) => void;
  selectedNode: GraphNode | null;
  nodes: GraphNode[];
  onSelectNode: (node: GraphNode) => void;
  impactAnalysis: ImpactAnalysis | null;
  workspaceName?: string;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  activeTab,
  onSelectTab,
  selectedNode,
  nodes,
  onSelectNode,
  impactAnalysis,
  workspaceName = 'order-service',
}) => {
  const directCount = impactAnalysis?.directDependents.length || 0;
  const indirectCount = impactAnalysis?.indirectDependents.length || 0;
  const totalImpact = directCount + indirectCount;
  const impactPercent = Math.min(100, Math.max(15, (totalImpact / Math.max(1, nodes.length)) * 100));

  return (
    <aside className="w-64 bg-white/90 backdrop-blur-md border-r border-slate-200/80 flex flex-col justify-between p-5 select-none shrink-0 h-full">
      <div className="space-y-6 overflow-y-auto">
        {/* Brand Header */}
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-sm">
            <GitFork className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="font-bold text-slate-900 text-lg tracking-tight">Code Solver</span>
        </div>

        {/* Active Workspace */}
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            ACTIVE WORKSPACE
          </p>
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs font-semibold text-slate-900">
            <div className="flex items-center space-x-2">
              <FolderGit2 className="w-4 h-4 text-emerald-600" />
              <span>{workspaceName}</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-bold">
              Java
            </span>
          </div>
        </div>

        {/* Investigation Views */}
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            INVESTIGATION VIEWS
          </p>
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => onSelectTab('graph')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'graph'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Network className={`w-4 h-4 ${activeTab === 'graph' ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>Graph AST View</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('hierarchy')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'hierarchy'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <ListTree className={`w-4 h-4 ${activeTab === 'hierarchy' ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>Call Hierarchy</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('blast')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'blast'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Radar className={`w-4 h-4 ${activeTab === 'blast' ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>Blast Radius</span>
            </button>
          </nav>
        </div>

        {/* Quick Class Switcher */}
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            CLASSES IN PROJECT ({nodes.length})
          </p>
          <div className="space-y-1 max-h-52 overflow-y-auto">
            {nodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onSelectNode(node)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition text-left cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-200'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center space-x-1.5 truncate">
                    <FileCode className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className="truncate">{node.name}.java</span>
                  </span>
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Blast Impact Widget */}
      <div className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-200/80 text-xs">
        <div className="flex justify-between font-semibold text-slate-600">
          <span className="flex items-center space-x-1">
            <ShieldAlert className="w-3.5 h-3.5 text-emerald-600" />
            <span>BLAST IMPACT</span>
          </span>
          <span className="text-slate-900 font-bold">
            {totalImpact} {totalImpact === 1 ? 'Direct Call' : 'Total Calls'}
          </span>
        </div>
        <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
          <div
            className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
            style={{ width: `${impactPercent}%` }}
          ></div>
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5">
          {totalImpact === 0
            ? 'Safe to modify in isolation'
            : `${directCount} direct caller, ${indirectCount} transitive`}
        </p>
      </div>
    </aside>
  );
};
