const defaultPresetMonths = [36, 48, 60];

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const createPresetState = (initialAmount = 18000) =>
  defaultPresetMonths.map((months) => ({
    label: `${months} meses`,
    months,
    initial_amount: initialAmount,
  }));

export const createDefaultFinancingState = (price = 0, currency = "S/") => ({
  enabled: true,
  currency: currency || "S/",
  price_reference: toNumber(price, 0),
  default_initial_amount: 18000,
  min_initial_amount: 18000,
  max_initial_amount: Math.max(toNumber(price, 0), 18000),
  default_months: 36,
  min_months: 10,
  max_months: 60,
  annual_interest_rate: 0,
  monthly_admin_fee: 0,
  insurance_monthly: 0,
  origination_fee_pct: 0,
  balloon_payment_pct: 0,
  grace_months: 0,
  presets: createPresetState(18000),
  notes:
    "El cliente podrá ajustar inicial y meses dentro de los límites definidos.",
});

export const parseFinancingConfigState = (
  rawConfig,
  price = 0,
  currency = "S/",
) => {
  let parsed = rawConfig;
  if (typeof rawConfig === "string") {
    try {
      parsed = JSON.parse(rawConfig);
    } catch {
      parsed = null;
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return createDefaultFinancingState(price, currency);
  }

  const base = createDefaultFinancingState(price, currency);
  const presets = Array.isArray(parsed.presets) && parsed.presets.length
    ? parsed.presets.map((preset, index) => ({
        label: preset?.label || `${defaultPresetMonths[index] || 36} meses`,
        months: toNumber(preset?.months, defaultPresetMonths[index] || 36),
        initial_amount: toNumber(
          preset?.initial_amount,
          base.default_initial_amount,
        ),
      }))
    : base.presets;

  return {
    ...base,
    ...parsed,
    currency: parsed.currency || currency || base.currency,
    price_reference: toNumber(
      parsed.price_reference,
      toNumber(price, base.price_reference),
    ),
    default_initial_amount: toNumber(
      parsed.default_initial_amount,
      base.default_initial_amount,
    ),
    min_initial_amount: toNumber(
      parsed.min_initial_amount,
      base.min_initial_amount,
    ),
    max_initial_amount: toNumber(
      parsed.max_initial_amount,
      Math.max(toNumber(price, 0), base.max_initial_amount),
    ),
    default_months: toNumber(parsed.default_months, base.default_months),
    min_months: toNumber(parsed.min_months, base.min_months),
    max_months: toNumber(parsed.max_months, base.max_months),
    annual_interest_rate: toNumber(
      parsed.annual_interest_rate,
      base.annual_interest_rate,
    ),
    monthly_admin_fee: toNumber(
      parsed.monthly_admin_fee,
      base.monthly_admin_fee,
    ),
    insurance_monthly: toNumber(
      parsed.insurance_monthly,
      base.insurance_monthly,
    ),
    origination_fee_pct: toNumber(
      parsed.origination_fee_pct,
      base.origination_fee_pct,
    ),
    balloon_payment_pct: toNumber(
      parsed.balloon_payment_pct,
      base.balloon_payment_pct,
    ),
    grace_months: toNumber(parsed.grace_months, base.grace_months),
    presets,
    notes: parsed.notes || base.notes,
    enabled: parsed.enabled !== false,
  };
};

export const serializeFinancingConfigState = (
  state,
  price = 0,
  currency = "S/",
) =>
  JSON.stringify(
    {
      enabled: state.enabled !== false,
      currency: state.currency || currency || "S/",
      price_reference: toNumber(state.price_reference, price),
      default_initial_amount: toNumber(state.default_initial_amount, 0),
      min_initial_amount: toNumber(state.min_initial_amount, 0),
      max_initial_amount: toNumber(
        state.max_initial_amount,
        Math.max(toNumber(price, 0), 0),
      ),
      default_months: toNumber(state.default_months, 36),
      min_months: toNumber(state.min_months, 1),
      max_months: toNumber(state.max_months, 60),
      annual_interest_rate: toNumber(state.annual_interest_rate, 0),
      monthly_admin_fee: toNumber(state.monthly_admin_fee, 0),
      insurance_monthly: toNumber(state.insurance_monthly, 0),
      origination_fee_pct: toNumber(state.origination_fee_pct, 0),
      balloon_payment_pct: toNumber(state.balloon_payment_pct, 0),
      grace_months: toNumber(state.grace_months, 0),
      presets: (Array.isArray(state.presets) ? state.presets : []).map(
        (preset, index) => ({
          label: preset?.label || `${defaultPresetMonths[index] || 36} meses`,
          months: toNumber(preset?.months, defaultPresetMonths[index] || 36),
          initial_amount: toNumber(
            preset?.initial_amount,
            toNumber(state.default_initial_amount, 0),
          ),
        }),
      ),
      notes:
        state.notes ||
        "El cliente podrá ajustar inicial y meses dentro de los límites definidos.",
    },
    null,
    2,
  );
