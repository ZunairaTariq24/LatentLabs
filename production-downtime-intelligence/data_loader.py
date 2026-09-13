"""
Production Downtime & Maintenance Decision Intelligence
Module: data_loader.py
Description: Authoritative dataset loader and registry for factory topology,
machine asset registers, and diagnostic error matrices.
"""

import csv
import os
from typing import Dict, Any, List, Optional, Tuple
from validators import validate_dataset_schema, validate_record_row


def find_dataset_path(filename: str = "factory_data.csv") -> str:
    """Locate factory_data.csv across common working directory structures."""
    candidates = [
        filename,
        os.path.join("production-downtime-intelligence", filename),
        os.path.join(os.path.dirname(__file__), filename),
        os.path.join(os.path.dirname(__file__), "production-downtime-intelligence", filename),
        os.path.join(os.getcwd(), filename),
        os.path.join(os.getcwd(), "production-downtime-intelligence", filename),
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    raise FileNotFoundError(f"Authoritative dataset '{filename}' not found in paths: {candidates}")


class FactoryDataLoader:
    """Loads and caches authoritative factory topology and error records."""

    def __init__(self, csv_path: Optional[str] = None):
        self.csv_path = csv_path or find_dataset_path()
        self.records: List[Dict[str, Any]] = []
        self._load_and_validate()

    def _load_and_validate(self) -> None:
        if not os.path.exists(self.csv_path):
            raise FileNotFoundError(f"Factory data file not found: {self.csv_path}")

        with open(self.csv_path, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            if reader.fieldnames is None:
                raise ValueError("Dataset is empty or malformed.")

            is_valid_schema, schema_err = validate_dataset_schema(reader.fieldnames)
            if not is_valid_schema:
                raise ValueError(schema_err)

            self.records = []
            for idx, row in enumerate(reader):
                is_valid_row, row_err = validate_record_row(row)
                if not is_valid_row:
                    raise ValueError(f"Row {idx + 1} validation failed: {row_err}")
                self.records.append(row)

        if not self.records:
            raise ValueError("Factory dataset is empty. No valid operational scenarios found.")

    def get_all_records(self) -> List[Dict[str, Any]]:
        return list(self.records)

    def get_machines(self) -> List[Dict[str, Any]]:
        """
        Returns distinct list of machines in the 1 -> 2 -> 4 topology.
        Preserves topology ordering: Stage 1, Stage 2, Stage 3.
        """
        seen = set()
        machines = []
        for r in self.records:
            m_id = r["machine_id"]
            if m_id not in seen:
                seen.add(m_id)
                machines.append({
                    "machine_id": m_id,
                    "machine_name": r["machine_name"],
                    "stage": r["stage"],
                    "operator": r["operator"],
                    "capacity_per_hour": float(r["capacity_per_hour"]),
                    "line_loss_rate": float(r["line_loss_rate"]),
                })
        return machines

    def get_errors_for_machine(self, machine_id: str) -> List[Dict[str, Any]]:
        """Returns all validated diagnostic error scenarios for a given machine ID."""
        matching = [r for r in self.records if r["machine_id"] == machine_id]
        if not matching:
            # Check if machine exists in any form
            all_m = {r["machine_id"] for r in self.records}
            if machine_id not in all_m:
                return []
        return matching

    def get_record(self, machine_id: str, error_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves the exact corresponding record for a machine and error.
        If not present in the supplied dataset, does NOT guess: returns None.
        """
        for r in self.records:
            if r["machine_id"] == machine_id and r["error_id"] == error_id:
                return dict(r)
        return None


# Global singleton instance for easy import across modules
_cached_loader: Optional[FactoryDataLoader] = None


def get_data_loader() -> FactoryDataLoader:
    global _cached_loader
    if _cached_loader is None:
        _cached_loader = FactoryDataLoader()
    return _cached_loader
