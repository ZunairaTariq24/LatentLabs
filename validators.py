"""
Production Downtime & Maintenance Decision Intelligence
Module: validators.py
Description: Strict validation engine for datasets, numerical calculations,
user inputs, and anti-hallucination verification of AI responses.
"""

import re
from typing import Dict, Any, List, Tuple, Optional

REQUIRED_COLUMNS = [
    "stage",
    "machine_id",
    "machine_name",
    "capacity_per_hour",
    "operator",
    "line_loss_rate",
    "error_id",
    "failure_mode",
    "category",
    "symptom",
    "planned_downtime_min",
    "planned_part_cost",
    "planned_labor_cost",
    "unplanned_downtime_min",
    "replacement_cost",
    "freight_cost",
    "idle_labor_cost",
    "emergency_tech_cost",
    "scrap_cost",
    "safety_override",
]

NUMERIC_COLUMNS = [
    "capacity_per_hour",
    "line_loss_rate",
    "planned_downtime_min",
    "planned_part_cost",
    "planned_labor_cost",
    "unplanned_downtime_min",
    "replacement_cost",
    "freight_cost",
    "idle_labor_cost",
    "emergency_tech_cost",
    "scrap_cost",
]

MANDATORY_SAFETY_ERRORS = {"M1-E04", "M2-E05", "M3-E05"}


def validate_dataset_schema(columns: List[str]) -> Tuple[bool, Optional[str]]:
    """Validates that all required columns are present in the dataset."""
    missing = [col for col in REQUIRED_COLUMNS if col not in columns]
    if missing:
        return False, f"Missing required columns in dataset: {', '.join(missing)}"
    return True, None


def validate_record_row(row: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """Validates data types and constraints for a single dataset row."""
    for col in NUMERIC_COLUMNS:
        if col not in row or row[col] is None or str(row[col]).strip() == "":
            return False, f"Missing numeric value for column '{col}' in error '{row.get('error_id')}'"
        try:
            val = float(row[col])
            if val < 0:
                return False, f"Negative value '{val}' not allowed for column '{col}'"
        except (ValueError, TypeError):
            return False, f"Invalid numeric format for column '{col}': {row[col]}"

    # Verify safety override flag consistency
    err_id = str(row.get("error_id", "")).strip()
    is_safety = str(row.get("safety_override", "")).strip().lower() in ("true", "1", "yes")
    if err_id in MANDATORY_SAFETY_ERRORS and not is_safety:
        return False, f"Error {err_id} is a statutory safety override but safety_override is False"

    return True, None


def validate_ai_explanation(
    ai_text: Optional[str],
    structured_decision: Dict[str, Any],
) -> Tuple[bool, Optional[str], Optional[Dict[str, str]]]:
    """
    Validates the AI explanation against strict anti-hallucination rules:
    1. Text exists and is non-empty.
    2. Contains all required sections: DECISION:, WHY:, FINANCIAL IMPACT:, RISK:, ACTION:.
    3. If safety_override is true, ensures action requires immediate shutdown and denies deferral.
    4. Extracts any dollar/PKR or bare financial numbers mentioned and verifies they
       correspond to the deterministic Python values.
    """
    if not ai_text or not isinstance(ai_text, str) or not ai_text.strip():
        return False, "AI response is empty or unavailable.", None

    text = ai_text.strip()

    # Check for required sections
    required_sections = ["DECISION:", "WHY:", "FINANCIAL IMPACT:", "RISK:", "ACTION:"]
    sections: Dict[str, str] = {}

    pattern = r"(DECISION|WHY|FINANCIAL IMPACT|RISK|ACTION):"
    splits = re.split(pattern, text)

    if len(splits) >= 11:
        current_sec = None
        for item in splits[1:]:
            item_strip = item.strip()
            if item_strip in ["DECISION", "WHY", "FINANCIAL IMPACT", "RISK", "ACTION"]:
                current_sec = item_strip
            elif current_sec:
                sections[current_sec] = item_strip
                current_sec = None

    missing_sections = [sec for sec in ["DECISION", "WHY", "FINANCIAL IMPACT", "RISK", "ACTION"] if sec not in sections]
    if missing_sections:
        return (
            False,
            f"AI explanation missing required sections: {', '.join(missing_sections)}. Fallback engaged.",
            None,
        )

    is_safety = structured_decision.get("safety_override", False)
    if is_safety:
        action_text = sections.get("ACTION", "").lower()
        if not ("shutdown" in action_text or "stop" in action_text or "immediate" in action_text):
            return False, "AI failed to enforce immediate shutdown on mandatory safety override.", None
        if "defer" in action_text and "not permitted" not in action_text and "prohibited" not in action_text:
            return False, "AI permitted or suggested deferral on mandatory safety override.", None

    valid_numbers = {
        int(round(structured_decision.get("option_a_total", 0))),
        int(round(structured_decision.get("option_b_total", 0))),
        int(round(structured_decision.get("line_loss_rate", 0))),
    }
    net_avoided = structured_decision.get("net_avoided_loss")
    if net_avoided is not None:
        valid_numbers.add(int(round(net_avoided)))

    opt_a = structured_decision.get("option_a", {})
    if isinstance(opt_a, dict):
        for k in ["production_loss", "parts", "labor"]:
            if k in opt_a:
                valid_numbers.add(int(round(opt_a[k])))

    opt_b = structured_decision.get("option_b", {})
    if isinstance(opt_b, dict):
        for k in ["production_loss", "replacement", "freight", "idle_labor", "emergency_tech", "scrap"]:
            if k in opt_b:
                valid_numbers.add(int(round(opt_b[k])))

    found_nums = re.findall(r"\b(\d{1,3}(?:,\d{3})+|\d{4,})\b", text)
    for num_str in found_nums:
        clean_num = int(num_str.replace(",", ""))
        if clean_num in (2026, 2025, 2024, 100, 50, 25):
            continue
        matched = any(abs(clean_num - vn) <= 1 for vn in valid_numbers)
        if not matched:
            return (
                False,
                f"AI text contains ungrounded figure '{clean_num}' not present in deterministic calculations.",
                None,
            )

    return True, None, sections
