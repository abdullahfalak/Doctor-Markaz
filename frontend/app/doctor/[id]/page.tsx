"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { API_URL, getImageUrl, renderStars } from "@/lib/api";

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

type Review = {
  id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  patient_first_name: string;
};

export default function DoctorProfilePage() {
  const params = useParams();
  const doctorId = params.id;

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [reviews, setReviews] = useState<Review[]>([]);
  const [totalReviews, setTotalReviews] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [loadingReviews, setLoadingReviews] = useState(true);

  // Fetch doctor profile
  useEffect(() => {
    if (!doctorId) return;

    const fetchDoctor = async () => {
      try {
        const response = await fetch(`${API_URL}/api/doctors/${doctorId}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.message || "Doctor not found");
          return;
        }

        setDoctor(data.doctor);
      } catch {
        setError("Unable to connect to server");
      } finally {
        setLoading(false);
      }
    };

    fetchDoctor();
  }, [doctorId]);

  // Fetch reviews
  useEffect(() => {
    if (!doctorId) return;

    const fetchReviews = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/doctors/${doctorId}/reviews`
        );
        const data = await response.json();

        if (response.ok) {
          setReviews(data.reviews || []);
          setTotalReviews(data.total_reviews || 0);
          setAverageRating(data.average_rating || 0);
        }
      } catch {
        // Reviews failing silently — profile still loads
      } finally {
        setLoadingReviews(false);
      }
    };

    fetchReviews();
  }, [doctorId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-lg">Loading doctor profile...</p>
      </main>
    );
  }

  if (error || !doctor) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">😔</div>
          <h1 className="text-2xl font-bold text-slate-900">
            Doctor Not Found
          </h1>
          <p className="text-slate-500 mt-2">
            {error || "This doctor profile does not exist."}
          </p>
          <Link
            href="/"
            className="inline-block mt-6 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Back to Doctors
          </Link>
        </div>
      </main>
    );
  }

  const imageUrl = getImageUrl(doctor.profile_image);

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-blue-700">
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

      {/* Back */}
      <div className="max-w-6xl mx-auto px-4 pt-6">
        <Link
          href="/"
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          ← Back to Doctors
        </Link>
      </div>

      {/* Profile */}
      <section className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden">

          {/* Top section */}
          <div className="p-6 sm:p-8 border-b">
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {/* Image */}
              <div className="w-28 h-28 rounded-2xl bg-blue-100 flex items-center justify-center text-5xl shrink-0 overflow-hidden">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={doctor.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>👨‍⚕️</span>
                )}
              </div>

              {/* Name + rating */}
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-bold text-slate-900">
                    {doctor.name}
                  </h1>
                  {doctor.is_verified && (
                    <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
                      ✓ Verified
                    </span>
                  )}
                </div>

                <p className="text-lg text-blue-600 font-medium mt-2">
                  {doctor.specialization}
                </p>

                <p className="text-slate-500 mt-1">📍 {doctor.area}</p>

                {/* Average rating summary */}
                {!loadingReviews && totalReviews > 0 && (
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-yellow-400 text-lg tracking-tight">
                      {renderStars(Math.round(averageRating))}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {averageRating.toFixed(1)}
                    </span>
                    <span className="text-slate-500 text-sm">
                      ({totalReviews} review{totalReviews !== 1 ? "s" : ""})
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Info cards */}
          <div className="p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              Doctor Information
            </h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-sm text-slate-500">Qualification</p>
                <p className="font-semibold text-slate-900 mt-2">
                  🎓 {doctor.qualification || "Not available"}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-sm text-slate-500">Experience</p>
                <p className="font-semibold text-slate-900 mt-2">
                  💼 {doctor.experience} years
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-sm text-slate-500">Consultation Fee</p>
                <p className="font-semibold text-slate-900 mt-2">
                  💰 Rs. {doctor.consultation_fee}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-sm text-slate-500">Clinic</p>
                <p className="font-semibold text-slate-900 mt-2">
                  🏥 {doctor.clinic_name || "Not available"}
                </p>
              </div>
            </div>

            {/* Address */}
            <div className="mt-8">
              <h2 className="text-xl font-bold text-slate-900 mb-3">
                Clinic Address
              </h2>
              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-slate-700">
                  📍 {doctor.address || doctor.area}
                </p>
              </div>
            </div>

            {/* Bio */}
            <div className="mt-8">
              <h2 className="text-xl font-bold text-slate-900 mb-3">
                About Doctor
              </h2>
              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-slate-600 leading-7">
                  {doctor.bio || "Doctor information will be available soon."}
                </p>
              </div>
            </div>

            {/* Book CTA */}
            <div className="mt-8 rounded-2xl bg-blue-50 p-6">
              <h2 className="text-xl font-bold text-slate-900">
                Want to visit this doctor?
              </h2>
              <p className="text-slate-600 mt-2">
                Book your appointment through Doctor Markaz.
              </p>
              <Link
                href={`/doctor/${doctor.id}/book`}
                className="inline-block mt-5 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
              >
                📅 Book Appointment
              </Link>
            </div>

            {/* ── Reviews Section ── */}
            <div className="mt-10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900">
                  Patient Reviews
                </h2>
                {totalReviews > 0 && (
                  <span className="text-sm text-slate-500">
                    {totalReviews} review{totalReviews !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {loadingReviews ? (
                <div className="rounded-2xl bg-slate-50 p-8 text-center">
                  <div className="h-6 w-6 mx-auto animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
                </div>
              ) : reviews.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-8 text-center">
                  <p className="text-slate-400 text-sm">
                    No reviews yet. Be the first to share your experience.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Rating summary bar */}
                  <div className="rounded-2xl bg-slate-50 p-5 flex items-center gap-4">
                    <div className="text-center shrink-0">
                      <p className="text-4xl font-bold text-slate-900">
                        {averageRating.toFixed(1)}
                      </p>
                      <p className="text-yellow-400 text-xl mt-1">
                        {renderStars(Math.round(averageRating))}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        out of 5
                      </p>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      {[5, 4, 3, 2, 1].map((star) => {
                        const starCount = reviews.filter(
                          (r) => r.rating === star
                        ).length;
                        const pct =
                          totalReviews > 0
                            ? Math.round((starCount / totalReviews) * 100)
                            : 0;
                        return (
                          <div
                            key={star}
                            className="flex items-center gap-2 text-xs"
                          >
                            <span className="w-4 text-right text-slate-500">
                              {star}
                            </span>
                            <span className="text-yellow-400">★</span>
                            <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-yellow-400 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-6 text-slate-500">{starCount}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Individual review cards */}
                  {reviews.map((review) => (
                    <div
                      key={review.id}
                      className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600 shrink-0">
                            {review.patient_first_name?.charAt(0)?.toUpperCase() || "P"}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">
                              {review.patient_first_name}
                            </p>
                            <p className="text-xs text-slate-400">
                              {new Date(review.created_at).toLocaleDateString(
                                "en-PK",
                                { day: "2-digit", month: "short", year: "numeric" }
                              )}
                            </p>
                          </div>
                        </div>
                        <span className="text-yellow-400 text-base shrink-0">
                          {renderStars(review.rating)}
                        </span>
                      </div>

                      {review.comment && (
                        <p className="mt-3 text-sm text-slate-600 leading-6">
                          {review.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* ── End Reviews ── */}
          </div>
        </div>
      </section>
    </main>
  );
}
