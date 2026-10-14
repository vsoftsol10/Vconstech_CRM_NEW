// import { useEffect, useState } from "react";
// import { useNavigate, useParams } from "react-router-dom";
// import { motion } from "framer-motion";
// import Select from "react-select";
// import { FiX } from "react-icons/fi";
// import axios from "axios";
// import { API_BASE_URL, unwrapCustomer, unwrapCustomerList } from "../../config/api";

// const YELLOW = "#F5C518";

// const PLANS = [
//   { value: "Trial", label: "Trial" },
//   { value: "Basic", label: "Basic" },
  
//   { value: "Premium", label: "Premium" },
//   { value: "Advanced", label: "Advanced" },
// ];

// const emailPattern = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
// const phonePattern = /^[6-9]\d{9}$/;

// const inputCls = (hasError) =>
//   `w-full px-3 py-2.5 text-sm border rounded-xl bg-gray-50 outline-none transition-colors ${
//     hasError ? "border-red-400 focus:border-red-400" : "border-gray-200 focus:border-[#F5C518]"
//   }`;

// const selectStyles = (hasError) => ({
//   control: (base, state) => ({
//     ...base,
//     minHeight: 42,
//     borderRadius: 12,
//     borderColor: hasError ? "#f87171" : state.isFocused ? YELLOW : "#e5e7eb",
//     boxShadow: "none",
//     backgroundColor: "#F9FAFB",
//     cursor: "pointer",
//     fontSize: 14,
//     transition: "border-color .15s",
//     "&:hover": {
//       borderColor: hasError ? "#f87171" : state.isFocused ? YELLOW : "#d1d5db",
//     },
//   }),
//   valueContainer: (base) => ({ ...base, padding: "0 10px" }),
//   placeholder: (base) => ({ ...base, color: "#9CA3AF", fontSize: 14 }),
//   singleValue: (base) => ({ ...base, color: "#111827", fontSize: 14 }),
//   indicatorSeparator: () => ({ display: "none" }),
//   dropdownIndicator: (base, state) => ({
//     ...base,
//     color: state.isFocused ? YELLOW : "#9CA3AF",
//     transition: "color .15s, transform .2s",
//     transform: state.selectProps.menuIsOpen ? "rotate(180deg)" : "rotate(0deg)",
//     paddingRight: 10,
//   }),
//   menu: (base) => ({
//     ...base,
//     borderRadius: 14,
//     overflow: "hidden",
//     border: "1px solid #f1f1f1",
//     boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
//     zIndex: 9999,
//     marginTop: 5,
//   }),
//   menuList: (base) => ({ ...base, padding: "5px" }),
//   option: (base, state) => ({
//     ...base,
//     backgroundColor: state.isSelected ? YELLOW : state.isFocused ? "#FFFAE6" : "#fff",
//     color: state.isSelected ? "#1a1400" : "#111827",
//     fontSize: 14,
//     fontWeight: state.isSelected ? 600 : 400,
//     cursor: "pointer",
//     padding: "10px 12px",
//     borderRadius: 8,
//   }),
// });

// const Field = ({ label, error, children }) => (
//   <div>
//     <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
//     {children}
//     {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
//   </div>
// );

// function toInputDate(value) {
//   if (!value) return "";
//   if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.split("T")[0];
//   const parsed = new Date(value);
//   return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().split("T")[0];
// }

// function findPlan(value) {
//   return PLANS.find((item) => item.label.toLowerCase() === String(value || "").toLowerCase()) || null;
// }

// function formatDateOnly(date) {
//   const year = date.getFullYear();
//   const month = String(date.getMonth() + 1).padStart(2, "0");
//   const day = String(date.getDate()).padStart(2, "0");
//   return `${year}-${month}-${day}`;
// }

// function getPlanDurationDays(planName) {
//   const key = String(planName || "").trim().toLowerCase();
//   if (key === "trial" || key === "free trial") return { unit: "days", value: 7 };
//   if (key === "basic" || key === "premium") return { unit: "years", value: 1 };
//   return null; // Advanced terms are custom and set by the backend/ERP.
// }

// function addCalendarYears(date, years) {
//   const next = new Date(date);
//   const originalDay = next.getDate();
//   next.setDate(1);
//   next.setFullYear(next.getFullYear() + years);
//   const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
//   next.setDate(Math.min(originalDay, lastDay));
//   return next;
// }

// function getPlanDates(planName) {
//   const start = new Date();
//   start.setHours(0, 0, 0, 0);
//   const duration = getPlanDurationDays(planName);
//   if (!duration) {
//     const end = addCalendarYears(start, 1);
//     return { startDate: start, endDate: end, startDateOnly: formatDateOnly(start), endDateOnly: formatDateOnly(end) };
//   }
//   const end = new Date(start);
//   if (duration.unit === "years") return {
//     startDate: start,
//     endDate: addCalendarYears(start, duration.value),
//     startDateOnly: formatDateOnly(start),
//     endDateOnly: formatDateOnly(addCalendarYears(start, duration.value)),
//   };
//   end.setDate(end.getDate() + duration.value);

//   return {
//     startDate: start,
//     endDate: end,
//     startDateOnly: formatDateOnly(start),
//     endDateOnly: formatDateOnly(end),
//   };
// }

// function customerToForm(data = {}) {
//   return {
//     customer_name: data.customer_name || data.name || "",
//     company_name: data.company_name || data.company || data.company?.name || "",
//     phone: String(data.phone || data.phoneNumber || "").replace(/\D/g, ""),
//     email: data.email || "",
//     address: data.address || "",
//     location: data.location || data.city || "",
//     subscription_plan: findPlan(data.subscription_plan || data.plan || data.package),
//     purchase_date: toInputDate(data.start_date || data.createdAt),
//     renewal_date: toInputDate(data.renewal_date),
//     custom_members: data.custom_users || data.customMembers || "",
//     custom_projects: data.custom_projects || data.customProjectLimit || "",
//     custom_price: data.custom_price || data.customPrice || "",
//     gst_rate: data.gst_rate ?? 18,
//     selected_features: data.custom_features?.features || [],
//     support_level: data.custom_features?.support_level || "Email support",
//     dedicated_setup: Boolean(data.custom_features?.dedicated_setup),
//     setup_notes: data.custom_features?.notes || "",
//     notes: data.notes || "",
//   };
// }

// export default function CustomerFormPage({
//   propId,
//   initialCustomer,
//   source,
//   onClose,
//   modalMode = false,
//   isNew = false,
//   onCustomerAdded,
//   onRefresh,
// }) {
//   const { id: paramId } = useParams();
//   const id = propId || paramId;
//   const isErpCustomer = source === "erp" || initialCustomer?.source === "erp";
//   const navigate = useNavigate();
//   const [form, setForm] = useState({
//     customer_name: "",
//     company_name: "",
//     phone: "",
//     email: "",
//     address:"",
//     location:"",

//     subscription_plan: null,
//     purchase_date: "",
//     renewal_date: "",
//     custom_members: "",
//     custom_projects: "",
//     custom_price: "",
//     gst_rate: 18,
//     selected_features: [],
//     support_level: "Email support",
//     dedicated_setup: false,
//     setup_notes: "",
//     notes: "",
//   });
//   const [errors, setErrors] = useState({});
//   const [loading, setLoading] = useState(!isNew && Boolean(id) && !initialCustomer);
//   const [saving, setSaving] = useState(false);
//   const [saveResult, setSaveResult] = useState(null);
//   const [syncStatus, setSyncStatus] = useState(initialCustomer?.sync_status || "");
//   const [catalog, setCatalog] = useState([]);

//   useEffect(() => {
//     axios.get(`${API_BASE_URL}/api/plans`).then(({ data }) => {
//       const seen = new Set();
//       setCatalog((data || []).flatMap((plan) => (plan.features || []).map((feature) => ({ ...feature, plan: plan.name }))).filter((feature) => feature.feature_name && !seen.has(feature.feature_name) && seen.add(feature.feature_name)));
//     }).catch(() => setCatalog([]));
//   }, []);

//   useEffect(() => {
//     if (!modalMode) return undefined;
//     document.body.style.overflow = "hidden";
//     return () => {
//       document.body.style.overflow = "";
//     };
//   }, [modalMode]);

//   useEffect(() => {
//     if (!modalMode) return undefined;
//     const handler = (e) => {
//       if (e.key === "Escape") onClose?.();
//     };
//     window.addEventListener("keydown", handler);
//     return () => window.removeEventListener("keydown", handler);
//   }, [modalMode, onClose]);

//   useEffect(() => {
//     if (isNew || !initialCustomer) return;
//     setForm(customerToForm(initialCustomer));
//     setSyncStatus(initialCustomer.sync_status || "");
//     setLoading(false);
//   }, [initialCustomer, isNew]);

//   useEffect(() => {
//     if (isErpCustomer) return;
//     if (isNew || !id) return;
//     const loadCustomer = async () => {
//       try {
//         setLoading(true);
//         const res = await axios.get(`${API_BASE_URL}/api/customers/${id}`);
//         const data = unwrapCustomer(res.data);
//         setForm(customerToForm(data));
//         setSyncStatus(data.sync_status || "");
//       } catch (err) {
//         setErrors({ form: err.response?.data?.message || "Failed to load customer" });
//       } finally {
//         setLoading(false);
//       }
//     };
//     loadCustomer();
//   }, [id, isErpCustomer, isNew]);

//   const set = (field) => (e) => {
//     const rawValue = e.target.value;
//     const value = field === "phone" ? rawValue.replace(/\D/g, "").slice(0, 10) : rawValue;
//     setForm((prev) => ({ ...prev, [field]: value }));
//     setErrors((prev) => ({ ...prev, [field]: "", form: "" }));
//   };

//   const setPlan = (plan) => {
//     setForm((prev) => {
//       const selectedPlanName = plan?.label || "";
//       const currentPlanName =
//         initialCustomer?.subscription_plan ||
//         initialCustomer?.plan ||
//         initialCustomer?.raw?.subscriptionPlan ||
//         initialCustomer?.raw?.package;
//       const planChanged =
//         String(currentPlanName || "").trim().toLowerCase() !==
//         String(selectedPlanName || "").trim().toLowerCase();

//       if (!plan || (!isNew && !planChanged && initialCustomer?.active !== false)) {
//         return { ...prev, subscription_plan: plan };
//       }

//       const planDates = getPlanDates(selectedPlanName);
//       return {
//         ...prev,
//         subscription_plan: plan,
//         purchase_date: planDates.startDateOnly,
//         renewal_date: planDates.endDateOnly,
//       };
//     });
//     setErrors((prev) => ({ ...prev, subscription_plan: "", form: "" }));
//   };

//   const validate = () => {
//     const next = {};
//     const name = form.customer_name.trim();
//     const email = form.email.trim();
//     const phone = form.phone.trim();

//     if (!name) next.customer_name = "Customer name is required";
//     else if (name.length < 3) next.customer_name = "Name must be at least 3 characters";
//     if (!phone) next.phone = "Phone is required";
//     else if (!/^\d+$/.test(phone)) next.phone = "Phone must contain numbers only";
//     else if (!phonePattern.test(phone)) next.phone = "Enter a valid 10-digit mobile number";
//     if (!email) next.email = "Email is required";
//     else if (!emailPattern.test(email)) next.email = "Enter a valid email address";
//     if (!form.subscription_plan) next.subscription_plan = "Plan is required";
//     if (form.subscription_plan?.label === "Advanced") {
//       if (!Number.isInteger(Number(form.custom_members)) || Number(form.custom_members) < 1) next.custom_members = "Engineers are required";
//       if (!Number.isInteger(Number(form.custom_projects)) || Number(form.custom_projects) < 1) next.custom_projects = "Projects are required";
//       if (form.custom_price === "" || Number(form.custom_price) < 0) next.custom_price = "Custom yearly price is required";
//       if (Number(form.gst_rate) < 0 || Number(form.gst_rate) > 100) next.gst_rate = "GST must be 0–100";
//       if (!form.purchase_date || !form.renewal_date || form.renewal_date <= form.purchase_date) next.renewal_date = "End date must be after start date";
//     }
//     if (isErpCustomer) {
//       if (!form.company_name.trim()) next.company_name = "Company is required";
//       if (!form.location.trim()) next.location = "Location is required";
//       if (!form.address.trim()) next.address = "Address is required";
//     }
//     return next;
//   };

//   const checkDuplicates = async () => {
//     const currentId = String(id || "");
//     const email = form.email.trim().toLowerCase();
//     const phone = form.phone.trim();

//     if (isErpCustomer) {
//       const { data } = await axios.get(`${API_BASE_URL}/api/customers?source=erp`);
//       const duplicate = unwrapCustomerList(data).find((customer) => {
//         if (String(customer.id) === currentId) return false;
//         return (
//           String(customer.email || "").trim().toLowerCase() === email ||
//           String(customer.phoneNumber || customer.phone || "").replace(/\D/g, "") === phone
//         );
//       });

//       if (!duplicate) return {};
//       return {
//         ...(String(duplicate.email || "").trim().toLowerCase() === email
//           ? { email: "This email address already exists." }
//           : {}),
//         ...(String(duplicate.phoneNumber || duplicate.phone || "").replace(/\D/g, "") === phone
//           ? { phone: "This phone number already exists." }
//           : {}),
//       };
//     }

//     const { data } = await axios.get(`${API_BASE_URL}/api/customers`);
//     const duplicate = unwrapCustomerList(data).find((customer) => {
//       if (String(customer.id) === currentId) return false;
//       return (
//         String(customer.email || "").trim().toLowerCase() === email ||
//         String(customer.phone || "").replace(/\D/g, "") === phone
//       );
//     });

//     if (!duplicate) return {};
//     return {
//       ...(String(duplicate.email || "").trim().toLowerCase() === email
//         ? { email: "This email address already exists." }
//         : {}),
//       ...(String(duplicate.phone || "").replace(/\D/g, "") === phone
//         ? { phone: "This phone number already exists." }
//         : {}),
//     };
//   };

//   const close = () => {
//     if (modalMode) onClose?.();
//     else navigate("/customer");
//   };

//   const applyApiErrors = (err) => {
//     const apiErrors = err.response?.data?.errors;
//     if (apiErrors && typeof apiErrors === "object") {
//       setErrors(apiErrors);
//       return;
//     }
//     setErrors({
//       form: err.response?.data?.message || err.response?.data?.error || "Failed to save customer",
//     });
//   };

//   const handleSubmit = async () => {
//     if (saving) return;
//     const nextErrors = validate();
//     if (Object.keys(nextErrors).length > 0) {
//       setErrors(nextErrors);
//       return;
//     }

//     try {
//       setSaving(true);
//       const duplicateErrors = await checkDuplicates();
//       if (Object.keys(duplicateErrors).length > 0) {
//         setErrors(duplicateErrors);
//         return;
//       }

//       const payload = {
//         customer_name: form.customer_name.trim(),
//         company_name: form.company_name.trim(),
//         phone: form.phone.trim(),
//         email: form.email.trim(),
//         address: form.address.trim(),
//         location: form.location.trim(),
//         subscription_plan: form.subscription_plan.label,
//         notes: form.notes.trim(),
//         startDate: form.purchase_date || undefined,
//         endDate: form.renewal_date || undefined,
//         customMembers: form.subscription_plan.label === "Advanced" ? Number(form.custom_members) : undefined,
//         customProjectLimit: form.subscription_plan.label === "Advanced" ? Number(form.custom_projects) : undefined,
//         customPrice: form.subscription_plan.label === "Advanced" ? Number(form.custom_price) : undefined,
//         gstRate: form.subscription_plan.label === "Advanced" ? Number(form.gst_rate) : undefined,
//       customFeatures: form.subscription_plan.label === "Advanced" ? { features: form.selected_features, support_level: form.support_level, dedicated_setup: form.dedicated_setup, notes: form.setup_notes.trim() } : undefined,
//       };
//       const selectedPlanName = form.subscription_plan.label;
//       const currentPlanName =
//         initialCustomer?.subscription_plan || initialCustomer?.plan || initialCustomer?.raw?.subscriptionPlan || initialCustomer?.raw?.package;
//       const planChanged =
//         String(currentPlanName || "").trim().toLowerCase() !== String(selectedPlanName || "").trim().toLowerCase();
//       const shouldStartPlan = isNew || planChanged || initialCustomer?.active === false;
//       const planDates = getPlanDates(form.subscription_plan.label);

//       if (isErpCustomer) {
//         const subscriptionPayload = {
//           ...payload,
//           name: form.customer_name.trim(),
//           phoneNumber: form.phone.trim(),
//           city: form.location.trim(),
//           role: initialCustomer?.role || initialCustomer?.raw?.role || "Admin",
//           companyName: form.company_name.trim(),
//           plan: selectedPlanName,
//           planName: selectedPlanName,
//           subscriptionPlan: selectedPlanName,
//           crmCustomerId: initialCustomer?.crm_customer_id || initialCustomer?.crmCustomerId || initialCustomer?.raw?.crmCustomerId,
//           erpCustomerId: initialCustomer?.erp_customer_id || initialCustomer?.erpCustomerId || initialCustomer?.raw?.erpCustomerId,
//           erpUserId: initialCustomer?.erp_user_id || initialCustomer?.erpUserId || initialCustomer?.raw?.erp_user_id || initialCustomer?.raw?.id,
//           customMembers:
//             selectedPlanName === "Advanced"
//               ? Number(initialCustomer?.members || initialCustomer?.raw?.customMembers || 1)
//               : null,
//           shouldStartPlan,
//         };

//         if (shouldStartPlan && planDates) {
//           Object.assign(subscriptionPayload, {
//             subscriptionStartedAt: planDates.startDate.toISOString(),
//             subscriptionStartDate: planDates.startDate.toISOString(),
//             subscriptionEndDate: planDates.endDate.toISOString(),
//             trialStartDate: planDates.startDateOnly,
//             trialEndDate: planDates.endDateOnly,
//             renewalDate: planDates.endDateOnly,
//             startDate: planDates.startDateOnly,
//             expiryDate: planDates.endDateOnly,
//             subscriptionStatus: "Subscription Active",
//             accountStatus: "ACTIVE",
//             isActive: true,
//           });
//         }

//         await axios.put(`${API_BASE_URL}/api/customers/${id}/subscription`, subscriptionPayload);
//       } else if (isNew) {
//         const response = await axios.post(`${API_BASE_URL}/api/customers`, payload);
//         setSaveResult({ message: response.data?.message, customer: response.data?.customer, erpEnabled: response.data?.erpEnabled });
//         onRefresh?.();
//         onCustomerAdded?.();
//         return;
//       } else {
//         if (selectedPlanName === "Advanced") await axios.put(`${API_BASE_URL}/api/customers/${id}/custom-plan`, payload);
//         else await axios.put(`${API_BASE_URL}/api/customers/${id}`, payload);
//       }
//       onRefresh?.();
//       onCustomerAdded?.();
//       close();
//     } catch (err) {
//       applyApiErrors(err);
//     } finally {
//       setSaving(false);
//     }
//   };

//   if (loading) {
//     return (
//       <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
//         <div className="absolute inset-0 bg-black/40" onClick={close} />
//         <div className="relative z-10 bg-white rounded-2xl shadow-2xl px-8 py-6 text-sm text-gray-500">
//           Loading customer...
//         </div>
//       </div>
//     );
//   }

//   return (
//     <motion.div
//       className="fixed inset-0 z-50 flex items-center justify-center p-4"
//       initial={{ opacity: 0 }}
//       animate={{ opacity: 1 }}
//       exit={{ opacity: 0 }}
//       transition={{ duration: 0.2 }}
//     >
//       <div className="absolute inset-0 bg-black/40" onClick={close} />

//       <motion.div
//         initial={{ opacity: 0, scale: 0.93, y: 20 }}
//         animate={{ opacity: 1, scale: 1, y: 0 }}
//         exit={{ opacity: 0, scale: 0.93, y: 20 }}
//         transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
//         className="relative z-10 flex rounded-2xl shadow-2xl overflow-hidden max-h-[90vh]"
//         style={{ width: "min(680px, 95vw)" }}
//       >
//         <div className="flex flex-col bg-white flex-1 min-w-0">
//           <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
//             <div className="flex items-center gap-3">
//               <h2 className="text-[18px] font-bold text-[#111111]">
//                 {isNew ? "Add New Customer" : "Update Customer"}
//               </h2>
//               {!isNew && (
//                 <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
//                   Edit Mode
//                 </span>
//               )}
//             </div>
//             <button
//               onClick={close}
//               className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
//             >
//               <FiX size={16} />
//             </button>
//           </div>

//           <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
//             {errors.form && (
//               <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
//                 {errors.form}
//               </div>
//             )}
//             {saveResult && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{saveResult.message}</div>}

//             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//               <Field label="Customer Name" error={errors.customer_name}>
//                 <input
//                   type="text"
//                   value={form.customer_name}
//                   onChange={set("customer_name")}
//                   placeholder="Enter customer name"
//                   className={inputCls(errors.customer_name)}
//                 />
//               </Field>
//               <Field label="Company" error={errors.company_name}>
//                 <input
//                   type="text"
//                   value={form.company_name}
//                   onChange={set("company_name")}
//                   placeholder="Enter company name"
//                   className={inputCls(errors.company_name)}
//                 />
//               </Field>
//             </div>

//             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//               <Field label="Phone" error={errors.phone}>
//                 <input
//                   type="tel"
//                   inputMode="numeric"
//                   value={form.phone}
//                   onChange={set("phone")}
//                   placeholder="9876543210"
//                   className={inputCls(errors.phone)}
//                 />
//               </Field>
//               <Field label="Email" error={errors.email}>
//                 <input
//                   type="email"
//                   value={form.email}
//                   onChange={set("email")}
//                   placeholder="example@email.com"
//                   className={inputCls(errors.email)}
//                 />
//               </Field>
//             </div>
//              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//               <Field label="location" error={errors.location}>
//                 <input
//                   type="text"
//                   inputMode="numeric"
//                   value={form.location}
//                   onChange={set("location")}
//                   placeholder="city..."
//                   className={inputCls(errors.location)}
//                 />
//               </Field>
//               <Field label="Address" error={errors.address}>
//                 <input
//                   type="text"
//                   value={form.address}
//                   onChange={set("address")}
//                   placeholder="example@email.com"
//                   className={inputCls(errors.address)}
//                 />
//               </Field>
//             </div>

//             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//               <Field label="Plan" error={errors.subscription_plan}>
//                 <Select
//                   styles={selectStyles(errors.subscription_plan)}
//                   placeholder="Select plan"
//                   value={form.subscription_plan}
//                   onChange={setPlan}
//                   options={isNew || form.subscription_plan?.label === "Advanced" ? PLANS : PLANS.filter((plan) => plan.value !== "Advanced")}
//                 />
//               </Field>
//               {!isNew && (
//                 <Field label="Purchase Date" error={errors.purchase_date}>
//                   <input
//                     type="date"
//                     value={form.purchase_date}
//                     readOnly
//                     className={`${inputCls(errors.purchase_date)} cursor-not-allowed text-gray-500`}
//                   />
//                 </Field>
//               )}
//             </div>

//             {(isNew || !isNew) && (
//               <Field label="Renewal Date" error={errors.renewal_date}>
//                 <input
//                   type="date"
//                   value={form.renewal_date}
//                   readOnly={form.subscription_plan?.label !== "Advanced"}
//                   onChange={set("renewal_date")}
//                   className={`${inputCls(errors.renewal_date)} cursor-not-allowed text-gray-500`}
//                 />
//               </Field>
//             )}

//             {form.subscription_plan?.label === "Advanced" && <>
//               <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 space-y-4">
//                 <h3 className="font-semibold text-gray-800">Customize plan</h3>
//               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//                 <Field label="Engineers" error={errors.custom_members}><input type="number" min="1" value={form.custom_members} onChange={set("custom_members")} className={inputCls(errors.custom_members)} /></Field>
//                 <Field label="Projects" error={errors.custom_projects}><input type="number" min="1" value={form.custom_projects} onChange={set("custom_projects")} className={inputCls(errors.custom_projects)} /></Field>
//                 <Field label="Custom yearly price (before GST)" error={errors.custom_price}><input type="number" min="0" value={form.custom_price} onChange={set("custom_price")} className={inputCls(errors.custom_price)} /></Field>
//                 <Field label="GST %" error={errors.gst_rate}><input type="number" min="0" max="100" value={form.gst_rate} onChange={set("gst_rate")} className={inputCls(errors.gst_rate)} /></Field>
//               </div>
//               <Field label="Start Date"><input type="date" value={form.purchase_date} onChange={set("purchase_date")} className={inputCls(false)} /></Field>
//               <Field label="Features">
//                 <button type="button" onClick={() => setForm((prev) => ({ ...prev, selected_features: catalog.filter((feature) => String(feature.plan).toLowerCase() === "premium").map((feature) => feature.feature_name) }))} className="mb-2 text-xs font-semibold text-yellow-700 underline">Select all Premium features</button>
//                 {catalog.length ? Object.entries(catalog.reduce((groups, feature) => ({ ...groups, [feature.category_name || "General"]: [...(groups[feature.category_name || "General"] || []), feature] }), {})).map(([category, features]) => <div key={category} className="mb-2"><p className="text-xs font-semibold text-gray-600">{category}</p>{features.map((feature) => <label key={feature.feature_name} className="mr-4 inline-flex items-center gap-1 text-sm"><input type="checkbox" checked={form.selected_features.includes(feature.feature_name)} onChange={(event) => setForm((prev) => ({ ...prev, selected_features: event.target.checked ? [...prev.selected_features, feature.feature_name] : prev.selected_features.filter((item) => item !== feature.feature_name) }))} />{feature.feature_name}</label>)}</div>) : <p className="text-sm text-gray-500">No catalog features are available.</p>}
//               </Field>
//               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Field label="Support level"><select value={form.support_level} onChange={set("support_level")} className={inputCls(false)}><option>Email support</option><option>Priority email support</option></select></Field><label className="mt-7 inline-flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.dedicated_setup} onChange={(event) => setForm((prev) => ({ ...prev, dedicated_setup: event.target.checked }))} />Dedicated/customized engineer/project setup</label></div>
//               {form.dedicated_setup && <Field label="Setup notes"><textarea rows={2} value={form.setup_notes} onChange={set("setup_notes")} className={inputCls(false)} /></Field>}
//               <div className="rounded-lg bg-white p-3 text-sm text-gray-700"><strong>Summary</strong><br/>Engineers: {form.custom_members || 0} · Projects: {form.custom_projects || 0}<br/>Features: {form.selected_features.length ? form.selected_features.join(", ") : "None selected"}<br/>Price: ₹{Number(form.custom_price || 0).toLocaleString("en-IN")} + GST ₹{((Number(form.custom_price || 0) * Number(form.gst_rate || 0)) / 100).toLocaleString("en-IN")} = <strong>₹{(Number(form.custom_price || 0) * (1 + Number(form.gst_rate || 0) / 100)).toLocaleString("en-IN")}</strong><br/>Expiry: {form.renewal_date || "Not set"}</div>
//               </div>
//             </>}

//             <Field label="Notes" error={errors.notes}>
//               <textarea
//                 rows={4}
//                 value={form.notes}
//                 onChange={set("notes")}
//                 placeholder="Enter notes..."
//                 className={inputCls(errors.notes)}
//               />
//             </Field>
//           </div>

//           <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0 bg-white">
//             {!isNew && syncStatus === "ERP_FAILED" && <button type="button" onClick={() => axios.post(`${API_BASE_URL}/api/customers/${id}/retry-erp-sync`).then((response) => { setSaveResult({ message: response.data?.message }); if (response.data?.erp?.synced) setSyncStatus("SYNCED"); }).catch(applyApiErrors)} className="px-4 py-2.5 rounded-xl border border-yellow-300 text-sm font-semibold text-yellow-800">Retry ERP sync</button>}
//             <button
//               onClick={close}
//               className="px-6 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all"
//             >
//               Cancel
//             </button>
//             <motion.button
//               whileHover={{ scale: saving ? 1 : 1.02 }}
//               whileTap={{ scale: saving ? 1 : 0.97 }}
//               onClick={handleSubmit}
//               disabled={saving}
//               className="px-6 py-2.5 rounded-xl text-sm font-bold text-black transition-all shadow-sm disabled:opacity-70"
//               style={{ background: YELLOW }}
//             >
//               {saving ? "Saving..." : isNew ? "Create Customer" : form.subscription_plan?.label === "Advanced" ? "Edit custom plan" : "Update Customer"}
//             </motion.button>
//             {saveResult?.customer?.id && <button onClick={() => axios.post(`${API_BASE_URL}/api/customers/${saveResult.customer.id}/resync`).then((r) => setSaveResult((prev) => ({ ...prev, message: r.data.message }))).catch(applyApiErrors)} disabled={!saveResult.erpEnabled} className="px-4 py-2.5 rounded-xl border text-sm disabled:opacity-50">Resync / Resend credentials</button>}
//           </div>
//         </div>
//       </motion.div>
//     </motion.div>
//   );
// }
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import Select from "react-select";
import { FiX } from "react-icons/fi";
import axios from "axios";
import { API_BASE_URL, unwrapCustomer, unwrapCustomerList } from "../../config/api";

const YELLOW = "#F5C518";
const GST_RATE = 18; // fixed 18% GST for the Advanced plan

const PLAN_ROLE_ERROR = "Log in to customize the plan.";

const ROLE_FIELDS = ["role", "roleName", "role_name", "user_role", "userRole", "userType", "type", "designation"];

// Finds a role string inside an object (also looks in user / data / employee sub-objects)
function pickRole(obj) {
  if (!obj || typeof obj !== "object") return "";
  for (const field of ROLE_FIELDS) {
    const value = obj[field];
    if (typeof value === "string" && value.trim()) return value;
    if (value && typeof value === "object" && typeof value.name === "string") return value.name;
  }
  return pickRole(obj.user) || pickRole(obj.data) || pickRole(obj.employee) || "";
}

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

// Reads the logged-in user's role from common storage keys or from the login token.
// Adjust the key lists below if your login stores it somewhere else.
function getCurrentRole() {
  const objectKeys = ["employee", "user", "userData", "currentUser", "authUser", "auth", "loggedInUser", "crm_user", "admin"];
  const plainKeys = ["role", "userRole", "user_role"];
  const tokenKeys = ["token", "accessToken", "authToken", "jwt"];

  for (const store of [localStorage, sessionStorage]) {
    for (const key of objectKeys) {
      try {
        const raw = store.getItem(key);
        const role = raw ? pickRole(JSON.parse(raw)) : "";
        if (role) return String(role).trim().toLowerCase();
      } catch {
        /* not JSON, ignore */
      }
    }
    for (const key of plainKeys) {
      const value = store.getItem(key);
      if (value) return value.replace(/^"|"$/g, "").trim().toLowerCase();
    }
    for (const key of tokenKeys) {
      const token = store.getItem(key);
      const role = token ? pickRole(decodeJwt(token)) : "";
      if (role) return String(role).trim().toLowerCase();
    }
  }
  return "";
}

function canCustomizePlan() {
  return Boolean(localStorage.getItem("token"));
}

const PLANS = [
  { value: "Trial", label: "Trial" },
  { value: "Basic", label: "Basic" },

  { value: "Premium", label: "Premium" },
  { value: "Advanced", label: "Advanced" },
];

const emailPattern = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const phonePattern = /^[6-9]\d{9}$/;

const inputCls = (hasError) =>
  `w-full px-3 py-2.5 text-sm border rounded-xl bg-gray-50 outline-none transition-colors ${
    hasError ? "border-red-400 focus:border-red-400" : "border-gray-200 focus:border-[#F5C518]"
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
  placeholder: (base) => ({ ...base, color: "#9CA3AF", fontSize: 14 }),
  singleValue: (base) => ({ ...base, color: "#111827", fontSize: 14 }),
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
    {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
  </div>
);

const formatMoney = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function toInputDate(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.split("T")[0];
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().split("T")[0];
}

function findPlan(value) {
  return PLANS.find((item) => item.label.toLowerCase() === String(value || "").toLowerCase()) || null;
}

function formatDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPlanDurationDays(planName) {
  const key = String(planName || "").trim().toLowerCase();
  if (key === "trial" || key === "free trial") return { unit: "days", value: 7 };
  if (key === "basic" || key === "premium") return { unit: "years", value: 1 };
  return null; // Advanced terms are custom and set by the backend/ERP.
}

function addCalendarYears(date, years) {
  const next = new Date(date);
  const originalDay = next.getDate();
  next.setDate(1);
  next.setFullYear(next.getFullYear() + years);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(originalDay, lastDay));
  return next;
}

function getPlanDates(planName) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const duration = getPlanDurationDays(planName);
  if (!duration) {
    const end = addCalendarYears(start, 1);
    return { startDate: start, endDate: end, startDateOnly: formatDateOnly(start), endDateOnly: formatDateOnly(end) };
  }
  const end = new Date(start);
  if (duration.unit === "years") return {
    startDate: start,
    endDate: addCalendarYears(start, duration.value),
    startDateOnly: formatDateOnly(start),
    endDateOnly: formatDateOnly(addCalendarYears(start, duration.value)),
  };
  end.setDate(end.getDate() + duration.value);

  return {
    startDate: start,
    endDate: end,
    startDateOnly: formatDateOnly(start),
    endDateOnly: formatDateOnly(end),
  };
}

function customerToForm(data = {}) {
  return {
    customer_name: data.customer_name || data.name || "",
    company_name: data.company_name || data.company || data.company?.name || "",
    phone: String(data.phone || data.phoneNumber || "").replace(/\D/g, ""),
    email: data.email || "",
    address: data.address || "",
    role: data.role || data.customer_role || "",
    location: data.location || data.city || "",
    subscription_plan: findPlan(data.subscription_plan || data.plan || data.package),
    purchase_date: toInputDate(data.start_date || data.createdAt),
    renewal_date: toInputDate(data.renewal_date),
    custom_templates: data.custom_templates || data.customTemplates || data.template_count || "",
    custom_members: data.custom_users || data.customMembers || "",
    custom_projects: data.custom_projects || data.customProjectLimit || "",
    custom_price: data.custom_price || data.customPrice || "",
    selected_features: data.custom_features?.features || [],
    support_level: data.custom_features?.support_level || "Email support",
    dedicated_setup: Boolean(data.custom_features?.dedicated_setup),
    setup_notes: data.custom_features?.notes || "",
    notes: data.notes || "",
  };
}

export default function CustomerFormPage({
  propId,
  initialCustomer,
  source,
  onClose,
  modalMode = false,
  isNew = false,
  onCustomerAdded,
  onRefresh,
}) {
  const { id: paramId } = useParams();
  const id = propId || paramId;
  const isErpCustomer = source === "erp" || initialCustomer?.source === "erp";
  const navigate = useNavigate();
  const [form, setForm] = useState({
    customer_name: "",
    company_name: "",
    phone: "",
    email: "",
    role: "",
    password: "",
    confirm_password: "",
    address: "",
    location: "",

    subscription_plan: null,
    purchase_date: "",
    renewal_date: "",
    custom_templates: "",
    custom_members: "",
    custom_projects: "",
    custom_price: "",
    selected_features: [],
    support_level: "Email support",
    dedicated_setup: false,
    setup_notes: "",
    notes: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(!isNew && Boolean(id) && !initialCustomer);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);
  const [syncStatus, setSyncStatus] = useState(initialCustomer?.sync_status || "");

  // Advanced plan price: entered price + fixed 18% GST
  const advancedPrice = Number(form.custom_price || 0);
  const advancedGst = (advancedPrice * GST_RATE) / 100;
  const advancedTotal = advancedPrice + advancedGst;

  useEffect(() => {
    if (!modalMode) return undefined;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [modalMode]);

  useEffect(() => {
    if (!modalMode) return undefined;
    const handler = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [modalMode, onClose]);

  useEffect(() => {
    if (isNew || !initialCustomer) return;
    setForm(customerToForm(initialCustomer));
    setSyncStatus(initialCustomer.sync_status || "");
    setLoading(false);
  }, [initialCustomer, isNew]);

  useEffect(() => {
    if (isErpCustomer) return;
    if (isNew || !id) return;
    const loadCustomer = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_BASE_URL}/api/customers/${id}`);
        const data = unwrapCustomer(res.data);
        setForm(customerToForm(data));
        setSyncStatus(data.sync_status || "");
      } catch (err) {
        setErrors({ form: err.response?.data?.message || "Failed to load customer" });
      } finally {
        setLoading(false);
      }
    };
    loadCustomer();
  }, [id, isErpCustomer, isNew]);

  const set = (field) => (e) => {
    const rawValue = e.target.value;
    const value = field === "phone" ? rawValue.replace(/\D/g, "").slice(0, 10) : rawValue;
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "", form: "" }));
  };

  const setPlan = (plan) => {
    // Only Admin and Sales may choose the Advanced (customized) plan
    if (plan?.label === "Advanced" && !canCustomizePlan()) {
      setErrors((prev) => ({ ...prev, subscription_plan: PLAN_ROLE_ERROR }));
      return;
    }

    setForm((prev) => {
      const selectedPlanName = plan?.label || "";
      const currentPlanName =
        initialCustomer?.subscription_plan ||
        initialCustomer?.plan ||
        initialCustomer?.raw?.subscriptionPlan ||
        initialCustomer?.raw?.package;
      const planChanged =
        String(currentPlanName || "").trim().toLowerCase() !==
        String(selectedPlanName || "").trim().toLowerCase();

      if (!plan || (!isNew && !planChanged && initialCustomer?.active !== false)) {
        return { ...prev, subscription_plan: plan };
      }

      const planDates = getPlanDates(selectedPlanName);
      return {
        ...prev,
        subscription_plan: plan,
        purchase_date: planDates.startDateOnly,
        renewal_date: planDates.endDateOnly,
      };
    });
    setErrors((prev) => ({ ...prev, subscription_plan: "", form: "" }));
  };

  const validate = () => {
    const next = {};
    const name = form.customer_name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();

    if (!name) next.customer_name = "Customer name is required";
    else if (name.length < 3) next.customer_name = "Name must be at least 3 characters";
    if (!phone) next.phone = "Phone is required";
    else if (!/^\d+$/.test(phone)) next.phone = "Phone must contain numbers only";
    else if (!phonePattern.test(phone)) next.phone = "Enter a valid 10-digit mobile number";
    if (!email) next.email = "Email is required";
    else if (!emailPattern.test(email)) next.email = "Enter a valid email address";
    if (isNew) {
      if (!form.company_name.trim()) next.company_name = "Company name is required";
      if (!form.location.trim()) next.location = "City is required";
      if (!form.role) next.role = "Role is required";
      if (form.password.length < 6) next.password = "Password must be at least 6 characters";
      if (form.confirm_password !== form.password) next.confirm_password = "Passwords do not match";
      if (!form.address.trim()) next.address = "Address is required";
    }
    if (!form.subscription_plan) next.subscription_plan = "Plan is required";
    if (form.subscription_plan?.label === "Advanced" && !canCustomizePlan()) {
      next.subscription_plan = PLAN_ROLE_ERROR;
    }
    if (form.subscription_plan?.label === "Advanced") {
      if (!Number.isInteger(Number(form.custom_templates)) || Number(form.custom_templates) < 1 || Number(form.custom_templates) > 10) next.custom_templates = "Enter 1 to 10 templates";
      if (!Number.isInteger(Number(form.custom_members)) || Number(form.custom_members) < 1) next.custom_members = "Engineer count is required";
      if (!Number.isInteger(Number(form.custom_projects)) || Number(form.custom_projects) < 1) next.custom_projects = "Project count is required";
      if (form.custom_price === "" || Number(form.custom_price) < 0) next.custom_price = "Price is required";
      if (!form.purchase_date || !form.renewal_date || form.renewal_date <= form.purchase_date) next.renewal_date = "End date must be after start date";
    }
    if (isErpCustomer) {
      if (!form.company_name.trim()) next.company_name = "Company is required";
      if (!form.location.trim()) next.location = "Location is required";
    }
    return next;
  };

  const checkDuplicates = async () => {
    const currentId = String(id || "");
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();

    if (isErpCustomer) {
      const { data } = await axios.get(`${API_BASE_URL}/api/customers?source=erp`);
      const duplicate = unwrapCustomerList(data).find((customer) => {
        if (String(customer.id) === currentId) return false;
        return (
          String(customer.email || "").trim().toLowerCase() === email ||
          String(customer.phoneNumber || customer.phone || "").replace(/\D/g, "") === phone
        );
      });

      if (!duplicate) return {};
      return {
        ...(String(duplicate.email || "").trim().toLowerCase() === email
          ? { email: "This email address already exists." }
          : {}),
        ...(String(duplicate.phoneNumber || duplicate.phone || "").replace(/\D/g, "") === phone
          ? { phone: "This phone number already exists." }
          : {}),
      };
    }

    const { data } = await axios.get(`${API_BASE_URL}/api/customers`);
    const duplicate = unwrapCustomerList(data).find((customer) => {
      if (String(customer.id) === currentId) return false;
      return (
        String(customer.email || "").trim().toLowerCase() === email ||
        String(customer.phone || "").replace(/\D/g, "") === phone
      );
    });

    if (!duplicate) return {};
    return {
      ...(String(duplicate.email || "").trim().toLowerCase() === email
        ? { email: "This email address already exists." }
        : {}),
      ...(String(duplicate.phone || "").replace(/\D/g, "") === phone
        ? { phone: "This phone number already exists." }
        : {}),
    };
  };

  const close = () => {
    if (modalMode) onClose?.();
    else navigate("/customer");
  };

  const applyApiErrors = (err) => {
    const apiErrors = err.response?.data?.errors;
    if (apiErrors && typeof apiErrors === "object") {
      setErrors(apiErrors);
      return;
    }
    setErrors({
      form: err.response?.data?.message || err.response?.data?.error || "Failed to save customer",
    });
  };

  const handleSubmit = async () => {
    if (saving) return;
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      setSaving(true);
      const duplicateErrors = await checkDuplicates();
      if (Object.keys(duplicateErrors).length > 0) {
        setErrors(duplicateErrors);
        return;
      }

      const isAdvanced = form.subscription_plan.label === "Advanced";

      const payload = {
        customer_name: form.customer_name.trim(),
        company_name: form.company_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        role: form.role,
        password: isNew ? form.password : undefined,
        address: form.address.trim(),
        location: form.location.trim(),
        subscription_plan: form.subscription_plan.label,
        notes: form.notes.trim(),
        startDate: form.purchase_date || undefined,
        endDate: form.renewal_date || undefined,
        customTemplates: isAdvanced ? Number(form.custom_templates) : undefined,
        customMembers: isAdvanced ? Number(form.custom_members) : undefined,
        customProjectLimit: isAdvanced ? Number(form.custom_projects) : undefined,
        customPrice: isAdvanced ? Number(form.custom_price) : undefined,
        gstRate: isAdvanced ? GST_RATE : undefined,
        customFeatures: isAdvanced
          ? {
              features: form.selected_features,
              support_level: form.support_level,
              dedicated_setup: form.dedicated_setup,
              notes: form.setup_notes.trim(),
            }
          : undefined,
      };
      const selectedPlanName = form.subscription_plan.label;
      const currentPlanName =
        initialCustomer?.subscription_plan || initialCustomer?.plan || initialCustomer?.raw?.subscriptionPlan || initialCustomer?.raw?.package;
      const planChanged =
        String(currentPlanName || "").trim().toLowerCase() !== String(selectedPlanName || "").trim().toLowerCase();
      const shouldStartPlan = isNew || planChanged || initialCustomer?.active === false;
      const planDates = getPlanDates(form.subscription_plan.label);

      if (isErpCustomer) {
        const subscriptionPayload = {
          ...payload,
          name: form.customer_name.trim(),
          phoneNumber: form.phone.trim(),
          city: form.location.trim(),
          role: initialCustomer?.role || initialCustomer?.raw?.role || "Admin",
          companyName: form.company_name.trim(),
          plan: selectedPlanName,
          planName: selectedPlanName,
          subscriptionPlan: selectedPlanName,
          crmCustomerId: initialCustomer?.crm_customer_id || initialCustomer?.crmCustomerId || initialCustomer?.raw?.crmCustomerId,
          erpCustomerId: initialCustomer?.erp_customer_id || initialCustomer?.erpCustomerId || initialCustomer?.raw?.erpCustomerId,
          erpUserId: initialCustomer?.erp_user_id || initialCustomer?.erpUserId || initialCustomer?.raw?.erp_user_id || initialCustomer?.raw?.id,
          customMembers:
            selectedPlanName === "Advanced"
              ? Number(initialCustomer?.members || initialCustomer?.raw?.customMembers || 1)
              : null,
          shouldStartPlan,
        };

        if (shouldStartPlan && planDates) {
          Object.assign(subscriptionPayload, {
            subscriptionStartedAt: planDates.startDate.toISOString(),
            subscriptionStartDate: planDates.startDate.toISOString(),
            subscriptionEndDate: planDates.endDate.toISOString(),
            trialStartDate: planDates.startDateOnly,
            trialEndDate: planDates.endDateOnly,
            renewalDate: planDates.endDateOnly,
            startDate: planDates.startDateOnly,
            expiryDate: planDates.endDateOnly,
            subscriptionStatus: "Subscription Active",
            accountStatus: "ACTIVE",
            isActive: true,
          });
        }

        await axios.put(`${API_BASE_URL}/api/customers/${id}/subscription`, subscriptionPayload);
      } else if (isNew) {
        const response = await axios.post(`${API_BASE_URL}/api/customers`, payload);
        setSaveResult({ message: response.data?.message, customer: response.data?.customer, erpEnabled: response.data?.erpEnabled });
        onRefresh?.();
        onCustomerAdded?.();
        return;
      } else {
        if (selectedPlanName === "Advanced") await axios.put(`${API_BASE_URL}/api/customers/${id}/custom-plan`, payload);
        else await axios.put(`${API_BASE_URL}/api/customers/${id}`, payload);
      }
      onRefresh?.();
      onCustomerAdded?.();
      close();
    } catch (err) {
      applyApiErrors(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={close} />
        <div className="relative z-10 bg-white rounded-2xl shadow-2xl px-8 py-6 text-sm text-gray-500">
          Loading customer...
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="absolute inset-0 bg-black/40" onClick={close} />

      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 20 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex rounded-2xl shadow-2xl overflow-hidden max-h-[90vh]"
        style={{ width: "min(680px, 95vw)" }}
      >
        <div className="flex flex-col bg-white flex-1 min-w-0">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="text-[18px] font-bold text-[#111111]">
                {isNew ? "Add New Customer" : "Update Customer"}
              </h2>
              {!isNew && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
                  Edit Mode
                </span>
              )}
            </div>
            <button
              onClick={close}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
            >
              <FiX size={16} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
            {errors.form && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {errors.form}
              </div>
            )}
            {saveResult && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{saveResult.message}</div>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Client Name" error={errors.customer_name}>
                <input
                  type="text"
                  value={form.customer_name}
                  onChange={set("customer_name")}
                  placeholder="Enter customer name"
                  className={inputCls(errors.customer_name)}
                />
              </Field>
              <Field label="Email" error={errors.email}>
                <input type="email" value={form.email} onChange={set("email")} placeholder="Enter email address" className={inputCls(errors.email)} />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Contact Number" error={errors.phone}>
                <input type="tel" inputMode="numeric" value={form.phone} onChange={set("phone")} placeholder="Enter 10-digit phone number" className={inputCls(errors.phone)} />
              </Field>
              <Field label="Role" error={errors.role}>
                <select value={form.role} onChange={set("role")} className={inputCls(errors.role)}>
                  <option value="">Select role</option>
                  <option value="Admin">Admin</option>
                  <option value="User">User</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Company Name" error={errors.company_name}>
                <input type="text" value={form.company_name} onChange={set("company_name")} placeholder="Enter company name" className={inputCls(errors.company_name)} />
              </Field>
              <Field label="City" error={errors.location}>
                <input type="text" value={form.location} onChange={set("location")} placeholder="Enter city name" className={inputCls(errors.location)} />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Package" error={errors.subscription_plan}>
                <Select
                  styles={selectStyles(errors.subscription_plan)}
                  placeholder="Select plan"
                  value={form.subscription_plan}
                  onChange={setPlan}
                  options={isNew || form.subscription_plan?.label === "Advanced" ? PLANS : PLANS.filter((plan) => plan.value !== "Advanced")}
                />
              </Field>
              {!isNew && (
                <Field label="Purchase Date" error={errors.purchase_date}>
                  <input
                    type="date"
                    value={form.purchase_date}
                    readOnly
                    className={`${inputCls(errors.purchase_date)} cursor-not-allowed text-gray-500`}
                  />
                </Field>
              )}
            </div>

            {isNew && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Password" error={errors.password}>
                <input type="password" autoComplete="new-password" value={form.password} onChange={set("password")} placeholder="Min 6 characters" className={inputCls(errors.password)} />
              </Field>
              <Field label="Confirm Password" error={errors.confirm_password}>
                <input type="password" autoComplete="new-password" value={form.confirm_password} onChange={set("confirm_password")} placeholder="Re-enter password" className={inputCls(errors.confirm_password)} />
              </Field>
            </div>}

            {isNew && <Field label="Address" error={errors.address}>
              <textarea rows={3} value={form.address} onChange={set("address")} placeholder="Enter full address" className={inputCls(errors.address)} />
            </Field>}

            <Field label="Renewal Date" error={errors.renewal_date}>
              <input
                type="date"
                value={form.renewal_date}
                readOnly={form.subscription_plan?.label !== "Advanced"}
                onChange={set("renewal_date")}
                className={`${inputCls(errors.renewal_date)} ${form.subscription_plan?.label !== "Advanced" ? "cursor-not-allowed text-gray-500" : ""}`}
              />
            </Field>

            {/* Advanced plan only: templates, engineers, projects and price with 18% GST */}
            {form.subscription_plan?.label === "Advanced" && (
              <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 space-y-4">
                <h3 className="font-semibold text-gray-800">Advanced plan details</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Number of Templates" error={errors.custom_templates}>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={form.custom_templates}
                      onChange={set("custom_templates")}
                      placeholder="Enter 1 to 10 templates"
                      className={inputCls(errors.custom_templates)}
                    />
                  </Field>
                  <Field label="Number of Site Engineers" error={errors.custom_members}>
                    <input
                      type="number"
                      min="1"
                      value={form.custom_members}
                      onChange={set("custom_members")}
                      placeholder="Enter number of site engineers"
                      className={inputCls(errors.custom_members)}
                    />
                  </Field>
                  <Field label="Number of Projects" error={errors.custom_projects}>
                    <input
                      type="number"
                      min="1"
                      value={form.custom_projects}
                      onChange={set("custom_projects")}
                      placeholder="Enter number of projects"
                      className={inputCls(errors.custom_projects)}
                    />
                  </Field>
                  <Field label="Custom Annual Price (Rs.)" error={errors.custom_price}>
                    <input
                      type="number"
                      min="0"
                      value={form.custom_price}
                      onChange={set("custom_price")}
                      placeholder="Enter agreed annual price"
                      className={inputCls(errors.custom_price)}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={`GST (${GST_RATE}%)`}>
                    <input
                      type="text"
                      readOnly
                      value={formatMoney(advancedGst)}
                      className={`${inputCls(false)} cursor-not-allowed text-gray-500`}
                    />
                  </Field>
                  <Field label={`Total Price (incl. ${GST_RATE}% GST)`}>
                    <input
                      type="text"
                      readOnly
                      value={formatMoney(advancedTotal)}
                      className={`${inputCls(false)} cursor-not-allowed font-semibold text-gray-900`}
                    />
                  </Field>
                </div>
              </div>
            )}

            <Field label="Notes" error={errors.notes}>
              <textarea
                rows={4}
                value={form.notes}
                onChange={set("notes")}
                placeholder="Enter notes..."
                className={inputCls(errors.notes)}
              />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0 bg-white">
            {!isNew && syncStatus === "ERP_FAILED" && <button type="button" onClick={() => axios.post(`${API_BASE_URL}/api/customers/${id}/retry-erp-sync`).then((response) => { setSaveResult({ message: response.data?.message }); if (response.data?.erp?.synced) setSyncStatus("SYNCED"); }).catch(applyApiErrors)} className="px-4 py-2.5 rounded-xl border border-yellow-300 text-sm font-semibold text-yellow-800">Retry ERP sync</button>}
            <button
              onClick={close}
              className="px-6 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <motion.button
              whileHover={{ scale: saving ? 1 : 1.02 }}
              whileTap={{ scale: saving ? 1 : 0.97 }}
              onClick={handleSubmit}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-black transition-all shadow-sm disabled:opacity-70"
              style={{ background: YELLOW }}
            >
              {saving ? "Saving..." : isNew ? "Create Customer" : form.subscription_plan?.label === "Advanced" ? "Edit custom plan" : "Update Customer"}
            </motion.button>
            {saveResult?.customer?.id && <button onClick={() => axios.post(`${API_BASE_URL}/api/customers/${saveResult.customer.id}/resync`).then((r) => setSaveResult((prev) => ({ ...prev, message: r.data.message }))).catch(applyApiErrors)} disabled={!saveResult.erpEnabled} className="px-4 py-2.5 rounded-xl border text-sm disabled:opacity-50">Resync / Resend credentials</button>}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
