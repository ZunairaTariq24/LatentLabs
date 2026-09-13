"""
Automated Verification Test Suite
Verifies all 15 operational scenarios from the specification document:
Production Downtime & Maintenance Decision Intelligence — Hackathon Research Edition
"""

import unittest
from data_loader import FactoryDataLoader
from calculator import evaluate_maintenance_case
from validators import validate_ai_explanation
from ai_engine import generate_deterministic_explanation

EXPECTED_BENCHMARKS = {
    "M1-E01": {"opt_a": 56500.0, "opt_b": 808000.0, "net": 751500.0, "safety": False},
    "M1-E02": {"opt_a": 36500.0, "opt_b": 622000.0, "net": 585500.0, "safety": False},
    "M1-E03": {"opt_a": 76000.0, "opt_b": 1229000.0, "net": 1153000.0, "safety": False},
    "M1-E04": {"opt_a": 37000.0, "opt_b": 0.0, "net": None, "safety": True},
    "M1-E05": {"opt_a": 98000.0, "opt_b": 1356000.0, "net": 1258000.0, "safety": False},
    "M2-E01": {"opt_a": 79000.0, "opt_b": 1519000.0, "net": 1440000.0, "safety": False},
    "M2-E02": {"opt_a": 47500.0, "opt_b": 777000.0, "net": 729500.0, "safety": False},
    "M2-E03": {"opt_a": 28000.0, "opt_b": 441800.0, "net": 413800.0, "safety": False},
    "M2-E04": {"opt_a": 30000.0, "opt_b": 781200.0, "net": 751200.0, "safety": False},
    "M2-E05": {"opt_a": 31500.0, "opt_b": 0.0, "net": None, "safety": True},
    "M3-E01": {"opt_a": 18750.0, "opt_b": 207500.0, "net": 188750.0, "safety": False},
    "M3-E02": {"opt_a": 14000.0, "opt_b": 224250.0, "net": 210250.0, "safety": False},
    "M3-E03": {"opt_a": 15500.0, "opt_b": 231300.0, "net": 215800.0, "safety": False},
    "M3-E04": {"opt_a": 16500.0, "opt_b": 259000.0, "net": 242500.0, "safety": False},
    "M3-E05": {"opt_a": 16000.0, "opt_b": 0.0, "net": None, "safety": True},
}


class TestMaintenanceDecisionIntelligence(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.loader = FactoryDataLoader()

    def test_all_15_master_scenarios(self):
        """Validates all 15 master errors against official specification benchmarks."""
        tested_errors = set()

        for err_id, expected in EXPECTED_BENCHMARKS.items():
            # Find a matching record
            matching = [r for r in self.loader.records if r["error_id"] == err_id]
            self.assertTrue(len(matching) > 0, f"Error {err_id} missing from dataset")
            record = matching[0]

            decision = evaluate_maintenance_case(record)
            tested_errors.add(err_id)

            self.assertEqual(decision["safety_override"], expected["safety"], f"Safety override mismatch for {err_id}")
            self.assertEqual(decision["option_a_total"], expected["opt_a"], f"Option A mismatch for {err_id}")

            if expected["safety"]:
                self.assertTrue(decision["option_b"]["locked_out"], f"Option B should be locked out for {err_id}")
                self.assertIsNone(decision["net_avoided_loss"], f"Net avoided loss should be None for safety case {err_id}")
            else:
                self.assertEqual(decision["option_b_total"], expected["opt_b"], f"Option B mismatch for {err_id}")
                self.assertEqual(decision["net_avoided_loss"], expected["net"], f"Net avoided mismatch for {err_id}")

        self.assertEqual(len(tested_errors), 15, "All 15 errors must be verified")

    def test_mandatory_safety_overrides(self):
        """Verifies safety overrides enforce immediate shutdown and lock out deferrals."""
        for err_id in ["M1-E04", "M2-E05", "M3-E05"]:
            matching = [r for r in self.loader.records if r["error_id"] == err_id]
            decision = evaluate_maintenance_case(matching[0])
            self.assertTrue(decision["safety_override"])
            self.assertTrue(decision["option_b"]["locked_out"])

    def test_anti_hallucination_validation_catches_fabrications(self):
        """Verifies that ungrounded numbers or missing sections in AI text are rejected."""
        record = [r for r in self.loader.records if r["error_id"] == "M1-E01"][0]
        decision = evaluate_maintenance_case(record)

        # AI fabricated figure: PKR 999,999
        fabricated_ai_text = """DECISION: Intervene immediately.
WHY: Hydraulic seal is leaking oil.
FINANCIAL IMPACT: Option A is PKR 56,500.00 and Option B is PKR 999,999.00.
RISK: Unplanned breakdown will stop the line.
ACTION: Approve immediate shutdown."""

        is_valid, err, _ = validate_ai_explanation(fabricated_ai_text, decision)
        self.assertFalse(is_valid)
        self.assertIn("ungrounded figure", err.lower())

    def test_deterministic_explanation_generator(self):
        """Verifies that our fallback generator satisfies all 5 sections and passes validation."""
        for r in self.loader.records:
            decision = evaluate_maintenance_case(r)
            text = generate_deterministic_explanation(decision)
            is_valid, err, sections = validate_ai_explanation(text, decision)
            self.assertTrue(is_valid, f"Fallback failed validation for {r['error_id']}: {err}")
            self.assertIsNotNone(sections)
            for req in ["DECISION", "WHY", "FINANCIAL IMPACT", "RISK", "ACTION"]:
                self.assertIn(req, sections)

    def test_predictive_decision_engine_thresholds(self):
        """
        Verifies deterministic decision engine thresholds:
        - Low risk: probability < 0.20 -> RUN NORMALLY
        - Medium risk: 0.20 <= probability < 0.40 -> MONITOR
        - High risk: probability >= 0.40 -> MAINTENANCE RECOMMENDED
        """
        from services.decision_engine import evaluate_maintenance_decision

        # CASE 1: Low-risk machine (< 0.20)
        low_res = evaluate_maintenance_decision(0.08)
        self.assertEqual(low_res["risk_level"], "LOW")
        self.assertEqual(low_res["risk_display"], "LOW RISK")
        self.assertEqual(low_res["decision"], "RUN NORMALLY")
        self.assertIn("Continue normal production", low_res["recommendation"])

        # Boundary test at 0.199
        low_boundary = evaluate_maintenance_decision(0.199)
        self.assertEqual(low_boundary["risk_level"], "LOW")

        # CASE 2: Medium-risk machine (0.20 <= prob < 0.40)
        med_res = evaluate_maintenance_decision(0.28)
        self.assertEqual(med_res["risk_level"], "MEDIUM")
        self.assertEqual(med_res["risk_display"], "MEDIUM RISK")
        self.assertEqual(med_res["decision"], "MONITOR")
        self.assertIn("increased monitoring", med_res["recommendation"])

        # Boundary test at 0.20
        med_boundary = evaluate_maintenance_decision(0.20)
        self.assertEqual(med_boundary["risk_level"], "MEDIUM")

        # CASE 3: High-risk machine (>= 0.40)
        high_res = evaluate_maintenance_decision(0.674)
        self.assertEqual(high_res["risk_level"], "HIGH")
        self.assertEqual(high_res["risk_display"], "HIGH RISK")
        self.assertEqual(high_res["decision"], "MAINTENANCE RECOMMENDED")
        self.assertIn("Inspect the machine", high_res["recommendation"])

        # Boundary test at 0.40
        high_boundary = evaluate_maintenance_decision(0.40)
        self.assertEqual(high_boundary["risk_level"], "HIGH")

    def test_ml_pipeline_cases_end_to_end(self):
        """Verifies end-to-end ML prediction on Case 1 (Low), Case 2 (Medium), and Case 3 (High)."""
        from ml.predictor import predict_failure_probability
        from services.decision_engine import evaluate_maintenance_decision

        # CASE 1: Low risk machine
        c1_prob = predict_failure_probability(
            machine_type="L",
            air_temperature=298.1,
            process_temperature=308.6,
            rotational_speed=1551.0,
            torque=32.8,
            tool_wear=10.0,
        )
        c1_decision = evaluate_maintenance_decision(c1_prob)
        self.assertLess(c1_prob, 0.20)
        self.assertEqual(c1_decision["risk_level"], "LOW")
        self.assertEqual(c1_decision["decision"], "RUN NORMALLY")

        # CASE 2: Medium risk machine
        c2_prob = predict_failure_probability(
            machine_type="L",
            air_temperature=300.5,
            process_temperature=310.0,
            rotational_speed=1400.0,
            torque=62.0,
            tool_wear=120.0,
        )
        c2_decision = evaluate_maintenance_decision(c2_prob)
        self.assertGreaterEqual(c2_prob, 0.20)
        self.assertLess(c2_prob, 0.40)
        self.assertEqual(c2_decision["risk_level"], "MEDIUM")
        self.assertEqual(c2_decision["decision"], "MONITOR")

        # CASE 3: High risk machine
        c3_prob = predict_failure_probability(
            machine_type="L",
            air_temperature=304.5,
            process_temperature=312.0,
            rotational_speed=1200.0,
            torque=75.0,
            tool_wear=235.0,
        )
        c3_decision = evaluate_maintenance_decision(c3_prob)
        self.assertGreaterEqual(c3_prob, 0.40)
        self.assertEqual(c3_decision["risk_level"], "HIGH")
        self.assertEqual(c3_decision["decision"], "MAINTENANCE RECOMMENDED")

    def test_ml_input_validation(self):
        """Verifies input validation enforces Type (H/M/L) and valid numeric fields."""
        from ml.predictor import validate_prediction_inputs

        # Valid inputs
        validated = validate_prediction_inputs("l", 300, 310, 1500, 40, 100)
        self.assertEqual(validated["Type"], "L")

        # Invalid Type
        with self.assertRaises(ValueError):
            validate_prediction_inputs("X", 300, 310, 1500, 40, 100)

        # Invalid numeric input
        with self.assertRaises(ValueError):
            validate_prediction_inputs("L", "invalid_temp", 310, 1500, 40, 100)

    def test_predictive_grok_explanation_fallback(self):
        """Verifies that the AI explanation layer provides deterministic fallback without crashing when Groq is unconfigured."""
        from ai_engine import generate_predictive_maintenance_ai_explanation

        machine_data = {
            "Type": "L",
            "Air temperature [K]": 304.5,
            "Process temperature [K]": 312.0,
            "Rotational speed [rpm]": 1200.0,
            "Torque [Nm]": 75.0,
            "Tool wear [min]": 235.0,
        }
        decision_result = {
            "probability_pct": 55.3,
            "formatted_probability": "55.3%",
            "risk_level": "HIGH",
            "decision": "MAINTENANCE RECOMMENDED",
            "recommendation": "Inspect the machine before prolonged production and prioritize maintenance.",
        }

        explanation, is_ai, notice = generate_predictive_maintenance_ai_explanation(
            machine_data=machine_data,
            decision_result=decision_result,
            api_key="",  # Test without API key
        )

        self.assertFalse(is_ai)
        self.assertIn("MAINTENANCE RECOMMENDED", explanation)
        self.assertIn("Torque at 75.0 Nm", explanation)
        self.assertIsNotNone(notice)

    def test_feature_importance_output(self):
        """Verifies dynamic extraction of actual Random Forest feature importances from pipeline."""
        from ml.predictor import get_feature_importances

        importances = get_feature_importances()
        self.assertIsInstance(importances, list)
        self.assertGreaterEqual(len(importances), 5)

        total_importance = sum(item["importance"] for item in importances)
        # Importances must sum to approximately 1.0 (100%)
        self.assertAlmostEqual(total_importance, 1.0, places=2)

        feature_names = [item["feature"] for item in importances]
        self.assertIn("Machine Type", feature_names)
        self.assertIn("Tool wear [min]", feature_names)
        self.assertIn("Rotational speed [rpm]", feature_names)
        self.assertIn("Torque [Nm]", feature_names)
        self.assertIn("Air temperature [K]", feature_names)
        self.assertIn("Process temperature [K]", feature_names)

        # Confirm non-negative and valid formatting
        for item in importances:
            self.assertGreaterEqual(item["importance"], 0.0)
            self.assertIn("%", item["formatted"])
            self.assertAlmostEqual(item["percentage"], round(item["importance"] * 100.0, 1), places=1)

    def test_threshold_boundaries_exact(self):
        """Verifies strict deterministic policy across exact threshold boundaries: 0.19, 0.20, 0.39, 0.40."""
        from services.decision_engine import evaluate_maintenance_decision

        # 0.19 -> LOW / RUN NORMALLY / P3
        res_019 = evaluate_maintenance_decision(0.19)
        self.assertEqual(res_019["risk_level"], "LOW")
        self.assertEqual(res_019["decision"], "RUN NORMALLY")
        self.assertEqual(res_019["priority"], "P3")
        self.assertEqual(res_019["priority_label"], "P3 - Routine")

        # 0.20 -> MEDIUM / MONITOR / P2 (boundary transition)
        res_020 = evaluate_maintenance_decision(0.20)
        self.assertEqual(res_020["risk_level"], "MEDIUM")
        self.assertEqual(res_020["decision"], "MONITOR")
        self.assertEqual(res_020["priority"], "P2")
        self.assertEqual(res_020["priority_label"], "P2 - Scheduled")

        # 0.39 -> MEDIUM / MONITOR / P2
        res_039 = evaluate_maintenance_decision(0.39)
        self.assertEqual(res_039["risk_level"], "MEDIUM")
        self.assertEqual(res_039["decision"], "MONITOR")
        self.assertEqual(res_039["priority"], "P2")
        self.assertEqual(res_039["priority_label"], "P2 - Scheduled")

        # 0.40 -> HIGH / MAINTENANCE RECOMMENDED / P1 (decision boundary transition)
        res_040 = evaluate_maintenance_decision(0.40)
        self.assertEqual(res_040["risk_level"], "HIGH")
        self.assertEqual(res_040["decision"], "MAINTENANCE RECOMMENDED")
        self.assertEqual(res_040["priority"], "P1")
        self.assertEqual(res_040["priority_label"], "P1 - Urgent")

    def test_model_config_loading(self):
        """Verifies loading of model_config.json metadata, verified metrics, and thresholds."""
        from ml.predictor import load_model_config

        config = load_model_config()
        self.assertIsInstance(config, dict)
        self.assertIn("metrics", config)
        self.assertIn("thresholds", config)

        metrics = config["metrics"]
        self.assertAlmostEqual(metrics["roc_auc"], 0.9662, places=3)
        self.assertEqual(metrics["threshold"], 0.40)
        self.assertAlmostEqual(metrics["precision"], 0.632911, places=3)
        self.assertAlmostEqual(metrics["recall"], 0.735294, places=3)
        self.assertAlmostEqual(metrics["f1_score"], 0.680272, places=3)

        thresholds = config["thresholds"]
        self.assertEqual(thresholds["low_risk_max"], 0.20)
        self.assertEqual(thresholds["medium_risk_max"], 0.40)
        self.assertEqual(thresholds["decision_threshold"], 0.40)


if __name__ == "__main__":
    unittest.main()

