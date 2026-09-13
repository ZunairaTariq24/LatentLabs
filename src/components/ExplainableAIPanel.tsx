import React, { useState, useEffect } from "react";
import { AIExplanationResult, DecisionPackage, FeatureImportanceItem } from "../types";
import { ShieldCheck, Bot, Sparkles, Key, CheckCircle, RefreshCw, BarChart3 } from "lucide-react";

interface ExplainableAIPanelProps {
  decision: DecisionPackage;
  explanation: AIExplanationResult;
  groqApiKey: string;
  onUpdateGroqKey: (key: string) => void;
  onRefreshExplanation: () => void;
  isLoading: boolean;
}

export const ExplainableAIPanel: React.FC<ExplainableAIPanelProps> = ({
  decision,
  explanation,
  groqApiKey,
  onUpdateGroqKey,
  onRefreshExplanation,
  isLoading,
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [keyInput, setKeyInput] = useState(groqApiKey);
  const [featureImportances, setFeatureImportances] = useState<FeatureImportanceItem[]>([]);
  const [loadingImportances, setLoadingImportances] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch("/api/model-info")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted && data && data.feature_importance) {
          setFeatureImportances(data.feature_importance);
        }
      })
      .catch((err) => console.error("Failed to load model feature importances", err))
      .finally(() => {
        if (mounted) setLoadingImportances(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleSaveKey = () => {
    onUpdateGroqKey(keyInput);
    setShowConfig(false);
  };

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-800/80 text-cyan-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                Explainable AI Management Panel
              </h3>
              <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                <ShieldCheck className="w-3.5 h-3.5" />
                Anti-Hallucination Guard Active
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              AI explanation generated strictly from validated factory data & deterministic math.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            <Key className="w-3.5 h-3.5 text-cyan-400" />
            {groqApiKey ? "Groq Configured" : "Enter Groq Key"}
          </button>
          <button
            onClick={onRefreshExplanation}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs transition-colors"
            title="Re-synthesize explanation"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-cyan-400" : ""}`} />
          </button>
        </div>
      </div>

      {showConfig && (
        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-700 space-y-2">
          <label className="text-xs font-medium text-slate-300 block">
            Groq API Key (Stored in session / memory only)
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="gsk_..."
              className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={handleSaveKey}
              className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
            >
              Save Key
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            If no Groq key is provided, the deterministic anti-hallucination fallback engine generates
            100% grounded explanations automatically.
          </p>
        </div>
      )}

      {/* 5 Structured Management Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Section 1: DECISION */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 uppercase tracking-wider">
            <CheckCircle className="w-3.5 h-3.5" />
            DECISION
          </div>
          <p className="text-xs text-slate-200 leading-relaxed">{explanation.decision}</p>
        </div>

        {/* Section 2: WHY */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            WHY (Root Cause & Diagnostics)
          </div>
          <p className="text-xs text-slate-200 leading-relaxed">{explanation.why}</p>
        </div>

        {/* Section 3: FINANCIAL IMPACT */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wider">
            <span>PKR</span>
            FINANCIAL IMPACT
          </div>
          <p className="text-xs text-slate-200 leading-relaxed font-mono">{explanation.financial_impact}</p>
        </div>

        {/* Section 4: RISK */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-red-400 uppercase tracking-wider">
            <span>⚠️</span>
            RISK (Downtime & Line Exposure)
          </div>
          <p className="text-xs text-slate-200 leading-relaxed">{explanation.risk}</p>
        </div>

        {/* Section 5: ACTION */}
        <div className="md:col-span-2 p-3.5 rounded-xl bg-slate-900/60 border border-cyan-900/50 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300 uppercase tracking-wider">
            <span>⚡</span>
            ACTION (Preventative Operations Order)
          </div>
          <p className="text-xs text-slate-200 leading-relaxed">{explanation.action}</p>
        </div>
      </div>

      {/* Random Forest Feature Importance (Dynamic from ml/predictive_maintenance_model.pkl) */}
      <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <h5 className="text-sm font-bold text-white tracking-wide">
              Random Forest Feature Importance
            </h5>
          </div>
          <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
            ml/predictive_maintenance_model.pkl
          </span>
        </div>
        <p className="text-xs text-slate-400">
          Shows which input features the trained model relies on most heavily. Feature importance indicates model reliance, not causation.
        </p>

        {loadingImportances ? (
          <div className="flex items-center gap-2 py-3 text-xs text-slate-400">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
            Loading real feature importances from pipeline...
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            {featureImportances.map((item) => (
              <div key={item.feature} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300">{item.feature}</span>
                  <span className="font-mono text-cyan-300 font-semibold">{item.formatted}</span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(2, item.percentage))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grounding Source Info */}
      <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500">
        <span>
          Explanation Engine: <strong className="text-slate-300">{explanation.source}</strong>
        </span>
        <span>{explanation.notice}</span>
      </div>
    </div>
  );
};
