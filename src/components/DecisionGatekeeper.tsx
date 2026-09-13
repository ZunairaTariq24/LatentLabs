import React from "react";
import { DecisionPackage } from "../types";
import {
  ShieldAlert,
  Clock,
  Wrench,
  AlertOctagon,
  CheckCircle,
  TrendingDown,
  Lock,
} from "lucide-react";

interface DecisionGatekeeperProps {
  decision: DecisionPackage;
  onAcceptOptionA: () => void;
  onDeferOptionB: () => void;
}

export const DecisionGatekeeper: React.FC<DecisionGatekeeperProps> = ({
  decision,
  onAcceptOptionA,
  onDeferOptionB,
}) => {
  const { option_a, option_b, safety_override, net_avoided_loss } = decision;

  return (
    <div className="space-y-5">
      {/* Safety Override Alert Banner */}
      {safety_override && (
        <div className="bg-red-950/80 border-2 border-red-600 rounded-xl p-4 text-red-100 flex items-start gap-3 shadow-lg shadow-red-950/50">
          <ShieldAlert className="w-6 h-6 text-red-400 shrink-0 mt-0.5 animate-pulse" />
          <div>
            <h4 className="font-bold text-red-200 text-sm uppercase tracking-wide">
              Mandatory Safety Override Enforced — Statutory Lockout Active
            </h4>
            <p className="text-xs text-red-300 mt-1 leading-relaxed">
              Operating with compromised machine safeguarding, optical interlocks, or emergency circuits
              violates legal safety regulations. Economic deferral is strictly prohibited. Immediate
              preventative shutdown is required. Option B has been permanently locked out.
            </p>
          </div>
        </div>
      )}

      {/* Side-by-Side Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* OPTION A: INTERVENE NOW */}
        <div className="bg-emerald-950/30 border-2 border-emerald-600/80 rounded-2xl p-5 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-emerald-800/60 mb-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-900/60 text-emerald-400 border border-emerald-700/60">
                <Wrench className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-emerald-300 uppercase tracking-wider">
                  Option A: Intervene Now
                </h3>
                <span className="text-[11px] text-emerald-400/80">Proactive Controlled Stop</span>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-900/80 text-emerald-200 border border-emerald-700">
              {option_a.planned_downtime_min} MIN DOWNTIME
            </span>
          </div>

          <div className="space-y-2.5 text-xs text-slate-300">
            <div className="flex items-center justify-between py-1 border-b border-emerald-900/40">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                Planned Production Downtime Loss ({option_a.planned_downtime_min} min):
              </span>
              <span className="font-mono font-medium text-slate-100">
                PKR {option_a.production_loss.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-emerald-900/40">
              <span className="text-slate-400">Consumable / Wear Part Replacement:</span>
              <span className="font-mono font-medium text-slate-100">
                PKR {option_a.parts.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-emerald-900/40">
              <span className="text-slate-400">Scheduled In-House Labor (Standard Shift):</span>
              <span className="font-mono font-medium text-slate-100">
                PKR {option_a.labor.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-emerald-700/80 flex items-baseline justify-between">
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
              Total Planned Intervention:
            </span>
            <span className="text-xl font-mono font-bold text-emerald-400">
              PKR {option_a.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* OPTION B: RUN TO FAILURE */}
        <div
          className={`rounded-2xl p-5 shadow-xl relative overflow-hidden transition-all ${
            safety_override
              ? "bg-red-950/20 border-2 border-red-800/40 opacity-75"
              : "bg-red-950/30 border-2 border-red-600/80"
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-red-800/60 mb-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-red-900/60 text-red-400 border border-red-700/60">
                <AlertOctagon className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-red-300 uppercase tracking-wider">
                  Option B: Run to Failure
                </h3>
                <span className="text-[11px] text-red-400/80">Unplanned Breakdown Exposure</span>
              </div>
            </div>
            {safety_override ? (
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-red-900/90 text-red-200 border border-red-700 flex items-center gap-1">
                <Lock className="w-3 h-3" /> LOCKED OUT
              </span>
            ) : (
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-red-900/80 text-red-200 border border-red-700">
                {option_b.unplanned_downtime_min} MIN DOWNTIME
              </span>
            )}
          </div>

          {safety_override ? (
            <div className="py-6 text-center space-y-3">
              <Lock className="w-8 h-8 text-red-400 mx-auto opacity-70" />
              <p className="text-xs text-red-300 font-medium px-4">
                Financial deferral calculation is prohibited by statutory industrial safety codes.
                Operating compromised equipment risks catastrophic injury.
              </p>
              <div className="text-lg font-mono font-bold text-red-400">STATUS: PROHIBITED</div>
            </div>
          ) : (
            <>
              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="flex items-center justify-between py-1 border-b border-red-900/40">
                  <span className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-3 h-3 text-red-400" />
                    Lost Production ({option_b.unplanned_downtime_min} min):
                  </span>
                  <span className="font-mono font-medium text-slate-100">
                    PKR {option_b.production_loss.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-red-900/40">
                  <span className="text-slate-400">Complete Assembly Replacement:</span>
                  <span className="font-mono font-medium text-slate-100">
                    PKR {option_b.replacement.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-red-900/40">
                  <span className="text-slate-400">Express Air Freight Premium:</span>
                  <span className="font-mono font-medium text-slate-100">
                    PKR {option_b.freight.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-red-900/40">
                  <span className="text-slate-400">Downstream Idle Operator Wage:</span>
                  <span className="font-mono font-medium text-slate-100">
                    PKR {option_b.idle_labor.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-red-900/40">
                  <span className="text-slate-400">Emergency Technician Callout:</span>
                  <span className="font-mono font-medium text-slate-100">
                    PKR {option_b.emergency_tech.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-red-900/40">
                  <span className="text-slate-400">Scrap Material & Workpiece Waste:</span>
                  <span className="font-mono font-medium text-slate-100">
                    PKR {option_b.scrap.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-red-700/80 flex items-baseline justify-between">
                <span className="text-xs font-bold text-red-300 uppercase tracking-wider">
                  Total Breakdown Exposure:
                </span>
                <span className="text-xl font-mono font-bold text-red-400">
                  PKR {option_b.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Net Avoided Loss Highlight Banner */}
      <div className="rounded-xl p-4 bg-slate-900 border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
        {safety_override ? (
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-red-950 text-red-400 border border-red-800">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <div>
              <span className="text-xs text-slate-400 block uppercase tracking-wider font-semibold">
                Decision Recommendation
              </span>
              <span className="text-sm font-bold text-red-400">
                MANDATORY SAFETY SHUTDOWN REQUIRED — ZERO ECONOMIC DEFERRAL PERMITTED
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800">
              <TrendingDown className="w-5 h-5" />
            </span>
            <div>
              <span className="text-xs text-slate-400 block uppercase tracking-wider font-semibold">
                Net Capital Losses Avoided by Intervening Now (Option B − Option A)
              </span>
              <span className="text-2xl font-mono font-extrabold text-emerald-400">
                +PKR {(net_avoided_loss ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            id="btn-accept-option-a"
            onClick={onAcceptOptionA}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-950/40 hover:scale-[1.02] active:scale-[0.98]"
          >
            <CheckCircle className="w-4 h-4" />
            Accept Option A: Stop Machine Now
          </button>

          {safety_override ? (
            <button
              id="btn-defer-locked-out"
              disabled
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/60 text-slate-500 font-semibold text-xs uppercase tracking-wider cursor-not-allowed border border-slate-700/50"
              title="Economic deferral is legally locked out due to safety regulations."
            >
              <Lock className="w-3.5 h-3.5" />
              Defer Locked Out
            </button>
          ) : (
            <button
              id="btn-defer-option-b"
              onClick={onDeferOptionB}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold text-xs uppercase tracking-wider transition-all border border-slate-700 hover:border-amber-600/60"
            >
              Defer: Continue Running
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
