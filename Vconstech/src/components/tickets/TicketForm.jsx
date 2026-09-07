import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FiAlertCircle,
  FiCalendar,
  FiCheck,
  FiCheckCircle,
  FiChevronDown,
  FiClock,
  FiEdit2,
  FiEye,
  FiFileText,
  FiPlus,
  FiTrash2,
  FiUser,
} from "react-icons/fi";
import { API_BASE_URL } from "../../config/api";

const API = `${API_BASE_URL}`;
const STATUS_OPTIONS = ["Open", "In Progress", "Resolved", "Closed", "Draft"];
const URGENCY_OPTIONS = ["Low", "Medium", "High", "Critical"];
const CONTACT_OPTIONS = ["Email", "Phone", "Walk-in", "Chat"];
const CATEGORY_OPTIONS = ["Hardware", "Software", "Network", "Other"];
const DEPARTMENT_OPTIONS = ["Sales", "Support", "Technical", "Marketing"];
const TICKET_TYPE_OPTIONS = [
  { value: "request", label: "Request" },
  { value: "incident", label: "Incident" },
];

const emptyTicket = {
  ticket_type: "request",
  caller: "",
  opened_by: "",
  location: "",
  contact_type: "",
  category: "",
  company_name: "",
  assigned_to: "",
  urgency: "Medium",
  state: "Open",
  department: "",
  short_description: "",
  notes: "",
  due_date: "",
};

const fieldClass =
  "h-[50px] w-full rounded-[6px] border border-[#d8caca] bg-white px-3 text-[15px] text-[#111] outline-none transition focus:border-[#F5C518] focus:ring-1 focus:ring-[#F5C518]";
const readOnlyClass = "bg-[#fafafa] text-gray-600 cursor-default";

function toDateInput(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-CA");
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function ticketToForm(ticket) {
  return {
    ticket_type: ticket.ticket_type || ticket.type || "request",
    caller: ticket.caller || "",
    opened_by: ticket.opened_by || "",
    location: ticket.location || "",
    contact_type: ticket.contact_type || "",
    category: ticket.category || "",
    company_name: ticket.company_name || ticket.company || "",
    assigned_to: ticket.assigned_to || "",
    urgency: ticket.urgency || "Medium",
    state: ticket.state || ticket.status || "Open",
    department: ticket.department || "",
    short_description: ticket.short_description || "",
    notes: "",
    due_date: toDateInput(ticket.due_date || ticket.created_at),
  };
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("employee") || "{}");
  } catch {
    return {};
  }
}

function getCurrentUserId() {
  const employee = getCurrentUser();
  return employee.id || employee.employee_id || null;
}

function getActor(item) {
  return item?.created_by_name || item?.sender || item?.created_by_employee_id || item?.created_by || "Support";
}

function getHistoryMessage(item) {
  return item?.Worknotes || item?.note || item?.title || item?.status_snapshot || "Ticket activity recorded.";
}

function getHistoryTitle(item) {
  const raw = item?.title || item?.activity_type || item?.status_snapshot || "Ticket Updated";
  return String(raw).replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function getInitialMode(mode, location, hasId) {
  if (mode === "create" || !hasId) return "edit";
  const queryMode = new URLSearchParams(location.search).get("mode");
  return location.state?.mode || queryMode || mode || "view";
}

function buildChangeSummary(before, after) {
  if (!before) return "Ticket updated";
  const labels = {
    caller: "Caller",
    opened_by: "Opened By",
    location: "Location",
    contact_type: "Contact Type",
    category: "Category",
    company_name: "Company",
    assigned_to: "Assignment",
    urgency: "Priority",
    state: "Status",
    department: "Department",
    short_description: "Short Description",
    due_date: "Due Date",
  };

  return Object.entries(labels)
    .filter(([key]) => String(before[key] || "") !== String(after[key] || ""))
    .map(([, label]) => `${label} Changed`)
    .join(", ") || "Ticket Updated";
}

const FieldLabel = ({ children }) => (
  <label className="text-[15px] font-medium text-black">{children}</label>
);

function TextInput({ value, onChange, type = "text", placeholder = "", readOnly = false, icon = null }) {
  return (
    <div className="relative">
      <input
        type={type}
        value={value || ""}
        placeholder={placeholder}
        onChange={(event) => onChange?.(event.target.value)}
        readOnly={readOnly}
        disabled={readOnly && type === "date"}
        className={`${fieldClass} ${readOnly ? readOnlyClass : ""} ${icon ? "pr-10" : ""}`}
      />
      {icon && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#cdbebe]">{icon}</span>}
    </div>
  );
}

function SelectField({ value, onChange, options, placeholder = "Select Category", readOnly = false }) {
  return (
    <div className="relative">
      <select
        value={value || ""}
        onChange={(event) => onChange?.(event.target.value)}
        disabled={readOnly}
        className={`${fieldClass} appearance-none pr-10 ${readOnly ? readOnlyClass : "cursor-pointer"} ${!value ? "text-[#cbbcbc]" : ""}`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value ?? option} value={option.value ?? option}>
            {option.label ?? option}
          </option>
        ))}
      </select>
      <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[26px] text-[#cdbebe]" />
    </div>
  );
}

function FormRow({ label, children }) {
  return (
    <div className="grid grid-cols-[86px_minmax(0,1fr)] items-center gap-4">
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  );
}

function SidebarRow({ label, value, dot }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="font-semibold text-black">{label}</span>
      <span className="flex items-center gap-1.5 text-right text-black">
        {dot && <span className={`h-4 w-1.5 rounded-full ${dot}`} />}
        {value || "-"}
      </span>
    </div>
  );
}

function Timeline({ history, ticket }) {
  const fallback = ticket
    ? [
        { id: "created", title: "Ticket Created", created_at: ticket.created_at, sender: "Support", Worknotes: ticket.short_description },
        { id: "status", title: `Status Changed ${ticket.state || "Open"}`, created_at: ticket.updated_at || ticket.created_at, sender: "Support", Worknotes: ticket.state },
      ]
    : [];
  const items = history.length ? history.slice(0, 5) : fallback;

  return (
    <div className="rounded-[4px] bg-white p-3">
      <div className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold text-black">
        <FiClock size={12} /> Timeline
      </div>
      <div className="relative ml-2 space-y-7 border-l-2 border-[#14951d] pl-3">
        {items.map((item) => (
          <div key={item.id || item.created_at} className="relative">
            <span className="absolute -left-[20px] top-0 h-3 w-3 rounded-full bg-[#14951d]" />
            <p className="text-[13px] font-semibold leading-tight text-black">{getHistoryTitle(item)}</p>
            <p className="mt-1 text-[11px] leading-tight text-black">By {getActor(item)}</p>
            <p className="text-[11px] leading-tight text-black">{formatDate(item.created_at)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkHistory({ history, loading }) {
  return (
    <section className="mt-6 border-t border-[#cfcfcf] pt-4">
      <h3 className="mb-4 text-[19px] font-semibold text-black">Work History</h3>
      {loading ? (
        <div className="rounded-[4px] border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">Loading work history...</div>
      ) : history.length === 0 ? (
        <div className="rounded-[4px] border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">No work history available for this ticket.</div>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 h-full w-px bg-gray-200" />
          <div className="space-y-4">
            {history.map((item) => (
              <div key={item.id || item.created_at} className="relative flex gap-4">
                <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5C518] text-xs font-bold text-black">
                  {getHistoryTitle(item).charAt(0)}
                </div>
                <div className="flex-1 rounded-[6px] border border-gray-200 bg-[#fbfbfb] p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-[#FFF9E0] px-3 py-1 text-[11px] font-semibold text-[#8A6A00]">
                      {getHistoryTitle(item)}
                    </span>
                    <span className="text-[11px] text-gray-400">{formatDateTime(item.created_at)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-5 text-gray-700">{getHistoryMessage(item)}</p>
                  <p className="mt-2 text-[12px] text-gray-500">User: {getActor(item)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function WorkNotes({ history, note, onNoteChange, onAddNote, readOnly, saving }) {
  const notes = history.filter((item) => item.Worknotes || item.note || item.title);

  return (
    <section className="mt-3">
      <h3 className="mb-2 text-[19px] font-semibold text-black">Work Notes</h3>
      <textarea
        value={note}
        onChange={(event) => onNoteChange(event.target.value)}
        readOnly={readOnly}
        rows={3}
        className={`min-h-[80px] w-full resize-none rounded-[8px] border border-[#d8caca] bg-white px-3 py-2 text-[14px] outline-none transition focus:border-[#F5C518] focus:ring-1 focus:ring-[#F5C518] ${readOnly ? readOnlyClass : ""}`}
      />
      <div className="mt-1 flex justify-end">
        <button
          type="button"
          onClick={onAddNote}
          disabled={readOnly || saving || !note.trim()}
          className="h-[40px] min-w-[138px] bg-[#F8C400] px-5 text-[14px] font-medium text-black transition hover:bg-[#eebb00] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Adding..." : "Add Note"}
        </button>
      </div>

      {notes.length > 0 && (
        <div className="mt-4 space-y-3">
          {notes.map((item) => (
            <div key={item.id || item.created_at} className="rounded-[4px] bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ffe9a6] text-[12px] font-semibold text-black">
                    {String(getActor(item)).slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-black">{getActor(item)}</p>
                    <p className="text-[10px] text-gray-500">
                      {formatDate(item.created_at)} {formatTime(item.created_at)}
                    </p>
                  </div>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-[12px] leading-4 text-black">{getHistoryMessage(item)}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function TicketForm({ mode, ticketId, initialMode, inModal = false, onSaved, onDeleted, onClose }) {
  const { id: routeId } = useParams();
  const id = ticketId || routeId;
  const location = useLocation();
  const navigate = useNavigate();
  const isCreate = mode === "create" || !id;
  const [pageMode, setPageMode] = useState(() => initialMode || getInitialMode(mode, location, Boolean(id)));
  const isView = pageMode === "view";
  const [form, setForm] = useState(emptyTicket);
  const [lastSavedForm, setLastSavedForm] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [history, setHistory] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [companyOptions, setCompanyOptions] = useState([]);
  const [loading, setLoading] = useState(!isCreate);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const set = (key) => (value) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const currentUser = getCurrentUser();

  const assigneeOptions = useMemo(() => {
    const filtered = form.department
      ? teamMembers.filter((member) => String(member.department || "").toLowerCase() === form.department.toLowerCase())
      : teamMembers;

    return filtered.map((member) => ({
      value: member.id,
      label: `${member.name} (${member.employee_id})`,
    }));
  }, [form.department, teamMembers]);

  const selectedAssignee = teamMembers.find((member) => String(member.id) === String(form.assigned_to));
  const selectedOpener = teamMembers.find((member) => String(member.id) === String(form.opened_by));

  const loadHistory = async () => {
    if (!id) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API}/api/tickets/${id}/history`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load work history.");
      setHistory(
        (json.data || []).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      );
    } catch (err) {
      setError(err.message || "Failed to load work history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    const loadTeam = async () => {
      try {
        const res = await fetch(`${API}/api/team`);
        const data = await res.json();
        setTeamMembers(Array.isArray(data) ? data : data.data || []);
      } catch {
        setTeamMembers([]);
      }
    };

    loadTeam();
  }, []);

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const res = await fetch(`${API}/api/customers`);
        const data = await res.json();
        const customers = Array.isArray(data) ? data : data.customers || data.data?.customers || [];
        const companies = [...new Set(
          customers
            .map((customer) => String(customer.company_name || customer.companyName || customer.company || "").trim())
            .filter(Boolean)
        )].sort((first, second) => first.localeCompare(second));
        setCompanyOptions(companies);
      } catch {
        setCompanyOptions([]);
      }
    };

    loadCompanies();
  }, []);

  useEffect(() => {
    if (isCreate || !id) return;

    const loadTicket = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API}/api/tickets/${id}`);
        const result = await res.json();
        if (!res.ok || !result.success) throw new Error(result.error || "Ticket not found.");
        const nextForm = ticketToForm(result.data);
        setTicket(result.data);
        setForm(nextForm);
        setLastSavedForm(nextForm);
        if (String(result.data?.state || "").toLowerCase() === "draft") {
          setPageMode("edit");
        }
        await loadHistory();
      } catch (err) {
        setError(err.message || "Unable to load ticket.");
      } finally {
        setLoading(false);
      }
    };

    loadTicket();
  }, [id, isCreate]);

  const payload = {
    ...form,
    ticket_type: form.ticket_type || "request",
    assigned_to: form.assigned_to || null,
    opened_by: form.opened_by || null,
    due_date: form.due_date || null,
    updated_by: getCurrentUserId(),
  };

  const postHistory = async ({ title, Worknotes, activity_type = "TICKET_UPDATED" }) => {
    if (!id) return;
    try {
      await fetch(`${API}/api/tickets/${id}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity_type,
          title,
          Worknotes,
          status_snapshot: form.state,
          created_by: currentUser?.id || null,
          sender: currentUser?.name || currentUser?.full_name || currentUser?.employee_id || "Support",
        }),
      });
    } catch {
      // The ticket save should not fail if the existing history endpoint is unavailable.
    }
  };

  const saveTicket = async ({ stayInEdit = true, stateOverride = null } = {}) => {
    setError("");
    const nextState = stateOverride || form.state;
    if (!form.caller || !form.short_description || !nextState) {
      setError("Caller, short description, and state are required.");
      return;
    }

    setSaving(true);
    try {
      const nextPayload = {
        ...payload,
        state: nextState,
        status: nextState,
      };
      const res = await fetch(`${API}/api/tickets${isCreate ? "/create" : `/${id}`}`, {
        method: isCreate ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextPayload),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || "Unable to save ticket.");

      const nextForm = ticketToForm(result.data);
      if (!isCreate) {
        const summary = buildChangeSummary(lastSavedForm, form);
        await postHistory({ title: summary, Worknotes: form.notes.trim() || summary });
        await loadHistory();
      }
      setTicket(result.data);
      setForm(nextForm);
      setLastSavedForm(nextForm);
      setSaved(true);
      onSaved?.(result.data);

      if (isCreate) {
        navigate("/ticket", { replace: true });
      } else if (!stayInEdit) {
        setPageMode("view");
      }
    } catch (err) {
      setError(err.message || "Server error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = (options = {}) => saveTicket({ ...options, stateOverride: "Saved" });
  const handleDraft = () => saveTicket({ stayInEdit: true, stateOverride: "Draft" });

  const handleAddNote = async () => {
    if (isCreate) return;
    if (!id || !form.notes.trim() || isView) return;
    setNoteSaving(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/tickets/${id}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity_type: "WORK_NOTE_ADDED",
          title: "Work Note Added",
          Worknotes: form.notes,
          status_snapshot: form.state,
          created_by: currentUser?.id || null,
          sender: currentUser?.name || currentUser?.full_name || currentUser?.employee_id || "Support",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to add work note.");
      setForm((current) => ({ ...current, notes: "" }));
      await loadHistory();
    } catch (err) {
      setError(err.message || "Failed to add work note.");
    } finally {
      setNoteSaving(false);
    }
  };

  const handleResolve = async () => {
    if (isCreate || !id) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/tickets/${id}/resolve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updated_by: getCurrentUserId() }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || "Unable to resolve ticket.");
      const nextForm = ticketToForm(result.data);
      setTicket(result.data);
      setForm(nextForm);
      setLastSavedForm(nextForm);
      setSaved(true);
      await loadHistory();
    } catch (err) {
      setError(err.message || "Unable to resolve ticket.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isCreate || !id) return;
    if (!window.confirm(`Delete ${ticket?.ticket_number || "this ticket"}? This cannot be undone.`)) return;

    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/tickets/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok || result.success === false) throw new Error(result.error || "Unable to delete ticket.");
      onDeleted?.(id);
      if (inModal) {
        onClose?.();
      } else {
        navigate("/ticket", { replace: true });
      }
    } catch (err) {
      setError(err.message || "Unable to delete ticket.");
    } finally {
      setSaving(false);
    }
  };

  const openedDate = ticket?.created_at || form.due_date;
  const dueDate = ticket?.due_date || form.due_date;
  const slaPercent = form.state === "Resolved" || form.state === "Closed" ? 100 : form.urgency === "High" ? 42 : 28;
  const remainingTime = form.state === "Resolved" || form.state === "Closed" ? "Completed" : "2h 14m remaining";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f4f4]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#F5C518] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className={`${inModal ? "min-h-0" : "min-h-screen"} bg-[#f4f4f4] font-sans text-black`}>
      <div className="border-b border-[#cfcfcf] bg-[#f7f7f7] px-4 py-2 md:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[18px] font-medium">
            {isCreate ? "Create Ticket" : `${form.ticket_type === "incident" ? "Incident" : "Ticket"} - ${ticket?.ticket_number || `TICKET-${id}`}`}
          </h1>
          <div className="flex flex-wrap items-center gap-2.5">
            {isView ? (
              <button
                type="button"
                onClick={() => setPageMode("edit")}
                className="flex h-[35px] items-center gap-2 border border-[#d5d5d5] bg-white px-5 text-[15px] font-medium"
              >
                <FiEdit2 /> Update
              </button>
            ) : !isCreate ? (
              <button
                type="button"
                onClick={() => setPageMode("view")}
                className="flex h-[35px] items-center gap-2 border border-[#d5d5d5] bg-white px-5 text-[15px] font-medium"
              >
                <FiEye /> View
              </button>
            ) : (
              <button
                type="button"
                onClick={() => (inModal ? onClose?.() : navigate("/ticket"))}
                className="flex h-[35px] items-center gap-2 border border-[#d5d5d5] bg-white px-5 text-[15px] font-medium"
              >
                <FiEye /> View
              </button>
            )}
            {!isCreate && (
              <button
                type="button"
                onClick={handleResolve}
                disabled={saving}
                className="flex h-[35px] items-center gap-2 border border-green-200 bg-[#effcf5] px-5 text-[14px] font-medium text-green-700 disabled:opacity-60"
              >
                <FiCheckCircle /> Resolve Incident
              </button>
            )}
            {!isCreate && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="mr-7  flex h-[35px] items-center gap-2 border border-red-200 bg-[#fff0f0] px-5 text-[14px] font-medium text-red-500 disabled:opacity-60 "
              >
                <FiTrash2 /> Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-[6px] border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 md:mx-5">
          <FiAlertCircle /> {error}
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="px-4 py-2 md:px-5">
        <div className={isCreate ? "mx-auto max-w-[1120px]" : "grid gap-4 xl:grid-cols-[minmax(0,1fr)_275px]"}>
          <main className="bg-white px-3 pb-6 pt-1 md:px-4">
            <h2 className="mb-4 text-[20px] font-semibold text-black">Ticket Information</h2>

            <div className="grid grid-cols-1 gap-x-12 gap-y-5 lg:grid-cols-2">
              <FormRow label="Number">
                <TextInput value={ticket?.ticket_number || ""} readOnly placeholder="Auto Generated" />
              </FormRow>
              <FormRow label="Date">
                <TextInput value={form.due_date} onChange={set("due_date")} type="date" readOnly={isView} icon={<FiCalendar size={25} />} />
              </FormRow>
              <FormRow label="Caller">
                <TextInput value={form.caller} onChange={set("caller")} readOnly={isView} />
              </FormRow>
              <FormRow label="Opened by">
                <SelectField
                  value={form.opened_by}
                  onChange={set("opened_by")}
                  readOnly={isView}
                  options={teamMembers.map((member) => ({ value: member.id, label: `${member.name} (${member.employee_id})` }))}
                />
              </FormRow>
              <FormRow label="Location">
                <TextInput value={form.location} onChange={set("location")} readOnly={isView} />
              </FormRow>
              <FormRow label="Contact Type">
                <SelectField value={form.contact_type} onChange={set("contact_type")} readOnly={isView} options={CONTACT_OPTIONS} />
              </FormRow>
              <FormRow label="Category">
                <SelectField value={form.category} onChange={set("category")} readOnly={isView} options={CATEGORY_OPTIONS} />
              </FormRow>
              <FormRow label="Company">
                <SelectField value={form.company_name} onChange={set("company_name")} readOnly={isView} options={companyOptions} placeholder="Select Company" />
              </FormRow>
              <FormRow label="Assigned to">
                <SelectField value={form.assigned_to} onChange={set("assigned_to")} readOnly={isView} options={assigneeOptions} />
              </FormRow>
              <FormRow label="Urgency">
                <SelectField value={form.urgency} onChange={set("urgency")} readOnly={isView} options={URGENCY_OPTIONS} placeholder="" />
              </FormRow>
              <FormRow label="State">
                <SelectField value={form.state} onChange={set("state")} readOnly={isView} options={STATUS_OPTIONS} />
              </FormRow>
            </div>

            <div className="mt-5">
              <FieldLabel>Short Description</FieldLabel>
              <textarea
                value={form.short_description}
                onChange={(event) => set("short_description")(event.target.value)}
                readOnly={isView}
                rows={3}
                className={`mt-2 min-h-[92px] w-full resize-none rounded-[8px] border border-[#d8caca] bg-white px-3 py-2 text-[14px] outline-none transition focus:border-[#F5C518] focus:ring-1 focus:ring-[#F5C518] ${isView ? readOnlyClass : ""}`}
              />
            </div>

            <WorkNotes
              history={history}
              note={form.notes}
              onNoteChange={set("notes")}
              onAddNote={handleAddNote}
              readOnly={isView}
              saving={noteSaving}
            />

            <section className="mt-3">
              <h3 className="mb-2 text-[19px] font-semibold text-black">Terms and Conditions</h3>
              <div className="space-y-3 text-[17px] font-medium leading-[1.15] text-black">
                <p>1. You agree to provide accurate and complete information while raising a ticket. Incorrect or misleading details may delay resolution.</p>
                <p>2.This ticketing system is intended for legitimate business or support requests only. Misuse may result in restricted access.</p>
                <p>3.Your information will be handled securely and used only for resolving your request, in accordance with our privacy policy.</p>
                <p>4.Response and resolution times may vary depending on ticket priority, complexity, and workload.</p>
                <p>5.You are responsible for the content submitted and any actions taken based on the provided information.</p>
              </div>
            </section>

            {!isCreate && <WorkHistory history={history} loading={historyLoading} />}
          </main>

          {!isCreate && (
            <aside className="space-y-6">
              <div className="rounded-[4px] bg-white p-3">
                <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-black">
                  <FiFileText className="text-[#F5C518]" /> Ticket Overview
                </div>
                <div className="space-y-3">
                  <SidebarRow label="Ticket Number" value={ticket?.ticket_number || `TICKET-${id}`} />
                  <SidebarRow label="Status" value={form.state} dot="bg-green-500" />
                  <SidebarRow label="Urgency" value={form.urgency} dot={form.urgency === "High" || form.urgency === "Critical" ? "bg-red-500" : "bg-yellow-500"} />
                  <SidebarRow label="Category" value={form.category} />
                  <SidebarRow label="Opened" value={formatDate(openedDate)} />
                  <SidebarRow label="Assigned by" value={selectedAssignee?.name || selectedOpener?.name || ticket?.employee_name || "Support Team"} />
                </div>
              </div>

              <div className="rounded-[4px] bg-white p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-black">
                  <FiClock size={12} /> SLA / Response
                </div>
                <div className="mb-1 flex items-center justify-between text-[10px] text-black">
                  <span>Response SLA</span>
                  <span className="text-green-600">{remainingTime}</span>
                </div>
                <div className="h-[5px] bg-[#d9d9d9]">
                  <div className="h-full bg-[#14951d]" style={{ width: `${slaPercent}%` }} />
                </div>
                <p className="mt-1 text-[10px] text-black">Due by {formatDate(dueDate)}</p>
              </div>

              <Timeline history={history} ticket={ticket} />

              {history[0] && (
                <div className="rounded-[4px] bg-white p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ffe9a6] text-[12px] font-semibold text-black">
                      {String(getActor(history[0])).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-black">{getActor(history[0])}</p>
                      <p className="text-[10px] text-gray-500">{formatTime(history[0].created_at)}</p>
                    </div>
                  </div>
                  <p className="text-[11px] leading-4 text-black">{getHistoryMessage(history[0])}</p>
                </div>
              )}
            </aside>
          )}
        </div>

        <div className="sticky bottom-0 mt-4 flex justify-end gap-3 border-t border-[#cfcfcf] bg-[#f4f4f4] py-3">
          {!isView && (
            <>
              <button
                type="button"
                onClick={handleDraft}
                disabled={saving}
                className="h-[35px] min-w-[115px] border border-[#d5d5d5] bg-white text-[15px] font-medium text-black disabled:opacity-60"
              >
                Draft
              </button>
              <button
                type="button"
                onClick={() => handleSave({ stayInEdit: true })}
                disabled={saving}
                className="flex h-[35px] min-w-[160px] items-center justify-center gap-2 bg-[#ffdb6a] text-[15px] font-medium text-black disabled:opacity-60"
              >
                <FiCheckCircle /> {saving ? "Saving..." : saved ? "Saved" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => handleSave({ stayInEdit: false })}
                disabled={saving}
                className="flex h-[35px] min-w-[115px] items-center justify-center gap-2 border border-green-200 bg-[#effcf5] text-[15px] font-medium text-green-700 disabled:opacity-60"
              >
                <FiUser /> Assign
              </button>
            </>
          )}
          {isView && (
            <button
              type="button"
              onClick={() => setPageMode("edit")}
              className="flex h-[35px] min-w-[130px] items-center justify-center gap-2 bg-[#F8C400] px-5 text-[15px] font-medium text-black"
            >
              <FiPlus /> Update
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
