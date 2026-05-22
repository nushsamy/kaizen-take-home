const MS_PER_HOUR = 1000 * 60 * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;
const MULTIDAY_DISCOUNT_THRESHOLD_DAYS = 3;
const MULTIDAY_DISCOUNT_PER_HOUR_CENTS = 1000; // $10/hr
const HOLIDAY_DISCOUNT_RATE = 0.17; // 17% off

export const HOLIDAYS: Array<{ month: number; day: number }> = [
  { month: 1,  day: 21 },
  { month: 2,  day: 12 },
  { month: 3,  day: 4  },
  { month: 5,  day: 2  },
  { month: 6,  day: 16 },
  { month: 7,  day: 26 },
  { month: 8,  day: 3  },
  { month: 9,  day: 1  },
  { month: 11, day: 5  },
  { month: 12, day: 18 },
];

export type DiscountType = "holiday" | "multiday";

export interface DiscountResult {
  totalPriceCents: number;
  durationInHours: number;
  discountType: DiscountType | null;
  savingsCents: number;
  discountedTotalCents: number;
  discountedHourlyRateCents: number;
}

function hasHolidayInRange(start: Date, end: Date): boolean {
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  const startMidnight = new Date(startYear, start.getMonth(), start.getDate());
  const endMidnight = new Date(endYear, end.getMonth(), end.getDate());

  if (endMidnight <= startMidnight) return false;

  for (let year = startYear; year <= endYear; year++) {
    for (const { month, day } of HOLIDAYS) {
      const holidayDate = new Date(year, month - 1, day);
      if (holidayDate > startMidnight && holidayDate < endMidnight) {
        return true;
      }
    }
  }
  return false;
}

export function getApplicableDiscount(
  start: Date,
  end: Date,
  hourlyRateCents: number,
): DiscountResult {
  const durationHours = (end.getTime() - start.getTime()) / MS_PER_HOUR;
  const originalTotalCents = Math.round(hourlyRateCents * durationHours);

  const startMidnight = new Date(
    start.getFullYear(), start.getMonth(), start.getDate(),
  );
  const endMidnight = new Date(
    end.getFullYear(), end.getMonth(), end.getDate(),
  );
  const calendarDays =
    (endMidnight.getTime() - startMidnight.getTime()) / MS_PER_DAY;

  const holidayApplies = hasHolidayInRange(start, end);
  const multidayApplies = calendarDays > MULTIDAY_DISCOUNT_THRESHOLD_DAYS;

  // Compare per-hour savings to pick the better discount (duration cancels out)
  const holidayPerHourSavings = hourlyRateCents * HOLIDAY_DISCOUNT_RATE;
  const discountType: DiscountType | null =
    !holidayApplies && !multidayApplies ? null
    : holidayApplies && !multidayApplies ? "holiday"
    : !holidayApplies && multidayApplies ? "multiday"
    : holidayPerHourSavings >= MULTIDAY_DISCOUNT_PER_HOUR_CENTS ? "holiday" : "multiday";

  const discountedHourlyRateCents =
    discountType === "holiday"
      ? Math.round(hourlyRateCents * (1 - HOLIDAY_DISCOUNT_RATE))
      : discountType === "multiday"
        ? hourlyRateCents - MULTIDAY_DISCOUNT_PER_HOUR_CENTS
        : hourlyRateCents;

  const discountedTotalCents =
    discountType === "holiday"
      ? Math.round(originalTotalCents * (1 - HOLIDAY_DISCOUNT_RATE))
      : Math.round(discountedHourlyRateCents * durationHours);
  const savingsCents = originalTotalCents - discountedTotalCents;

  return {
    totalPriceCents: originalTotalCents,
    durationInHours: durationHours,
    discountType,
    savingsCents,
    discountedTotalCents,
    discountedHourlyRateCents,
  };
}
