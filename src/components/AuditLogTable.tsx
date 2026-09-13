import React from "react";
import { AuditLogItem } from "../types";
import { ClipboardList, Download, Trash2, ShieldAlert } from "lucide-react";

interface AuditLogTableProps {
  logs: AuditLogItem[];
  onClearLogs: () => void;
}

export const AuditLogTable: React.FC<AuditLogTableProps> = ({ logs, onClearLogs }) => {
  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = "Timestamp,Asset_ID,Error_ID,Failure_Mode,Decision,Net_Avoided_Loss,Safety_Override\n";
    const rows = logs
      .map(
        (l) =>
          `"${l.timestamp}","${l.machine_id}","${l.error_id}","${l.failure_mode}","${l.decision}",${l.net_avoided_loss},${l.safety_override}`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `maintenance_decision_audit_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300">
            <ClipboardList className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Decision Audit & Shift Handover Trail
            </h3>
            <p className="text-xs text-slate-400">
              Immutable session log tracking maintenance gatekeeper approvals and safety compliance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            Export CSV
          </button>
          <button
            onClick={onClearLogs}
            disabled={logs.length === 0}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-400 text-xs transition-colors disabled:opacity-50"
            title="Clear current session log"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-mono text-[11px] border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3">Timestamp</th>
              <th className="py-2.5 px-3">Asset</th>
              <th className="py-2.5 px-3">Error Code</th>
              <th className="py-2.5 px-3">Decision</th>
              <th className="py-2.5 px-3 text-right">Net Avoided Loss</th>
              <th className="py-2.5 px-3 text-center">Safety Lockout</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-900/40">
                <td className="py-2.5 px-3 text-slate-400">{log.timestamp}</td>
                <td className="py-2.5 px-3 font-semibold text-slate-200">{log.machine_id}</td>
                <td className="py-2.5 px-3 text-cyan-400">{log.error_id}</td>
                <td className="py-2.5 px-3 font-sans text-slate-200">{log.decision}</td>
                <td
                  className={`py-2.5 px-3 text-right font-semibold ${
                    log.net_avoided_loss > 0
                      ? "text-emerald-400"
                      : log.net_avoided_loss < 0
                      ? "text-red-400"
                      : "text-slate-400"
                  }`}
                >
                  {log.net_avoided_loss !== 0
                    ? `PKR ${log.net_avoided_loss.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                    : "—"}
                </td>
                <td className="py-2.5 px-3 text-center font-sans">
                  {log.safety_override ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800">
                      <ShieldAlert className="w-3 h-3" /> Enforced
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-sans">Standard</span>
                  )}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-500 font-sans">
                  No decisions recorded yet in this shift.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
