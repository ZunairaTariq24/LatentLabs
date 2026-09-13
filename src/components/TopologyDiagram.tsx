import React from "react";
import { FACTORY_MACHINES } from "../data/factoryData";
import { FactoryMachine } from "../types";
import { AlertTriangle, CheckCircle2, ShieldAlert, Cpu } from "lucide-react";

interface TopologyDiagramProps {
  selectedMachineId: string;
  onSelectMachine: (machineId: string) => void;
  activeErrorMachineId?: string;
  isSafetyOverrideActive?: boolean;
}

export const TopologyDiagram: React.FC<TopologyDiagramProps> = ({
  selectedMachineId,
  onSelectMachine,
  activeErrorMachineId,
  isSafetyOverrideActive,
}) => {
  const m101 = FACTORY_MACHINES.find((m) => m.machine_id === "M-101")!;
  const stage2 = FACTORY_MACHINES.filter((m) => m.stage === "Stage 2");
  const stage3 = FACTORY_MACHINES.filter((m) => m.stage === "Stage 3");

  const renderCard = (m: FactoryMachine, splitLabel: string) => {
    const isSelected = selectedMachineId === m.machine_id;
    const isIncident = activeErrorMachineId === m.machine_id;

    return (
      <button
        key={m.machine_id}
        id={`btn-topology-${m.machine_id.toLowerCase()}`}
        onClick={() => onSelectMachine(m.machine_id)}
        className={`w-full text-left transition-all duration-200 rounded-xl p-4 border relative ${
          isSelected
            ? "bg-slate-900/90 border-cyan-500 ring-2 ring-cyan-500/40 shadow-lg shadow-cyan-500/10"
            : "bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70"
        }`}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
              {m.machine_id}
            </span>
            <span className="text-xs text-slate-400 font-medium">{splitLabel}</span>
          </div>
          {isIncident && isSafetyOverrideActive ? (
            <span className="flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-950/80 px-2 py-0.5 rounded-full border border-red-800 animate-pulse">
              <ShieldAlert className="w-3 h-3" /> Safety Alert
            </span>
          ) : isIncident ? (
            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-800">
              <AlertTriangle className="w-3 h-3" /> Diagnostic
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-900">
              <CheckCircle2 className="w-3 h-3" /> Operational
            </span>
          )}
        </div>

        <h4 className="text-sm font-semibold text-slate-100 mb-1">{m.machine_name}</h4>

        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800/80 text-xs text-slate-400">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase tracking-wider">Capacity</span>
            <span className="font-mono font-medium text-slate-200">{m.capacity_per_hour} pkts/hr</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase tracking-wider">Line Loss</span>
            <span className="font-mono font-medium text-amber-300">
              PKR {(m.line_loss_rate / 1000).toFixed(0)}k/hr
            </span>
          </div>
        </div>

        <div className="mt-2 text-[11px] text-slate-400 truncate">
          <span className="text-slate-500">Staff: </span> {m.operator}
        </div>
      </button>
    );
  };

  return (
    <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            1 → 2 → 4 Diverging Balanced Factory Topology
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            100 pkts/hr nominal throughput &bull; Click any asset to inspect reported errors and economics
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded bg-slate-900 text-slate-300 border border-slate-800 font-mono">
          Diverging Flow
        </span>
      </div>

      <div className="space-y-4">
        {/* Stage 1 */}
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            Stage 1: Primary Feeder (100% Single Point of Failure)
          </div>
          <div className="max-w-md mx-auto">{renderCard(m101, "100% Flow")}</div>
        </div>

        {/* Divergence Connector 1 */}
        <div className="flex items-center justify-center gap-3 text-xs text-slate-500 font-mono">
          <span className="h-px bg-slate-800 flex-1"></span>
          <span>↓ 50% Throughput Split (Starvation Point) ↓</span>
          <span className="h-px bg-slate-800 flex-1"></span>
        </div>

        {/* Stage 2 */}
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            Stage 2: Parallel CNC Milling Centers (2 × 50 pkts/hr)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {stage2.map((m) => renderCard(m, "50% Parallel"))}
          </div>
        </div>

        {/* Divergence Connector 2 */}
        <div className="flex items-center justify-center gap-3 text-xs text-slate-500 font-mono">
          <span className="h-px bg-slate-800 flex-1"></span>
          <span>↓ 25% Throughput Quad Split (Packaging Buffer) ↓</span>
          <span className="h-px bg-slate-800 flex-1"></span>
        </div>

        {/* Stage 3 */}
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400"></span>
            Stage 3: Packaging Cells (4 × 25 pkts/hr)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {stage3.map((m) => renderCard(m, "25% Quad"))}
          </div>
        </div>
      </div>
    </div>
  );
};
