export const BUSINESS_MODEL_ASSUMPTIONS = Object.freeze({
  employeeCount: 4,
  monthlyPayrollCost: 22_000,
  monthlyRentCost: 12_000,
  monthlyMaintenanceCost: 4_500,
  lossRate: 0.05,
  merchandiseCostPerKg: 11,
  kwhPerKgProcessed: 2.4,
  averageSalePricePerKg: 16,
});

export const FINANCIAL_CONFIG = Object.freeze({
  ...BUSINESS_MODEL_ASSUMPTIONS,
  REVENUE_PER_KWH:
    BUSINESS_MODEL_ASSUMPTIONS.averageSalePricePerKg /
    BUSINESS_MODEL_ASSUMPTIONS.kwhPerKgProcessed,
  WORKING_HOURS_PER_DAY: 16,
  DAYS_PER_MONTH: 30,
});
