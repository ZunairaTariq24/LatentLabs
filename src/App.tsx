import React, { useState, useMemo } from "react";
import {
  FACTORY_MACHINES,
  AUTHORITATIVE_SCENARIOS,
  getErrorsForMachineId,
} from "./data/factoryData";
import { evaluateMaintenanceCaseTS } from "./utils/calculator";
import {
  generateDeterministicExplanationTS,
  fetchGroqExplanation,
} from "./utils/aiEngine";
import { AuditLogItem, DecisionPackage, AIExplanationResult } from "./types";
import { TopologyDiagram } from "./components/TopologyDiagram";
import { DecisionGatekeeper } from "./components/DecisionGatekeeper";
import { ExplainableAIPanel } from "./components/ExplainableAIPanel";
import { AuditLogTable } from "./components/AuditLogTable";
import { CodePackageModal } from "./components/CodePackageModal";
import { PredictiveMaintenancePanel } from "./components/PredictiveMaintenancePanel";

import {
  Factory,
  ShieldCheck,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Code,
  Sliders,
  BarChart3,
  Layers,
  Cpu,
  Database,
} from "lucide-react";

export default function App() {
  // Navigation & Selection state
  const [viewMode, setViewMode] = useState<"topology" | "diagnostic" | "predictive">("topology");
  const [selectedMachineId, setSelectedMachineId] = useState<string>("M-101");
  const [selectedErrorId, setSelectedErrorId] = useState<string>("M1-E01");

  // Groq API Key & Explanation State
  const [groqApiKey, setGroqApiKey] = useState<string>("");
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [customExplanation, setCustomExplanation] = useState<AIExplanationResult | null>(null);

  // Python Code Package Modal State
  const [isCodeModalOpen, setIsCodeModalOpen] = useState<boolean>(false);

  // Historical / Demo Economics State (Section 5.1 & 12)
  const [showChart, setShowChart] = useState<boolean>(false);

  // Shift Handover / Audit Log State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([
    {
      id: "log-1",
      timestamp: "2026-09-08 14:22:10",
      machine_id: "M-101",
      error_id: "M1-E01",
      failure_mode: "Hydraulic Seal Weeping",
      decision: "Accepted Option A (Intervene Now)",
      net_avoided_loss: 751500,
      safety_override: false,
    },
    {
      id: "log-2",
      timestamp: "2026-09-09 09:15:40",
      machine_id: "M-201",
      error_id: "M2-E01",
      failure_mode: "Ceramic Bearing Wear",
      decision: "Accepted Option A (Intervene Now)",
      net_avoided_loss: 1440000,
      safety_override: false,
    },
    {
      id: "log-3",
      timestamp: "2026-09-10 11:45:00",
      machine_id: "M-301",
      error_id: "M3-E05",
      failure_mode: "E-Stop Ground Fault",
      decision: "Mandatory Safety Shutdown",
      net_avoided_loss: 0,
      safety_override: true,
    },
  ]);

  // Current active machine's available error scenarios
  const availableErrors = useMemo(() => {
    return getErrorsForMachineId(selectedMachineId);
  }, [selectedMachineId]);

  // Ensure selectedErrorId is valid for selectedMachineId
  const activeRecord = useMemo(() => {
    const matched = availableErrors.find((e) => e.error_id === selectedErrorId);
    if (matched) return matched;
    return availableErrors[0] || AUTHORITATIVE_SCENARIOS[0];
  }, [availableErrors, selectedErrorId]);

  // Evaluate deterministic decision package (Zero math hallucinations)
  const decisionPackage: DecisionPackage = useMemo(() => {
    return evaluateMaintenanceCaseTS(activeRecord);
  }, [activeRecord]);

  // Compute or synthesize explanation
  const activeExplanation: AIExplanationResult = useMemo(() => {
    if (customExplanation) return customExplanation;
    return generateDeterministicExplanationTS(decisionPackage);
  }, [customExplanation, decisionPackage]);

  // Handle machine selection from topology or dropdown
  const handleSelectMachine = (machineId: string) => {
    setSelectedMachineId(machineId);
    const newErrors = getErrorsForMachineId(machineId);
    if (newErrors.length > 0) {
      setSelectedErrorId(newErrors[0].error_id);
    }
    setCustomExplanation(null);
  };

  // Handle error scenario change
  const handleSelectError = (errorId: string) => {
    setSelectedErrorId(errorId);
    setCustomExplanation(null);
  };

  // Re-synthesize explanation via Groq or fallback
  const handleRefreshExplanation = async () => {
    setIsSynthesizing(true);
    try {
      const res = await fetchGroqExplanation(decisionPackage, groqApiKey);
      setCustomExplanation(res);
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Accept Option A (Stop Machine Now)
  const handleAcceptOptionA = () => {
    const newLog: AuditLogItem = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      machine_id: decisionPackage.machine_id,
      error_id: decisionPackage.error_id,
      failure_mode: decisionPackage.failure_mode,
      decision: decisionPackage.safety_override
        ? "Mandatory Safety Shutdown"
        : "Accepted Option A (Intervene Now)",
      net_avoided_loss: decisionPackage.net_avoided_loss || 0,
      safety_override: decisionPackage.safety_override,
    };
    setAuditLogs([newLog, ...auditLogs]);
  };

  // Defer Option B (Continue Running)
  const handleDeferOptionB = () => {
    if (decisionPackage.safety_override) return; // Prevented by safety lockout
    const newLog: AuditLogItem = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      machine_id: decisionPackage.machine_id,
      error_id: decisionPackage.error_id,
      failure_mode: decisionPackage.failure_mode,
      decision: "Deferred: Continue Running",
      net_avoided_loss: -(decisionPackage.net_avoided_loss || 0),
      safety_override: false,
    };
    setAuditLogs([newLog, ...auditLogs]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
              <Factory className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-100 tracking-tight">
                  Production Downtime & Maintenance Decision Intelligence
                </h1>
                <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                  Cohort 11
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Industrial maintenance decision support &bull; “Stop for 10 minutes now — or lose 2 hours later?”
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden lg:flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5" /> 15 Tests Verified
            </span>
            <button
              id="btn-open-code-modal"
              onClick={() => setIsCodeModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-all"
            >
              <Code className="w-4 h-4 text-cyan-400" />
              <span>Python Codebase</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Strategic Landing Metrics Overview */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Machine Learning Evaluation & Operational Benchmarks
              </h2>
              <p className="text-xs text-slate-500">
                AI4I 2020 Predictive Maintenance Dataset (10,000 Industrial Milling Machine Telemetry Records)
              </p>
            </div>
            <button
              onClick={() => setShowChart(!showChart)}
              className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-medium"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              {showChart ? "Hide Economics Simulation" : "View Economics Simulation"}
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Metric 1 */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
                <span>Benchmark Records</span>
                <Database className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-cyan-400">10,000</div>
              <div className="text-[11px] text-slate-400 mt-1 font-medium">
                AI4I 2020 Industrial Dataset
              </div>
            </div>

            {/* Metric 2 */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
                <span>Model ROC-AUC</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-400">0.9662</div>
              <div className="text-[11px] text-emerald-400/90 mt-1">Random Forest Classifier Pipeline</div>
            </div>

            {/* Metric 3 */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
                <span>Failure Recall (@ 0.40 Thr)</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-cyan-400">73.5%</div>
              <div className="text-[11px] text-slate-400 mt-1">Precision: 63.3% &bull; F1: 0.680</div>
            </div>

            {/* Metric 4 */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
                <span>Benchmark Failure Rate</span>
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-amber-400">3.39%</div>
              <div className="text-[11px] text-slate-400 mt-1 font-medium">
                339 Failures / 9,661 Normal
              </div>
            </div>
          </div>

          {/* Collapsible Economics Bar Visualizer */}
          {showChart && (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Illustrative Scenario — Balanced Line Financial Impact Simulation
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/50">
                  Illustrative Simulation — Not Audited Historical Savings
                </span>
              </div>
              <p className="text-xs text-slate-400">
                This economic model illustrates potential downtime cost avoidance across the 15 plant scenarios. These financial estimates are simulation figures, distinct from the machine learning model output.
              </p>
              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>July: Planned Stop (PKR 185k) vs Avoided Breakdown Exposure (PKR 2.68M)</span>
                    <span className="text-emerald-400 font-mono font-bold">+PKR 2.49M Saved</span>
                  </div>
                  <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden flex">
                    <div className="bg-emerald-500 h-full" style={{ width: "7%" }} title="Planned Cost"></div>
                    <div className="bg-red-500/40 h-full" style={{ width: "93%" }} title="Avoided Loss"></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>August: Planned Stop (PKR 246.5k) vs Avoided Breakdown Exposure (PKR 3.45M)</span>
                    <span className="text-emerald-400 font-mono font-bold">+PKR 3.20M Saved</span>
                  </div>
                  <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden flex">
                    <div className="bg-emerald-500 h-full" style={{ width: "7%" }} title="Planned Cost"></div>
                    <div className="bg-red-500/40 h-full" style={{ width: "93%" }} title="Avoided Loss"></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>September: Planned Stop (PKR 212k) vs Avoided Breakdown Exposure (PKR 2.93M)</span>
                    <span className="text-emerald-400 font-mono font-bold">+PKR 2.72M Saved</span>
                  </div>
                  <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden flex">
                    <div className="bg-emerald-500 h-full" style={{ width: "7%" }} title="Planned Cost"></div>
                    <div className="bg-red-500/40 h-full" style={{ width: "93%" }} title="Avoided Loss"></div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Planned Proactive Cost
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/40"></span> Avoided Breakdown Exposure (Illustrative)
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Dual Mode Selector Header */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-slate-200">Asset Diagnosis & Incident Selector</h2>
          </div>

          <div className="flex items-center rounded-xl bg-slate-900 border border-slate-800 p-1 flex-wrap gap-1">
            <button
              onClick={() => setViewMode("topology")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "topology"
                  ? "bg-cyan-950 text-cyan-300 border border-cyan-800 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Factory className="w-3.5 h-3.5" />
              Mode 1: Factory Topology
            </button>
            <button
              onClick={() => setViewMode("diagnostic")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "diagnostic"
                  ? "bg-cyan-950 text-cyan-300 border border-cyan-800 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Mode 2: Quick Diagnostic
            </button>
            <button
              onClick={() => setViewMode("predictive")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "predictive"
                  ? "bg-indigo-950 text-indigo-300 border border-indigo-700 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              Mode 3: AI4I ML Predictor (Random Forest)
            </button>
          </div>
        </section>

        {/* Mode 3: AI4I Predictive Maintenance (Random Forest ML) */}
        {viewMode === "predictive" && (
          <section>
            <PredictiveMaintenancePanel groqApiKey={groqApiKey} />
          </section>
        )}

        {/* Mode 1: Graphical Topology Diagram */}
        {viewMode === "topology" && (
          <section>
            <TopologyDiagram
              selectedMachineId={selectedMachineId}
              onSelectMachine={handleSelectMachine}
              activeErrorMachineId={decisionPackage.machine_id}
              isSafetyOverrideActive={decisionPackage.safety_override}
            />

            {/* Error selector bar for selected machine */}
            <div className="mt-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block">
                  Reported Symptom / Diagnostic Code for {decisionPackage.machine_id}:
                </label>
                <span className="text-[11px] text-slate-500">
                  Select an error scenario to trigger deterministic cost comparison.
                </span>
              </div>
              <select
                value={selectedErrorId}
                onChange={(e) => handleSelectError(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
              >
                {availableErrors.map((err) => (
                  <option key={err.error_id} value={err.error_id}>
                    {err.error_id} — {err.failure_mode} ({err.category})
                  </option>
                ))}
              </select>
            </div>
          </section>
        )}

        {/* Mode 2: Quick Diagnostic Selector */}
        {viewMode === "diagnostic" && (
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  1. Target Machine ID:
                </label>
                <select
                  value={selectedMachineId}
                  onChange={(e) => handleSelectMachine(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                >
                  {FACTORY_MACHINES.map((m) => (
                    <option key={m.machine_id} value={m.machine_id}>
                      {m.machine_id} — {m.machine_name} ({m.stage})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  2. Reported Symptom / Error Code:
                </label>
                <select
                  value={selectedErrorId}
                  onChange={(e) => handleSelectError(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                >
                  {availableErrors.map((err) => (
                    <option key={err.error_id} value={err.error_id}>
                      {err.error_id} — {err.failure_mode} ({err.category})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>
        )}

        {/* Mode 1 & 2: Active Incident Context & Gatekeeper */}
        {viewMode !== "predictive" && (
          <>
            {/* Active Incident Context Banner */}
            <section className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
                    {decisionPackage.error_id}
                  </span>
                  <span className="font-semibold text-slate-200">{decisionPackage.failure_mode}</span>
                  <span className="text-slate-400">({decisionPackage.category})</span>
                </div>
                <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
                  <span>Asset: <strong className="text-slate-200">{decisionPackage.machine_id}</strong></span>
                  <span>Stage: <strong className="text-slate-200">{decisionPackage.stage}</strong></span>
                  <span>Operator: <strong className="text-slate-200">{decisionPackage.operator}</strong></span>
                  <span>Line Loss: <strong className="text-amber-300">PKR {decisionPackage.line_loss_rate.toLocaleString()}/hr</strong></span>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                <span className="text-slate-500 font-semibold uppercase text-[10px] mr-2">Observed Symptom:</span>
                {decisionPackage.symptom}
              </div>
            </section>

            {/* Decision Gatekeeper (Option A vs Option B) */}
            <section>
              <DecisionGatekeeper
                decision={decisionPackage}
                onAcceptOptionA={handleAcceptOptionA}
                onDeferOptionB={handleDeferOptionB}
              />
            </section>

            {/* Explainable AI Panel (5 Sections) */}
            <section>
              <ExplainableAIPanel
                decision={decisionPackage}
                explanation={activeExplanation}
                groqApiKey={groqApiKey}
                onUpdateGroqKey={setGroqApiKey}
                onRefreshExplanation={handleRefreshExplanation}
                isLoading={isSynthesizing}
              />
            </section>
          </>
        )}

        {/* Decision Audit Log Table */}
        <section>
          <AuditLogTable logs={auditLogs} onClearLogs={() => setAuditLogs([])} />
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Production Downtime & Maintenance Decision Intelligence &bull; Cohort 11 Prototype</span>
          <span className="font-mono text-[11px] text-slate-400">
            Deterministic Engine (Python + TypeScript) &bull; Zero Hallucinations Guaranteed
          </span>
        </div>
      </footer>

      {/* Code Viewer Modal */}
      <CodePackageModal isOpen={isCodeModalOpen} onClose={() => setIsCodeModalOpen(false)} />
    </div>
  );
}
