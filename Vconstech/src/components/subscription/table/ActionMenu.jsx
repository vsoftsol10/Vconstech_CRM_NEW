import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import axios from "axios";

import SendReminderModal from "../modal/SendReminderModal";
import { BellIcon } from "../icons/SubscriptionIcons";
import { API_BASE_URL } from "../../../config/api";

const formatDate = (value) => value
  ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
  : "Not set";

export default function ActionMenu({ row, onReminderSent, onRenewed }) {
  const [modalRow, setModalRow] = useState(null);
  const [renewing, setRenewing] = useState(false);
  const [feedback, setFeedback] = useState("");

  const renew = async () => {
    if (!row?.id || renewing) return;
    try {
      setRenewing(true);
      setFeedback("");
      const previewResponse = await axios.get(`${API_BASE_URL}/api/customers/${row.id}/renew-preview`);
      const preview = previewResponse.data?.preview;
      const confirmed = window.confirm(
        `Renew subscription?\n\nCustomer: ${preview?.customerName || row.customer_name || row.name || "Customer"}\nPlan: ${preview?.plan || row.subscription_plan || row.plan || "N/A"}\nCurrent expiry: ${formatDate(preview?.currentExpiryDate)}\nNew expiry: ${formatDate(preview?.newExpiryDate)}`
      );
      if (!confirmed) return;
      const response = await axios.post(`${API_BASE_URL}/api/customers/${row.id}/renew`);
      onRenewed?.(response.data?.customer || row);
      setFeedback("Renewed successfully.");
    } catch (error) {
      setFeedback(error.response?.data?.message || "Unable to renew the subscription.");
    } finally {
      setRenewing(false);
    }
  };

  return (
    <>
      <div className="flex justify-center gap-1.5">
        <button type="button" onClick={renew} disabled={renewing}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-500 transition-all hover:border-green-300 hover:bg-green-50 hover:text-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Renew subscription" title="Renew subscription">↻</button>
        <button
          type="button"
          onClick={() => setModalRow(row)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition-all duration-200 hover:border-yellow-300 hover:bg-[#FFFBF0] hover:text-[#C89B00] active:scale-95"
          aria-label="Notify customer"
          title="Notify customer"
        >
          <BellIcon />
        </button>
      </div>
      {feedback && <p className="mt-1 max-w-28 text-center text-[10px] text-gray-600">{feedback}</p>}

      <AnimatePresence>
        {modalRow && (
          <SendReminderModal
            row={modalRow}
            onClose={() => setModalRow(null)}
            onReminderSent={(updatedRow) => {
              setModalRow(null);
              onReminderSent?.(updatedRow);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
