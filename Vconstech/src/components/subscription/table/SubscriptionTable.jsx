import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import ActionMenu from "./ActionMenu";

const ROW_OPTIONS = [10, 15, 25, 50, 100];

const STYLE = `
  @keyframes rowIn {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes dropdownIn {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

function getDaysLeft(row) {
  const renewal = new Date(row.renewal_date || row.expire || row.expires_at);
  if (Number.isNaN(renewal.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((renewal - today) / (1000 * 60 * 60 * 24));
}

function titleCase(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

function getPlan(row) {
  return row.subscription_plan || row.plan || "-";
}

function getCustomerName(row) {
  return row.customer_name || row.name || "-";
}

function getPaymentStatus(row) {
  return titleCase(row.payment_status || row.paymentStatus || row.payment_state) || "Pending";
}

function getStatus(row) {
  const raw = titleCase(row.subscription_status || row.subscriptionStatus || row.status);
  if (["Active", "Expired", "Trial", "Cancelled"].includes(raw)) return raw;
  const daysLeft = getDaysLeft(row);
  if (daysLeft !== null && daysLeft < 0) return "Expired";
  if (String(row.subscription_plan || row.plan || "").toLowerCase().includes("trial")) return "Trial";
  return "Active";
}

function getReminderStatus(row) {
  const raw = titleCase(row.reminder_status || row.reminderStatus);
  if (["Pending", "Sent", "Failed"].includes(raw)) return raw;
  if (row.reminder_failed) return "Failed";
  if (row.reminder_sent) return "Sent";
  return "Pending";
}

function formatDisplayDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function uniqueOptions(rows, getter) {
  return [...new Set(rows.map(getter).filter((item) => item && item !== "-"))].sort();
}

function Badge({ value, type }) {
  const styles = {
    status: {
      Active: "bg-green-100 text-green-700",
      Expired: "bg-red-100 text-red-700",
      Trial: "bg-yellow-100 text-yellow-700",
      Cancelled: "bg-gray-100 text-gray-700",
    },
    reminder: {
      Pending: "bg-yellow-100 text-yellow-700",
      Sent: "bg-green-100 text-green-700",
      Failed: "bg-red-100 text-red-700",
    },
    payment: {
      Paid: "bg-green-100 text-green-700",
      Pending: "bg-yellow-100 text-yellow-700",
      Failed: "bg-red-100 text-red-700",
    },
  };

  return (
    <span className={`inline-flex h-7 items-center rounded-full px-2.5 text-[11px] font-bold ${styles[type]?.[value] || "bg-gray-100 text-gray-700"}`}>
      {value || "-"}
    </span>
  );
}

function HeaderFilterMenu({ anchorRef, isOpen, onClose, allLabel, options, selected, onSelect }) {
  const [pos, setPos] = useState(null);
  const menuRef = useRef(null);
  const menuWidth = 240;
  const viewportGap = 12;

  const getMenuPosition = () => {
    if (!anchorRef.current) return null;
    const rect = anchorRef.current.getBoundingClientRect();
    const maxLeft = window.innerWidth - menuWidth - viewportGap;
    return {
      top: rect.bottom + 6,
      left: Math.max(viewportGap, Math.min(rect.left, maxLeft)),
    };
  };

  useLayoutEffect(() => {
    if (!isOpen || !anchorRef.current) return;
    setPos(getMenuPosition());
  }, [isOpen, anchorRef]);

  useEffect(() => {
    if (!isOpen) return;
    const handleScrollOrResize = () => setPos(getMenuPosition());
    const handleClickOutside = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        anchorRef.current &&
        !anchorRef.current.contains(event.target)
      ) {
        onClose();
      }
    };
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, anchorRef, onClose]);

  if (!isOpen || !pos) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] w-[240px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl shadow-black/10"
      style={{ top: pos.top, left: pos.left, animation: "dropdownIn 0.18s ease-out" }}
    >
      <div className="max-h-[240px] overflow-y-auto py-1">
        <button
          type="button"
          onClick={() => onSelect("")}
          title={allLabel}
          className={`block w-full truncate px-3 py-2 text-left text-[13px] transition-colors ${
            !selected ? "bg-yellow-50 font-semibold text-yellow-700" : "text-gray-700 hover:bg-yellow-50"
          }`}
        >
          {allLabel}
        </button>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            title={option}
            className={`block w-full truncate px-3 py-2 text-left text-[13px] transition-colors ${
              selected === option ? "bg-yellow-50 font-semibold text-yellow-700" : "text-gray-700 hover:bg-yellow-50"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}

function FilterHeader({ label, active, buttonRef, open, onToggle, children }) {
  return (
    <div className="relative inline-flex items-center gap-2">
      <span>{label}</span>
      <button
        ref={buttonRef}
        type="button"
        onClick={onToggle}
        className={`rounded-md p-1 transition-colors ${
          active ? "bg-yellow-100 text-yellow-700" : "text-gray-500 hover:bg-gray-100"
        }`}
        aria-label={`Filter ${label}`}
        aria-expanded={open}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="8" y1="12" x2="16" y2="12" />
          <line x1="11" y1="18" x2="13" y2="18" />
        </svg>
      </button>
      {children}
    </div>
  );
}

export default function SubscriptionTable({ filtered = [], onReminderSent, onRenewed }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [headerFilterOpen, setHeaderFilterOpen] = useState(null);
  const [filterPlan, setFilterPlan] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState("");

  const planBtnRef = useRef(null);
  const statusBtnRef = useRef(null);
  const paymentBtnRef = useRef(null);

  const plans = useMemo(() => uniqueOptions(filtered, getPlan), [filtered]);
  const statuses = useMemo(() => uniqueOptions(filtered, getStatus), [filtered]);
  const paymentStatuses = useMemo(() => uniqueOptions(filtered, getPaymentStatus), [filtered]);

  const activeFilterCount = [filterPlan, filterStatus, filterPaymentStatus].filter(Boolean).length;

  const tableRows = useMemo(
    () =>
      filtered.filter((row) => {
        const matchPlan = !filterPlan || getPlan(row) === filterPlan;
        const matchStatus = !filterStatus || getStatus(row) === filterStatus;
        const matchPayment = !filterPaymentStatus || getPaymentStatus(row) === filterPaymentStatus;
        return matchPlan && matchStatus && matchPayment;
      }),
    [filtered, filterPlan, filterStatus, filterPaymentStatus]
  );

  const totalPages = Math.max(1, Math.ceil(tableRows.length / rowsPerPage));
  const paginated = tableRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(Number(event.target.value));
    setCurrentPage(1);
  };

  const clearHeaderFilters = () => {
    setFilterPlan("");
    setFilterStatus("");
    setFilterPaymentStatus("");
    setCurrentPage(1);
  };

  return (
    <>
      <style>{STYLE}</style>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="hidden overflow-visible rounded-xl border border-gray-100 bg-white shadow-sm md:block"
      >
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-5 py-3 text-xs">
            <span className="font-semibold text-gray-500">Filters:</span>
            {filterPlan && <span className="rounded-full bg-yellow-50 px-2.5 py-1 font-semibold text-yellow-700">Plan: {filterPlan}</span>}
            {filterStatus && <span className="rounded-full bg-yellow-50 px-2.5 py-1 font-semibold text-yellow-700">Status: {filterStatus}</span>}
            {filterPaymentStatus && <span className="rounded-full bg-yellow-50 px-2.5 py-1 font-semibold text-yellow-700">Payment: {filterPaymentStatus}</span>}
            <button
              type="button"
              onClick={clearHeaderFilters}
              className="ml-auto rounded-lg px-2.5 py-1 text-[11px] font-semibold text-red-500 transition-all duration-200 hover:bg-red-50 hover:text-red-700"
            >
              Clear All
            </button>
          </div>
        )}

        <div className="relative z-0">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[11%]" />
              <col className="w-[20%]" />
              <col className="w-[11%]" />
              <col className="w-[13%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[11%]" />
              <col className="w-[72px]" />
            </colgroup>
            <thead className="sticky top-0 z-30">
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-[13px] font-bold tracking-wide text-black">
                  <FilterHeader
                    label="Plan"
                    active={filterPlan}
                    buttonRef={planBtnRef}
                    open={headerFilterOpen === "plan"}
                    onToggle={() => setHeaderFilterOpen((open) => (open === "plan" ? null : "plan"))}
                  >
                    <HeaderFilterMenu
                      anchorRef={planBtnRef}
                      isOpen={headerFilterOpen === "plan"}
                      onClose={() => setHeaderFilterOpen(null)}
                      allLabel="All Plans"
                      options={plans}
                      selected={filterPlan}
                      onSelect={(value) => {
                        setFilterPlan(value);
                        setHeaderFilterOpen(null);
                        setCurrentPage(1);
                      }}
                    />
                  </FilterHeader>
                </th>
                <th className="px-4 py-3 text-left text-[13px] font-bold tracking-wide text-black">Customer</th>
                <th className="px-4 py-3 text-left text-[13px] font-bold tracking-wide text-black">
                  <FilterHeader
                    label="Status"
                    active={filterStatus}
                    buttonRef={statusBtnRef}
                    open={headerFilterOpen === "status"}
                    onToggle={() => setHeaderFilterOpen((open) => (open === "status" ? null : "status"))}
                  >
                    <HeaderFilterMenu
                      anchorRef={statusBtnRef}
                      isOpen={headerFilterOpen === "status"}
                      onClose={() => setHeaderFilterOpen(null)}
                      allLabel="All Statuses"
                      options={statuses}
                      selected={filterStatus}
                      onSelect={(value) => {
                        setFilterStatus(value);
                        setHeaderFilterOpen(null);
                        setCurrentPage(1);
                      }}
                    />
                  </FilterHeader>
                </th>
                <th className="px-4 py-3 text-left text-[13px] font-bold tracking-wide text-black">
                  <FilterHeader
                    label="Payment Status"
                    active={filterPaymentStatus}
                    buttonRef={paymentBtnRef}
                    open={headerFilterOpen === "payment"}
                    onToggle={() => setHeaderFilterOpen((open) => (open === "payment" ? null : "payment"))}
                  >
                    <HeaderFilterMenu
                      anchorRef={paymentBtnRef}
                      isOpen={headerFilterOpen === "payment"}
                      onClose={() => setHeaderFilterOpen(null)}
                      allLabel="All Payment Statuses"
                      options={paymentStatuses}
                      selected={filterPaymentStatus}
                      onSelect={(value) => {
                        setFilterPaymentStatus(value);
                        setHeaderFilterOpen(null);
                        setCurrentPage(1);
                      }}
                    />
                  </FilterHeader>
                </th>
                <th className="px-4 py-3 text-left text-[13px] font-bold tracking-wide text-black">Expires</th>
                <th className="px-4 py-3 text-left text-[13px] font-bold tracking-wide text-black">Reminder Status</th>
                <th className="px-4 py-3 text-left text-[13px] font-bold tracking-wide text-black">Reminder Sent On</th>
                <th className="px-4 py-3 text-center text-[13px] font-bold tracking-wide text-black">Action</th>
              </tr>
            </thead>

            <tbody className="relative z-0">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2" style={{ animation: "fadeIn 0.4s ease" }}>
                      <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-gray-300">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                      </svg>
                      <p className="font-medium">No records found</p>
                      {activeFilterCount > 0 && <p className="text-xs text-gray-300">Try clearing your filters</p>}
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((row, index) => {
                  const status = getStatus(row);
                  const reminderStatus = getReminderStatus(row);
                  const paymentStatus = getPaymentStatus(row);
                  const customerName = getCustomerName(row);

                  return (
                    <tr
                      key={row.id || index}
                      className="h-[68px] border-t border-gray-50 transition-colors hover:bg-yellow-50/40"
                      style={{
                        opacity: 0,
                        animation: "rowIn 0.45s ease forwards",
                        animationDelay: `${index * 45}ms`,
                      }}
                    >
                      <td className="px-4 py-3 align-middle">
                        <p className="truncate font-semibold text-gray-800" title={getPlan(row)}>{getPlan(row)}</p>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-sm font-bold text-yellow-600">
                            {customerName?.[0]?.toUpperCase() || "?"}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold leading-tight text-gray-800" title={customerName}>{customerName}</p>
                            <p className="mt-0.5 truncate text-[11px] text-gray-400" title={row.email || row.phone || ""}>
                              {row.email || row.phone || "-"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle"><Badge value={status} type="status" /></td>
                      <td className="px-4 py-3 align-middle"><Badge value={paymentStatus} type="payment" /></td>
                      <td className="px-4 py-3 align-middle text-gray-600">
                        <span className="block truncate" title={formatDisplayDate(row.renewal_date || row.expire || row.expires_at)}>
                          {formatDisplayDate(row.renewal_date || row.expire || row.expires_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle"><Badge value={reminderStatus} type="reminder" /></td>
                      <td className="px-4 py-3 align-middle text-gray-600">
                        <span className="block truncate" title={formatDisplayDate(row.reminder_sent_date || row.reminderSentOn)}>
                          {formatDisplayDate(row.reminder_sent_date || row.reminderSentOn)}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <ActionMenu row={row} onReminderSent={onReminderSent} onRenewed={onRenewed} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {tableRows.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-gray-500 px-5 py-3 text-xs text-gray-800 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {(currentPage - 1) * rowsPerPage + 1} - {Math.min(currentPage * rowsPerPage, tableRows.length)} of {tableRows.length} subscription{tableRows.length !== 1 ? "s" : ""}
            </span>

            <div className="flex items-center gap-2">
              <select
                value={rowsPerPage}
                onChange={handleRowsPerPageChange}
                className="h-8 cursor-pointer rounded border bg-white px-3 text-sm outline-none"
              >
                {ROW_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>

              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                className="h-8 rounded border px-3 disabled:opacity-70"
              >
                Previous
              </button>

              <span className="px-2">{currentPage} / {totalPages}</span>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                className="h-8 rounded border px-3 disabled:opacity-70"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </>
  );
}
