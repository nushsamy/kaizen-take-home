import { DateTime } from "luxon";
import { getApplicableDiscount, DiscountType } from "@/lib/discounts";
import {
  getAvailableVehicles,
  getReservationById,
  getVehicleById,
  getVehicles,
} from "./data_helpers";

const parseAndValidateTimeRange = (startTime: string, endTime: string) => {
  const start = DateTime.fromISO(startTime);
  const end = DateTime.fromISO(endTime);

  if (
    start.toString() === "Invalid Date" ||
    end.toString() === "Invalid Date"
  ) {
    throw new Error(
      "BAD REQUEST: Invalid date format. Please use ISO 8601 format.",
    );
  }

  if (end <= start) {
    throw new Error("BAD REQUEST: end_time must be after start_time");
  }
  return { start, end };
};

const calculateTotalPrice = (
  start: DateTime,
  end: DateTime,
  hourlyRateCents: number,
) => {
  const durationInHours = end.diff(start, "hours").hours || 0;

  return {
    totalPriceCents: hourlyRateCents * durationInHours,
    hourlyRateCents,
    durationInHours,
  };
};

const validateReservationAndGetVehicle = (input: {
  vehicleId: string;
  startTime: string;
  endTime: string;
}) => {
  const { vehicleId, startTime, endTime } = input;
  const { start, end } = parseAndValidateTimeRange(startTime, endTime);

  const vehicle = getVehicleById(vehicleId);

  if (!vehicle) {
    throw new Error("NOT_FOUND: Vehicle not found");
  }

  return { vehicle, start, end };
};

function searchVehicles(input: {
  startTime: string;
  endTime: string;
  passengerCount: number;
  classifications: string[];
  makes: string[];
  priceMin: number;
  priceMax: number;
}) {
  const {
    startTime,
    endTime,
    passengerCount,
    classifications,
    makes,
    priceMin,
    priceMax,
  } = input;

  const parsedPriceMin = priceMin;
  const parsedPriceMax = priceMax === 100 ? Number.MAX_SAFE_INTEGER : priceMax;

  try {
    const { start, end } = parseAndValidateTimeRange(startTime, endTime);

    const availableVehicles = getAvailableVehicles({
      startTime: start,
      endTime: end,
      passengerCount,
      classifications,
      makes,
      priceMinDollars: parsedPriceMin,
      priceMaxDollars: parsedPriceMax,
    });

    return {
      vehicles: availableVehicles,
    };
  } catch (error) {
    console.error(error);
    return {
      vehicles: [],
    }
  }
}

export interface FilterOptions {
  makes: string[];
  classifications: string[];
  passengerCounts: number[];
}

//fetch all vehicles and filter to find max and min price
function getPriceRange(): { minDollars: number; maxDollars: number } {
  const allVehicles = getVehicles();
  const rates = allVehicles.map((v) => v.hourly_rate_cents);
  return {
    minDollars: Math.floor(Math.min(...rates) / 100),
    maxDollars: Math.ceil(Math.max(...rates) / 100),
  };
}

function getFilterOptions(): FilterOptions {
  const allVehicles = getVehicles();

  const uniqueMakes = [...new Set(allVehicles.map((v) => v.make))].sort();
  const uniqueClassifications = [
    ...new Set(allVehicles.map((v) => v.classification)),
  ].sort();
  const uniquePassengerCounts = [
    ...new Set(allVehicles.map((v) => v.max_passengers)),
  ].sort((a, b) => a - b);

  return {
    makes: uniqueMakes,
    classifications: uniqueClassifications,
    passengerCounts: uniquePassengerCounts,
  };
}

function getVehicle(id: string) {
  const vehicle = getVehicleById(id);

  if (!vehicle) {
    throw new Error("NOT_FOUND: Vehicle not found");
  }

  return vehicle;
}

function getReservation(id: string) {
  const reservation = getReservationById(id);
  if (!reservation) {
    throw new Error("NOT_FOUND: Reservation not found");
  }
  return reservation;
}

export interface QuoteResult {
  totalPriceCents: number;
  hourlyRateCents: number;
  durationInHours: number;
  discountType: DiscountType | null;
  savingsCents: number;
  discountedTotalCents: number;
}

function getQuote(input: {
  vehicleId: string;
  startTime: string;
  endTime: string;
}): QuoteResult {
  const { vehicle, start, end } = validateReservationAndGetVehicle(input);
  const basePricing = calculateTotalPrice(start, end, vehicle.hourly_rate_cents);
  const discount = getApplicableDiscount(
    start.toJSDate(),
    end.toJSDate(),
    vehicle.hourly_rate_cents,
    basePricing.totalPriceCents,
  );
  return { ...basePricing, ...discount };
}

export const API = {
  searchVehicles,
  getFilterOptions,
  getPriceRange,
  getVehicle,
  getReservation,
  getQuote,
};
