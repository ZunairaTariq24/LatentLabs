"""
Production Downtime & Maintenance Decision Intelligence
Module: calculator.py
Description: Pure, deterministic financial calculation engine.
CRITICAL MANDATE: No LLM arithmetic. Calculations are completely auditable
and handled strictly through verified deterministic Python functions.
"""

from typing import Dict, Any, Optional


def calculate_option_a(
    planned_downtime_min: float,
    line_loss_rate: float,
    planned_part_cost: float,
    planned_labor_cost: float,
) -> Dict[str, float]:
    """
    OPTION A: Intervene Now
    Formula:
      Production Loss = (Planned Downtime (min) / 60) * Line Loss Rate
      Total Cost = Production Loss + Consumable/Wear Part Cost + Technician Labor Cost
    """
    production_loss = (float(planned_downtime_min) / 60.0) * float(line_loss_rate)
    total = production_loss + float(planned_part_cost) + float(planned_labor_cost)

    return {
        "planned_downtime_min": float(planned_downtime_min),
        "production_loss": round(production_loss, 2),
        "parts": round(float(planned_part_cost), 2),
        "labor": round(float(planned_labor_cost), 2),
        "total": round(total, 2),
    }


def calculate_option_b(
    unplanned_downtime_min: float,
    line_loss_rate: float,
    replacement_cost: float,
    freight_cost: float,
    idle_labor_cost: float,
    emergency_tech_cost: float,
    scrap_cost: float,
) -> Dict[str, float]:
    """
    OPTION B: Run to Failure / Repair Later
    Formula:
      Production Loss = (Unplanned Downtime (min) / 60) * Line Loss Rate
      Total Cost = Production Loss + Emergency Tech Labor + Idle Operator Cost +
                   Assembly Replacement + Express Freight + Scrap Waste
    """
    production_loss = (float(unplanned_downtime_min) / 60.0) * float(line_loss_rate)
    total = (
        production_loss
        + float(replacement_cost)
        + float(freight_cost)
        + float(idle_labor_cost)
        + float(emergency_tech_cost)
        + float(scrap_cost)
    )

    return {
        "unplanned_downtime_min": float(unplanned_downtime_min),
        "production_loss": round(production_loss, 2),
        "replacement": round(float(replacement_cost), 2),
        "freight": round(float(freight_cost), 2),
        "idle_labor": round(float(idle_labor_cost), 2),
        "emergency_tech": round(float(emergency_tech_cost), 2),
        "scrap": round(float(scrap_cost), 2),
        "total": round(total, 2),
    }


def calculate_net_avoided_loss(
    option_a_total: float,
    option_b_total: float,
    safety_override: bool = False,
) -> Optional[float]:
    """
    NET AVOIDED LOSS
    Formula: Option B Total - Option A Total
    Note: If safety_override is True, economic deferral is legally prohibited.
    """
    if safety_override:
        return None
    return round(float(option_b_total) - float(option_a_total), 2)


def evaluate_maintenance_case(record: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluates an entire maintenance scenario record deterministically.
    Returns structured decision object.
    """
    safety_override = str(record.get("safety_override", "")).strip().lower() in ("true", "1", "yes")

    line_loss_rate = float(record["line_loss_rate"])
    opt_a = calculate_option_a(
        planned_downtime_min=float(record["planned_downtime_min"]),
        line_loss_rate=line_loss_rate,
        planned_part_cost=float(record["planned_part_cost"]),
        planned_labor_cost=float(record["planned_labor_cost"]),
    )

    if safety_override:
        opt_b = {
            "unplanned_downtime_min": 0.0,
            "production_loss": 0.0,
            "replacement": 0.0,
            "freight": 0.0,
            "idle_labor": 0.0,
            "emergency_tech": 0.0,
            "scrap": 0.0,
            "total": 0.0,
            "locked_out": True,
            "lockout_reason": "MANDATORY SAFETY OVERRIDE: Economic deferral prohibited by safety statutory codes.",
        }
        net_avoided = None
    else:
        opt_b = calculate_option_b(
            unplanned_downtime_min=float(record["unplanned_downtime_min"]),
            line_loss_rate=line_loss_rate,
            replacement_cost=float(record["replacement_cost"]),
            freight_cost=float(record["freight_cost"]),
            idle_labor_cost=float(record["idle_labor_cost"]),
            emergency_tech_cost=float(record["emergency_tech_cost"]),
            scrap_cost=float(record["scrap_cost"]),
        )
        opt_b["locked_out"] = False
        net_avoided = calculate_net_avoided_loss(opt_a["total"], opt_b["total"], safety_override=False)

    return {
        "machine_id": record["machine_id"],
        "machine_name": record["machine_name"],
        "stage": record.get("stage", ""),
        "operator": record.get("operator", ""),
        "capacity_per_hour": record.get("capacity_per_hour", 0),
        "error_id": record["error_id"],
        "failure_mode": record["failure_mode"],
        "category": record.get("category", ""),
        "symptom": record["symptom"],
        "line_loss_rate": line_loss_rate,
        "option_a": opt_a,
        "option_b": opt_b,
        "option_a_total": opt_a["total"],
        "option_b_total": opt_b["total"] if not safety_override else 0.0,
        "net_avoided_loss": net_avoided,
        "safety_override": safety_override,
    }
