import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "../../config/api";

import {
  FiX,
  FiCheck,
  FiAlertCircle,
  FiUser,
  FiBriefcase,
  FiHash,
} from "react-icons/fi";
import Select from "react-select";
import axios from "axios";
import {
  validateMember,
  isValidPhone,
  isValidEmail,
} from "../../utils/memberValidation";
import { selectStyles } from "../../components/TeamMember/styles/selectStyles";

const API = `${API_BASE_URL}`;

const DEPARTMENTS = ["Sales", "Marketing", "Technical", "Support", "Admin"].map((v) => ({
  value: v,
  label: v,
}));

function resolveImageUrl(value) {
  if (!value) return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  return `${API}/uploads/${value}`;
}

// ── tiny sub-components ─────────────────────────────────────────────────────

function FieldError({ msg }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
          className="flex items-center gap-1 mt-1 text-xs text-red-500 font-medium"
        >
          <FiAlertCircle size={11} /> {msg}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

function FieldStatus({ value, errorKey, errors, touched }) {
  if (!touched[errorKey]) return null;
  if (errors[errorKey]) return <FiAlertCircle size={14} className="text-red-400" />;
  if (value) return <FiCheck size={14} className="text-green-500" />;
  return null;
}

function inputClass(fieldKey, errors, touched, extra = "") {
  const base =
    "w-full px-3 py-2.5 text-sm border rounded-xl bg-white outline-none transition-all duration-150 " +
    extra;
  if (!touched[fieldKey]) return base + " border-gray-200 focus:border-[#F5C518]";
  if (errors[fieldKey])
    return base +
      " border-red-400 bg-red-50 focus:border-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.08)]";
  return base +
    " border-green-400 focus:border-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.08)]";
}

// ── main component ──────────────────────────────────────────────────────────

export default function AddMemberModal({
  onClose,
  onSave,
  existingMembers = [],
  initialData = null,
}) {
  // FIX 1: track newly selected file separately from the existing remote URL
  const [image, setImage] = useState(null);
  const [existingImageUrl, setExistingImageUrl] = useState("");

  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState({});
  const [phoneLen, setPhoneLen] = useState(0);
  const [generatedId, setGeneratedId] = useState("");
  const [serverError, setServerError] = useState("");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    department: null,
    role: "",
    designation: "",
    dateJoined: "",
  });

  // Populate form when editing
  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || "",
        phone: initialData.phone || "",
        email: initialData.email || "",
        department: initialData.department
          ? { value: initialData.department, label: initialData.department }
          : null,
        role: initialData.role || "",
        designation: initialData.designation || "",
        dateJoined: initialData.date_joined
          ? initialData.date_joined.split("T")[0]
          : "",
      });
      setGeneratedId(initialData.employee_id || "");
      // FIX 2: store the existing remote image URL so preview & validation
      //         don't treat the edit form as "no image uploaded"
      setExistingImageUrl(resolveImageUrl(initialData.profile_image));
      setPhoneLen((initialData.phone || "").length);
    }
  }, [initialData]);

  // FIX 3: useMemo + revokeObjectURL to avoid per-render object-URL leaks
  const imagePreviewUrl = useMemo(() => {
    if (!image) return null;
    return URL.createObjectURL(image);
  }, [image]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const set = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    setTouched((p) => ({ ...p, [k]: true }));
  };

  const touch = (k) => setTouched((p) => ({ ...p, [k]: true }));

  // Exclude the member being edited so their own phone/email don't
  // trigger "already registered" false positives
  const otherMembers = existingMembers.filter((m) => m.id !== initialData?.id);

  // FIX 4: pass existingImageUrl so validation doesn't require a new upload
  //         when editing a member who already has a photo
  const errors = validateMember(form, image, otherMembers, existingImageUrl);

  const showErrors = submitted
    ? errors
    : Object.fromEntries(
        Object.entries(errors).filter(
          ([k]) => touched[k] || (k === "image" && touched.image)
        )
      );

  const isFormValid = Object.keys(errors).length === 0;

  const handleSave = async () => {
    setTouched({
      name: true,
      phone: true,
      email: true,
      department: true,
      role: true,
      designation: true,
      dateJoined: true,
      image: true,
    });
    setSubmitted(true);
    setServerError("");

    if (!isFormValid) return;

    try {
      setSaving(true);

      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) =>
        formData.append(k, typeof v === "object" && v?.value ? v.value : v ?? "")
      );

      // FIX 5: only send profileImage when the user actually picked a new file
      if (image) {
        formData.append("profileImage", image);
      }

      const response = initialData
        ? await axios.put(
            `${API_BASE_URL}/api/team/${initialData.id}`,
            formData,
            { headers: { "Content-Type": "multipart/form-data" } }
          )
        : await axios.post(`${API_BASE_URL}/api/team`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });

      setGeneratedId(response.data.employeeId);
      onSave?.();
      onClose();
    } catch (error) {
      console.error(error);
      setServerError(error.response?.data?.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  // Progress indicator
  const totalFields = 8;
  const filledFields = [
    form.name.trim().length >= 2,
    isValidPhone(form.phone),
    isValidEmail(form.email),
    !!form.department,
    !!form.role.trim(),
    !!form.designation.trim(),
    !!form.dateJoined,
    // FIX 6: count image as filled if either a new file or existing URL present
    !!(image || existingImageUrl),
  ].filter(Boolean).length;
  const progress = Math.round((filledFields / totalFields) * 100);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex h-[92vh] w-full max-w-[920px] flex-col overflow-hidden rounded-[20px] bg-[#f8f8f6] shadow-2xl"
      >
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100 z-10">
          <motion.div
            className="h-full bg-[#F5C518] rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-white px-5 pt-6 pb-4 sm:px-6 shrink-0">
          <div>
            <h2 className="text-[20px] font-bold text-[#111111]">
              {initialData ? "Edit Team Member" : "Add Team Member"}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {filledFields}/{totalFields} fields completed
              {submitted && !isFormValid && (
                <span className="text-red-500 ml-2 font-semibold">
                  · Fix {Object.keys(errors).length} error
                  {Object.keys(errors).length > 1 ? "s" : ""} to save
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
          >
            <FiX size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto px-4 py-5 sm:px-6 lg:grid-cols-2">

          {/* ── Personal Information ──────────────────────────────────────── */}
          <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-md bg-[#FEF3C7] flex items-center justify-center">
                <FiUser size={13} className="text-[#B45309]" />
              </div>
              <h3 className="text-[14px] font-bold text-[#111111]">
                Personal Information
              </h3>
            </div>

            <div className="space-y-4">

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    onBlur={() => touch("name")}
                    placeholder="e.g. Rahul Sharma"
                    className={inputClass("name", showErrors, touched, "pr-8")}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    <FieldStatus
                      value={form.name}
                      errorKey="name"
                      errors={showErrors}
                      touched={touched}
                    />
                  </span>
                </div>
                <FieldError msg={showErrors.name} />
              </div>

              {/* Phone + Email */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={form.phone}
                      maxLength={10}
                      onChange={(e) => {
                        const digits = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 10);
                        set("phone", digits);
                        setPhoneLen(digits.length);
                      }}
                      onBlur={() => touch("phone")}
                      placeholder="10-digit number"
                      className={inputClass(
                        "phone",
                        showErrors,
                        touched,
                        "pr-14"
                      )}
                    />
                    <span
                      className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold tabular-nums ${
                        phoneLen === 10
                          ? "text-green-500"
                          : touched.phone && phoneLen > 0
                          ? "text-red-400"
                          : "text-gray-300"
                      }`}
                    >
                      {phoneLen}/10
                    </span>
                  </div>
                  <FieldError msg={showErrors.phone} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      onBlur={() => touch("email")}
                      placeholder="name@gmail.com"
                      className={inputClass(
                        "email",
                        showErrors,
                        touched,
                        "pr-8"
                      )}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      <FieldStatus
                        value={form.email}
                        errorKey="email"
                        errors={showErrors}
                        touched={touched}
                      />
                    </span>
                  </div>
                  <FieldError msg={showErrors.email} />
                  {!touched.email && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      Only @gmail.com addresses accepted.
                    </p>
                  )}
                </div>
              </div>

              {/* Profile Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Profile Image <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-4">
                  {/* Preview circle */}
                  <div
                    className={`w-16 h-16 rounded-full overflow-hidden border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      touched.image && showErrors.image
                        ? "border-red-400 bg-red-50"
                        : image || existingImageUrl
                        ? "border-green-400 bg-gray-100"
                        : "border-dashed border-gray-300 bg-gray-50"
                    }`}
                  >
                    {/* FIX 7: show new preview → existing URL → placeholder */}
                    {image ? (
                      <img
                        src={imagePreviewUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : existingImageUrl ? (
                      <img
                        src={existingImageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FiUser size={22} className="text-gray-300" />
                    )}
                  </div>

                  <div className="flex-1">
                    <label className="cursor-pointer group">
                      <div
                        className={`px-4 py-2.5 rounded-xl border-2 border-dashed text-sm font-medium text-center transition-all ${
                          touched.image && showErrors.image
                            ? "border-red-400 bg-red-50 text-red-400"
                            : "border-gray-200 text-gray-500 hover:border-[#F5C518] hover:bg-[#FFFBEB] hover:text-[#B45309]"
                        }`}
                      >
                        {image || existingImageUrl
                          ? "Change Photo"
                          : "Click to Upload"}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          // FIX 8: guard against cancel clearing the image
                          const file = e.target.files[0];
                          if (file) {
                            setImage(file);
                            setTouched((p) => ({ ...p, image: true }));
                          }
                        }}
                      />
                    </label>
                    {(image || existingImageUrl) && (
                      <p className="text-[11px] text-green-600 mt-1 flex items-center gap-1">
                        <FiCheck size={11} />
                        {image ? image.name : "Current photo"}
                      </p>
                    )}
                    <FieldError msg={showErrors.image} />
                  </div>
                </div>
              </div>

            </div>
          </section>

          {/* ── Work Information ──────────────────────────────────────────── */}
          <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-md bg-[#FEF3C7] flex items-center justify-center">
                <FiBriefcase size={13} className="text-[#B45309]" />
              </div>
              <h3 className="text-[14px] font-bold text-[#111111]">
                Work Information
              </h3>
            </div>

            <div className="space-y-4">

              {/* Department */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Department <span className="text-red-500">*</span>
                </label>
                <Select
                  options={DEPARTMENTS}
                  value={form.department}
                  onChange={(v) => set("department", v)}
                  onBlur={() => touch("department")}
                  placeholder="Select Department"
                  isSearchable={false}
                  styles={selectStyles(
                    touched.department && !!showErrors.department
                  )}
                />
                <FieldError msg={showErrors.department} />
              </div>

              {/* Role + Designation */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={form.role}
                      onChange={(e) => set("role", e.target.value)}
                      onBlur={() => touch("role")}
                      placeholder="e.g. Developer"
                      className={inputClass(
                        "role",
                        showErrors,
                        touched,
                        "pr-8"
                      )}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      <FieldStatus
                        value={form.role}
                        errorKey="role"
                        errors={showErrors}
                        touched={touched}
                      />
                    </span>
                  </div>
                  <FieldError msg={showErrors.role} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Designation <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={form.designation}
                      onChange={(e) => set("designation", e.target.value)}
                      onBlur={() => touch("designation")}
                      placeholder="e.g. Senior"
                      className={inputClass(
                        "designation",
                        showErrors,
                        touched,
                        "pr-8"
                      )}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      <FieldStatus
                        value={form.designation}
                        errorKey="designation"
                        errors={showErrors}
                        touched={touched}
                      />
                    </span>
                  </div>
                  <FieldError msg={showErrors.designation} />
                </div>
              </div>

              {/* Employee ID + Date */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Employee ID
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={generatedId}
                      readOnly
                      placeholder="Auto-generated on save"
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 outline-none text-gray-500 cursor-not-allowed"
                    />
                    {generatedId && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        <FiHash size={13} className="text-[#B45309]" />
                      </span>
                    )}
                  </div>
                  {!generatedId && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      Generated by server on save.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Date of Joining <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={form.dateJoined}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={(e) => set("dateJoined", e.target.value)}
                      onBlur={() => touch("dateJoined")}
                      className={inputClass("dateJoined", showErrors, touched)}
                    />
                  </div>
                  <FieldError msg={showErrors.dateJoined} />
                </div>
              </div>

            </div>
          </section>

          {/* ── Validation Summary ────────────────────────────────────────── */}
          <AnimatePresence>
            {submitted && !isFormValid && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 lg:col-span-2"
              >
                <p className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-1.5">
                  <FiAlertCircle size={14} /> Please fix the following:
                </p>
                <ul className="space-y-1">
                  {Object.values(errors).map((msg, i) => (
                    <li
                      key={i}
                      className="text-xs text-red-500 flex items-start gap-1.5"
                    >
                      <span className="mt-0.5">•</span> {msg}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Server Error */}
        <AnimatePresence>
          {serverError && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mx-6 mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
            >
              <p className="text-sm font-semibold text-red-600 flex items-center gap-2">
                <FiAlertCircle size={14} />
                {serverError}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="flex flex-col gap-3 border-t border-gray-100 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 shrink-0">

          {/* Completion pill */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full border-2 border-gray-100 flex items-center justify-center relative overflow-hidden">
              <svg
                className="absolute inset-0 w-full h-full -rotate-90"
                viewBox="0 0 32 32"
              >
                <circle
                  cx="16"
                  cy="16"
                  r="13"
                  fill="none"
                  stroke="#f3f4f6"
                  strokeWidth="3"
                />
                <motion.circle
                  cx="16"
                  cy="16"
                  r="13"
                  fill="none"
                  stroke={isFormValid ? "#22c55e" : "#F5C518"}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 13}`}
                  animate={{
                    strokeDashoffset: 2 * Math.PI * 13 * (1 - progress / 100),
                  }}
                  transition={{ duration: 0.4 }}
                />
              </svg>
              <span className="text-[8px] font-bold text-gray-500 z-10">
                {progress}%
              </span>
            </div>
            <span className="text-xs text-gray-400 hidden sm:block">
              {isFormValid ? "Ready to save!" : "Fill all fields"}
            </span>
          </div>

          <div className="flex w-full flex-col-reverse gap-3 sm:w-auto sm:flex-row sm:items-center">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>

            <motion.button
              whileHover={{ scale: isFormValid ? 1.03 : 1 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold transition-all ${
                isFormValid
                  ? "bg-[#F5C518] hover:bg-yellow-500 text-black shadow-sm"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              {saving ? (
                <>
                  <motion.div
                    className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.7,
                      ease: "linear",
                    }}
                  />
                  Saving…
                </>
              ) : (
                <>
                  {isFormValid && <FiCheck size={14} />}
                  Save Member
                </>
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
