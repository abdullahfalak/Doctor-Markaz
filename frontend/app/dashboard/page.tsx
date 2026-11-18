"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  API_URL,
  formatDate,
  formatTime,
  getStatusClass,
  getStatusMessage,
} from "@/lib/api";

type User = {
  id: number;
  name: string;
  phone: string;
  role: string;
};

type Appointment = {
  id: number;
  appointment_date: string;
  appointment_time: string;
  status: string;
  reason: string | null;
  created_at: string;
  doctor_id: number;
  doctor_name: string;
  specialization: string;
  area: string;
  clinic_name: string;
  address: string;
  profile_image: string | null;
  consultation_fee: number;
};

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("doctorMarkazUser");
    const token = localStorage.getItem("doctorMarkazToken");

    if (!storedUser || !token) {
      router.push("/login");
      return;
    }

    const parsedUser = JSON.parse(storedUser);

    if (parsedUser.role !== "patient") {
      if (parsedUser.role === "doctor") {
        router.push("/doctor-dashboard");
      } else if (parsedUser.role === "admin") {
        router.push("/admin-dashboard");
      } else {
        router.push("/login");
      }
      return;
    }

    setUser(parsedUser);
    fetchAppointments(token);
  }, [router]);

  const fetchAppointments = async (token: string) => {
    try {
      const response = await fetch(`${API_URL}/api/appointments/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        localStorage.removeItem("doctorMarkazToken");
        localStorage.removeItem("doctorMarkazUser");
        router.push("/login");
        return;
      }

      const data = await response.json();

      if (data.success) {
        setAppointments(data.appointments || []);
      }
    } catch (error) {
      console.error("Failed to load appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (appointmentId: number) => {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;

    const token = localStorage.getItem("doctorMarkazToken");
    if (!token) {
      router.push("/login");
      return;
    }

    setCancellingId(appointmentId);

    try {
      const response = await fetch(
        `${API_URL}/api/appointments/${appointmentId}/cancel`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.status === 401) {
        localStorage.removeItem("doctorMarkazToken");
        localStorage.removeItem("doctorMarkazUser");
        router.push("/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Could not cancel appointment.");
        return;
      }

      // Refresh appointments
      await fetchAppointments(token);
    } catch (error) {
      console.error("Cancel error:", error);
      alert("Unable to connect to server.");
    } finally {
      setCancellingId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("doctorMarkazToken");
    localStorage.removeItem("doctorMarkazUser");
    router.push("/login");
  };

  // Split appointments into upcoming and past
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingAppointments = appointments.filter((a) => {
    const [y, m, d] = a.appointment_date.split("T")[0].split("-").map(Number);
    const apptDate = new Date(y, m - 1, d);
    return (
      apptDate >= today &&
      a.status !== "cancelled" &&
      a.status !== "completed"
    );
  });

  const pastAppointments = appointments.filter((a) => {
    const [y, m, d] = a.appointment_date.split("T")[0].split("-").map(Number);
    const apptDate = new Date(y, m - 1, d);
    return (
      apptDate < today ||
      a.status === "cancelled" ||
      a.status === "completed"
    );
  });

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-2xl font-bold text-blue-700">
            Doctor Markaz
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 sm:block"
            >
              Find Doctors
            </Link>

            <button
              onClick={handleLogout}
              className="rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Welcome */}
        <div className="mb-8">
          <p className="mb-2 text-sm font-medium text-blue-600">
            Patient Dashboard
          </p>

          <h1 className="text-3xl font-bold text-slate-900">
            Welcome, {user?.name || "Patient"} 👋
          </h1>

          <p className="mt-2 text-slate-500">
            Manage your appointments and doctor visits from here.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/"
            className="rounded-2xl bg-blue-600 p-6 text-white shadow-sm transition hover:bg-blue-700"
          >
            <div className="mb-3 text-3xl">🔎</div>
            <h2 className="text-lg font-bold">Find a Doctor</h2>
            <p className="mt-1 text-sm text-blue-100">
              Search doctors by area and specialization.
            </p>
          </Link>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="mb-3 text-3xl">📅</div>
            <h2 className="text-lg font-bold text-slate-900">My Appointments</h2>
            <p className="mt-1 text-sm text-slate-500">
              You have{" "}
              <span className="font-semibold text-blue-600">
                {upcomingAppointments.length}
              </span>{" "}
              upcoming appointment
              {upcomingAppointments.length !== 1 ? "s" : ""}.
            </p>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>
            <p className="text-slate-500">Loading your appointments...</p>
          </div>
        )}

        {/* No appointments at all */}
        {!loading && appointments.length === 0 && (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 text-5xl">📅</div>
            <h3 className="text-xl font-bold text-slate-900">
              No appointments yet
            </h3>
            <p className="mx-auto mt-2 max-w-md text-slate-500">
              You have not booked any appointment yet. Find a doctor and book
              your first appointment.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Find a Doctor
            </Link>
          </div>
        )}

        {/* Upcoming Appointments */}
        {!loading && upcomingAppointments.length > 0 && (
          <div className="mb-10">
            <h2 className="mb-4 text-xl font-bold text-slate-900">
              Upcoming Appointments
            </h2>

            <div className="space-y-5">
              {upcomingAppointments.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  cancellingId={cancellingId}
                  onCancel={handleCancel}
                />
              ))}
            </div>
          </div>
        )}

        {/* Past Appointments */}
        {!loading && pastAppointments.length > 0 && (
          <div>
            <h2 className="mb-4 text-xl font-bold text-slate-900">
              Past Appointments
            </h2>

            <div className="space-y-5">
              {pastAppointments.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  cancellingId={cancellingId}
                  onCancel={handleCancel}
                />
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

// ==========================================
// Appointment Card Component
// ==========================================

function AppointmentCard({
  appointment,
  cancellingId,
  onCancel,
}: {
  appointment: Appointment;
  cancellingId: number | null;
  onCancel: (id: number) => void;
}) {
  const canCancel =
    appointment.status === "pending" || appointment.status === "confirmed";

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      {/* Top Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">
            {appointment.doctor_name}
          </h3>
          <p className="mt-1 font-medium text-blue-600">
            {appointment.specialization}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            🏥 {appointment.clinic_name || appointment.area}
          </p>
        </div>

        {/* Status Badge */}
        <div className="text-left md:text-right">
          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold capitalize ${getStatusClass(
              appointment.status
            )}`}
          >
            {appointment.status}
          </span>
          <p className="mt-2 max-w-xs text-sm text-slate-500">
            {getStatusMessage(appointment.status)}
          </p>
        </div>
      </div>

      {/* Appointment Details */}
      <div className="mt-6 grid gap-4 border-t pt-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Date
          </p>
          <p className="mt-1 font-semibold text-slate-800">
            📅 {formatDate(appointment.appointment_date)}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Time
          </p>
          <p className="mt-1 font-semibold text-slate-800">
            🕐 {formatTime(appointment.appointment_time)}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Consultation Fee
          </p>
          <p className="mt-1 font-semibold text-slate-800">
            Rs. {Number(appointment.consultation_fee).toLocaleString()}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Appointment ID
          </p>
          <p className="mt-1 font-semibold text-slate-800">
            #{appointment.id}
          </p>
        </div>
      </div>

      {/* Reason */}
      {appointment.reason && (
        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Reason for Visit
          </p>
          <p className="mt-1 text-sm text-slate-700">{appointment.reason}</p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={`/doctor/${appointment.doctor_id}`}
          className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          View Doctor
        </Link>

        {/* Cancel Button — only for pending or confirmed */}
        {canCancel && (
          <button
            onClick={() => onCancel(appointment.id)}
            disabled={cancellingId === appointment.id}
            className="rounded-xl bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancellingId === appointment.id
              ? "Cancelling..."
              : "Cancel Appointment"}
          </button>
        )}

        {/* Book Again — only for cancelled */}
        {appointment.status === "cancelled" && (
          <Link
            href={`/doctor/${appointment.doctor_id}/book`}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Book Again
          </Link>
        )}
      </div>
    </div>
  );
}
