export type CostRowStatus = "provider_total" | "user_estimate" | "reference_only" | "unpriced" | "contingency";

export type CostLedgerRow = {
  id: string;
  label: string;
  amount: number | null;
  currency: string;
  status: CostRowStatus;
  includedInSubtotal: boolean;
  detail: string;
};

export type CostLedgerInput = {
  currency: string;
  nights: number;
  budget: number;
  flightRequested: boolean;
  stayRequested: boolean;
  activitiesRequested: boolean;
  outbound: { price: number | null; currency: string } | null;
  returnFlight: { price: number | null; currency: string } | null;
  flightSeller: { price: number | null; currency: string; seller: string; type: string } | null;
  hotel: {
    name: string;
    totalPrice: number | null;
    nightlyPrice: number | null;
    currency: string;
  } | null;
  activities: Array<{ name: string; price?: string }>;
  restaurants: Array<{ name: string; price?: string }>;
  manual: {
    groundTransport: number | null;
    activities: number | null;
    dining: number | null;
  };
  contingencyPercent: number;
};

export type CostLedgerResult = {
  rows: CostLedgerRow[];
  pricedSubtotal: number;
  contingencyAmount: number;
  planningTotal: number;
  unpricedCategories: string[];
  budget: number;
  remainingBeforeUnpriced: number;
};

export function parseCostEstimate(value: string): number | null {
  const normalized = value.trim().replace(/[$,\s]/g, "");
  if (!normalized) return null;
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 && amount <= 99_999_999 ? amount : null;
}

function isValidAmount(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 99_999_999;
}

function cleanText(value: string | undefined): string {
  return (value ?? "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
}

export function buildTripCostLedger(input: CostLedgerInput): CostLedgerResult {
  const rows: CostLedgerRow[] = [];
  const unpricedCategories: string[] = [];
  let pricedSubtotal = 0;

  const addIncluded = (row: CostLedgerRow) => {
    rows.push(row);
    if (row.includedInSubtotal && row.amount !== null && row.currency === input.currency) {
      pricedSubtotal += row.amount;
    }
  };
  const addReference = (row: CostLedgerRow) => rows.push({ ...row, includedInSubtotal: false, status: "reference_only" });

  if (input.flightRequested) {
    if (input.flightSeller && isValidAmount(input.flightSeller.price)) {
      const separateTickets = /separate tickets?/i.test(input.flightSeller.type);
      addReference({
        id: "flight",
        label: "Flight · selected seller offer",
        amount: input.flightSeller.price,
        currency: input.flightSeller.currency || input.currency,
        status: "reference_only",
        includedInSubtotal: false,
        detail: separateTickets
          ? `${cleanText(input.flightSeller.seller)} · separate tickets; this is not one combined round-trip fare.`
          : `${cleanText(input.flightSeller.seller)} · seller-displayed fare. Passenger/party basis and final taxes must be verified before this can be added to a trip total.`,
      });
    } else if (input.outbound && isValidAmount(input.outbound.price)) {
      addReference({
        id: "flight",
        label: "Flight · outbound display price",
        amount: input.outbound.price,
        currency: input.outbound.currency || input.currency,
        status: "reference_only",
        includedInSubtotal: false,
        detail: input.returnFlight
          ? "Outbound leg only. No combined round-trip seller total has been selected, so this amount is excluded from the planning subtotal."
          : "Outbound leg only; return fare has not been selected. Excluded from the planning subtotal.",
      });
    } else {
      rows.push({ id: "flight", label: "Flight", amount: null, currency: input.currency, status: "unpriced", includedInSubtotal: false, detail: "Choose a return leg and retrieve a seller offer. The outbound display price alone is not a full trip fare." });
      unpricedCategories.push("Flight");
    }
  }

  if (input.stayRequested) {
    if (input.hotel && isValidAmount(input.hotel.totalPrice)) {
      const currency = input.hotel.currency || input.currency;
      const canInclude = currency === input.currency;
      addIncluded({
        id: "stay",
        label: "Accommodation · provider stay total",
        amount: input.hotel.totalPrice,
        currency,
        status: canInclude ? "provider_total" : "reference_only",
        includedInSubtotal: canInclude,
        detail: `${input.hotel.name} · ${input.nights} ${input.nights === 1 ? "night" : "nights"}. Provider-displayed total for the selected search; verify room allocation, taxes and fees at checkout.${canInclude ? "" : ` Currency differs from the trip budget (${input.currency}); not converted or included.`}`,
      });
    } else if (input.hotel && isValidAmount(input.hotel.nightlyPrice)) {
      rows.push({
        id: "stay",
        label: "Accommodation · nightly price",
        amount: input.hotel.nightlyPrice,
        currency: input.hotel.currency || input.currency,
        status: "reference_only",
        includedInSubtotal: false,
        detail: `Nightly display price for ${input.hotel.name}. A full stay total, taxes, fees and room basis were not supplied; not multiplied by nights or rooms.`,
      });
      unpricedCategories.push("Accommodation total");
    } else {
      rows.push({ id: "stay", label: "Accommodation", amount: null, currency: input.currency, status: "unpriced", includedInSubtotal: false, detail: input.hotel ? "The selected property has no numeric stay total or nightly price." : "No property has been selected." });
      unpricedCategories.push("Accommodation");
    }
  }

  if (input.activitiesRequested) {
    const selected = input.activities;
    const hints = selected.map((item) => `${item.name}${cleanText(item.price) ? ` (${cleanText(item.price)})` : ""}`).join("; ");
    if (isValidAmount(input.manual.activities)) {
      addIncluded({ id: "activities", label: "Activities · your estimate", amount: input.manual.activities, currency: input.currency, status: "user_estimate", includedInSubtotal: true, detail: "Your manually entered group estimate. Provider price text for individual activities is shown separately and is not double-counted." });
    } else if (selected.length) {
      rows.push({ id: "activities", label: "Selected activities · provider price text", amount: null, currency: input.currency, status: "unpriced", includedInSubtotal: false, detail: hints || `${selected.length} selected activity${selected.length === 1 ? "" : "ies"}; no numeric amount supplied.` });
      unpricedCategories.push("Activities");
    } else {
      rows.push({ id: "activities", label: "Activities", amount: null, currency: input.currency, status: "unpriced", includedInSubtotal: false, detail: "No activities selected or group estimate entered." });
      unpricedCategories.push("Activities");
    }
  }

  if (input.activitiesRequested) {
    const selectedDining = input.restaurants;
    const hints = selectedDining.map((item) => `${item.name}${cleanText(item.price) ? ` (${cleanText(item.price)})` : ""}`).join("; ");
    if (isValidAmount(input.manual.dining)) {
      addIncluded({ id: "dining", label: "Food & dining · your estimate", amount: input.manual.dining, currency: input.currency, status: "user_estimate", includedInSubtotal: true, detail: "Your manually entered group estimate. Restaurant price indicators are not converted into meal totals." });
    } else {
      rows.push({ id: "dining", label: "Food & dining", amount: null, currency: input.currency, status: "unpriced", includedInSubtotal: false, detail: hints || (selectedDining.length ? "Selected restaurants do not provide a comparable meal total." : "No food budget entered; restaurant prices are not estimated." ) });
      unpricedCategories.push("Food & dining");
    }
  }

  if (isValidAmount(input.manual.groundTransport)) {
    addIncluded({ id: "transport", label: "Ground transport · your estimate", amount: input.manual.groundTransport, currency: input.currency, status: "user_estimate", includedInSubtotal: true, detail: "Your manually entered group estimate for airport transfers, local transport and other ground travel." });
  } else {
    rows.push({ id: "transport", label: "Ground transport", amount: null, currency: input.currency, status: "unpriced", includedInSubtotal: false, detail: "No priced transfer or rental-car selection is connected to this trip yet. Enter a group estimate to include it." });
    unpricedCategories.push("Ground transport");
  }

  const percent = Number.isFinite(input.contingencyPercent) ? Math.min(50, Math.max(0, input.contingencyPercent)) : 0;
  const contingencyAmount = Math.round(pricedSubtotal * percent) / 100;
  if (percent > 0 && pricedSubtotal > 0) {
    addIncluded({ id: "contingency", label: `Contingency · ${percent}%`, amount: contingencyAmount, currency: input.currency, status: "contingency", includedInSubtotal: true, detail: "Planning allowance calculated only from the provider stay total and group estimates above; it does not cover unpriced categories." });
  }

  const planningTotal = Math.round(pricedSubtotal * 100) / 100;
  return {
    rows,
    pricedSubtotal: Math.round((planningTotal - contingencyAmount) * 100) / 100,
    contingencyAmount: Math.round(contingencyAmount * 100) / 100,
    planningTotal,
    unpricedCategories: [...new Set(unpricedCategories)],
    budget: input.budget,
    remainingBeforeUnpriced: Math.round((input.budget - planningTotal) * 100) / 100,
  };
}
