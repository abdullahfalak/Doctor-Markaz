
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type Doctor = {
  id: number;
  name: string;
  specialization: string;
  area: string;
  qualification: string;
  experience: number;
  consultation_fee: string;
  clinic_name: string;
  address: string;
  bio: string;
  profile_image: string | null;
  is_verified: boolean;
};

type Specialization = {
  id: number;
  name: string;
};

type Area = {
  id: number;
  name: string;
};

export default function HomePage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);

  const [area, setArea] = useState("");
  const [specialization, setSpecialization] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [dashboardPath, setDashboardPath] = useState("/dashboard");

  // ==========================================
  // Load Areas, Specializations & Login Status
  // ==========================================

  useEffect(() => {
    const token = localStorage.getItem("doctorMarkazToken");
    const storedUser = localStorage.getItem("doctorMarkazUser");

    if (token && storedUser) {
      try {
        const user = JSON.parse(storedUser);

        setIsLoggedIn(true);

        if (user.role === "doctor") {
          setDashboardPath("/doctor-dashboard");
        } else if (user.role === "admin") {
          setDashboardPath("/admin-dashboard");
        } else {
          setDashboardPath("/dashboard");
        }
      } catch (error) {
        console.error("Invalid saved user data:", error);
        setIsLoggedIn(false);
        setDashboardPath("/dashboard");
      }
    } else {
      setIsLoggedIn(false);
      setDashboardPath("/dashboard");
    }

    const fetchFilters = async () => {
      try {
        const [areasRes, specsRes] = await Promise.all([
          fetch(`${API_URL}/api/public/areas`),
          fetch(`${API_URL}/api/public/specializations`),
        ]);

        if (areasRes.ok) {
          const areasData = await areasRes.json();
          setAreas(areasData.areas || []);
        }

        if (specsRes.ok) {
          const specsData = await specsRes.json();
          setSpecializations(specsData.specializations || []);
        }
      } catch (error) {
        console.error("Filter fetch error:", error);
      }
    };

    fetchFilters();
    fetchDoctors();
  }, []);

  // ==========================================
  // Get Doctors
  // ==========================================

  const fetchDoctors = async (
    areaFilter = "",
    specFilter = ""
  ) => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (areaFilter) params.append("area", areaFilter);
      if (specFilter) params.append("specialization", specFilter);

      const url = params.toString()
        ? `${API_URL}/api/doctors/search?${params.toString()}`
        : `${API_URL}/api/doctors/search`;

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to load doctors");
        return;
      }

      setDoctors(data.doctors || []);
    } catch (error) {
      console.error("Doctor fetch error:", error);
      setError("Unable to connect to Doctor Markaz server.");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // Search
  // ==========================================

  const handleSearch = () => {
    fetchDoctors(area, specialization);
  };

  // ==========================================
  // Clear Filters
  // ==========================================

  const clearFilters = () => {
    setArea("");
    setSpecialization("");
    fetchDoctors("", "");
  };

  // ==========================================
  // Logout
  // ==========================================

  const handleLogout = () => {
    localStorage.removeItem("doctorMarkazToken");
    localStorage.removeItem("doctorMarkazUser");

    setIsLoggedIn(false);
    setDashboardPath("/dashboard");

    window.location.href = "/";
  };

  // ==========================================
  // Build Image URL
  // ==========================================

  const getImageUrl = (profileImage: string | null) => {
    if (!profileImage) return null;

    if (profileImage.startsWith("http")) {
      return profileImage;
    }

    return `${API_URL}${profileImage}`;
  };

  return (
    <main className="min-h-screen bg-slate-50">

      {/* ======================================
          Header
      ======================================= */}

      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">

            {/* Logo */}
            <Link
              href="/"
              className="text-2xl sm:text-3xl font-bold text-blue-700"
            >
              Doctor Markaz
            </Link>

            {/* Navigation */}
            <nav className="flex items-center gap-3">

              <Link
                href="/"
                className="hidden sm:block text-sm font-medium text-slate-600 hover:text-blue-600"
              >
                Home
              </Link>

              {isLoggedIn ? (
                <>
                  <Link
                    href={dashboardPath}
                    className="text-sm font-medium text-slate-600 hover:text-blue-600"
                  >
                    Dashboard
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Login
                </Link>
              )}

            </nav>
          </div>
        </div>
      </header>

      {/* ======================================
          Hero Section
      ======================================= */}

      <section className="bg-linear-to-b from-blue-50 to-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
          <div className="max-w-3xl mx-auto text-center">

            <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 mb-5">
              🏥 Easy Doctor Appointment
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900">
              Find the Right Doctor
              <span className="block text-blue-600 mt-2">
                Near You
              </span>
            </h1>

            <p className="mt-5 text-base sm:text-lg text-slate-600 leading-7">
              Find doctors in your area and book your appointment easily from
              home.
            </p>

          </div>

          {/* ==================================
              Search Box
          =================================== */}

          <div className="max-w-5xl mx-auto mt-10">
            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-4 sm:p-6">

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* Area */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    📍 Select Area
                  </label>

                  <select
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">All Areas</option>

                    {areas.map((item) => (
                      <option key={item.id} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Specialization */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    🩺 Specialization
                  </label>

                  <select
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">All Specializations</option>

                    {specializations.map((item) => (
                      <option key={item.id} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search Button */}
                <div className="flex items-end">
                  <button
                    onClick={handleSearch}
                    disabled={loading}
                    className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    🔎 {loading ? "Searching..." : "Search Doctors"}
                  </button>
                </div>

              </div>

              {/* Clear Filters */}
              {(area || specialization) && (
                <div className="mt-4 text-center">
                  <button
                    onClick={clearFilters}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800"
                  >
                    Clear Filters
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      </section>

      {/* ======================================
          Doctors Section
      ======================================= */}

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">

        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">

          <div>
            <p className="text-sm font-semibold text-blue-600">
              AVAILABLE DOCTORS
            </p>

            <h2 className="text-3xl font-bold text-slate-900 mt-1">
              Find a Doctor
            </h2>
          </div>

          {!loading && (
            <p className="text-sm text-slate-500">
              {doctors.length} doctor{doctors.length !== 1 ? "s" : ""} found
            </p>
          )}

        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="text-center">
              <div className="h-10 w-10 mx-auto rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin"></div>

              <p className="mt-4 text-slate-500">
                Finding doctors...
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-2xl bg-red-50 border border-red-100 p-6 text-center">

            <div className="text-4xl mb-3">⚠️</div>

            <h3 className="font-semibold text-red-800">
              Something went wrong
            </h3>

            <p className="text-red-600 mt-2">
              {error}
            </p>

            <button
              onClick={() => fetchDoctors(area, specialization)}
              className="mt-4 rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white hover:bg-red-700"
            >
              Try Again
            </button>

          </div>
        )}

        {/* No Doctors */}
        {!loading && !error && doctors.length === 0 && (
          <div className="rounded-3xl bg-white border border-slate-100 p-10 text-center">

            <div className="text-6xl mb-5">🩺</div>

            <h3 className="text-xl font-bold text-slate-900">
              No doctors found
            </h3>

            <p className="text-slate-500 mt-2">
              Try another area or specialization.
            </p>

            <button
              onClick={clearFilters}
              className="mt-5 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Show All Doctors
            </button>

          </div>
        )}

        {/* Doctor Cards */}
        {!loading && !error && doctors.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {doctors.map((doctor) => {
              const imageUrl = getImageUrl(doctor.profile_image);

              return (
                <div
                  key={doctor.id}
                  className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-lg transition-shadow"
                >

                  {/* Doctor Top */}
                  <div className="p-6">

                    <div className="flex items-start gap-4">

                      {/* Profile Image */}
                      <div className="h-16 w-16 shrink-0 rounded-2xl bg-blue-50 flex items-center justify-center overflow-hidden">

                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={doctor.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-3xl">
                            👨‍⚕️
                          </span>
                        )}

                      </div>

                      {/* Name */}
                      <div className="min-w-0">

                        <div className="flex items-center gap-2">

                          <h3 className="text-lg font-bold text-slate-900 truncate">
                            {doctor.name}
                          </h3>

                          {doctor.is_verified && (
                            <span
                              title="Verified Doctor"
                              className="shrink-0 text-blue-600"
                            >
                              ✓
                            </span>
                          )}

                        </div>

                        <p className="text-sm text-blue-600 font-medium mt-1">
                          {doctor.specialization}
                        </p>

                      </div>
                    </div>

                    {/* Doctor Details */}
                    <div className="mt-5 space-y-3">

                      <div className="flex items-center gap-3 text-sm text-slate-600">
                        <span className="text-lg">📍</span>
                        <span>{doctor.area}</span>
                      </div>

                      <div className="flex items-center gap-3 text-sm text-slate-600">
                        <span className="text-lg">🎓</span>
                        <span>{doctor.qualification}</span>
                      </div>

                      <div className="flex items-center gap-3 text-sm text-slate-600">
                        <span className="text-lg">💼</span>
                        <span>{doctor.experience} years experience</span>
                      </div>

                      <div className="flex items-center gap-3 text-sm text-slate-600">
                        <span className="text-lg">🏥</span>
                        <span className="truncate">{doctor.clinic_name}</span>
                      </div>

                    </div>

                    {/* Fee */}
                    <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 flex items-center justify-between">

                      <span className="text-sm text-slate-500">
                        Consultation Fee
                      </span>

                      <span className="font-bold text-slate-900">
                        Rs. {doctor.consultation_fee}
                      </span>

                    </div>

                  </div>

                  {/* Card Buttons */}
                  <div className="border-t border-slate-100 p-4 grid grid-cols-2 gap-3">

                    <Link
                      href={`/doctor/${doctor.id}`}
                      className="rounded-xl border border-blue-600 px-4 py-3 text-center text-sm font-semibold text-blue-600 hover:bg-blue-50"
                    >
                      👁️ View Doctor
                    </Link>

                    <Link
                      href={`/doctor/${doctor.id}/book`}
                      className="rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      📅 Book
                    </Link>

                  </div>

                </div>
              );
            })}

          </div>
        )}

      </section>

      {/* ======================================
          How It Works
      ======================================= */}

      <section className="bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">

          <div className="text-center max-w-2xl mx-auto">

            <p className="text-sm font-semibold text-blue-600">
              SIMPLE PROCESS
            </p>

            <h2 className="text-3xl font-bold text-slate-900 mt-2">
              How Doctor Markaz Works
            </h2>

            <p className="text-slate-500 mt-3">
              Booking your doctor is simple and easy.
            </p>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">

            <div className="text-center rounded-2xl bg-slate-50 p-7">
              <div className="h-14 w-14 mx-auto rounded-2xl bg-blue-100 flex items-center justify-center text-2xl">
                🔎
              </div>

              <h3 className="font-bold text-lg text-slate-900 mt-5">
                Find a Doctor
              </h3>

              <p className="text-sm text-slate-500 mt-2">
                Search doctors by area and specialization.
              </p>
            </div>

            <div className="text-center rounded-2xl bg-slate-50 p-7">
              <div className="h-14 w-14 mx-auto rounded-2xl bg-blue-100 flex items-center justify-center text-2xl">
                👨‍⚕️
              </div>

              <h3 className="font-bold text-lg text-slate-900 mt-5">
                Choose Doctor
              </h3>

              <p className="text-sm text-slate-500 mt-2">
                View the doctor profile and consultation details.
              </p>
            </div>

            <div className="text-center rounded-2xl bg-slate-50 p-7">
              <div className="h-14 w-14 mx-auto rounded-2xl bg-blue-100 flex items-center justify-center text-2xl">
                📅
              </div>

              <h3 className="font-bold text-lg text-slate-900 mt-5">
                Book Appointment
              </h3>

              <p className="text-sm text-slate-500 mt-2">
                Select your date and time and book your appointment.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ======================================
          Footer
      ======================================= */}

      <footer className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">

            <div>
              <h3 className="text-xl font-bold">
                Doctor Markaz
              </h3>

              <p className="text-sm text-slate-400 mt-1">
                Simple healthcare appointment platform.
              </p>
            </div>

            <p className="text-sm text-slate-400">
              © 2026 Doctor Markaz. All rights reserved.
            </p>

          </div>
        </div>
      </footer>

    </main>
  );
}
