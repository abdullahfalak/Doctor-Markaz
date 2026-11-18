"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
const [bookedSlots, setBookedSlots] = useState<string[]>([]);
const [loadingBookedSlots, setLoadingBookedSlots] = useState(false);

type Doctor = {
  id: number;
  name: string;
  specialization: string;
  area: string;
  consultation_fee: string;
};

type Availability = {
  id?: number;
  doctor_id?: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
};

const days = [
  { value: 1, name: "Monday" },
  { value: 2, name: "Tuesday" },
  { value: 3, name: "Wednesday" },
  { value: 4, name: "Thursday" },
  { value: 5, name: "Friday" },
  { value: 6, name: "Saturday" },
  { value: 0, name: "Sunday" },
];

export default function BookAppointmentPage() {
  const params = useParams();
  const router = useRouter();

  const doctorId = params.id;

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");

  const [loadingDoctor, setLoadingDoctor] = useState(true);
  const [loadingAvailability, setLoadingAvailability] =
    useState(true);

  const [booking, setBooking] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // ==========================================
  // Get Doctor
  // ==========================================

  useEffect(() => {
    if (!doctorId) return;

    const fetchDoctor = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/doctors/${doctorId}`
        );

        const data = await response.json();

        if (!response.ok) {
          setError(data.message || "Doctor not found");
          return;
        }

        setDoctor(data.doctor);
      } catch (error) {
        console.error("Doctor fetch error:", error);
        setError("Unable to connect to server");
      } finally {
        setLoadingDoctor(false);
      }
    };

    fetchDoctor();
  }, [doctorId]);

  // ==========================================
  // Get Doctor Availability
  // ==========================================

  useEffect(() => {
    if (!doctorId) return;

    const fetchAvailability = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/doctors/${doctorId}/availability`
        );

        const data = await response.json();

        if (!response.ok) {
          setError(
            data.message || "Unable to load doctor availability"
          );
          return;
        }

        setAvailability(
          (data.availability || []).filter(
            (item: Availability) => item.is_available
          )
        );
      } catch (error) {
        console.error(
          "Availability fetch error:",
          error
        );

        setError(
          "Unable to load doctor availability"
        );
      } finally {
        setLoadingAvailability(false);
      }
    };

    fetchAvailability();
  }, [doctorId]);

  // ==========================================
  // Today's Date
  // ==========================================

  const today = useMemo(() => {
    const currentDate = new Date();

    const year = currentDate.getFullYear();
    const month = String(
      currentDate.getMonth() + 1
    ).padStart(2, "0");
    const day = String(
      currentDate.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }, []);

  // ==========================================
  // Selected Day Availability
  // ==========================================

  const selectedDayAvailability = useMemo(() => {
    if (!date) return null;

    const selectedDate = new Date(
      `${date}T00:00:00`
    );

    const dayOfWeek = selectedDate.getDay();

    return (
      availability.find(
        (item) =>
          item.day_of_week === dayOfWeek &&
          item.is_available
      ) || null
    );
  }, [date, availability]);

  // ==========================================
  // Generate Time Slots
  // ==========================================

  const timeSlots = useMemo(() => {
    if (!selectedDayAvailability) {
      return [];
    }

    const slots: string[] = [];

    const start = selectedDayAvailability.start_time.slice(
      0,
      5
    );

    const end = selectedDayAvailability.end_time.slice(
      0,
      5
    );

    const [startHour, startMinute] =
      start.split(":").map(Number);

    const [endHour, endMinute] =
      end.split(":").map(Number);

    let currentMinutes =
      startHour * 60 + startMinute;

    const endMinutes =
      endHour * 60 + endMinute;

    while (currentMinutes < endMinutes) {
      const hour = Math.floor(
        currentMinutes / 60
      );

      const minute =
        currentMinutes % 60;

      const formattedTime = `${String(
        hour
      ).padStart(2, "0")}:${String(
        minute
      ).padStart(2, "0")}`;

      slots.push(formattedTime);

      currentMinutes += 30;
    }

    return slots;
  }, [selectedDayAvailability]);
  const availableTimeSlots = useMemo(() => {
  return timeSlots.filter(
    (slot) => !bookedSlots.includes(slot)
  );
}, [timeSlots, bookedSlots]);

  // ==========================================
  // Handle Date Change
  // ==========================================

  const handleDateChange = async (
  selectedDate: string
) => {
  setDate(selectedDate);
  setTime("");
  setMessage("");
  setError("");
  setBookedSlots([]);

  if (!selectedDate) return;

  const selected = new Date(
    `${selectedDate}T00:00:00`
  );

  const dayOfWeek = selected.getDay();

  const available = availability.some(
    (item) =>
      item.day_of_week === dayOfWeek &&
      item.is_available
  );

  if (!available) {
    setError(
      "Doctor is not available on this day. Please select another date."
    );
    return;
  }

  // Get already booked slots
  setLoadingBookedSlots(true);

  try {
    const response = await fetch(
      `http://localhost:5000/api/doctors/${doctorId}/booked-slots?date=${selectedDate}`
    );

    const data = await response.json();

    if (!response.ok) {
      setError(
        data.message ||
          "Unable to load booked slots."
      );
      return;
    }

    setBookedSlots(
      data.booked_slots || []
    );
  } catch (error) {
    console.error(
      "Booked slots fetch error:",
      error
    );

    setError(
      "Unable to check booked appointment slots."
    );
  } finally {
    setLoadingBookedSlots(false);
  }
};
  // ==========================================
  // Book Appointment
  // ==========================================

  const handleBooking = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setMessage("");
    setError("");

    if (!date) {
      setError(
        "Please select an appointment date."
      );
      return;
    }

    if (!time) {
      setError(
        "Please select an appointment time."
      );
      return;
    }

    if (!selectedDayAvailability) {
      setError(
        "Doctor is not available on the selected date."
      );
      return;
    }

    if (!timeSlots.includes(time)) {
      setError(
        "Please select a valid available time slot."
      );
      return;
    }

    // Get JWT token
    const token = localStorage.getItem(
      "doctorMarkazToken"
    );

    // If user is not logged in
    if (!token) {
      router.push(
        `/login?redirect=${encodeURIComponent(
          `/doctor/${doctorId}/book`
        )}`
      );

      return;
    }

    setBooking(true);

    try {
      const response = await fetch(
        "http://localhost:5000/api/appointments",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            doctor_id: Number(doctorId),
            appointment_date: date,
            appointment_time: time,
            reason: reason,
          }),
        }
      );

      const data = await response.json();

      // Token invalid/expired
      if (response.status === 401) {
        localStorage.removeItem(
          "doctorMarkazToken"
        );

        localStorage.removeItem(
          "doctorMarkazUser"
        );

        router.push(
          `/login?redirect=${encodeURIComponent(
            `/doctor/${doctorId}/book`
          )}`
        );

        return;
      }

      if (!response.ok) {
        setError(
          data.message || "Booking failed"
        );

        return;
      }

      // Success
      setMessage(
        "Appointment booked successfully! Your appointment is pending confirmation."
      );

      setDate("");
      setTime("");
      setReason("");
    } catch (error) {
      console.error("Booking error:", error);

      setError(
        "Unable to connect to server"
      );
    } finally {
      setBooking(false);
    }
  };

  // ==========================================
  // Loading Doctor
  // ==========================================

  if (loadingDoctor) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">
          Loading doctor...
        </p>
      </main>
    );
  }

  // ==========================================
  // Doctor Not Found
  // ==========================================

  if (error && !doctor) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">
            😔
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            Doctor Not Found
          </h1>

          <p className="text-slate-500 mt-2">
            {error}
          </p>

          <Link
            href="/"
            className="inline-block mt-6 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white"
          >
            Back to Doctors
          </Link>
        </div>
      </main>
    );
  }

  // ==========================================
  // Booking Page
  // ==========================================

  return (
    <main className="min-h-screen bg-slate-50">

      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">

          <Link
            href="/"
            className="text-2xl font-bold text-blue-700"
          >
            Doctor Markaz
          </Link>

          <Link
            href="/dashboard"
            className="text-sm font-medium text-slate-600 hover:text-blue-600"
          >
            Dashboard
          </Link>

        </div>
      </header>

      {/* Main */}
      <section className="max-w-3xl mx-auto px-4 py-8">

        {/* Back */}
        <Link
          href={`/doctor/${doctorId}`}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          ← Back to Doctor
        </Link>

        {/* Booking Card */}
        <div className="bg-white rounded-3xl shadow-sm p-6 sm:p-8 mt-6">

          {/* Doctor Information */}
          <div className="border-b pb-6 mb-6">

            <p className="text-sm text-blue-600 font-medium">
              Booking Appointment
            </p>

            <h1 className="text-3xl font-bold text-slate-900 mt-2">
              {doctor?.name}
            </h1>

            <p className="text-slate-500 mt-2">
              {doctor?.specialization}
            </p>

            <p className="text-slate-500 mt-1">
              📍 {doctor?.area}
            </p>

            <p className="text-slate-700 font-semibold mt-3">
              Consultation Fee: Rs.{" "}
              {doctor?.consultation_fee}
            </p>

          </div>

          {/* Availability Loading */}
          {loadingAvailability ? (
            <div className="rounded-xl bg-blue-50 px-4 py-4 text-blue-700 mb-6">
              Loading doctor availability...
            </div>
          ) : availability.length === 0 ? (
            <div className="rounded-xl bg-yellow-50 px-4 py-4 text-yellow-700 mb-6">
              This doctor has not set any available
              appointment time yet.
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-4 mb-6">

              <p className="text-sm font-semibold text-slate-800">
                Doctor's Available Days
              </p>

              <div className="flex flex-wrap gap-2 mt-3">
                {days
                  .filter((day) =>
                    availability.some(
                      (item) =>
                        item.day_of_week ===
                          day.value &&
                        item.is_available
                    )
                  )
                  .map((day) => (
                    <span
                      key={day.value}
                      className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700"
                    >
                      {day.name}
                    </span>
                  ))}
              </div>

            </div>
          )}

          {/* Form */}
          <form
            onSubmit={handleBooking}
            className="space-y-6"
          >

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Appointment Date
              </label>

              <input
                type="date"
                value={date}
                onChange={(e) =>
                  handleDateChange(
                    e.target.value
                  )
                }
                required
                min={today}
                disabled={
                  loadingAvailability ||
                  availability.length === 0
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:cursor-not-allowed"
              />

              {date &&
                !selectedDayAvailability && (
                  <p className="text-sm text-red-600 mt-2">
                    Doctor is not available on this
                    day.
                  </p>
                )}
            </div>

            {/* Time */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Appointment Time
              </label>

              <select
                value={time}
                onChange={(e) =>
                  setTime(e.target.value)
                }
                required
                disabled={
                  !date ||
                  !selectedDayAvailability ||
                  timeSlots.length === 0
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:cursor-not-allowed"
              >
                <option value="">
                  {!date
                    ? "First select a date"
                    : !selectedDayAvailability
                    ? "Doctor unavailable on this day"
                    : "Select available time"}
                </option>

                {timeSlots.map((slot) => (
                  <option
                    key={slot}
                    value={slot}
                  >
                    {slot}
                  </option>
                ))}
              </select>

              {selectedDayAvailability && (
                <p className="text-xs text-slate-500 mt-2">
                  Available from{" "}
                  {selectedDayAvailability.start_time.slice(
                    0,
                    5
                  )}{" "}
                  to{" "}
                  {selectedDayAvailability.end_time.slice(
                    0,
                    5
                  )}
                </p>
              )}
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Reason for Visit
              </label>

              <textarea
                value={reason}
                onChange={(e) =>
                  setReason(e.target.value)
                }
                placeholder="Example: Fever, checkup, headache..."
                rows={4}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Success Message */}
            {message && (
              <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-green-700">
                {message}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-600">
                {error}
              </div>
            )}

            {/* Button */}
            <button
              type="submit"
              disabled={
                booking ||
                loadingAvailability ||
                availability.length === 0 ||
                !date ||
                !time ||
                !selectedDayAvailability
              }
              className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {booking
                ? "Booking Appointment..."
                : "📅 Book Appointment"}
            </button>

          </form>

        </div>
      </section>

    </main>
  );
}