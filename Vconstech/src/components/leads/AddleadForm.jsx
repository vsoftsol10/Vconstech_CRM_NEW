import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Select from "react-select";
import { FiX, FiClipboard } from "react-icons/fi";
import axios from "axios";
import { API_BASE_URL } from "../../config/api";
// import UpdateTaskForm from "./Employee/LeadUpdate";
import UpdateTaskForm from "./Employee/LeadUpdate"
const YELLOW = "#F5C518";

const CHANNELS = [
  { value: "email",     label: "Email" },
  { value: "phone",     label: "Phone" },
  { value: "whatsapp",  label: "WhatsApp" },
  { value: "linkedin",  label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "website",   label: "Website" },
  { value: "meta ads",  label: "Meta Ads" },
  { value: "erp",       label: "ERP" },
];
const DEFAULT_CHANNEL = CHANNELS[0];
const STATUSES = [
  { value: "new",       label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal",  label: "Proposal" },
  { value: "won",       label: "Won" },
  { value: "lost",      label: "Lost" },
];
const PLANS = [
   { value: "none",      label: "None" },

  { value: "trail",      label: "Trail" },

  { value: "basic",      label: "Basic" },
  { value: "premium",        label: "Premium" },
  { value: "advanced", label: "Advanced" },
];

const todayInput = new Date().toISOString().split("T")[0];

const toSelectOption = (options, value) => {
  const rawValue = String(value || "").trim();
  if (!rawValue) return null;

  const normalizedValue = rawValue.toLowerCase();
  const existingOption = options.find(
    (option) => String(option.value).toLowerCase() === normalizedValue
  );

  if (existingOption) return existingOption;

  return {
    value: rawValue,
    label: rawValue
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" "),
  };
};

const withSelectedOption = (options, selectedOption) => {
  if (!selectedOption) return options;

  const hasOption = options.some(
    (option) => String(option.value).toLowerCase() === String(selectedOption.value).toLowerCase()
  );

  return hasOption ? options : [selectedOption, ...options];
};

const inputCls = (hasError) =>
  `w-full px-3 py-2.5 text-sm border rounded-xl bg-gray-50 outline-none transition-colors ${
    hasError
      ? "border-red-400 focus:border-red-400"
      : "border-gray-200 focus:border-[#F5C518]"
  }`;

const selectStyles = (hasError) => ({
  control: (base, state) => ({
    ...base,
    minHeight: 42,
    borderRadius: 12,
    borderColor: hasError ? "#f87171" : state.isFocused ? YELLOW : "#e5e7eb",
    boxShadow: "none",
    backgroundColor: "#F9FAFB",
    cursor: "pointer",
    fontSize: 14,
    transition: "border-color .15s",
    "&:hover": {
      borderColor: hasError ? "#f87171" : state.isFocused ? YELLOW : "#d1d5db",
    },
  }),
  valueContainer: (base) => ({ ...base, padding: "0 10px" }),
  placeholder:    (base) => ({ ...base, color: "#9CA3AF", fontSize: 14 }),
  singleValue:    (base) => ({ ...base, color: "#111827", fontSize: 14 }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused ? YELLOW : "#9CA3AF",
    transition: "color .15s, transform .2s",
    transform: state.selectProps.menuIsOpen ? "rotate(180deg)" : "rotate(0deg)",
    paddingRight: 10,
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid #f1f1f1",
    boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
    zIndex: 9999,
    marginTop: 5,
  }),
  menuList: (base) => ({ ...base, padding: "5px" }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? YELLOW : state.isFocused ? "#FFFAE6" : "#fff",
    color: state.isSelected ? "#1a1400" : "#111827",
    fontSize: 14,
    fontWeight: state.isSelected ? 600 : 400,
    cursor: "pointer",
    padding: "10px 12px",
    borderRadius: 8,
  }),
});

const Field = ({ label, error, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
    {children}
    {error && <p className="text-[11px] text-red-400 mt-1">{error}</p>}
  </div>
);

export default function AddLeadModal({ onClose, onSubmit, editData = null }) {
  const [form, setForm] = useState({
    fullName: "", company: "", channel: DEFAULT_CHANNEL, status: null,
    phone: "", email: "", date: "", plan: { value: "none", label: "None" },
    assignedTo: null, address: "", location: "", requirements: "", workNotes: "",
  });
  const [showWorkUpdate, setShowWorkUpdate] = useState(false);
  const [assignableMembers, setAssignableMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [memberLoadError, setMemberLoadError] = useState("");
  const [errors, setErrors]                 = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting]         = useState(false);
  const channelOptions = withSelectedOption(CHANNELS, form.channel);

  const assignmentOptions = useMemo(
    () => ["Sales", "Marketing"]
      .map((department) => ({
        label: `${department} Team`,
        options: assignableMembers.filter((member) => member.department === department),
      }))
      .filter((group) => group.options.length > 0),
    [assignableMembers]
  );

  useEffect(() => {
    const loadMembers = async () => {
      setLoadingMembers(true);
      setMemberLoadError("");
      try {
        const res = await axios.get(`${API_BASE_URL}/api/team`);
        const members = Array.isArray(res.data) ? res.data : res.data?.data || [];
        const options = members
          .filter((member) => ["sales", "marketing"].includes(String(member.department || "").toLowerCase()))
          .map((member) => ({
            value: member.id,
            label: `${member.name || "Unnamed"} (${member.employee_id || "No employee ID"})`,
            department: String(member.department || "").trim().replace(/^./, (letter) => letter.toUpperCase()),
          }));
        setAssignableMembers(options);
      } catch (err) {
        console.error(err);
        setMemberLoadError("Unable to load Sales and Marketing team members.");
      } finally {
        setLoadingMembers(false);
      }
    };
    loadMembers();
  }, []);

  // Populate form when editing — runs after salesMembers are loaded
  useEffect(() => {
    if (editData) {
      setForm({
        fullName:     editData.full_name    || "",
        company:      editData.company      || "",
        channel:      toSelectOption(CHANNELS, editData.channel),
        status:       toSelectOption(STATUSES, editData.status),
        plan:         toSelectOption(PLANS, editData.plan),
        assignedTo:   assignableMembers.find(m => String(m.value) === String(editData.assigned_to)) || null,
        workNotes:    editData.work_notes   || "",
        phone:        editData.phone        || "",
        email:        editData.email        || "",
        date:         editData.lead_date    ? editData.lead_date.split("T")[0] : "",
        address:      editData.address      || "",
        location:     editData.location     || "",
        requirements: editData.requirements || "",
      });
    }
  }, [editData, assignableMembers]);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const set       = (field) => (e)   => {
    const value = field === "phone" ? e.target.value.replace(/\D/g, "").slice(0, 10) : e.target.value;
    setForm(f => ({ ...f, [field]: value }));
    setErrors(er => ({ ...er, [field]: "" }));
     setFormError("");
  };
  // FIX: pass the full option object — don't extract .value here; extract it only on submit
  const setSelect = (field) => (val) => {
     setForm(f => ({ ...f, [field]: val }));   
   setErrors(er => ({ ...er, [field]: "" }));  
   setFormError(""); };

  const validate = () => {
    const e = {};
    if (!form.fullName.trim())                                     e.fullName     = "Full name is required";
    else if (form.fullName.trim().length < 3)                      e.fullName     = "Name must be at least 3 characters";
    if (!form.company.trim())                                      e.company      = "Company is required";
    if (!form.phone.trim())                                        e.phone        = "Phone is required";
    else if (!/^[6-9]\d{9}$/.test(form.phone.replace(/\s/g, ""))) e.phone        = "Enter a valid 10-digit mobile number";
    if (!form.email.trim())                                        e.email        = "Email is required";
    else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(form.email)) e.email = "Enter a valid email address";
    if (!form.status)                                              e.status       = "Status is required";
    if (form.status?.value !== "new" && !form.plan)                e.plan         = "Plan is required";
    if (!form.channel)                                             e.channel      = "Channel is required";
    if (!form.date)                                                e.date         = "Date is required";
    else if (Number.isNaN(new Date(form.date).getTime()))          e.date         = "Enter a valid date";
    else if (form.date > todayInput)                               e.date         = "Lead date cannot be in the future";
    if (form.requirements && form.requirements.trim().length < 10) e.requirements = "Requirements should be at least 10 characters";
    return e;
  };

  // Serialize Select option objects before sending to the API
  const serializeForm = () => ({
    ...form,
    assignedTo: form.assignedTo?.value || null,
    channel:    form.channel?.value    || null,
    status:     form.status?.value     || null,
    plan:       form.plan?.value       || null,
  });

  const checkDuplicates = async () => {
    const normalizedEmail = form.email.trim().toLowerCase();
    const normalizedPhone = form.phone.trim();
    const { data } = await axios.get(`${API_BASE_URL}/api/leads`);
    const currentId = String(editData?.id || "");
    const duplicate = data.find((lead) => {
      if (String(lead.id) === currentId) return false;
      return (
        String(lead.email || "").trim().toLowerCase() === normalizedEmail ||
        String(lead.phone || "").replace(/\D/g, "") === normalizedPhone
      );
    });

    if (!duplicate) return {};
    return {
      ...(String(duplicate.email || "").trim().toLowerCase() === normalizedEmail
        ? { email: "This email address already exists." }
        : {}),
      ...(String(duplicate.phone || "").replace(/\D/g, "") === normalizedPhone
        ? { phone: "This phone number already exists." }
        : {}),
    };
  };

  const handleSubmit = async () => {
  const e = validate();

if (Object.keys(e).length > 0) {
  setErrors(e);
  setFormError("Please fill all required fields.");
  return;
}

setErrors({});
setFormError("");
    setSubmitting(true);
    try {
      const duplicateErrors = await checkDuplicates();
      if (Object.keys(duplicateErrors).length > 0) {
        setErrors((current) => ({ ...current, ...duplicateErrors }));
        return;
      }

      if (editData) {
        // FIX: serialize selects for PUT just like POST
        await axios.put(`${API_BASE_URL}/api/leads/${editData.id}`, serializeForm());
        alert("Lead updated successfully");
      } else {
        await axios.post(`${API_BASE_URL}/api/leads`, serializeForm());
        alert("Lead created successfully");
      }
      onSubmit?.(serializeForm());
      onClose();
    } catch (err) {
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
        return;
      }

      if (err.response?.status === 409) {
        const nextErrors = {};
        if (err.response.data?.emailExists) {
          nextErrors.email = "This email address already exists.";
        }
        if (err.response.data?.phoneExists) {
          nextErrors.phone = "This phone number already exists.";
        }
        setErrors(nextErrors);
        return;
      }

      alert(err.response?.data?.message || "Failed to save lead");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* ── OUTER MODAL SHELL ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 20 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex rounded-2xl shadow-2xl overflow-hidden max-h-[90vh]"
        style={{ width: showWorkUpdate ? "min(1100px, 95vw)" : "min(680px, 95vw)" }}
      >

        {/* ════════════════════════════════
            LEFT PANEL — Add / Edit Lead
        ════════════════════════════════ */}
        <div className="flex flex-col bg-white flex-1 min-w-0">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="text-[18px] font-bold text-[#111111]">
                {editData ? "Update Lead" : "Add New Lead"}
              </h2>
              {editData && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
                  Edit Mode
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
            >
              <FiX size={16} />
            </button>
          </div>

          {/* Scrollable form body */}
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

            {/* Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name" error={errors.fullName}>
                <input type="text" value={form.fullName} onChange={set("fullName")}
                  placeholder="Enter full name" className={inputCls(errors.fullName)} />
              </Field>
              <Field label="Company" error={errors.company}>
                <input type="text" value={form.company} onChange={set("company")}
                  placeholder="Enter company name" className={inputCls(errors.company)} />
              </Field>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Channel" error={errors.channel}>
                <Select styles={selectStyles(errors.channel)} placeholder="Select channel"
                  value={form.channel} onChange={setSelect("channel")} options={channelOptions} />
              </Field>
              <Field label="Status" error={errors.status}>
                <Select styles={selectStyles(errors.status)} placeholder="Select status"
                  value={form.status} onChange={setSelect("status")} options={STATUSES} />
              </Field>
            </div>

            {/* Row 3 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Phone" error={errors.phone}>
                <input type="tel" inputMode="numeric" value={form.phone} onChange={set("phone")}
                  placeholder="9876543210" className={inputCls(errors.phone)} />
              </Field>
              <Field label="Email" error={errors.email}>
                <input type="email" value={form.email} onChange={set("email")}
                  placeholder="example@email.com" className={inputCls(errors.email)} />
              </Field>
            </div>

            {/* Row 4 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Date" error={errors.date}>
                <input type="date" value={form.date} onChange={set("date")} max={todayInput}
                  className={inputCls(errors.date)} />
              </Field>
              {form.status?.value !== "new" && (
                <Field label="Plan" error={errors.plan}>
                  <Select styles={selectStyles(errors.plan)} placeholder="Select plan"
                    value={form.plan} onChange={setSelect("plan")} options={PLANS} />
                </Field>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <Field label="Location" error={errors.location}>
              <input type="text" value={form.location} onChange={set("location")}
                placeholder="Enter location" className={inputCls(errors.location)} />
            </Field>

            <Field label="Address" error={errors.address}>
              <textarea rows={3} value={form.address} onChange={set("address")}
                placeholder="Enter address..." className={inputCls(errors.address)} />
            </Field>

</div>

            {/* Row 5 */}
            <Field label="Assign To" error={errors.assignedTo}>
              {/* FIX: use setSelect directly — no .value extraction here */}
              <Select
                styles={selectStyles(errors.assignedTo)}
                placeholder="Select Sales or Marketing member"
                value={form.assignedTo}
                onChange={setSelect("assignedTo")}
                options={assignmentOptions}
                isLoading={loadingMembers}
                isDisabled={loadingMembers || Boolean(memberLoadError)}
                noOptionsMessage={() => "No Sales or Marketing team members found"}
              />
              {memberLoadError && <p className="mt-1 text-[11px] text-red-400">{memberLoadError}</p>}
            </Field>

           

            <Field label="Requirements" error={errors.requirements}>
              <textarea rows={4} value={form.requirements} onChange={set("requirements")}
                placeholder="Enter requirements..." className={inputCls(errors.requirements)} />
            </Field>

          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 shrink-0 bg-white">
            {/* Left: Update Work toggle (edit mode only) */}
            <div>
              {editData && (
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={() => setShowWorkUpdate(v => !v)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: showWorkUpdate ? "#FFF9E6" : "#f9f9f9",
                    border: `1.5px solid ${showWorkUpdate ? YELLOW : "#e5e7eb"}`,
                    color: showWorkUpdate ? "#9a7700" : "#555",
                  }}
                >
                  <FiClipboard size={14} />
                  {showWorkUpdate ? "Hide Work Update" : "Update Work"}
                </motion.button>
              )}
            </div>
{formError && (
  <p className="text-red-600 text-sm font-medium mr-4">
    {formError}
  </p>
)}
            {/* Right: Cancel + Submit */}
            <div className="flex items-center gap-3">
              <button onClick={onClose}
                className="px-6 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all">
                Cancel
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-black transition-all shadow-sm"
                style={{ background: YELLOW, opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? "Saving..." : editData ? "Update Lead" : "Create Lead"}
              </motion.button>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════
            RIGHT PANEL — Update Work
        ════════════════════════════════ */}
        <AnimatePresence>
          {showWorkUpdate && (
            <motion.div
              key="work-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 400, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              className="flex-shrink-0 overflow-hidden"
              style={{ borderLeft: "1px solid #f0f0f0" }}
            >
              <div className="w-[400px] h-full flex flex-col bg-white">

                {/* Panel Header */}
                <div className="flex items-center justify-between px-5 py-5 border-b border-gray-200 shrink-0 bg-white">
                  <div>
                    <h3 className="text-[15px] font-bold text-gray-800">Work Update</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">Log task progress for this lead</p>
                  </div>
                  <button
                    onClick={() => setShowWorkUpdate(false)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                  >
                    <FiX size={14} />
                  </button>
                </div>

                {/* Panel Body */}
                <div className="flex-1 overflow-y-auto">
                  {/* <UpdateTaskForm leadId={editData?.id} leadData={editData} /> */}
                  <UpdateTaskForm
  leadId={editData?.id}
  leadData={{
    ...editData,
    assigned_to_name: assignableMembers.find(
      m => String(m.value) === String(editData?.assigned_to)
    )?.label
  }}
/>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </motion.div>
  );
}
