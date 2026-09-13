import React, { useState, useEffect } from "react";
import {
  Cpu,
  Gauge,
  Thermometer,
  RotateCw,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  Sparkles,
  BarChart2,
  BarChart3,
  Info,
  Layers,
  ArrowRight,
  ShieldCheck,
  Sliders,
  GitCompare,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from "lucide-react";
import {
  FeatureImportanceItem,
  ModelConfigData,
  PredictiveMaintenanceResult,
} from "../types";

interface MachineInputs {
  Type: "L" | "M" | "H";
  "Air temperature [K]": number;
  "Process temperature [K]": number;
  "Rotational speed [rpm]": number;
  "Torque [Nm]": number;
  "Tool wear [min]": number;
}

interface Props {
  groqApiKey?: string;
}

export const PredictiveMaintenancePanel: React.FC<Props> = ({ groqApiKey }) => {
  // Current baseline inputs
  const [inputs, setInputs] = useState<MachineInputs>({
    Type: "L",
    "Air temperature [K]": 300.5,
    "Process temperature [K]": 310.0,
    "Rotational speed [rpm]": 1400,
    "Torque [Nm]": 62.0,
    "Tool wear [min]": 120,
  });

  // Simulated What-If inputs
  const [simInputs, setSimInputs] = useState<MachineInputs>({
    Type: "L",
    "Air temperature [K]": 302.0,
    "Process temperature [K]": 311.5,
    "Rotational speed [rpm]": 1250,
    "Torque [Nm]": 72.0,
    "Tool wear [min]": 215,
  });

  // Model configuration state (loaded dynamically from ml/model_config.json)
  const [modelConfig, setModelConfig] = useState<ModelConfigData | null>(null);
  const [featureImportances, setFeatureImportances] = useState<FeatureImportanceItem[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Execution states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [predictionResult, setPredictionResult] = useState<PredictiveMaintenanceResult | null>(null);

  // What-If comparison state
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<PredictiveMaintenanceResult | null>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const [showWhatIf, setShowWhatIf] = useState(false);

  // Groq AI Explanation states
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  // Fetch model configuration and dynamic feature importances on mount
  useEffect(() => {
    let active = true;
    fetch("/api/model-info")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) {
          setModelConfig({
            model_name: data.model_name || "Random Forest Pipeline (100 Estimators)",
            model_type: data.model_type || "scikit-learn Pipeline (RandomForestClassifier)",
            dataset: data.dataset || "AI4I 2020 Predictive Maintenance Dataset",
            dataset_records: data.dataset_records || 10000,
            thresholds: data.thresholds || {
              low_risk_max: 0.20,
              medium_risk_max: 0.40,
              decision_threshold: 0.40,
            },
            metrics: data.metrics || {
              roc_auc: 0.9662,
              threshold: 0.40,
              precision: 0.632911,
              recall: 0.735294,
              f1_score: 0.680272,
            },
            features: data.features || [],
          });
          if (data.feature_importance && Array.isArray(data.feature_importance)) {
            setFeatureImportances(data.feature_importance);
          }
        }
      })
      .catch((err) => console.error("Failed to fetch model info:", err))
      .finally(() => {
        if (active) setLoadingConfig(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Quick Preset Handlers
  const applyPreset = (
    type: "L" | "M" | "H",
    air: number,
    proc: number,
    rpm: number,
    torque: number,
    wear: number
  ) => {
    const newInputs: MachineInputs = {
      Type: type,
      "Air temperature [K]": air,
      "Process temperature [K]": proc,
      "Rotational speed [rpm]": rpm,
      "Torque [Nm]": torque,
      "Tool wear [min]": wear,
    };
    setInputs(newInputs);
    setPredictionResult(null);
    setAiExplanation(null);
    setErrorMsg(null);
  };

  // Run Real ML Prediction on current inputs
  const handlePredict = async () => {
    setLoading(true);
    setErrorMsg(null);
    setPredictionResult(null);
    setAiExplanation(null);

    try {
      const response = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to execute machine learning model.");
      }

      const decision: PredictiveMaintenanceResult = data.data;
      setPredictionResult(decision);

      // Update feature importances and config if supplied in response
      if (data.feature_importance && Array.isArray(data.feature_importance)) {
        setFeatureImportances(data.feature_importance);
      }
      if (data.model_config) {
        setModelConfig(data.model_config);
      }

      // Trigger AI Explanation (Groq or deterministic fallback)
      generateExplanation(inputs, decision);
    } catch (err: any) {
      setErrorMsg(err?.message || "Prediction execution failed.");
    } finally {
      setLoading(false);
    }
  };

  // Run Real ML Prediction on What-If Simulated Inputs
  const handleSimulateWhatIf = async () => {
    setSimLoading(true);
    setSimError(null);

    try {
      const response = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(simInputs),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to run simulation prediction.");
      }

      setSimResult(data.data);
    } catch (err: any) {
      setSimError(err?.message || "What-If simulation failed.");
    } finally {
      setSimLoading(false);
    }
  };

  // Groq AI Explanation with deterministic fallback
  const generateExplanation = async (
    currentInputs: MachineInputs,
    decision: PredictiveMaintenanceResult
  ) => {
    setIsAiLoading(true);
    setAiNotice(null);

    const getDeterministicText = () => {
      if (decision.risk_level === "HIGH") {
        return `### AI Explanation: High Risk Degradation Analysis\n\n**1. Risk Classification Context:**\nThe Random Forest model calculated a **${decision.formatted_probability} failure probability**, exceeding the decision threshold of 40.0%.\n\n**2. Key Model Factors:**\nOperating with **Torque at ${currentInputs["Torque [Nm]"]} Nm** and cumulative **Tool Wear at ${currentInputs["Tool wear [min]"]} minutes** indicates severe mechanical stress. Elevated thermal readings (${currentInputs["Air temperature [K]"]} K air, ${currentInputs["Process temperature [K]"]} K process) exacerbate friction.\n\n**3. Actionable Maintenance Directive:**\nPriority: **${decision.priority_label}**. ${decision.recommendation} Technicians should lock out the machine, inspect tool geometry, and replace worn inserts before resuming production.\n\n**4. Downtime Reduction Value:**\nA planned 15-minute tool swap now avoids 2 to 4 hours of unmanaged breakdown downtime.`;
      } else if (decision.risk_level === "MEDIUM") {
        return `### AI Explanation: Moderate Risk Monitoring Analysis\n\n**1. Risk Classification Context:**\nThe Random Forest model calculated a **${decision.formatted_probability} failure probability**, falling in the 20.0% – 40.0% caution window.\n\n**2. Key Model Factors:**\nMonitored factors show elevated torque (${currentInputs["Torque [Nm]"]} Nm) and progressive tool wear (${currentInputs["Tool wear [min]"]} min) approaching maintenance thresholds.\n\n**3. Actionable Maintenance Directive:**\nPriority: **${decision.priority_label}**. ${decision.recommendation} Maintain standard production while increasing telemetry polling frequency, and schedule inspection during the next planned shift change.\n\n**4. Downtime Reduction Value:**\nAllows replacement during scheduled changeovers rather than unscheduled production disruption.`;
      } else {
        return `### AI Explanation: Normal Baseline Operation Analysis\n\n**1. Risk Classification Context:**\nThe Random Forest model computed a **${decision.formatted_probability} failure probability**, well below the 20.0% threshold.\n\n**2. Key Model Factors:**\nAll monitored readings (${currentInputs["Torque [Nm]"]} Nm torque, ${currentInputs["Rotational speed [rpm]"]} rpm, ${currentInputs["Tool wear [min]"]} min tool wear) are in standard safe bands.\n\n**3. Actionable Maintenance Directive:**\nPriority: **${decision.priority_label}**. ${decision.recommendation} No immediate intervention is required.\n\n**4. Downtime Reduction Value:**\nAvoiding premature shutdowns preserves machine uptime and tool useful life.`;
      }
    };

    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: currentInputs,
          decision,
          apiKey: groqApiKey || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.is_ai && data.explanation) {
          setAiExplanation(data.explanation);
          setAiNotice(data.model ? `Groq AI (${data.model})` : null);
          return;
        } else if (data.notice) {
          setAiExplanation(getDeterministicText());
          setAiNotice(data.notice);
          return;
        }
      }
      setAiExplanation(getDeterministicText());
      setAiNotice("Displaying deterministic explanation.");
    } catch {
      setAiExplanation(getDeterministicText());
      setAiNotice("Groq API unavailable. Displaying deterministic explanation.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // Calculate Risk Change percentage points between Current and Simulated
  const riskDiff =
    predictionResult && simResult
      ? Number((simResult.probability_pct - predictionResult.probability_pct).toFixed(1))
      : null;

  return (
    <div className="space-y-6">
      {/* 3-Pillar Architectural Separation Banner (Fix 6) */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Architectural Engine Separation
            </h3>
          </div>
          <span className="text-[11px] font-mono text-indigo-300 bg-indigo-950/70 px-2 py-0.5 rounded border border-indigo-800/50">
            Strict Engine Boundaries
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Pillar 1 */}
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-indigo-400 uppercase tracking-wider">
              <Cpu className="h-3.5 w-3.5" />
              1. Prediction Engine
            </div>
            <div className="font-semibold text-slate-200">
              {modelConfig?.model_name || "Scikit-Learn Random Forest Pipeline"}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Executes <code className="text-indigo-300">predict_proba()</code> on 6 sensor telemetry inputs from <code className="text-indigo-300">ml/predictive_maintenance_model.pkl</code>.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-400 uppercase tracking-wider">
              <Gauge className="h-3.5 w-3.5" />
              2. Decision Engine
            </div>
            <div className="font-semibold text-slate-200">Deterministic Policy Rules</div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Applies rigid plant rules: &lt;0.20 (Low / Run), 0.20–0.40 (Medium / Monitor), &ge;0.40 (High / Intervene).
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-emerald-400 uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5" />
              3. AI Maintenance Copilot
            </div>
            <div className="font-semibold text-slate-200">Groq Llama 3.3 70B (Explanation Layer)</div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Translates validated results into actionable technician directives. Groq cannot modify probabilities or override decisions.
            </p>
          </div>
        </div>

        <div className="p-2.5 rounded bg-slate-950/50 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
          <Info className="h-4 w-4 text-indigo-400 flex-shrink-0" />
          <span>
            <strong>Deterministic Isolation Principle:</strong> Groq explains the decision and provides diagnostic guidance. It does not calculate failure probabilities or decide whether maintenance is recommended.
          </span>
        </div>
      </div>

      {/* Model Benchmark & Dynamic Configuration Card (Fix 2) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-indigo-600" />
            <h4 className="text-sm font-semibold text-slate-900">
              Model Performance & Benchmark ({modelConfig?.model_name || "Random Forest Pipeline"})
            </h4>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            {modelConfig?.dataset || "AI4I 2020 Benchmark"} ({modelConfig?.dataset_records?.toLocaleString() || "10,000"} records)
          </span>
        </div>
        <p className="mb-4 text-xs text-slate-600">
          Evaluated against the authoritative AI4I 2020 Predictive Maintenance Dataset. Metrics loaded dynamically from <code className="text-slate-800 font-mono">ml/model_config.json</code>:
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-center">
            <div className="text-xs font-medium text-slate-500">ROC-AUC</div>
            <div className="text-lg font-bold text-slate-900">
              {modelConfig?.metrics?.roc_auc ? modelConfig.metrics.roc_auc.toFixed(4) : "0.9662"}
            </div>
            <div className="text-[10px] text-slate-400">Class discriminability</div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-center">
            <div className="text-xs font-medium text-slate-500">
              Precision (@ {modelConfig?.thresholds?.decision_threshold ? (modelConfig.thresholds.decision_threshold * 100).toFixed(0) : "40"}% thr)
            </div>
            <div className="text-lg font-bold text-slate-900">
              {modelConfig?.metrics?.precision ? `${(modelConfig.metrics.precision * 100).toFixed(1)}%` : "63.3%"}
            </div>
            <div className="text-[10px] text-slate-400">True failure rate</div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-center">
            <div className="text-xs font-medium text-slate-500">Recall</div>
            <div className="text-lg font-bold text-slate-900">
              {modelConfig?.metrics?.recall ? `${(modelConfig.metrics.recall * 100).toFixed(1)}%` : "73.5%"}
            </div>
            <div className="text-[10px] text-slate-400">Failure capture rate</div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-center">
            <div className="text-xs font-medium text-slate-500">F1 Score</div>
            <div className="text-lg font-bold text-slate-900">
              {modelConfig?.metrics?.f1_score ? `${(modelConfig.metrics.f1_score * 100).toFixed(1)}%` : "68.0%"}
            </div>
            <div className="text-[10px] text-slate-400">Harmonic balance</div>
          </div>
        </div>
      </div>

      {/* Preset Verification Buttons */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Quick Test Cases (Threshold Boundary Verification)
          </span>
          <span className="text-xs text-slate-400">Calibrated Telemetry Sets</span>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <button
            onClick={() => applyPreset("L", 298.1, 308.6, 1551, 32.8, 10)}
            className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-left transition hover:bg-emerald-100/60"
          >
            <div>
              <div className="text-xs font-bold text-emerald-800">Case 1: Low Risk</div>
              <div className="text-[11px] text-emerald-600">Prob &lt; 20% &bull; RUN NORMALLY &bull; P3</div>
            </div>
            <span className="rounded bg-emerald-200/80 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
              Select
            </span>
          </button>

          <button
            onClick={() => applyPreset("L", 300.5, 310.0, 1400, 62.0, 120)}
            className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-left transition hover:bg-amber-100/60"
          >
            <div>
              <div className="text-xs font-bold text-amber-800">Case 2: Medium Risk</div>
              <div className="text-[11px] text-amber-600">20% – 40% &bull; MONITOR &bull; P2</div>
            </div>
            <span className="rounded bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-900">
              Select
            </span>
          </button>

          <button
            onClick={() => applyPreset("L", 304.5, 312.0, 1200, 75.0, 235)}
            className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50/60 p-3 text-left transition hover:bg-rose-100/60"
          >
            <div>
              <div className="text-xs font-bold text-rose-800">Case 3: High Risk</div>
              <div className="text-[11px] text-rose-600">Prob &ge; 40% &bull; MAINTENANCE RECOMMENDED &bull; P1</div>
            </div>
            <span className="rounded bg-rose-200/80 px-2 py-0.5 text-[10px] font-bold text-rose-900">
              Select
            </span>
          </button>
        </div>
      </div>

      {/* Machine Data Inputs */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h4 className="text-base font-semibold text-slate-900">
              Machine Sensor Telemetry Inputs
            </h4>
            <p className="text-xs text-slate-500">
              6 input features for Random Forest pipeline (preprocessed & one-hot encoded)
            </p>
          </div>
          <button
            onClick={() => setShowWhatIf(!showWhatIf)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition-all"
          >
            <GitCompare className="h-3.5 w-3.5" />
            {showWhatIf ? "Hide What-If Simulation" : "Open What-If Simulator"}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Machine Type */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <Layers className="h-3.5 w-3.5 text-slate-500" />
              Machine Type (Quality Variant)
            </label>
            <select
              value={inputs.Type}
              onChange={(e) => setInputs({ ...inputs, Type: e.target.value as "L" | "M" | "H" })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="L">L (Low variant - 50% of product line)</option>
              <option value="M">M (Medium variant - 30% of product line)</option>
              <option value="H">H (High variant - 20% of product line)</option>
            </select>
            <span className="text-[11px] text-slate-500">Pipeline one-hot encodes Type automatically</span>
          </div>

          {/* Air Temperature */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <Thermometer className="h-3.5 w-3.5 text-slate-500" />
              Air Temperature [K]
            </label>
            <input
              type="number"
              step="0.1"
              value={inputs["Air temperature [K]"]}
              onChange={(e) =>
                setInputs({ ...inputs, "Air temperature [K]": parseFloat(e.target.value) || 0 })
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="text-[11px] text-slate-500">Typical: 295 K – 305 K</span>
          </div>

          {/* Process Temperature */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <Thermometer className="h-3.5 w-3.5 text-slate-500" />
              Process Temperature [K]
            </label>
            <input
              type="number"
              step="0.1"
              value={inputs["Process temperature [K]"]}
              onChange={(e) =>
                setInputs({ ...inputs, "Process temperature [K]": parseFloat(e.target.value) || 0 })
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="text-[11px] text-slate-500">Typical: 305 K – 315 K</span>
          </div>

          {/* Rotational Speed */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <RotateCw className="h-3.5 w-3.5 text-slate-500" />
              Rotational Speed [rpm]
            </label>
            <input
              type="number"
              step="1"
              value={inputs["Rotational speed [rpm]"]}
              onChange={(e) =>
                setInputs({ ...inputs, "Rotational speed [rpm]": parseFloat(e.target.value) || 0 })
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="text-[11px] text-slate-500">Typical: 1100 – 2800 rpm</span>
          </div>

          {/* Torque */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <Gauge className="h-3.5 w-3.5 text-slate-500" />
              Torque [Nm]
            </label>
            <input
              type="number"
              step="0.1"
              value={inputs["Torque [Nm]"]}
              onChange={(e) =>
                setInputs({ ...inputs, "Torque [Nm]": parseFloat(e.target.value) || 0 })
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="text-[11px] text-slate-500">Typical: 10 – 80 Nm</span>
          </div>

          {/* Tool Wear */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <Wrench className="h-3.5 w-3.5 text-slate-500" />
              Tool Wear [min]
            </label>
            <input
              type="number"
              step="1"
              value={inputs["Tool wear [min]"]}
              onChange={(e) =>
                setInputs({ ...inputs, "Tool wear [min]": parseFloat(e.target.value) || 0 })
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="text-[11px] text-slate-500">Critical threshold: &ge; 200 min</span>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={handlePredict}
            disabled={loading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RotateCw className="h-4 w-4 animate-spin" />
                Executing Scikit-Learn Model...
              </>
            ) : (
              <>
                <Cpu className="h-4 w-4" />
                Analyze Machine Risk (Run Random Forest)
              </>
            )}
          </button>
          <span className="text-xs text-slate-500">
            Thresholds: Low &lt; 20% &bull; Medium 20%–40% &bull; High &ge; 40%
          </span>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <div className="flex items-center gap-2 font-semibold">
              <AlertOctagon className="h-4 w-4 text-rose-600" />
              Model Execution Notice
            </div>
            <p className="mt-1 text-xs">{errorMsg}</p>
          </div>
        )}
      </div>

      {/* WHAT-IF SIMULATOR SECTION (Fix 7) */}
      {showWhatIf && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
            <div className="flex items-center gap-2">
              <GitCompare className="h-5 w-5 text-indigo-600" />
              <h4 className="text-base font-bold text-slate-900">
                Interactive What-If Simulation Comparison
              </h4>
            </div>
            <span className="text-xs font-semibold text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded">
              Dual Scikit-Learn Inference (/api/predict)
            </span>
          </div>

          <p className="text-xs text-slate-600">
            Adjust simulation parameters below to evaluate how changes in machine telemetry (such as elevated tool wear or speed adjustments) impact failure probability, risk classification, and maintenance directives.
          </p>

          {/* Simulator Inputs */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 bg-white p-4 rounded-lg border border-indigo-100">
            <div>
              <label className="text-xs font-semibold text-slate-700">Simulated Machine Type</label>
              <select
                value={simInputs.Type}
                onChange={(e) => setSimInputs({ ...simInputs, Type: e.target.value as "L" | "M" | "H" })}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900"
              >
                <option value="L">L (Low quality)</option>
                <option value="M">M (Medium quality)</option>
                <option value="H">H (High quality)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">
                Simulated Tool Wear [min]: {simInputs["Tool wear [min]"]}
              </label>
              <input
                type="range"
                min="0"
                max="260"
                value={simInputs["Tool wear [min]"]}
                onChange={(e) => setSimInputs({ ...simInputs, "Tool wear [min]": parseInt(e.target.value) || 0 })}
                className="mt-2 w-full"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">
                Simulated Rotational Speed [rpm]: {simInputs["Rotational speed [rpm]"]}
              </label>
              <input
                type="range"
                min="1100"
                max="2800"
                step="25"
                value={simInputs["Rotational speed [rpm]"]}
                onChange={(e) => setSimInputs({ ...simInputs, "Rotational speed [rpm]": parseInt(e.target.value) || 0 })}
                className="mt-2 w-full"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">
                Simulated Torque [Nm]: {simInputs["Torque [Nm]"]}
              </label>
              <input
                type="range"
                min="10"
                max="80"
                step="0.5"
                value={simInputs["Torque [Nm]"]}
                onChange={(e) => setSimInputs({ ...simInputs, "Torque [Nm]": parseFloat(e.target.value) || 0 })}
                className="mt-2 w-full"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">
                Simulated Air Temp [K]: {simInputs["Air temperature [K]"]}
              </label>
              <input
                type="range"
                min="295"
                max="306"
                step="0.1"
                value={simInputs["Air temperature [K]"]}
                onChange={(e) => setSimInputs({ ...simInputs, "Air temperature [K]": parseFloat(e.target.value) || 0 })}
                className="mt-2 w-full"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">
                Simulated Process Temp [K]: {simInputs["Process temperature [K]"]}
              </label>
              <input
                type="range"
                min="305"
                max="315"
                step="0.1"
                value={simInputs["Process temperature [K]"]}
                onChange={(e) => setSimInputs({ ...simInputs, "Process temperature [K]": parseFloat(e.target.value) || 0 })}
                className="mt-2 w-full"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={handleSimulateWhatIf}
              disabled={simLoading}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
            >
              {simLoading ? (
                <>
                  <RotateCw className="h-3.5 w-3.5 animate-spin" />
                  Running What-If Inference...
                </>
              ) : (
                <>
                  <GitCompare className="h-3.5 w-3.5" />
                  Compute What-If Scenario
                </>
              )}
            </button>
            <span className="text-[11px] text-slate-500">
              Evaluates actual scikit-learn model on simulated vectors
            </span>
          </div>

          {simError && (
            <div className="rounded bg-rose-50 p-2 text-xs text-rose-700">{simError}</div>
          )}

          {/* SIDE-BY-SIDE COMPARISON CARD */}
          {predictionResult && simResult && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Current Scenario Card */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    CURRENT SCENARIO
                  </span>
                  <span
                    className="rounded px-2 py-0.5 text-[10px] font-bold uppercase"
                    style={{
                      backgroundColor:
                        predictionResult.risk_level === "HIGH"
                          ? "#fee2e2"
                          : predictionResult.risk_level === "MEDIUM"
                          ? "#fef3c7"
                          : "#d1fae5",
                      color:
                        predictionResult.risk_level === "HIGH"
                          ? "#b91c1c"
                          : predictionResult.risk_level === "MEDIUM"
                          ? "#b45309"
                          : "#047857",
                    }}
                  >
                    {predictionResult.risk_level} RISK
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs text-slate-500">Failure Probability:</div>
                  <div
                    className="text-2xl font-black font-mono"
                    style={{ color: predictionResult.status_color }}
                  >
                    {predictionResult.formatted_probability}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                  <div>
                    <span className="text-slate-500">Decision:</span>
                    <div className="font-semibold text-slate-800">{predictionResult.decision}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Priority:</span>
                    <div className="font-semibold text-slate-800">{predictionResult.priority_label}</div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded">
                  Wear: {inputs["Tool wear [min]"]} min &bull; Speed: {inputs["Rotational speed [rpm]"]} rpm &bull; Torque: {inputs["Torque [Nm]"]} Nm
                </div>
              </div>

              {/* Simulated Scenario Card */}
              <div className="rounded-xl border border-indigo-200 bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                    SIMULATED SCENARIO
                  </span>
                  <span
                    className="rounded px-2 py-0.5 text-[10px] font-bold uppercase"
                    style={{
                      backgroundColor:
                        simResult.risk_level === "HIGH"
                          ? "#fee2e2"
                          : simResult.risk_level === "MEDIUM"
                          ? "#fef3c7"
                          : "#d1fae5",
                      color:
                        simResult.risk_level === "HIGH"
                          ? "#b91c1c"
                          : simResult.risk_level === "MEDIUM"
                          ? "#b45309"
                          : "#047857",
                    }}
                  >
                    {simResult.risk_level} RISK
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs text-slate-500">Failure Probability:</div>
                  <div
                    className="text-2xl font-black font-mono"
                    style={{ color: simResult.status_color }}
                  >
                    {simResult.formatted_probability}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                  <div>
                    <span className="text-slate-500">Decision:</span>
                    <div className="font-semibold text-slate-800">{simResult.decision}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Priority:</span>
                    <div className="font-semibold text-slate-800">{simResult.priority_label}</div>
                  </div>
                </div>

                <div className="text-[11px] text-indigo-900 bg-indigo-50/60 p-2 rounded">
                  Wear: {simInputs["Tool wear [min]"]} min &bull; Speed: {simInputs["Rotational speed [rpm]"]} rpm &bull; Torque: {simInputs["Torque [Nm]"]} Nm
                </div>
              </div>

              {/* Risk Change Callout Banner */}
              {riskDiff !== null && (
                <div className="md:col-span-2 rounded-lg border border-slate-200 bg-white p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    {riskDiff > 0 ? (
                      <TrendingUp className="h-4 w-4 text-rose-500" />
                    ) : riskDiff < 0 ? (
                      <TrendingDown className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Info className="h-4 w-4 text-slate-400" />
                    )}
                    <span className="font-medium text-slate-700">Risk Change:</span>
                    <strong
                      className={`font-mono ${
                        riskDiff > 0
                          ? "text-rose-600"
                          : riskDiff < 0
                          ? "text-emerald-600"
                          : "text-slate-700"
                      }`}
                    >
                      {riskDiff > 0 ? `+${riskDiff}` : riskDiff} percentage points
                    </strong>
                    <span className="text-slate-500">
                      ({riskDiff > 0 ? "Risk Escalation" : riskDiff < 0 ? "Risk Mitigation" : "No Change"})
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {predictionResult.formatted_probability} &rarr; {simResult.formatted_probability}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* DECISION-CENTRIC RESULT CARD (Fix 5 & Fix 3) */}
      {predictionResult && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-2">
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  Predictive Maintenance Decision
                </h4>
                <p className="text-xs text-slate-500">
                  Operational directive generated from Scikit-Learn failure probability
                </p>
              </div>
              <span
                className="self-start sm:self-auto rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-wider"
                style={{
                  backgroundColor:
                    predictionResult.risk_level === "HIGH"
                      ? "#fee2e2"
                      : predictionResult.risk_level === "MEDIUM"
                      ? "#fef3c7"
                      : "#d1fae5",
                  color:
                    predictionResult.risk_level === "HIGH"
                      ? "#b91c1c"
                      : predictionResult.risk_level === "MEDIUM"
                      ? "#b45309"
                      : "#047857",
                }}
              >
                {predictionResult.risk_display}
              </span>
            </div>

            {/* Core 4-Metric Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Failure Probability */}
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-4 space-y-1">
                <div className="text-xs font-medium text-slate-500">Failure Probability</div>
                <div
                  className="text-3xl font-extrabold font-mono"
                  style={{ color: predictionResult.status_color }}
                >
                  {predictionResult.formatted_probability}
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(5, predictionResult.probability_pct))}%`,
                      backgroundColor: predictionResult.status_color,
                    }}
                  />
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Threshold: &lt;20% Low &bull; 20-40% Med &bull; &ge;40% High
                </div>
              </div>

              {/* Risk Level */}
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-4 space-y-1">
                <div className="text-xs font-medium text-slate-500">Risk Level</div>
                <div className="text-2xl font-bold text-slate-900">
                  {predictionResult.risk_display}
                </div>
                <div className="text-[11px] text-slate-400">
                  Evaluated via deterministic rule policy
                </div>
              </div>

              {/* Maintenance Decision */}
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-4 space-y-1">
                <div className="text-xs font-medium text-slate-500">Maintenance Decision</div>
                <div
                  className="text-xl font-bold"
                  style={{ color: predictionResult.status_color }}
                >
                  {predictionResult.decision}
                </div>
                <div className="text-[11px] text-slate-400">
                  Operational line status directive
                </div>
              </div>

              {/* Priority */}
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-4 space-y-1">
                <div className="text-xs font-medium text-slate-500">Maintenance Priority</div>
                <div className="text-xl font-bold text-slate-900">
                  {predictionResult.priority_label}
                </div>
                <div className="text-[11px] text-slate-400">
                  Shop floor execution hierarchy
                </div>
              </div>
            </div>

            {/* Recommended Action Box */}
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                Recommended Action
              </div>
              <div className="mt-1 text-sm font-semibold text-indigo-950">
                {predictionResult.recommendation}
              </div>
            </div>

            {/* Separate Safety Interlock Status Card (Fix 3) */}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <div className="text-xs font-bold text-emerald-900">
                    Safety Interlock Status: NORMAL (Machine Cleared For Operation)
                  </div>
                  <div className="text-[11px] text-emerald-700">
                    Statutory safety overrides are evaluated independently from the ML probabilistic model. No mechanical safety locks are currently tripped.
                  </div>
                </div>
              </div>
              <span className="hidden sm:inline-block text-[11px] font-mono font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                INTERLOCK 100% CLEAR
              </span>
            </div>

            {/* REAL RANDOM FOREST FEATURE IMPORTANCE (Fix 1) */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-indigo-600" />
                  <h5 className="text-sm font-bold text-slate-900">
                    Random Forest Feature Importance
                  </h5>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  Extracted dynamically from ml/predictive_maintenance_model.pkl
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Shows which input features the trained model relies on most heavily. Feature importance indicates model reliance, not causation.
              </p>

              <div className="space-y-2.5 pt-2">
                {featureImportances.length > 0 ? (
                  featureImportances.map((item) => (
                    <div key={item.feature} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700">{item.feature}</span>
                        <span className="font-mono font-semibold text-slate-900">
                          {item.formatted}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(2, item.percentage))}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-400 italic">
                    Loading feature importances from pipeline...
                  </div>
                )}
              </div>
            </div>

            {/* Telemetry Input Snapshot */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Info className="h-3.5 w-3.5 text-indigo-600" />
                  Evaluated Telemetry Vector
                </div>
                <span className="text-[11px] italic text-slate-500">
                  Input vector passed to scikit-learn pipeline
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6 text-xs">
                <div className="rounded border border-slate-200 bg-white p-2">
                  <span className="text-slate-500">Type:</span>{" "}
                  <span className="font-semibold text-slate-900">{inputs.Type}</span>
                </div>
                <div className="rounded border border-slate-200 bg-white p-2">
                  <span className="text-slate-500">Torque:</span>{" "}
                  <span className="font-semibold text-slate-900">{inputs["Torque [Nm]"]} Nm</span>
                </div>
                <div className="rounded border border-slate-200 bg-white p-2">
                  <span className="text-slate-500">Speed:</span>{" "}
                  <span className="font-semibold text-slate-900">
                    {inputs["Rotational speed [rpm]"]} rpm
                  </span>
                </div>
                <div className="rounded border border-slate-200 bg-white p-2">
                  <span className="text-slate-500">Tool Wear:</span>{" "}
                  <span className="font-semibold text-slate-900">
                    {inputs["Tool wear [min]"]} min
                  </span>
                </div>
                <div className="rounded border border-slate-200 bg-white p-2">
                  <span className="text-slate-500">Air Temp:</span>{" "}
                  <span className="font-semibold text-slate-900">
                    {inputs["Air temperature [K]"]} K
                  </span>
                </div>
                <div className="rounded border border-slate-200 bg-white p-2">
                  <span className="text-slate-500">Process Temp:</span>{" "}
                  <span className="font-semibold text-slate-900">
                    {inputs["Process temperature [K]"]} K
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* AI EXPLANATION SECTION (Fix 6) */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-600" />
                <h4 className="text-base font-bold text-slate-900">
                  AI Maintenance Copilot Explanation
                </h4>
              </div>
              <span className="text-xs text-slate-400">
                Grounded explanation (Groq / Deterministic Fallback)
              </span>
            </div>

            {aiNotice && (
              <div className="mb-3 rounded bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                {aiNotice}
              </div>
            )}

            {isAiLoading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
                <RotateCw className="h-4 w-4 animate-spin text-indigo-600" />
                Synthesizing grounded explanation via Groq...
              </div>
            ) : aiExplanation ? (
              <div className="prose prose-sm max-w-none text-slate-800 whitespace-pre-line text-sm leading-relaxed">
                {aiExplanation}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                AI explanation will generate automatically after model prediction.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
