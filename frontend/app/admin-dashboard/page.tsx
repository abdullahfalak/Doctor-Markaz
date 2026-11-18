
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  API_URL,
  formatDate,
  formatTime,
  getStatusClass,
  getImageUrl,
} from "@/lib/api";

type Stats = {
  total_doctors: number;
  verified_doctors: number;
  total_patients: number;
  total_appointments: number;
  pending_appointments: number;
  confirmed_appointments: number;
};

type Doctor = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  specialization: string | null;
  specialization_id?: number | null;
  area: string | null;
  area_id?: number | null;
  qualification: string | null;
  experience: number;
  consultation_fee: string | number;
  clinic_name: string | null;
  address?: string | null;
  bio?: string | null;
  profile_image?: string | null;
  is_verified: boolean;
};

type Patient = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  created_at: string;
};

type Appointment = {
  id: number;
  appointment_date: string;
  appointment_time: string;
  status: string;
  reason: string | null;
  patient_name: string;
  patient_phone: string;
  doctor_name: string;
  clinic_name: string | null;
};

type Specialization = {
  id: number;
  name: string;
};

type Area = {
  id: number;
  name: string;
};

type DoctorForm = {
  name: string;
  phone: string;
  email: string;
  password: string;
  specialization_id: string;
  area_id: string;
  qualification: string;
  experience: string;
  consultation_fee: string;
  clinic_name: string;
  address: string;
  bio: string;
  profile_image: string;
};

const emptyDoctorForm: DoctorForm = {
  name: "",
  phone: "",
  email: "",
  password: "",
  specialization_id: "",
  area_id: "",
  qualification: "",
  experience: "",
  consultation_fee: "",
  clinic_name: "",
  address: "",
  bio: "",
  profile_image: "",
};

export default function AdminDashboard() {
  const router = useRouter();

  const [stats, setStats] = useState<Stats | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");

  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [editingDoctorId, setEditingDoctorId] = useState<number | null>(null);
  const [savingDoctor, setSavingDoctor] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [doctorForm, setDoctorForm] = useState<DoctorForm>({
    ...emptyDoctorForm,
  });
  const [imagePreview, setImagePreview] = useState("");

  // ── Specialization management state ──────────────────────────
  const [specList, setSpecList] = useState<Specialization[]>([]);
  const [specInput, setSpecInput] = useState("");
  const [editingSpecId, setEditingSpecId] = useState<number | null>(null);
  const [editingSpecName, setEditingSpecName] = useState("");
  const [savingSpec, setSavingSpec] = useState(false);
  const [specError, setSpecError] = useState("");
  const [specMessage, setSpecMessage] = useState("");

  // ── Area management state ─────────────────────────────────────
  const [areaList, setAreaList] = useState<Area[]>([]);
  const [areaInput, setAreaInput] = useState("");
  const [editingAreaId, setEditingAreaId] = useState<number | null>(null);
  const [editingAreaName, setEditingAreaName] = useState("");
  const [savingArea, setSavingArea] = useState(false);
  const [areaError, setAreaError] = useState("");
  const [areaMessage, setAreaMessage] = useState("");

  // ── Delete Doctor confirmation dialog state ───────────────────
  const [deleteConfirm, setDeleteConfirm] = useState<{
    doctorId: number;
    doctorName: string;
    appointmentCount: number;
  } | null>(null);
  const [deletingDoctor, setDeletingDoctor] = useState(false);

  const getToken = useCallback((): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("doctorMarkazToken");
  }, []);

  const loadDoctorFormData = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [specializationsRes, areasRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/specializations`, { headers }),
        fetch(`${API_URL}/api/admin/areas`, { headers }),
      ]);

      const specializationsData = await specializationsRes.json();
      const areasData = await areasRes.json();

      if (specializationsRes.ok) {
        setSpecializations(specializationsData.specializations || []);
      }

      if (areasRes.ok) {
        setAreas(areasData.areas || []);
      }
    } catch (error) {
      console.error("Doctor form data error:", error);
    }
  }, [getToken]);

  const loadDashboard = useCallback(async () => {
    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [statsRes, doctorsRes, patientsRes, appointmentsRes] =
        await Promise.all([
          fetch(`${API_URL}/api/admin/stats`, { headers }),
          fetch(`${API_URL}/api/admin/doctors`, { headers }),
          fetch(`${API_URL}/api/admin/patients`, { headers }),
          fetch(`${API_URL}/api/admin/appointments`, { headers }),
        ]);

      const [statsData, doctorsData, patientsData, appointmentsData] =
        await Promise.all([
          statsRes.json(),
          doctorsRes.json(),
          patientsRes.json(),
          appointmentsRes.json(),
        ]);

      if (!statsRes.ok) {
        throw new Error(statsData.message || "Failed to load statistics.");
      }

      if (!doctorsRes.ok) {
        throw new Error(doctorsData.message || "Failed to load doctors.");
      }

      if (!patientsRes.ok) {
        throw new Error(patientsData.message || "Failed to load patients.");
      }

      if (!appointmentsRes.ok) {
        throw new Error(
          appointmentsData.message || "Failed to load appointments."
        );
      }

      setStats(statsData.stats);
      setDoctors(doctorsData.doctors || []);
      setPatients(patientsData.patients || []);
      setAppointments(appointmentsData.appointments || []);
    } catch (error) {
      console.error("Dashboard loading error:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Dashboard data load nahi ho saka."
      );
    } finally {
      setLoading(false);
    }
  }, [getToken, router]);

  useEffect(() => {
    const userData = localStorage.getItem("doctorMarkazUser");

    if (!userData) {
      router.push("/login");
      return;
    }

    try {
      const user = JSON.parse(userData);

      if (user.role !== "admin") {
        router.push(
          user.role === "doctor" ? "/doctor-dashboard" : "/dashboard"
        );
        return;
      }

      void loadDashboard();
      void loadDoctorFormData();
      void loadSpecializations();
      void loadAreas();
    } catch (error) {
      console.error("Admin session error:", error);
      router.push("/login");
    }
  }, [router, loadDashboard, loadDoctorFormData]);

  const handleDoctorInput = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;

    setDoctorForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const resetDoctorForm = () => {
    setDoctorForm({ ...emptyDoctorForm });
    setImagePreview("");
    setFormError("");
  };

  const openAddDoctor = async () => {
    setMessage("");
    setFormError("");
    setEditingDoctorId(null);
    resetDoctorForm();

    await loadDoctorFormData();
    setShowDoctorModal(true);
  };

  const openEditDoctor = async (doctor: Doctor) => {
    setMessage("");
    setFormError("");
    setEditingDoctorId(doctor.id);

    setDoctorForm({
      name: doctor.name || "",
      phone: doctor.phone || "",
      email: doctor.email || "",
      password: "",
      specialization_id:
        doctor.specialization_id != null
          ? String(doctor.specialization_id)
          : "",
      area_id:
        doctor.area_id != null ? String(doctor.area_id) : "",
      qualification: doctor.qualification || "",
      experience:
        doctor.experience != null ? String(doctor.experience) : "0",
      consultation_fee:
        doctor.consultation_fee != null
          ? String(doctor.consultation_fee)
          : "0",
      clinic_name: doctor.clinic_name || "",
      address: doctor.address || "",
      bio: doctor.bio || "",
      profile_image: doctor.profile_image || "",
    });

    setImagePreview(
      doctor.profile_image ? getImageUrl(doctor.profile_image) || "" : ""
    );

    await loadDoctorFormData();
    setShowDoctorModal(true);
  };

  const closeDoctorModal = () => {
    if (savingDoctor || uploadingImage) return;

    setShowDoctorModal(false);
    setEditingDoctorId(null);
    resetDoctorForm();
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFormError("");
    setMessage("");

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setFormError("Sirf JPG, JPEG, PNG aur WEBP images allowed hain.");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFormError("Image ka size 5 MB se kam hona chahiye.");
      e.target.value = "";
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    try {
      setUploadingImage(true);

      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch(`${API_URL}/api/admin/upload-image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Image upload failed.");
      }

      setDoctorForm((previous) => ({
        ...previous,
        profile_image: data.imageUrl || "",
      }));

      setMessage("Profile image upload ho gayi hai.");
    } catch (error) {
      console.error("Image upload error:", error);
      setFormError(
        error instanceof Error
          ? error.message
          : "Image upload nahi ho saki."
      );
      setImagePreview("");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const saveDoctor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    setFormError("");
    setMessage("");

    if (
      !doctorForm.name.trim() ||
      !doctorForm.phone.trim() ||
      !doctorForm.specialization_id ||
      !doctorForm.area_id
    ) {
      setFormError(
        "Doctor name, phone, specialization aur area required hain."
      );
      return;
    }

    if (editingDoctorId === null && !doctorForm.password.trim()) {
      setFormError("Naye doctor ke liye password required hai.");
      return;
    }

    if (
      editingDoctorId === null &&
      doctorForm.password.length < 6
    ) {
      setFormError("Password kam az kam 6 characters ka hona chahiye.");
      return;
    }

    if (uploadingImage) {
      setFormError("Image upload complete hone ka intezar karein.");
      return;
    }

    const payload = {
      name: doctorForm.name.trim(),
      phone: doctorForm.phone.trim(),
      email: doctorForm.email.trim() || null,
      specialization_id: Number(doctorForm.specialization_id),
      area_id: Number(doctorForm.area_id),
      qualification: doctorForm.qualification.trim() || null,
      experience: doctorForm.experience
        ? Number(doctorForm.experience)
        : 0,
      consultation_fee: doctorForm.consultation_fee
        ? Number(doctorForm.consultation_fee)
        : 0,
      clinic_name: doctorForm.clinic_name.trim() || null,
      address: doctorForm.address.trim() || null,
      bio: doctorForm.bio.trim() || null,
      profile_image: doctorForm.profile_image || null,
    };

    try {
      setSavingDoctor(true);

      const isEditing = editingDoctorId !== null;
      const url = isEditing
        ? `${API_URL}/api/admin/doctors/${editingDoctorId}`
        : `${API_URL}/api/admin/doctors`;

      const body = isEditing
        ? payload
        : {
            ...payload,
            password: doctorForm.password,
            is_verified: false,
          };

      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

     if (!response.ok) {
  console.error("ADD DOCTOR API ERROR:", {
    status: response.status,
    response: data,
  });

  throw new Error(
    data.error || data.message ||
      (isEditing
        ? "Doctor update nahi ho saka."
        : "Doctor add nahi ho saka.")
  );
}

      setShowDoctorModal(false);
      setEditingDoctorId(null);
      resetDoctorForm();

      setMessage(
        isEditing
          ? "Doctor ki details successfully update ho gayi hain."
          : "Doctor successfully add ho gaya hai. Abhi verification pending hai."
      );

      await loadDashboard();
    } catch (error) {
      console.error("Save doctor error:", error);
      setFormError(
        error instanceof Error
          ? error.message
          : "Server se connection nahi ho saka."
      );
    } finally {
      setSavingDoctor(false);
    }
  };

  const verifyDoctor = async (doctorId: number, verify: boolean) => {
    const token = getToken();
    if (!token) return;

    try {
      const response = await fetch(
        `${API_URL}/api/admin/doctors/${doctorId}/${
          verify ? "verify" : "unverify"
        }`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Verification action failed.");
      }

      setMessage(
        verify
          ? "Doctor successfully verify ho gaya."
          : "Doctor ki verification remove ho gayi."
      );

      await loadDashboard();
    } catch (error) {
      console.error("Verify doctor error:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Server se connection nahi ho saka."
      );
    }
  };

  const updateAppointmentStatus = async (
    appointmentId: number,
    status: string
  ) => {
    const token = getToken();
    if (!token) return;

    try {
      const response = await fetch(
        `${API_URL}/api/admin/appointments/${appointmentId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Status update failed.");
      }

      setMessage("Appointment status update ho gaya.");
      await loadDashboard();
    } catch (error) {
      console.error("Appointment update error:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Server se connection nahi ho saka."
      );
    }
  };

  // ═══════════════════════════════════════════════════════════
  // SPECIALIZATION MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  const loadSpecializations = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/specializations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setSpecList(data.specializations || []);
    } catch (err) {
      console.error("Load specializations error:", err);
    }
  }, [getToken]);

  const addSpecialization = async () => {
    const token = getToken();
    if (!token) return;

    setSpecError("");
    setSpecMessage("");

    if (!specInput.trim()) {
      setSpecError("Specialization name is required.");
      return;
    }

    setSavingSpec(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/specializations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: specInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to add.");
      setSpecMessage(data.message);
      setSpecInput("");
      await loadSpecializations();
      // Also refresh doctor form dropdowns
      await loadDoctorFormData();
    } catch (err) {
      setSpecError(err instanceof Error ? err.message : "Server error.");
    } finally {
      setSavingSpec(false);
    }
  };

  const startEditSpec = (spec: Specialization) => {
    setEditingSpecId(spec.id);
    setEditingSpecName(spec.name);
    setSpecError("");
    setSpecMessage("");
  };

  const cancelEditSpec = () => {
    setEditingSpecId(null);
    setEditingSpecName("");
  };

  const saveEditSpec = async (id: number) => {
    const token = getToken();
    if (!token) return;

    setSpecError("");
    setSpecMessage("");

    if (!editingSpecName.trim()) {
      setSpecError("Specialization name cannot be empty.");
      return;
    }

    setSavingSpec(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/specializations/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: editingSpecName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update.");
      setSpecMessage(data.message);
      setEditingSpecId(null);
      setEditingSpecName("");
      await loadSpecializations();
      await loadDoctorFormData();
    } catch (err) {
      setSpecError(err instanceof Error ? err.message : "Server error.");
    } finally {
      setSavingSpec(false);
    }
  };

  const deleteSpecialization = async (id: number, name: string) => {
    if (!confirm(`Delete specialization "${name}"? This cannot be undone.`))
      return;

    const token = getToken();
    if (!token) return;

    setSpecError("");
    setSpecMessage("");

    try {
      const res = await fetch(`${API_URL}/api/admin/specializations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete.");
      setSpecMessage(data.message);
      await loadSpecializations();
      await loadDoctorFormData();
    } catch (err) {
      setSpecError(err instanceof Error ? err.message : "Server error.");
    }
  };

  // ═══════════════════════════════════════════════════════════
  // AREA MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  const loadAreas = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/areas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setAreaList(data.areas || []);
    } catch (err) {
      console.error("Load areas error:", err);
    }
  }, [getToken]);

  const addArea = async () => {
    const token = getToken();
    if (!token) return;

    setAreaError("");
    setAreaMessage("");

    if (!areaInput.trim()) {
      setAreaError("Area name is required.");
      return;
    }

    setSavingArea(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/areas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: areaInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to add.");
      setAreaMessage(data.message);
      setAreaInput("");
      await loadAreas();
      await loadDoctorFormData();
    } catch (err) {
      setAreaError(err instanceof Error ? err.message : "Server error.");
    } finally {
      setSavingArea(false);
    }
  };

  const startEditArea = (area: Area) => {
    setEditingAreaId(area.id);
    setEditingAreaName(area.name);
    setAreaError("");
    setAreaMessage("");
  };

  const cancelEditArea = () => {
    setEditingAreaId(null);
    setEditingAreaName("");
  };

  const saveEditArea = async (id: number) => {
    const token = getToken();
    if (!token) return;

    setAreaError("");
    setAreaMessage("");

    if (!editingAreaName.trim()) {
      setAreaError("Area name cannot be empty.");
      return;
    }

    setSavingArea(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/areas/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: editingAreaName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update.");
      setAreaMessage(data.message);
      setEditingAreaId(null);
      setEditingAreaName("");
      await loadAreas();
      await loadDoctorFormData();
    } catch (err) {
      setAreaError(err instanceof Error ? err.message : "Server error.");
    } finally {
      setSavingArea(false);
    }
  };

  const deleteArea = async (id: number, name: string) => {
    if (!confirm(`Delete area "${name}"? This cannot be undone.`)) return;

    const token = getToken();
    if (!token) return;

    setAreaError("");
    setAreaMessage("");

    try {
      const res = await fetch(`${API_URL}/api/admin/areas/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete.");
      setAreaMessage(data.message);
      await loadAreas();
      await loadDoctorFormData();
    } catch (err) {
      setAreaError(err instanceof Error ? err.message : "Server error.");
    }
  };

  // ═══════════════════════════════════════════════════════════
  // DELETE / DEACTIVATE DOCTOR
  // ═══════════════════════════════════════════════════════════

  /**
   * Fetch appointment count for a doctor, then open the
   * confirmation dialog with the correct options.
   */
  const openDeleteConfirm = async (doctor: Doctor) => {
    const token = getToken();
    if (!token) return;

    setMessage("");

    try {
      // Fetch fresh appointment count from the backend
      const res = await fetch(
        `${API_URL}/api/admin/appointments`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();

      const count: number = res.ok
        ? (data.appointments || []).filter(
            (a: { doctor_id: number }) => a.doctor_id === doctor.id
          ).length
        : 0;

      setDeleteConfirm({
        doctorId: doctor.id,
        doctorName: doctor.name,
        appointmentCount: count,
      });
    } catch {
      setDeleteConfirm({
        doctorId: doctor.id,
        doctorName: doctor.name,
        appointmentCount: -1, // unknown — treat as has appointments (safe default)
      });
    }
  };

  /**
   * Deactivate: sets is_verified = FALSE.
   * Safe for any doctor — preserves all records.
   */
  const deactivateDoctor = async () => {
    if (!deleteConfirm) return;

    const token = getToken();
    if (!token) { router.push("/login"); return; }

    setDeletingDoctor(true);
    try {
      const res = await fetch(
        `${API_URL}/api/admin/doctors/${deleteConfirm.doctorId}/deactivate`,
        { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to deactivate.");

      setDeleteConfirm(null);
      setMessage(data.message);
      await loadDashboard();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Server error.");
      setDeleteConfirm(null);
    } finally {
      setDeletingDoctor(false);
    }
  };

  /**
   * Permanent delete: only allowed when appointment count is 0.
   * Backend enforces the same rule independently.
   */
  const permanentlyDeleteDoctor = async () => {
    if (!deleteConfirm) return;

    const token = getToken();
    if (!token) { router.push("/login"); return; }

    setDeletingDoctor(true);
    try {
      const res = await fetch(
        `${API_URL}/api/admin/doctors/${deleteConfirm.doctorId}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete.");

      setDeleteConfirm(null);
      setMessage(data.message);
      await loadDashboard();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Server error.");
      setDeleteConfirm(null);
    } finally {
      setDeletingDoctor(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("doctorMarkazToken");
    localStorage.removeItem("doctorMarkazUser");
    router.push("/login");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="rounded-2xl bg-white p-8 text-center shadow">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="text-lg font-semibold text-gray-700">
            Loading Admin Dashboard...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="sticky top-0 z-20 border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-blue-600">
              Doctor Markaz
            </h1>
            <p className="text-sm text-gray-500">Admin Dashboard</p>
          </div>

          <button
            onClick={logout}
            className="rounded-lg bg-red-500 px-5 py-2 font-medium text-white transition hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {message && (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-green-200 bg-green-100 px-4 py-3 text-green-800">
            <p>{message}</p>
            <button
              type="button"
              onClick={() => setMessage("")}
              className="font-bold"
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        {/* Statistics */}
        <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[
            {
              label: "Doctors",
              value: stats?.total_doctors ?? 0,
              color: "text-gray-800",
            },
            {
              label: "Verified Doctors",
              value: stats?.verified_doctors ?? 0,
              color: "text-green-600",
            },
            {
              label: "Patients",
              value: stats?.total_patients ?? 0,
              color: "text-gray-800",
            },
            {
              label: "Appointments",
              value: stats?.total_appointments ?? 0,
              color: "text-gray-800",
            },
            {
              label: "Pending",
              value: stats?.pending_appointments ?? 0,
              color: "text-yellow-600",
            },
            {
              label: "Confirmed",
              value: stats?.confirmed_appointments ?? 0,
              color: "text-blue-600",
            },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">{item.label}</p>
              <h2 className={`mt-2 text-3xl font-bold ${item.color}`}>
                {item.value}
              </h2>
            </div>
          ))}
        </section>

        {/* Doctor Management */}
        <section className="mb-10 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                Doctor Management
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Doctors ko add, edit aur verify karein.
              </p>
            </div>

            <button
              onClick={openAddDoctor}
              className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white transition hover:bg-blue-700"
            >
              + Add Doctor
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    "Doctor",
                    "Phone",
                    "Specialization",
                    "Area",
                    "Fee",
                    "Status",
                    "Actions",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-gray-600"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {doctors.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No doctors found.
                    </td>
                  </tr>
                ) : (
                  doctors.map((doctor) => (
                    <tr key={doctor.id} className="border-t hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {doctor.profile_image ? (
                            <img
                              src={getImageUrl(doctor.profile_image) ?? ""}
                              alt={doctor.name}
                              className="h-11 w-11 rounded-full border object-cover"
                            />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-600">
                              {doctor.name?.charAt(0)?.toUpperCase() || "D"}
                            </div>
                          )}

                          <div>
                            <p className="font-semibold text-gray-800">
                              {doctor.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {doctor.qualification || "N/A"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-gray-700">
                        {doctor.phone}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {doctor.specialization || "N/A"}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {doctor.area || "N/A"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-gray-700">
                        Rs. {doctor.consultation_fee}
                      </td>
                      <td className="px-6 py-4">
                        {doctor.is_verified ? (
                          <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-700">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEditDoctor(doctor)}
                            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                          >
                            Edit
                          </button>

                          {doctor.is_verified ? (
                            <button
                              type="button"
                              onClick={() => verifyDoctor(doctor.id, false)}
                              className="rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-600"
                            >
                              Unverify
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => verifyDoctor(doctor.id, true)}
                              className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-green-700"
                            >
                              Verify
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => void openDeleteConfirm(doctor)}
                            className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Patients */}
        <section className="mb-10 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-6 py-5">
            <h2 className="text-xl font-bold text-gray-800">Patients</h2>
            <p className="mt-1 text-sm text-gray-500">
              Registered patients in Doctor Markaz.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50">
                <tr>
                  {["Name", "Phone", "Email", "Registered"].map((heading) => (
                    <th
                      key={heading}
                      className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-gray-600"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {patients.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      No patients found.
                    </td>
                  </tr>
                ) : (
                  patients.map((patient) => (
                    <tr key={patient.id} className="border-t hover:bg-gray-50">
                      <td className="px-6 py-4 font-semibold text-gray-800">
                        {patient.name}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-gray-700">
                        {patient.phone}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {patient.email || "N/A"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-gray-700">
                        {formatDate(patient.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Appointments */}
        <section className="mb-10 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-6 py-5">
            <h2 className="text-xl font-bold text-gray-800">
              All Appointments
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Tamam patient appointments manage karein.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    "Patient",
                    "Doctor",
                    "Date",
                    "Time",
                    "Reason",
                    "Status",
                    "Action",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-gray-600"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {appointments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No appointments found.
                    </td>
                  </tr>
                ) : (
                  appointments.map((appointment) => (
                    <tr key={appointment.id} className="border-t hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-800">
                          {appointment.patient_name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {appointment.patient_phone}
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-800">
                          {appointment.doctor_name}
                        </p>
                        {appointment.clinic_name && (
                          <p className="text-sm text-gray-500">
                            {appointment.clinic_name}
                          </p>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-gray-700">
                        {formatDate(appointment.appointment_date)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-gray-700">
                        {formatTime(appointment.appointment_time)}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {appointment.reason || "N/A"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-sm font-medium capitalize ${getStatusClass(
                            appointment.status
                          )}`}
                        >
                          {appointment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={appointment.status}
                          onChange={(e) =>
                            updateAppointmentStatus(
                              appointment.id,
                              e.target.value
                            )
                          }
                          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ═══════════════════════════════════════════════════
          MANAGE SPECIALIZATIONS & AREAS
      ═══════════════════════════════════════════════════ */}
      <div className="mx-auto max-w-7xl px-6 pb-12">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* ─── Specializations ─────────────────────────── */}
          <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="border-b px-6 py-5">
              <h2 className="text-xl font-bold text-gray-800">
                Manage Specializations
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Add, edit, or remove medical specializations.
              </p>
            </div>

            <div className="p-6">
              {/* Messages */}
              {specError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {specError}
                </div>
              )}
              {specMessage && (
                <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  <span>{specMessage}</span>
                  <button
                    type="button"
                    onClick={() => setSpecMessage("")}
                    className="font-bold"
                    aria-label="Dismiss"
                  >×</button>
                </div>
              )}

              {/* Add new */}
              <div className="mb-5 flex gap-2">
                <input
                  type="text"
                  value={specInput}
                  onChange={(e) => setSpecInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addSpecialization(); }}}
                  placeholder="New specialization name"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => void addSpecialization()}
                  disabled={savingSpec}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingSpec ? "Adding…" : "+ Add"}
                </button>
              </div>

              {/* List */}
              <div className="space-y-2">
                {specList.length === 0 ? (
                  <p className="py-4 text-center text-sm text-gray-400">
                    No specializations found.
                  </p>
                ) : (
                  specList.map((spec) => (
                    <div
                      key={spec.id}
                      className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5"
                    >
                      {editingSpecId === spec.id ? (
                        <>
                          <input
                            type="text"
                            value={editingSpecName}
                            onChange={(e) => setEditingSpecName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); void saveEditSpec(spec.id); }
                              if (e.key === "Escape") cancelEditSpec();
                            }}
                            autoFocus
                            className="flex-1 rounded-lg border border-blue-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => void saveEditSpec(spec.id)}
                            disabled={savingSpec}
                            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            {savingSpec ? "…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditSpec}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm text-gray-800">
                            {spec.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => startEditSpec(spec)}
                            className="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteSpecialization(spec.id, spec.name)}
                            className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* ─── Areas ───────────────────────────────────── */}
          <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="border-b px-6 py-5">
              <h2 className="text-xl font-bold text-gray-800">
                Manage Areas
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Add, edit, or remove service areas.
              </p>
            </div>

            <div className="p-6">
              {/* Messages */}
              {areaError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {areaError}
                </div>
              )}
              {areaMessage && (
                <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  <span>{areaMessage}</span>
                  <button
                    type="button"
                    onClick={() => setAreaMessage("")}
                    className="font-bold"
                    aria-label="Dismiss"
                  >×</button>
                </div>
              )}

              {/* Add new */}
              <div className="mb-5 flex gap-2">
                <input
                  type="text"
                  value={areaInput}
                  onChange={(e) => setAreaInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addArea(); }}}
                  placeholder="New area name"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => void addArea()}
                  disabled={savingArea}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingArea ? "Adding…" : "+ Add"}
                </button>
              </div>

              {/* List */}
              <div className="space-y-2">
                {areaList.length === 0 ? (
                  <p className="py-4 text-center text-sm text-gray-400">
                    No areas found.
                  </p>
                ) : (
                  areaList.map((area) => (
                    <div
                      key={area.id}
                      className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5"
                    >
                      {editingAreaId === area.id ? (
                        <>
                          <input
                            type="text"
                            value={editingAreaName}
                            onChange={(e) => setEditingAreaName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); void saveEditArea(area.id); }
                              if (e.key === "Escape") cancelEditArea();
                            }}
                            autoFocus
                            className="flex-1 rounded-lg border border-blue-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => void saveEditArea(area.id)}
                            disabled={savingArea}
                            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            {savingArea ? "…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditArea}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm text-gray-800">
                            {area.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => startEditArea(area)}
                            className="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteArea(area.id, area.name)}
                            className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          DELETE / DEACTIVATE DOCTOR CONFIRMATION DIALOG
      ═══════════════════════════════════════════════ */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">

            {/* Header */}
            <div className="border-b px-6 py-5">
              <h2 className="text-xl font-bold text-gray-800">
                Remove Doctor
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Choose how to remove this doctor account.
              </p>
            </div>

            <div className="px-6 py-5">

              {/* Doctor name */}
              <div className="mb-5 rounded-xl bg-gray-50 px-4 py-3">
                <p className="text-sm text-gray-500">Doctor</p>
                <p className="mt-1 font-semibold text-gray-900">
                  {deleteConfirm.doctorName}
                </p>
              </div>

              {/* Branch: has appointments vs zero appointments */}
              {deleteConfirm.appointmentCount !== 0 ? (
                /* ── HAS APPOINTMENTS: Deactivate only ─────── */
                <>
                  <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm font-semibold text-amber-800">
                      ⚠ Permanent deletion is not available
                    </p>
                    <p className="mt-1 text-sm text-amber-700">
                      This doctor has{" "}
                      <span className="font-bold">
                        {deleteConfirm.appointmentCount === -1
                          ? "existing"
                          : deleteConfirm.appointmentCount}
                      </span>{" "}
                      appointment record
                      {deleteConfirm.appointmentCount !== 1 ? "s" : ""}.
                      Deleting would permanently erase that history.
                    </p>
                  </div>

                  <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                    <p className="text-sm font-semibold text-blue-800">
                      Deactivate instead
                    </p>
                    <p className="mt-1 text-sm text-blue-700">
                      The doctor will be hidden from all public listings
                      immediately. All appointment records, availability,
                      and account data are preserved and can be restored
                      by clicking <strong>Verify</strong> again.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(null)}
                      disabled={deletingDoctor}
                      className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void deactivateDoctor()}
                      disabled={deletingDoctor}
                      className="flex-1 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
                    >
                      {deletingDoctor ? "Deactivating…" : "Deactivate Doctor"}
                    </button>
                  </div>
                </>
              ) : (
                /* ── ZERO APPOINTMENTS: Both options ───────── */
                <>
                  <div className="mb-5 rounded-xl border border-green-100 bg-green-50 px-4 py-3">
                    <p className="text-sm text-green-700">
                      ✓ This doctor has no appointment history.
                      Both options are available.
                    </p>
                  </div>

                  {/* Option A: Deactivate */}
                  <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
                    <p className="text-sm font-semibold text-gray-800">
                      Option A — Deactivate (Recommended)
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      Hides the doctor from public listings. Account and
                      all data are preserved. Reversible at any time.
                    </p>
                    <button
                      type="button"
                      onClick={() => void deactivateDoctor()}
                      disabled={deletingDoctor}
                      className="mt-3 w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
                    >
                      {deletingDoctor ? "Deactivating…" : "Deactivate Doctor"}
                    </button>
                  </div>

                  {/* Option B: Permanent delete */}
                  <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-4">
                    <p className="text-sm font-semibold text-red-800">
                      Option B — Permanently Delete
                    </p>
                    <p className="mt-1 text-sm text-red-700">
                      Removes the doctor account and all associated data
                      from the database. <strong>This cannot be undone.</strong>
                    </p>
                    <button
                      type="button"
                      onClick={() => void permanentlyDeleteDoctor()}
                      disabled={deletingDoctor}
                      className="mt-3 w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                    >
                      {deletingDoctor
                        ? "Deleting…"
                        : `Permanently Delete "${deleteConfirm.doctorName}"`}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(null)}
                    disabled={deletingDoctor}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Doctor Modal */}
      {showDoctorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  {editingDoctorId !== null ? "Edit Doctor" : "Add New Doctor"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {editingDoctorId !== null
                    ? "Doctor ki information update karein."
                    : "Doctor ki information enter karein."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeDoctorModal}
                disabled={savingDoctor || uploadingImage}
                className="text-2xl font-bold text-gray-500 hover:text-gray-800 disabled:opacity-50"
                aria-label="Close form"
              >
                ×
              </button>
            </div>

            <form onSubmit={saveDoctor} className="p-6">
              {formError && (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-100 px-4 py-3 text-red-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Doctor Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={doctorForm.name}
                    onChange={handleDoctorInput}
                    required
                    placeholder="Dr. Ahmad Khan"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={doctorForm.phone}
                    onChange={handleDoctorInput}
                    required
                    placeholder="03001234567"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={doctorForm.email}
                    onChange={handleDoctorInput}
                    placeholder="doctor@example.com"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {editingDoctorId === null && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Password *
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={doctorForm.password}
                      onChange={handleDoctorInput}
                      required
                      minLength={6}
                      placeholder="Minimum 6 characters"
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Specialization *
                  </label>
                  <select
                    name="specialization_id"
                    value={doctorForm.specialization_id}
                    onChange={handleDoctorInput}
                    required
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Specialization</option>
                    {specializations.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Area *
                  </label>
                  <select
                    name="area_id"
                    value={doctorForm.area_id}
                    onChange={handleDoctorInput}
                    required
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Area</option>
                    {areas.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Qualification
                  </label>
                  <input
                    type="text"
                    name="qualification"
                    value={doctorForm.qualification}
                    onChange={handleDoctorInput}
                    placeholder="MBBS, FCPS"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Experience (Years)
                  </label>
                  <input
                    type="number"
                    name="experience"
                    value={doctorForm.experience}
                    onChange={handleDoctorInput}
                    min="0"
                    placeholder="5"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Consultation Fee (Rs.)
                  </label>
                  <input
                    type="number"
                    name="consultation_fee"
                    value={doctorForm.consultation_fee}
                    onChange={handleDoctorInput}
                    min="0"
                    placeholder="1000"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Clinic Name
                  </label>
                  <input
                    type="text"
                    name="clinic_name"
                    value={doctorForm.clinic_name}
                    onChange={handleDoctorInput}
                    placeholder="Ahmad Medical Clinic"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Clinic Address
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={doctorForm.address}
                    onChange={handleDoctorInput}
                    placeholder="Complete clinic address"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Doctor Profile Image
                  </label>

                  <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-5">
                    <div className="flex flex-col items-center gap-5 md:flex-row">
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="Doctor preview"
                          className="h-32 w-32 rounded-xl border-2 border-white object-cover shadow"
                        />
                      ) : (
                        <div className="flex h-32 w-32 items-center justify-center rounded-xl bg-blue-100 text-4xl font-bold text-blue-600">
                          {doctorForm.name.charAt(0).toUpperCase() || "?"}
                        </div>
                      )}

                      <div className="w-full flex-1">
                        <input
                          id="doctor-profile-image"
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          onChange={handleImageUpload}
                          disabled={uploadingImage || savingDoctor}
                          className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-3 file:font-medium file:text-white hover:file:bg-blue-700"
                        />
                        <p className="mt-3 text-sm text-gray-500">
                          JPG, JPEG, PNG ya WEBP. Maximum 5 MB.
                        </p>
                        {uploadingImage && (
                          <p className="mt-2 text-sm font-medium text-blue-600">
                            Image upload ho rahi hai...
                          </p>
                        )}
                        {doctorForm.profile_image && !uploadingImage && (
                          <p className="mt-2 text-sm font-medium text-green-600">
                            Profile image selected.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Doctor Bio
                  </label>
                  <textarea
                    name="bio"
                    value={doctorForm.bio}
                    onChange={handleDoctorInput}
                    rows={4}
                    placeholder="Doctor ke bare mein mukhtasar taaruf..."
                    className="w-full resize-y rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {editingDoctorId === null && (
                <div className="mt-6 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                  <strong>Note:</strong> Naya doctor pehle Pending hoga.
                  Information check karne ke baad aap usay Verify kar sakte hain.
                </div>
              )}

              <div className="mt-6 flex flex-col justify-end gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={closeDoctorModal}
                  disabled={savingDoctor || uploadingImage}
                  className="rounded-lg border border-gray-300 px-5 py-3 font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingDoctor || uploadingImage}
                  className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {uploadingImage
                    ? "Uploading Image..."
                    : savingDoctor
                    ? editingDoctorId !== null
                      ? "Saving Changes..."
                      : "Adding Doctor..."
                    : editingDoctorId !== null
                    ? "Save Changes"
                    : "Add Doctor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
