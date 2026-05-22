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

/** Strips the time component from a date, returning local midnight. */
function toMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Returns true if any holiday falls strictly between start and end,
 * exclusive of both boundary calendar days.
 */
function hasHolidayInRange(start: Date, end: Date): boolean {
  const startDay = toMidnight(start);
  const endDay = toMidnight(end);

  if (endDay <= startDay) return false;

  for (let year = startDay.getFullYear(); year <= endDay.getFullYear(); year++) {
    for (const { month, day } of HOLIDAYS) {
      const holidayDate = new Date(year, month - 1, day);
      if (holidayDate > startDay && holidayDate < endDay) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Picks the discount type that saves the most per hour.
 * Returns null if neither discount applies.
 */
function selectDiscountType(
  holidayApplies: boolean,
  multidayApplies: boolean,
  hourlyRateCents: number,
): DiscountType | null {
  if (!holidayApplies && !multidayApplies) return null;
  if (holidayApplies && !multidayApplies) return "holiday";
  if (!holidayApplies) return "multiday";
  // Both apply — pick whichever saves more per hour (duration cancels out)
  return hourlyRateCents * HOLIDAY_DISCOUNT_RATE >= MULTIDAY_DISCOUNT_PER_HOUR_CENTS
    ? "holiday"
    : "multiday";
}

/**
 * Computes pricing for a reservation and determines the best applicable
 * discount, returning the full breakdown including discounted rate and total.
 */
export function getApplicableDiscount(
  start: Date,
  end: Date,
  hourlyRateCents: number,
): DiscountResult {
  const durationHours = (end.getTime() - start.getTime()) / MS_PER_HOUR;
  const originalTotalCents = Math.round(hourlyRateCents * durationHours);

  const startDay = toMidnight(start);
  const endDay = toMidnight(end);
  const calendarDays = (endDay.getTime() - startDay.getTime()) / MS_PER_DAY;

  const holidayApplies = hasHolidayInRange(start, end);
  const multidayApplies = calendarDays > MULTIDAY_DISCOUNT_THRESHOLD_DAYS;

  const discountType = selectDiscountType(holidayApplies, multidayApplies, hourlyRateCents);

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
