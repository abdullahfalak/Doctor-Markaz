/**
 * Shared API utility for Doctor Markaz frontend.
 * All API calls go through this file — no hardcoded URLs elsewhere.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL as string;

/**
 * Build a full image URL from a relative server path.
 * Returns null if no image is stored.
 */
export function getImageUrl(profileImage: string | null | undefined): string | null {
  if (!profileImage) return null;
  if (profileImage.startsWith("http")) return profileImage;
  return `${API_URL}${profileImage}`;
}

/**
 * Parse a YYYY-MM-DD date string safely without UTC offset shifting.
 * Using new Date("2026-01-15") can shift to Jan 14 in Pakistan timezone.
 */
export function parseLocalDate(dateString: string): Date {
  const clean = dateString.split("T")[0];
  const [year, month, day] = clean.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format a date string (YYYY-MM-DD or ISO) for display.
 * Safe against timezone shifts.
 */
export function formatDate(dateString: string): string {
  if (!dateString) return "N/A";
  try {
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

/**
 * Format a time string (HH:MM:SS or HH:MM) to 12-hour display.
 */
export function formatTime(timeString: string): string {
  if (!timeString) return "N/A";
  const parts = timeString.split(":");
  if (parts.length < 2) return timeString;

  let hour = Number(parts[0]);
  const minute = parts[1];

  if (Number.isNaN(hour)) return timeString;

  const period = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;

  return `${hour}:${minute} ${period}`;
}

/**
 * Get today's date as YYYY-MM-DD string (local time, not UTC).
 */
export function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Appointment status color classes for Tailwind.
 */
export function getStatusClass(status: string): string {
  switch (status?.toLowerCase()) {
    case "confirmed":
      return "bg-green-100 text-green-700";
    case "cancelled":
      return "bg-red-100 text-red-700";
    case "completed":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-yellow-100 text-yellow-700";
  }
}

/**
 * Appointment status human-readable message.
 */
export function getStatusMessage(status: string): string {
  switch (status?.toLowerCase()) {
    case "confirmed":
      return "Your appointment has been confirmed by the doctor.";
    case "cancelled":
      return "Your appointment has been cancelled.";
    case "completed":
      return "Your appointment has been completed.";
    default:
      return "Your appointment is waiting for doctor confirmation.";
  }
}

/**
 * Render a 1–5 star rating as filled/empty star characters.
 * e.g. renderStars(4) → "★★★★☆"
 */
export function renderStars(rating: number): string {
  const clamped = Math.max(1, Math.min(5, Math.round(rating)));
  return "★".repeat(clamped) + "☆".repeat(5 - clamped);
}
