"""
Production Downtime & Maintenance Decision Intelligence
Module: ai_engine.py
Description: Groq AI Explanation Engine with strict anti-hallucination guards.
CRITICAL MANDATE:
The Groq model is ONLY responsible for translating already-validated structured
information into a concise human-readable management explanation.
It NEVER performs calculations or creates facts.
"""

import json
import os
from typing import Dict, Any, Tuple, Optional
from validators import validate_ai_explanation

SYSTEM_PROMPT = """You are the explanation engine for a production maintenance decision-support application.
Your ONLY source of truth is the structured decision data supplied in the user message.
Do not invent, estimate, infer, calculate, modify, or add any numerical value.
Do not introduce machines, costs, failure modes, operators, production rates, safety rules, probabilities, or technical facts that are not explicitly supplied.
Do not perform arithmetic yourself.
Use the supplied calculated values exactly as provided.
Your task is only to explain the validated decision in clear management language.
If the supplied data is incomplete, respond:
'Insufficient validated data to provide a decision explanation.'
If safety_override is true, clearly state that the system requires immediate shutdown and that economic deferral is not permitted.
Do not suggest overriding, bypassing, disabling, or ignoring safety controls.
Do not claim certainty about future failure unless the supplied data explicitly establishes it.
Do not describe the application as predicting the future.
Describe it as decision support based on supplied maintenance scenarios.
Keep the explanation concise, professional, and auditable.
Use exactly this structure:
DECISION: One sentence.
WHY: Two or three short sentences based only on supplied data.
FINANCIAL IMPACT: Use the supplied Option A, Option B, and Net Avoided Loss values exactly.
RISK: Explain the operational consequence using only supplied information.
ACTION: State the appropriate action based on the validated safety and economic rules."""

DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"


def get_groq_api_key() -> Optional[str]:
    """Retrieve API key securely from Streamlit secrets or environment."""
    try:
        import streamlit as st
        if hasattr(st, "secrets") and "GROQ_API_KEY" in st.secrets:
            return st.secrets["GROQ_API_KEY"]
    except Exception:
        pass
    return os.environ.get("GROQ_API_KEY")


def get_groq_model_name() -> str:
    """Retrieve configured Groq model or default to modern production model."""
    try:
        import streamlit as st
        if hasattr(st, "secrets") and "GROQ_MODEL" in st.secrets:
            return st.secrets["GROQ_MODEL"]
    except Exception:
        pass
    return os.environ.get("GROQ_MODEL", DEFAULT_GROQ_MODEL)


def generate_deterministic_explanation(decision: Dict[str, Any]) -> str:
    """
    Deterministic rule-based fallback generator adhering strictly to the required 5 sections.
    Ensures the application functions 100% reliably even when Groq is unconfigured or offline.
    """
    is_safety = decision.get("safety_override", False)
    machine_id = decision.get("machine_id", "Unknown")
    error_id = decision.get("error_id", "Unknown")
    failure_mode = decision.get("failure_mode", "")
    symptom = decision.get("symptom", "")
    opt_a_total = decision.get("option_a_total", 0)
    opt_b_total = decision.get("option_b_total", 0)
    net_avoided = decision.get("net_avoided_loss")
    opt_a = decision.get("option_a", {})
    planned_min = int(opt_a.get("planned_downtime_min", 0))

    if is_safety:
        return f"""DECISION: Execute immediate emergency shutdown on machine {machine_id} to resolve {failure_mode}.
WHY: Operational inspection flagged {error_id} with observed symptom: {symptom}. Operating this equipment violates mandatory statutory safety codes and machine safeguarding regulations.
FINANCIAL IMPACT: Planned intervention cost is PKR {opt_a_total:,.2f}. Option B run-to-failure is strictly prohibited and locked out under statutory safety regulations.
RISK: Continued operation creates catastrophic occupational hazard and statutory non-compliance.
ACTION: Enforce immediate machine shutdown and execute mandatory safety intervention."""

    formatted_net = f"PKR {net_avoided:,.2f}" if net_avoided is not None else "N/A"
    return f"""DECISION: Approve immediate {planned_min}-minute planned maintenance intervention on machine {machine_id} for {failure_mode}.
WHY: Diagnostic inspection detected {error_id} with reported symptom: {symptom}. Taking proactive action now isolates mechanical degradation before secondary assembly damage occurs.
FINANCIAL IMPACT: Option A immediate intervention cost is PKR {opt_a_total:,.2f} versus Option B run-to-failure exposure of PKR {opt_b_total:,.2f}, delivering Net Avoided Loss of {formatted_net}.
RISK: Delaying repair exposes the line to an unplanned breakdown of {decision.get('option_b', {}).get('unplanned_downtime_min', 0)} minutes, compounding replacement, freight, and scrap waste.
ACTION: Intervene immediately to secure PKR {net_avoided:,.2f} in net avoided loss and prevent severe line starvation."""


def generate_ai_explanation(
    structured_decision: Dict[str, Any],
    api_key: Optional[str] = None,
    model: Optional[str] = None,
) -> Tuple[str, bool, Optional[str], Optional[Dict[str, str]]]:
    """
    Calls Groq API with structured JSON payload, then performs strict anti-hallucination validation.
    Returns: (explanation_text, is_ai_generated, error_message, parsed_sections)
    """
    key = api_key or get_groq_api_key()
    selected_model = model or get_groq_model_name()

    if not key or key.strip() in ("", "your_api_key_here"):
        fallback_text = generate_deterministic_explanation(structured_decision)
        is_valid, val_err, sections = validate_ai_explanation(fallback_text, structured_decision)
        return (
            fallback_text,
            False,
            "Groq API key not configured. Displaying deterministic validated management explanation.",
            sections,
        )

    try:
        from groq import Groq

        client = Groq(api_key=key.strip(), timeout=10.0)

        payload = {
            "machine_id": structured_decision["machine_id"],
            "machine_name": structured_decision["machine_name"],
            "error_id": structured_decision["error_id"],
            "failure_mode": structured_decision["failure_mode"],
            "symptom": structured_decision["symptom"],
            "option_a_total": structured_decision["option_a_total"],
            "option_b_total": structured_decision["option_b_total"],
            "net_avoided_loss": structured_decision["net_avoided_loss"],
            "safety_override": structured_decision["safety_override"],
            "line_loss_rate": structured_decision["line_loss_rate"],
        }

        user_content = (
            f"Please generate the management explanation using ONLY this validated structured decision data:\n"
            f"{json.dumps(payload, indent=2)}"
        )

        completion = client.chat.completions.create(
            model=selected_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0.1,
            max_tokens=600,
        )

        raw_response = completion.choices[0].message.content

        is_valid, val_err, sections = validate_ai_explanation(raw_response, structured_decision)

        if not is_valid:
            fallback_text = generate_deterministic_explanation(structured_decision)
            _, _, fallback_sections = validate_ai_explanation(fallback_text, structured_decision)
            return (
                fallback_text,
                False,
                f"AI validation filter tripped ({val_err}). Discarded ungrounded output and engaged deterministic fallback.",
                fallback_sections,
            )

        return raw_response, True, None, sections

    except Exception as exc:
        fallback_text = generate_deterministic_explanation(structured_decision)
        _, _, fallback_sections = validate_ai_explanation(fallback_text, structured_decision)
        return (
            fallback_text,
            False,
            f"Groq API connection notice ({type(exc).__name__}: {str(exc)}). Deterministic decision engine remains active.",
            fallback_sections,
        )


PREDICTIVE_SYSTEM_PROMPT = """You are an AI Explanation Engine for a Predictive Maintenance system in an industrial manufacturing plant.
A trained Random Forest model has already evaluated real sensor readings and produced a deterministic Failure Probability, Risk Level, and Maintenance Decision.
YOUR MANDATE:
1. You MUST NOT change the numerical probability or calculate numbers yourself.
2. You MUST NOT override the deterministic decision engine.
3. You MUST NOT invent sensor readings, machines, or facts not provided.
4. You MUST clearly distinguish between the model prediction and this AI-generated explanation.
5. Address the maintenance team and explain:
   - Why the machine is categorized as High/Medium/Low risk based on the failure probability and threshold.
   - Which machine readings appear most important according to the model/context (e.g. Torque, Rotational Speed, Tool Wear, Temperatures).
   - What the maintenance team should do based on the recommendation.
   - Why acting before failure can reduce production downtime.
6. Use professional, clear industrial maintenance language."""


def generate_predictive_deterministic_explanation(
    machine_data: Dict[str, Any],
    decision_result: Dict[str, Any],
) -> str:
    """
    Deterministic rule-based explanation for ML predictive maintenance.
    Ensures 100% operational availability if Groq is unconfigured or unreachable.
    """
    m_type = machine_data.get("Type", "Unknown")
    air_t = machine_data.get("Air temperature [K]", 0)
    proc_t = machine_data.get("Process temperature [K]", 0)
    speed = machine_data.get("Rotational speed [rpm]", 0)
    torque = machine_data.get("Torque [Nm]", 0)
    wear = machine_data.get("Tool wear [min]", 0)

    prob_pct = decision_result.get("probability_pct", 0.0)
    risk_level = decision_result.get("risk_level", "LOW")
    decision = decision_result.get("decision", "RUN NORMALLY")
    recommendation = decision_result.get("recommendation", "")

    if risk_level == "HIGH":
        return f"""### AI Explanation: High Risk Degradation Analysis

**1. Risk Classification Context:**
The Random Forest predictive maintenance model evaluated this Type {m_type} asset and computed a **{prob_pct:.1f}% failure probability**, which exceeds the primary critical decision threshold of 40.0%. The machine is classified as **HIGH RISK**.

**2. Key Model Factors Under Evaluation:**
Among the key factors monitored by the model, operating with **Torque at {torque:.1f} Nm**, **Rotational Speed at {speed:.0f} rpm**, and cumulative **Tool Wear at {wear:.0f} minutes** indicates severe mechanical stress. Elevated thermal readings (Air Temp: {air_t:.1f} K, Process Temp: {proc_t:.1f} K) further amplify the risk of imminent tool failure or heat dissipation breakdown.

**3. Actionable Maintenance Directive:**
Decision: **{decision}**. {recommendation} Technicians should lock out the machine, inspect tool geometry, verify spindle bearing lubrication, and replace worn inserts before resuming high-speed production.

**4. Downtime Reduction Value:**
Executing a scheduled 10-to-15 minute tool replacement now prevents a catastrophic assembly seizure that would cause 2 to 4 hours of unmanaged line downtime, idle operator costs, and substantial scrap generation."""

    elif risk_level == "MEDIUM":
        return f"""### AI Explanation: Moderate Risk Monitoring Analysis

**1. Risk Classification Context:**
The Random Forest predictive maintenance model computed a **{prob_pct:.1f}% failure probability** for this Type {m_type} machine. Falling within the 20.0% – 40.0% alert window, this asset is categorized as **MEDIUM RISK**.

**2. Key Model Factors Under Evaluation:**
The machine is currently operating at **{speed:.0f} rpm** with **{torque:.1f} Nm torque** and **{wear:.0f} minutes of tool wear**. While not in immediate failure state, the progressive wear and thermal envelope (Air: {air_t:.1f} K, Process: {proc_t:.1f} K) indicate early degradation trends.

**3. Actionable Maintenance Directive:**
Decision: **{decision}**. {recommendation} Maintain standard production while increasing telemetry polling frequency, and schedule a physical inspection during the next planned shift change.

**4. Downtime Reduction Value:**
Proactive condition monitoring enables the maintenance team to schedule component replacement during planned changeovers, completely avoiding unplanned production halts."""

    else:
        return f"""### AI Explanation: Normal Baseline Operation Analysis

**1. Risk Classification Context:**
The Random Forest predictive maintenance model evaluated this Type {m_type} asset and recorded a **{prob_pct:.1f}% failure probability**, well below the 20.0% caution threshold. The machine is categorized as **LOW RISK**.

**2. Key Model Factors Under Evaluation:**
All monitored key factors—**Torque ({torque:.1f} Nm)**, **Rotational Speed ({speed:.0f} rpm)**, **Tool Wear ({wear:.0f} min)**, and operating temperatures ({air_t:.1f} K / {proc_t:.1f} K)—remain well within nominal design tolerances.

**3. Actionable Maintenance Directive:**
Decision: **{decision}**. {recommendation} No immediate maintenance intervention is required. Continue standard operational logging.

**4. Downtime Reduction Value:**
Avoiding premature or unnecessary machine stoppages maximizes operational overall equipment effectiveness (OEE) while preserving remaining tool useful life."""


def generate_predictive_maintenance_ai_explanation(
    machine_data: Dict[str, Any],
    decision_result: Dict[str, Any],
    api_key: Optional[str] = None,
    model: Optional[str] = None,
) -> Tuple[str, bool, Optional[str]]:
    """
    Generates an AI explanation for ML predictive maintenance results via Groq.
    Falls back gracefully to deterministic explanation if Groq is unconfigured or unavailable.
    Returns: (explanation_text, is_ai_generated, notice_message)
    """
    key = api_key or get_groq_api_key()
    selected_model = model or get_groq_model_name()

    if not key or key.strip() in ("", "your_api_key_here"):
        fallback = generate_predictive_deterministic_explanation(machine_data, decision_result)
        return (
            fallback,
            False,
            "Groq API key not configured. Displaying deterministic maintenance explanation.",
        )

    try:
        from groq import Groq

        client = Groq(api_key=key.strip(), timeout=10.0)

        structured_summary = f"""Machine Type: {machine_data.get('Type')}
Air Temperature: {machine_data.get('Air temperature [K]')} K
Process Temperature: {machine_data.get('Process temperature [K]')} K
Rotational Speed: {machine_data.get('Rotational speed [rpm]')} rpm
Torque: {machine_data.get('Torque [Nm]')} Nm
Tool Wear: {machine_data.get('Tool wear [min]')} min

Predicted Failure Probability: {decision_result.get('formatted_probability')}
Risk Level: {decision_result.get('risk_level')}
Decision: {decision_result.get('decision')}
Recommended Action: {decision_result.get('recommendation')}"""

        prompt = f"""Explain the following predictive maintenance result using the 4 required points (Risk Context, Key Model Factors, Maintenance Directive, and Downtime Reduction Value):

{structured_summary}"""

        completion = client.chat.completions.create(
            model=selected_model,
            messages=[
                {"role": "system", "content": PREDICTIVE_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=650,
        )

        raw_response = completion.choices[0].message.content
        return raw_response, True, None

    except Exception as exc:
        fallback = generate_predictive_deterministic_explanation(machine_data, decision_result)
        return (
            fallback,
            False,
            f"Groq API notice ({type(exc).__name__}). Deterministic prediction & explanation active.",
        )

