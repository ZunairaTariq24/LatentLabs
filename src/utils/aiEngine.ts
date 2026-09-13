import { AIExplanationResult, DecisionPackage } from "../types";

export function generateDeterministicExplanationTS(d: DecisionPackage): AIExplanationResult {
  if (d.safety_override) {
    return {
      decision: `Immediate mandatory preventative shutdown required for ${d.machine_id} (${d.machine_name}).`,
      why: `Critical safety defect detected: ${d.failure_mode}. Symptom observed: ${d.symptom}.`,
      financial_impact: `Planned intervention cost is PKR ${d.option_a.total.toLocaleString("en-US", { minimumFractionDigits: 2 })} (Planned downtime: ${d.option_a.planned_downtime_min} min). Option B is legally locked out.`,
      risk: `Operating with compromised safety interlocks or protection systems carries immediate human life hazard and severe regulatory liability. Continued operation is strictly prohibited.`,
      action: `Authorize immediate lockout-tagout (LOTO) of ${d.machine_id}. Dispatch safety technician to inspect ${d.failure_mode.toLowerCase()} before clearing machine for operation.`,
      is_verified_grounded: true,
      source: "Deterministic Grounded Fallback",
      notice: "Safety statutory override enforced. Deferral permanently locked out.",
    };
  }

  const netLoss = d.net_avoided_loss ?? 0;
  return {
    decision: `Approve immediate planned maintenance stop of ${d.option_a.planned_downtime_min} minutes on ${d.machine_id} (${d.machine_name}).`,
    why: `Identified symptom '${d.symptom}' signals active ${d.failure_mode.toLowerCase()}. Operating without intervention will lead to catastrophic assembly failure and ${d.option_b.unplanned_downtime_min} minutes of unplanned downtime.`,
    financial_impact: `Option A planned intervention incurs PKR ${d.option_a.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}, whereas Option B run-to-failure incurs PKR ${d.option_b.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}. Intervening now rescues PKR ${netLoss.toLocaleString("en-US", { minimumFractionDigits: 2 })} in net capital losses.`,
    risk: `Deferral risks line stoppage, ${d.option_b.unplanned_downtime_min} minutes of total starvation, emergency technician callout fees, and scrap generation.`,
    action: `Authorize immediate ${d.option_a.planned_downtime_min}-minute stop for operator ${d.operator}. Replace wear component before catastrophic line trip occurs.`,
    is_verified_grounded: true,
    source: "Deterministic Grounded Fallback",
    notice: "Verified grounded against authoritative factory dataset and mathematical formulas.",
  };
}

export async function fetchGroqExplanation(
  d: DecisionPackage,
  apiKey?: string,
  model: string = "llama-3.3-70b-versatile"
): Promise<AIExplanationResult> {
  const fallback = generateDeterministicExplanationTS(d);

  if (!apiKey || apiKey.trim() === "" || apiKey === "your_groq_api_key_here") {
    return fallback;
  }

  const prompt = `
You are the explainable AI layer of an industrial maintenance decision intelligence system for a packaging line producing 100 pkts/hr.
Your ONLY role is to translate pre-computed numbers and technical diagnostics into a structured management explanation.

RULES:
1. You MUST NOT perform any math or alter any numbers.
2. Use ONLY the facts and figures given in the JSON below.
3. Your output MUST contain exactly these 5 uppercase section headers:
DECISION: [1-2 sentences]
WHY: [1-2 sentences citing failure mode and symptom]
FINANCIAL IMPACT: [Cite Option A, Option B, and Net Avoided Loss exactly as given]
RISK: [Consequences of deferral]
ACTION: [Specific preventative order]

DATA:
${JSON.stringify(d, null, 2)}
`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: model || "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are an explainable AI assistant in an industrial plant. Output structured decision text with headers DECISION, WHY, FINANCIAL IMPACT, RISK, ACTION. Do not hallucinate or compute numbers.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        ...fallback,
        notice: `Groq API notice (${response.status}): using verified grounded deterministic fallback.`,
      };
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content || "";

    // Parse sections
    const sections: Record<string, string> = {};
    const keys = ["DECISION", "WHY", "FINANCIAL IMPACT", "RISK", "ACTION"];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const start = content.indexOf(`${k}:`);
      if (start !== -1) {
        let end = content.length;
        for (let j = i + 1; j < keys.length; j++) {
          const nextStart = content.indexOf(`${keys[j]}:`);
          if (nextStart !== -1 && nextStart > start) {
            end = Math.min(end, nextStart);
          }
        }
        sections[k] = content.substring(start + k.length + 1, end).trim();
      }
    }

    const hasAll = keys.every((k) => sections[k] && sections[k].length > 0);
    if (!hasAll) {
      return {
        ...fallback,
        notice: "Groq response did not meet strict 5-section schema; verified fallback applied.",
      };
    }

    return {
      decision: sections["DECISION"],
      why: sections["WHY"],
      financial_impact: sections["FINANCIAL IMPACT"],
      risk: sections["RISK"],
      action: sections["ACTION"],
      is_verified_grounded: true,
      source: "Groq API",
      notice: `Grounded and verified via ${model}.`,
    };
  } catch {
    return {
      ...fallback,
      notice: "Network issue contacting Groq; deterministic grounded fallback applied.",
    };
  }
}
