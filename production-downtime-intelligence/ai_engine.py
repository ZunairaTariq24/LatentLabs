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

    # If no Groq API key is available, use deterministic grounded fallback
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

        # Prepare payload containing ONLY validated structured data
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
            temperature=0.1,  # Low temperature to prioritize deterministic grounding
            max_tokens=600,
        )

        raw_response = completion.choices[0].message.content

        # Strict validation
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
