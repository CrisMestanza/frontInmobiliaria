/**
 * Utilidades financieras compartidas para GeoHabita.
 * Usadas por MapSidebar (lote) y MapSidebarProyecto (proyecto).
 */

/**
 * Intenta parsear la configuración de financiamiento.
 * Acepta objeto JS, string JSON, o null/undefined.
 */
export const parseFinancingConfig = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

/**
 * Formatea un número como moneda (S/ o la divisa indicada).
 */
export const formatMoney = (value, currency = "S/") => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${currency} 0.00`;
  return `${currency} ${amount.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Acota un valor entre un mínimo y máximo.
 */
export const clamp = (value, min, max) =>
  Math.min(Math.max(Number(value) || 0, min), max);

/**
 * Calcula el porcentaje de progreso para estilizar inputs range.
 */
export const getRangeStyle = (value, min, max) => {
  const safeMin = Number.isFinite(Number(min)) ? Number(min) : 0;
  const rawMax = Number.isFinite(Number(max)) ? Number(max) : safeMin + 1;
  const safeMax = rawMax <= safeMin ? safeMin + 1 : rawMax;
  const current = clamp(value, safeMin, safeMax);
  const progress = ((current - safeMin) / (safeMax - safeMin)) * 100;
  return { "--financing-range-progress": `${progress}%` };
};

/**
 * Calcula la cuota mensual (método francés).
 */
export const calcPayment = (principal, annualRate, months) => {
  const safePrincipal = Math.max(Number(principal) || 0, 0);
  const safeMonths = Math.max(1, Math.round(Number(months) || 1));
  const monthlyRate = Math.max(0, Number(annualRate) || 0) / 12 / 100;
  if (!monthlyRate) return safePrincipal / safeMonths;
  return (
    (safePrincipal * monthlyRate) /
    (1 - Math.pow(1 + monthlyRate, -safeMonths))
  );
};

/**
 * Genera la tabla de amortización completa.
 * Retorna un array de objetos con mes, cuota, interés, capital, saldo.
 */
export const generateAmortizationSchedule = (
  principal,
  annualRate,
  months,
) => {
  const safePrincipal = Math.max(Number(principal) || 0, 0);
  const safeMonths = Math.max(1, Math.round(Number(months) || 1));
  const monthlyRate = Math.max(0, Number(annualRate) || 0) / 12 / 100;

  const monthlyPayment = calcPayment(safePrincipal, annualRate, safeMonths);
  let balance = safePrincipal;
  const schedule = [];

  for (let i = 1; i <= safeMonths; i++) {
    const interest = balance * monthlyRate;
    const capital = monthlyPayment - interest;
    balance = Math.max(0, balance - capital);

    schedule.push({
      month: i,
      payment: monthlyPayment,
      interest,
      capital,
      balance,
    });
  }

  return schedule;
};

const principalFromPayment = (payment, annualRate, months) => {
  const safePayment = Math.max(Number(payment) || 0, 0);
  const safeMonths = Math.max(1, Math.round(Number(months) || 1));
  const monthlyRate = Math.max(0, Number(annualRate) || 0) / 12 / 100;
  if (!monthlyRate) return safePayment * safeMonths;
  return (
    safePayment * ((1 - Math.pow(1 + monthlyRate, -safeMonths)) / monthlyRate)
  );
};

export const buildInverseFinancingOptions = ({
  price,
  budget,
  annualRate = 0,
  minInitial = 0,
  maxInitial,
  minMonths = 1,
  maxMonths = 60,
  monthlyAdminFee = 0,
  insuranceMonthly = 0,
  originationFeePct = 0,
  balloonPct = 0,
  currency = "S/",
}) => {
  const safePrice = Math.max(Number(price) || 0, 0);
  const safeBudget = Math.max(Number(budget) || 0, 0);
  const safeMinInitial = Math.max(0, Number(minInitial) || 0);
  const safeMaxInitial = Math.max(
    safeMinInitial,
    Number(maxInitial) || safePrice || safeMinInitial,
  );
  const safeMinMonths = Math.max(1, Math.round(Number(minMonths) || 1));
  const safeMaxMonths = Math.max(
    safeMinMonths,
    Math.round(Number(maxMonths) || safeMinMonths),
  );
  const fees = Math.max(Number(monthlyAdminFee) || 0, 0) +
    Math.max(Number(insuranceMonthly) || 0, 0);
  const monthlyBudgetForLoan = Math.max(safeBudget - fees, 0);
  const originationFee = (safePrice * Math.max(Number(originationFeePct) || 0, 0)) / 100;
  const balloonFactor = Math.max(0, Number(balloonPct) || 0) / 100;

  if (!safePrice || !safeBudget || monthlyBudgetForLoan <= 0) {
    return [];
  }

  const candidates = [];
  for (let months = safeMinMonths; months <= safeMaxMonths; months += 1) {
    const principalForInstallments = principalFromPayment(
      monthlyBudgetForLoan,
      annualRate,
      months,
    );
    const financedBaseRaw =
      (principalForInstallments - originationFee) /
      Math.max(1 - balloonFactor, 0.0001);
    const financedBase = Math.max(0, financedBaseRaw);
    const initial = clamp(safePrice - financedBase, safeMinInitial, safeMaxInitial);
    const monthlyEstimate =
      calcPayment(
        Math.max(
          safePrice - initial + originationFee - (safePrice - initial) * balloonFactor,
          0,
        ),
        annualRate,
        months,
      ) + fees;

    if (monthlyEstimate - safeBudget > 5) continue;

    const downPaymentPct = Math.round((initial / Math.max(safePrice, 1)) * 100);
    candidates.push({
      initial,
      months,
      monthlyEstimate,
      totalPaid: initial + monthlyEstimate * months,
      gapToBudget: safeBudget - monthlyEstimate,
      downPaymentPct,
      summary: `${formatMoney(monthlyEstimate, currency)} x ${months} meses`,
    });
  }

  return candidates.sort((a, b) => {
    if (Math.abs(a.gapToBudget - b.gapToBudget) > 0.5) {
      return a.gapToBudget - b.gapToBudget;
    }
    if (a.initial !== b.initial) return a.initial - b.initial;
    return a.months - b.months;
  });
};
