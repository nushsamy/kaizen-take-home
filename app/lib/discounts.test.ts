import { describe, expect, it } from "vitest";
import { getApplicableDiscount, getDiscountLabel } from "./discounts";

const RATE_45 = 4500;  // $45/hr — holiday saves more than multiday
const RATE_32 = 3200;  // $32/hr — multiday saves more than holiday

/** Convenience: build a Date at local midnight (or a given hour). */
function d(year: number, month: number, day: number, hour = 0): Date {
  return new Date(year, month - 1, day, hour);
}

// ---------------------------------------------------------------------------
// No discount
// ---------------------------------------------------------------------------

describe("no discount", () => {
  it("returns null for a same-day trip", () => {
    const result = getApplicableDiscount(d(2025, 1, 10, 9), d(2025, 1, 10, 18), RATE_45);
    expect(result.discountType).toBeNull();
    expect(result.savingsCents).toBe(0);
    expect(result.discountedTotalCents).toBe(result.totalPriceCents);
    expect(result.discountedHourlyRateCents).toBe(RATE_45);
  });

  it("returns null for exactly 3 calendar days with no holiday", () => {
    // Mar 10 → Mar 13: no holiday, calendarDays === 3 (not > 3)
    const result = getApplicableDiscount(d(2025, 3, 10), d(2025, 3, 13), RATE_45);
    expect(result.discountType).toBeNull();
  });

  it("returns null for a 2-day trip with no holiday", () => {
    const result = getApplicableDiscount(d(2025, 1, 10), d(2025, 1, 12), RATE_45);
    expect(result.discountType).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Holiday discount
// ---------------------------------------------------------------------------

describe("holiday discount", () => {
  it("applies when a holiday (Jan 21) falls strictly inside the range", () => {
    // Jan 20 → Jan 22: Jan 21 is an intermediate day
    const result = getApplicableDiscount(d(2025, 1, 20), d(2025, 1, 22), RATE_45);
    expect(result.discountType).toBe("holiday");
    expect(result.discountedHourlyRateCents).toBe(Math.round(RATE_45 * 0.83));
    expect(result.savingsCents).toBeGreaterThan(0);
  });

  it("does NOT apply when the trip starts on the holiday", () => {
    // Jan 21 → Jan 23: start IS the holiday
    const result = getApplicableDiscount(d(2025, 1, 21), d(2025, 1, 23), RATE_45);
    expect(result.discountType).toBeNull();
  });

  it("does NOT apply when the trip ends on the holiday", () => {
    // Jan 19 → Jan 21: end IS the holiday
    const result = getApplicableDiscount(d(2025, 1, 19), d(2025, 1, 21), RATE_45);
    expect(result.discountType).toBeNull();
  });

  it("applies for the Dec 18 holiday within the same year", () => {
    // Dec 17 → Dec 20: Dec 18 is an intermediate day; exactly 3 calendar days so multiday doesn't apply
    const result = getApplicableDiscount(d(2025, 12, 17), d(2025, 12, 20), RATE_45);
    expect(result.discountType).toBe("holiday");
  });

  it("detects a Jan holiday in the next year for a year-boundary reservation", () => {
    // Dec 28 2025 → Jan 22 2026: Jan 21 2026 is an intermediate day; use high rate so holiday saves more than multiday
    const result = getApplicableDiscount(d(2025, 12, 28), d(2026, 1, 22), 10000);
    expect(result.discountType).toBe("holiday");
  });
});

// ---------------------------------------------------------------------------
// Multi-day discount
// ---------------------------------------------------------------------------

describe("multiday discount", () => {
  it("applies when the trip spans more than 3 calendar days with no holiday", () => {
    // Mar 10 → Mar 14: 4 calendar days, no holiday
    const result = getApplicableDiscount(d(2025, 3, 10), d(2025, 3, 14), RATE_45);
    expect(result.discountType).toBe("multiday");
    expect(result.discountedHourlyRateCents).toBe(RATE_45 - 1000);
  });

  it("does NOT apply for exactly 3 calendar days", () => {
    // Mar 10 → Mar 13: calendarDays === 3, threshold is strictly >3
    const result = getApplicableDiscount(d(2025, 3, 10), d(2025, 3, 13), RATE_45);
    expect(result.discountType).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Both discounts qualify — tiebreaking
// ---------------------------------------------------------------------------

describe("both discounts qualify", () => {
  // Jan 20 → Jan 25: Jan 21 is inside AND calendarDays === 5 (>3)
  const start = d(2025, 1, 20);
  const end = d(2025, 1, 25);

  it("picks holiday when holiday saves more per hour (high rate)", () => {
    // $45/hr: holiday saves 4500 * 0.17 = $7.65/hr vs $10/hr multiday
    // Wait: 4500 * 0.17 = 765 cents/hr vs 1000 cents/hr → multiday saves more
    // Use a rate where holiday saves more: $100/hr = 10000 cents
    // 10000 * 0.17 = 1700 cents/hr > 1000 cents/hr
    const result = getApplicableDiscount(start, end, 10000);
    expect(result.discountType).toBe("holiday");
  });

  it("picks multiday when multiday saves more per hour (low rate)", () => {
    // $32/hr = 3200 cents: 3200 * 0.17 = 544 cents/hr < 1000 cents/hr
    const result = getApplicableDiscount(start, end, RATE_32);
    expect(result.discountType).toBe("multiday");
  });

  it("picks holiday on a tie (equal per-hour savings)", () => {
    // Tie when hourlyRate * 0.17 >= 1000 exactly. Use ceil to ensure >= not <.
    // Math.ceil(1000 / 0.17) = 5883; 5883 * 0.17 = 1000.11 >= 1000 → holiday wins
    const tieRate = Math.ceil(1000 / 0.17); // 5883
    const result = getApplicableDiscount(start, end, tieRate);
    expect(result.discountType).toBe("holiday");
  });
});

// ---------------------------------------------------------------------------
// Pricing arithmetic
// ---------------------------------------------------------------------------

describe("pricing arithmetic", () => {
  it("computes totalPriceCents, durationInHours, and discountedTotalCents correctly for holiday", () => {
    // Jan 20 noon → Jan 22 noon: exactly 48 hours, Jan 21 inside
    const start = d(2025, 1, 20, 12);
    const end = d(2025, 1, 22, 12);
    const result = getApplicableDiscount(start, end, RATE_45);

    const expectedTotal = RATE_45 * 48;
    expect(result.durationInHours).toBe(48);
    expect(result.totalPriceCents).toBe(expectedTotal);
    expect(result.discountedTotalCents).toBe(Math.round(expectedTotal * 0.83));
    expect(result.savingsCents).toBe(result.totalPriceCents - result.discountedTotalCents);
  });

  it("computes discountedTotalCents correctly for multiday", () => {
    // Mar 10 → Mar 15: 5 calendar days, no holiday, 120 hours
    const start = d(2025, 3, 10);
    const end = d(2025, 3, 15);
    const result = getApplicableDiscount(start, end, RATE_45);

    const discountedRate = RATE_45 - 1000; // $35/hr
    expect(result.discountType).toBe("multiday");
    expect(result.discountedHourlyRateCents).toBe(discountedRate);
    expect(result.discountedTotalCents).toBe(Math.round(discountedRate * 120));
    expect(result.savingsCents).toBe(result.totalPriceCents - result.discountedTotalCents);
  });
});

// ---------------------------------------------------------------------------
// getDiscountLabel
// ---------------------------------------------------------------------------

describe("getDiscountLabel", () => {
  it('returns "Holiday discount" for holiday', () => {
    expect(getDiscountLabel("holiday")).toBe("Holiday discount");
  });

  it('returns "Multi-day discount" for multiday', () => {
    expect(getDiscountLabel("multiday")).toBe("Multi-day discount");
  });
});
