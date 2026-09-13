import { DecisionPackage, OptionACalculation, OptionBCalculation, ScenarioRecord } from "../types";

export function calculateOptionA(
  plannedDowntimeMin: number,
  lineLossRate: number,
  plannedPartCost: number,
  plannedLaborCost: number
): OptionACalculation {
  const productionLoss = (plannedDowntimeMin / 60) * lineLossRate;
  const total = productionLoss + plannedPartCost + plannedLaborCost;
  return {
    planned_downtime_min: plannedDowntimeMin,
    production_loss: Math.round(productionLoss * 100) / 100,
    parts: plannedPartCost,
    labor: plannedLaborCost,
    total: Math.round(total * 100) / 100,
  };
}

export function calculateOptionB(
  unplannedDowntimeMin: number,
  lineLossRate: number,
  replacementCost: number,
  freightCost: number,
  idleLaborCost: number,
  emergencyTechCost: number,
  scrapCost: number
): OptionBCalculation {
  const productionLoss = (unplannedDowntimeMin / 60) * lineLossRate;
  const total =
    productionLoss +
    replacementCost +
    freightCost +
    idleLaborCost +
    emergencyTechCost +
    scrapCost;

  return {
    unplanned_downtime_min: unplannedDowntimeMin,
    production_loss: Math.round(productionLoss * 100) / 100,
    replacement: replacementCost,
    freight: freightCost,
    idle_labor: idleLaborCost,
    emergency_tech: emergencyTechCost,
    scrap: scrapCost,
    total: Math.round(total * 100) / 100,
    locked_out: false,
  };
}

export function evaluateMaintenanceCaseTS(record: ScenarioRecord): DecisionPackage {
  const isSafetyOverride = Boolean(record.safety_override);
  const lineLoss = record.line_loss_rate;

  const optA = calculateOptionA(
    record.planned_downtime_min,
    lineLoss,
    record.planned_part_cost,
    record.planned_labor_cost
  );

  let optB: OptionBCalculation;
  let netAvoided: number | null = null;

  if (isSafetyOverride) {
    optB = {
      unplanned_downtime_min: 0,
      production_loss: 0,
      replacement: 0,
      freight: 0,
      idle_labor: 0,
      emergency_tech: 0,
      scrap: 0,
      total: 0,
      locked_out: true,
      lockout_reason: "MANDATORY SAFETY OVERRIDE: Economic deferral prohibited by safety statutory codes.",
    };
    netAvoided = null;
  } else {
    optB = calculateOptionB(
      record.unplanned_downtime_min,
      lineLoss,
      record.replacement_cost,
      record.freight_cost,
      record.idle_labor_cost,
      record.emergency_tech_cost,
      record.scrap_cost
    );
    netAvoided = Math.round((optB.total - optA.total) * 100) / 100;
  }

  return {
    machine_id: record.machine_id,
    machine_name: record.machine_name,
    stage: record.stage,
    operator: record.operator,
    capacity_per_hour: record.capacity_per_hour,
    error_id: record.error_id,
    failure_mode: record.failure_mode,
    category: record.category,
    symptom: record.symptom,
    line_loss_rate: lineLoss,
    option_a: optA,
    option_b: optB,
    option_a_total: optA.total,
    option_b_total: isSafetyOverride ? 0 : optB.total,
    net_avoided_loss: netAvoided,
    safety_override: isSafetyOverride,
  };
}
