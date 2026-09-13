"""
Production Downtime & Maintenance Decision Intelligence
Module: services/decision_engine.py
Description: Deterministic decision engine mapping ML failure probability to risk levels and maintenance recommendations.
CRITICAL MANDATE:
Zero LLM interference in risk classification or maintenance decisions.
All decisions are 100% deterministic based on authoritative mathematical thresholds.
"""

from typing import Dict, Any

# Authoritative Risk Thresholds
LOW_RISK_THRESHOLD = 0.20
DECISION_THRESHOLD = 0.40


def evaluate_maintenance_decision(probability: float) -> Dict[str, Any]:
    """
    Deterministically maps failure probability to risk level, decision, and recommendation.

    Threshold Rules:
    - probability < 0.20: LOW RISK -> RUN NORMALLY
    - 0.20 <= probability < 0.40: MEDIUM RISK -> MONITOR
    - probability >= 0.40: HIGH RISK -> MAINTENANCE RECOMMENDED

    Returns structured dict with risk level, decision, recommendation, and display styling.
    """
    if not isinstance(probability, (int, float)):
        raise TypeError(f"Failure probability must be a float or int, got {type(probability).__name__}")

    prob_float = float(probability)
    if not (0.0 <= prob_float <= 1.0):
        raise ValueError(f"Failure probability must be between 0.0 and 1.0, got {prob_float}")

    if prob_float < LOW_RISK_THRESHOLD:
        risk_level = "LOW"
        risk_display = "LOW RISK"
        decision = "RUN NORMALLY"
        priority = "P3"
        priority_label = "P3 - Routine"
        recommendation = "Continue normal production and routine monitoring."
        status_color = "#10b981"  # Emerald green
        badge_variant = "low"
    elif prob_float < DECISION_THRESHOLD:
        risk_level = "MEDIUM"
        risk_display = "MEDIUM RISK"
        decision = "MONITOR"
        priority = "P2"
        priority_label = "P2 - Scheduled"
        recommendation = "Continue production with increased monitoring and schedule a maintenance inspection."
        status_color = "#f59e0b"  # Amber
        badge_variant = "medium"
    else:
        risk_level = "HIGH"
        risk_display = "HIGH RISK"
        decision = "MAINTENANCE RECOMMENDED"
        priority = "P1"
        priority_label = "P1 - Urgent"
        recommendation = "Inspect the machine before prolonged production and prioritize maintenance."
        status_color = "#ef4444"  # Red
        badge_variant = "high"

    return {
        "probability": prob_float,
        "probability_pct": round(prob_float * 100.0, 1),
        "formatted_probability": f"{prob_float * 100.0:.1f}%",
        "risk_level": risk_level,
        "risk_display": risk_display,
        "decision": decision,
        "priority": priority,
        "priority_label": priority_label,
        "recommendation": recommendation,
        "status_color": status_color,
        "badge_variant": badge_variant,
        "threshold": DECISION_THRESHOLD,
        "low_risk_threshold": LOW_RISK_THRESHOLD,
        "decision_threshold": DECISION_THRESHOLD,
    }
