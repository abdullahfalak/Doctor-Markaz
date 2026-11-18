"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL, formatDate, formatTime, getStatusClass, getImageUrl } from "@/lib/api";

type Appointment = {
  id: number;
  appointment_date: string;
  appointment_time: string;
  status: string;
  reason: string | null;
  patient_name: string;
  patient_phone: string;
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

export default function DoctorDashboard() {
  const router = useRouter();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [availability, setAvailability] = useState<Availability[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState("");
  const [scheduleError, setScheduleError] = useState("");

  // ==========================================
  // Authentication
  // ==========================================

  useEffect(() => {
    const token = localStorage.getItem("doctorMarkazToken");
    const userData = localStorage.getItem("doctorMarkazUser");

    if (!token || !userData) {
      router.push("/login");
      return;
    }

    try {
      const user = JSON.parse(userData);

      if (user.role !== "doctor") {
        router.push("/dashboard");
        return;
      }

      fetchAppointments(token);
      fetchAvailability(token);
    } catch (error) {
      console.error(error);

      localStorage.removeItem("doctorMarkazToken");
      localStorage.removeItem("doctorMarkazUser");

      router.push("/login");
    }
  }, [router]);

  // ==========================================
  // Logout / Session Expired
  // ==========================================

  const logout = () => {
    localStorage.removeItem("doctorMarkazToken");
    localStorage.removeItem("doctorMarkazUser");

    router.push("/login");
  };

  const handleUnauthorized = () => {
    localStorage.removeItem("doctorMarkazToken");
    localStorage.removeItem("doctorMarkazUser");

    router.push("/login");
  };

  // ==========================================
  // Get Doctor Appointments
  // ==========================================

  const fetchAppointments = async (token: string) => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/doctor/appointments`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        setError(data.message || "Failed to load appointments");
        return;
      }

      setAppointments(data.appointments || []);
    } catch (error) {
      console.error("Fetch appointments error:", error);

      setError("Unable to connect to server.");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // Get Doctor Availability
  // ==========================================

  const fetchAvailability = async (token: string) => {
    try {
      setLoadingSchedule(true);
      setScheduleError("");

      const response = await fetch(
        `${API_URL}/api/doctor/availability`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        setScheduleError(
          data.message || "Failed to load schedule"
        );
        return;
      }

      const savedAvailability: Availability[] =
        data.availability || [];

      const completeSchedule: Availability[] = days.map((day) => {
        const existing = savedAvailability.find(
          (item) => item.day_of_week === day.value
        );

        if (existing) {
          return {
            ...existing,
            day_of_week: day.value,
            start_time: existing.start_time
              ? existing.start_time.slice(0, 5)
              : "09:00",
            end_time: existing.end_time
              ? existing.end_time.slice(0, 5)
              : "17:00",
            is_available: existing.is_available,
          };
        }

        return {
          day_of_week: day.value,
          start_time: "09:00",
          end_time: "17:00",
          is_available: false,
        };
      });

      setAvailability(completeSchedule);
    } catch (error) {
      console.error("Fetch availability error:", error);

      setScheduleError("Unable to connect to server.");
    } finally {
      setLoadingSchedule(false);
    }
  };

  // ==========================================
  // Update Appointment Status
  // ==========================================

  const updateAppointmentStatus = async (
    appointmentId: number,
    status: string
  ) => {
    const token = localStorage.getItem("doctorMarkazToken");

    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/doctor/appointments/${appointmentId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status,
          }),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        alert(
          data.message || "Failed to update appointment."
        );
        return;
      }

      await fetchAppointments(token);
    } catch (error) {
      console.error("Update appointment error:", error);

      alert("Unable to connect to server.");
    }
  };

  // ==========================================
  // Update Schedule Day
  // ==========================================

  const updateScheduleDay = (
    dayOfWeek: number,
    field: keyof Availability,
    value: string | boolean
  ) => {
    setAvailability((previous) =>
      previous.map((item) =>
        item.day_of_week === dayOfWeek
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );

    setScheduleMessage("");
    setScheduleError("");
  };

  // ==========================================
  // Save Doctor Schedule
  // ==========================================

  const saveAvailability = async () => {
    const token = localStorage.getItem("doctorMarkazToken");

    if (!token) {
      router.push("/login");
      return;
    }

    setScheduleMessage("");
    setScheduleError("");

    const enabledDays = availability.filter(
      (item) => item.is_available
    );

    // Validate time
    for (const item of enabledDays) {
      if (!item.start_time || !item.end_time) {
        const dayName =
          days.find(
            (day) => day.value === item.day_of_week
          )?.name || "selected day";

        setScheduleError(
          `Please select start and end time for ${dayName}.`
        );

        return;
      }

      if (item.start_time >= item.end_time) {
        const dayName =
          days.find(
            (day) => day.value === item.day_of_week
          )?.name || "selected day";

        setScheduleError(
          `End time must be later than start time for ${dayName}.`
        );

        return;
      }
    }

    try {
      setSavingSchedule(true);

      const response = await fetch(
        `${API_URL}/api/doctor/availability`,
        {
          method: "PUT",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            availability: enabledDays.map((item) => ({
              day_of_week: item.day_of_week,
              start_time: item.start_time,
              end_time: item.end_time,
              is_available: true,
            })),
          }),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        setScheduleError(
          data.message || "Failed to save schedule."
        );

        return;
      }

      setScheduleMessage(
        "Your schedule has been saved successfully."
      );

      await fetchAvailability(token);
    } catch (error) {
      console.error("Save availability error:", error);

      setScheduleError("Unable to connect to server.");
    } finally {
      setSavingSchedule(false);
    }
  };

  // ==========================================
  // Loading
  // ==========================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-3 text-4xl">👨‍⚕️</div>

          <p className="text-gray-600">
            Loading Doctor Dashboard...
          </p>
        </div>
      </main>
    );
  }

  // ==========================================
  // Dashboard
  // ==========================================

  return (
    <main className="min-h-screen bg-gray-50">

      {/* Header */}

      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">

          <div>
            <h1 className="text-2xl font-bold text-blue-700">
              Doctor Markaz
            </h1>

            <p className="text-sm text-gray-500">
              Doctor Dashboard
            </p>
          </div>

          <button
            onClick={logout}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
          >
            Logout
          </button>

        </div>
      </header>

      {/* Main */}

      <div className="mx-auto max-w-6xl px-4 py-8">

        {/* Welcome */}

        <div className="mb-8 rounded-2xl bg-blue-700 p-6 text-white">

          <h2 className="text-2xl font-bold">
            Welcome, Doctor 👨‍⚕️
          </h2>

          <p className="mt-2 text-blue-100">
            Manage your patient appointments and
            consultation schedule from here.
          </p>

        </div>

        {/* Stats */}

        <div className="mb-8 grid gap-4 sm:grid-cols-3">

          {/* Total */}

          <div className="rounded-2xl bg-white p-5 shadow-sm">

            <p className="text-sm text-gray-500">
              Total Appointments
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {appointments.length}
            </p>

          </div>

          {/* Pending */}

          <div className="rounded-2xl bg-white p-5 shadow-sm">

            <p className="text-sm text-gray-500">
              Pending
            </p>

            <p className="mt-2 text-3xl font-bold text-yellow-600">
              {
                appointments.filter(
                  (item) => item.status === "pending"
                ).length
              }
            </p>

          </div>

          {/* Confirmed */}

          <div className="rounded-2xl bg-white p-5 shadow-sm">

            <p className="text-sm text-gray-500">
              Confirmed
            </p>

            <p className="mt-2 text-3xl font-bold text-green-600">
              {
                appointments.filter(
                  (item) => item.status === "confirmed"
                ).length
              }
            </p>

          </div>

        </div>

        {/* ==========================================
            MY SCHEDULE
        ========================================== */}

        <section className="mb-10 rounded-2xl bg-white p-6 shadow-sm">

          <div className="mb-6">

            <h2 className="text-xl font-bold text-gray-900">
              📅 My Schedule
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Set the days and times when patients can
              book appointments with you.
            </p>

          </div>

          {/* Schedule Error */}

          {scheduleError && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {scheduleError}
            </div>
          )}

          {/* Schedule Success */}

          {scheduleMessage && (
            <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
              {scheduleMessage}
            </div>
          )}

          {/* Loading Schedule */}

          {loadingSchedule ? (
            <div className="rounded-xl bg-gray-50 p-8 text-center">

              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>

              <p className="text-sm text-gray-500">
                Loading your schedule...
              </p>

            </div>
          ) : (
            <div className="space-y-4">

              {availability.map((item) => {

                const day = days.find(
                  (day) =>
                    day.value === item.day_of_week
                );

                return (
                  <div
                    key={item.day_of_week}
                    className={`rounded-xl border p-4 transition ${
                      item.is_available
                        ? "border-blue-200 bg-blue-50/50"
                        : "border-gray-200 bg-gray-50"
                    }`}
                  >

                    <div className="grid gap-4 md:grid-cols-[180px_1fr_1fr] md:items-center">

                      {/* Day */}

                      <div className="flex items-center gap-3">

                        <input
                          type="checkbox"
                          checked={item.is_available}
                          onChange={(e) =>
                            updateScheduleDay(
                              item.day_of_week,
                              "is_available",
                              e.target.checked
                            )
                          }
                          className="h-5 w-5 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />

                        <div>

                          <p className="font-semibold text-gray-900">
                            {day?.name}
                          </p>

                          <p className="text-xs text-gray-500">
                            {item.is_available
                              ? "Available"
                              : "Unavailable"}
                          </p>

                        </div>

                      </div>

                      {/* Start Time */}

                      <div>

                        <label className="mb-1 block text-xs font-medium text-gray-500">
                          Start Time
                        </label>

                        <input
                          type="time"
                          value={item.start_time}
                          disabled={!item.is_available}
                          onChange={(e) =>
                            updateScheduleDay(
                              item.day_of_week,
                              "start_time",
                              e.target.value
                            )
                          }
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                        />

                      </div>

                      {/* End Time */}

                      <div>

                        <label className="mb-1 block text-xs font-medium text-gray-500">
                          End Time
                        </label>

                        <input
                          type="time"
                          value={item.end_time}
                          disabled={!item.is_available}
                          onChange={(e) =>
                            updateScheduleDay(
                              item.day_of_week,
                              "end_time",
                              e.target.value
                            )
                          }
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                        />

                      </div>

                    </div>

                  </div>
                );
              })}

            </div>
          )}

          {/* Save Schedule */}

          {!loadingSchedule && (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

              <p className="text-sm text-gray-500">
                Only selected available days will be saved.
              </p>

              <button
                onClick={saveAvailability}
                disabled={savingSchedule}
                className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {savingSchedule
                  ? "Saving Schedule..."
                  : "💾 Save Schedule"}
              </button>

            </div>
          )}

        </section>

        {/* Appointment Error */}

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">
            {error}
          </div>
        )}

        {/* Appointment Heading */}

        <h2 className="mb-4 text-xl font-bold text-gray-900">
          Patient Appointments
        </h2>

        {/* No Appointments */}

        {!error && appointments.length === 0 && (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">

            <div className="mb-3 text-4xl">
              📅
            </div>

            <p className="text-gray-500">
              No appointments found.
            </p>

          </div>
        )}

        {/* Appointment Cards */}

        <div className="space-y-4">

          {appointments.map((appointment) => (

            <div
              key={appointment.id}
              className="rounded-2xl bg-white p-6 shadow-sm"
            >

              {/* Information */}

              <div className="grid gap-6 md:grid-cols-3">

                {/* Patient */}

                <div>

                  <p className="text-sm text-gray-500">
                    Patient
                  </p>

                  <h3 className="mt-1 text-lg font-bold text-gray-900">
                    {appointment.patient_name}
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    📞 {appointment.patient_phone}
                  </p>

                </div>

                {/* Appointment */}

                <div>

                  <p className="text-sm text-gray-500">
                    Appointment
                  </p>

                  <p className="mt-1 font-semibold text-gray-900">
                    📅{" "}
                    {formatDate(
                      appointment.appointment_date
                    )}
                  </p>

                  <p className="mt-1 text-sm text-gray-600">
                    🕐{" "}
                    {formatTime(
                      appointment.appointment_time
                    )}
                  </p>

                </div>

                {/* Status */}

                <div>

                  <p className="text-sm text-gray-500">
                    Status
                  </p>

                  <span
                    className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-semibold capitalize ${getStatusClass(
                      appointment.status
                    )}`}
                  >
                    {appointment.status}
                  </span>

                </div>

              </div>

              {/* Reason */}

              {appointment.reason && (
                <div className="mt-5 rounded-xl bg-gray-50 p-4">

                  <p className="text-sm font-semibold text-gray-700">
                    Reason
                  </p>

                  <p className="mt-1 text-sm text-gray-600">
                    {appointment.reason}
                  </p>

                </div>
              )}

              {/* Pending Actions */}

              {appointment.status === "pending" && (
                <div className="mt-5 flex flex-wrap gap-3">

                  <button
                    onClick={() =>
                      updateAppointmentStatus(
                        appointment.id,
                        "confirmed"
                      )
                    }
                    className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
                  >
                    ✅ Confirm Appointment
                  </button>

                  <button
                    onClick={() =>
                      updateAppointmentStatus(
                        appointment.id,
                        "cancelled"
                      )
                    }
                    className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    ❌ Cancel Appointment
                  </button>

                </div>
              )}

              {/* Confirmed Action */}

              {appointment.status === "confirmed" && (
                <div className="mt-5">

                  <button
                    onClick={() =>
                      updateAppointmentStatus(
                        appointment.id,
                        "completed"
                      )
                    }
                    className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    ✅ Mark as Completed
                  </button>

                </div>
              )}

              {/* Completed */}

              {appointment.status === "completed" && (
                <div className="mt-5 rounded-lg bg-blue-50 p-3 text-sm font-medium text-blue-700">
                  ✅ Appointment completed
                </div>
              )}

              {/* Cancelled */}

              {appointment.status === "cancelled" && (
                <div className="mt-5 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
                  ❌ Appointment cancelled
                </div>
              )}

            </div>

          ))}

        </div>

      </div>

    </main>
  );
}