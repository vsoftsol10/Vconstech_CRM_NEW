import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config/api";
function safe(val) {
  return val?.toString() || "—";
}

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("");
}
function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between border-b border-gray-200 pb-3">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{safe(value)}</span>
    </div>
  );
}
function Row({ label, value }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "10px 0",
      borderBottom: "1px solid #fef3c7",
    }}>
      <span style={{ fontSize: 13, color: "#9ca3af" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{safe(value)}</span>
    </div>
  );
}

function getHistoryCustomerId(customer) {
  const erpUserId = customer?.erp_user_id || customer?.erpUserId || customer?.raw?.erp_user_id || customer?.raw?.id;
  if (erpUserId) return erpUserId;

  const crmId = customer?.crm_customer_id || customer?.crmCustomerId;
  if (crmId) return crmId;

  const erpId = String(customer?.erp_customer_id || customer?.erpCustomerId || "");
  if (erpId) return erpId;

  const id = String(customer?.id || "");
  return id || null;
}

function formatHistoryPlan(item) {
  if (item.previous_plan || item.new_plan) {
    return `${safe(item.previous_plan)} -> ${safe(item.new_plan || item.plan_name)}`;
  }
  return safe(item.plan_name);
}

export default function CustomerViewPanel({ customer, onClose, onEdit }) {
  const navigate = useNavigate();
  const [subscriptionHistory, setSubscriptionHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!customer?.id) return;
    const historyCustomerId = getHistoryCustomerId(customer);
    if (!historyCustomerId) {
      setSubscriptionHistory([]);
      setHistoryLoading(false);
      return;
    }

    const loadHistory = async () => {
      try {
        setHistoryLoading(true);
        const res = await axios.get(
          `${API_BASE_URL}/api/customers/subscription-history/${historyCustomerId}`
        );
        setSubscriptionHistory(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to load subscription history:", err);
        setSubscriptionHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    };
    loadHistory();
  }, [customer?.id, customer?.crm_customer_id, customer?.crmCustomerId]);

  if (!customer) return null;

  return (
   <>
  <div
    onClick={onClose}
    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
  />

  <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
    {/* <div className="bg-white rounded-[24px] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl"> */}
<div className="relative bg-white rounded-[24px] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
        <h2 className="text-[30px] font-bold text-[#1f2937]">
          Customer Details
        </h2>
 
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-black transition"
        >
          ✕
        </button>
      
      </div>

      {/* Body */}
      <div className="overflow-y-auto max-h-[75vh] px-6 py-6">

        {/* Profile */}
        <div className="flex items-center gap-4 pb-6 border-b border-gray-200">
          <div className="w-16 h-16 rounded-full bg-[#F5C518] flex items-center justify-center text-xl font-bold text-black">
            {getInitials(customer.customer_name)}
          </div>

          <div>
            <h3 className="text-2xl font-bold text-gray-800">
              {customer.customer_name}
            </h3>

            <p className="text-gray-500 text-sm">
              {customer.company_name}
            </p>

            <p className="text-xs text-gray-400 mt-1">
              CUSTOMER-{customer.id}
            </p>
          </div>
        </div>

        {/* Personal */}
        <div className="mt-6">
          <h4 className="text-xs font-bold tracking-wider text-gray-400 uppercase mb-4">
            Personal
          </h4>

          <div className="space-y-4">
            <DetailRow label="Email" value={customer.email} />
            <DetailRow label="Phone" value={customer.phone} />
            <DetailRow label="Company" value={customer.company_name} />
          </div>
        </div>

        {/* Subscription */}
        <div className="mt-8">
          <h4 className="text-xs font-bold tracking-wider text-gray-400 uppercase mb-4">
            Subscription Information
          </h4>

          <div className="space-y-4">
            <DetailRow
              label="Plan"
              value={customer.subscription_plan}
            />

            <div className="flex justify-between border-b border-gray-200 pb-3">
              <span className="text-gray-500">Status</span>

              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                customer.payment_status === "paid"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-600"
              }`}>
                {customer.payment_status}
              </span>
            </div>

            <DetailRow
              label="Amount"
              value={
                customer.subscription_amount
                  ? `₹${customer.subscription_amount}`
                  : "—"
              }
            />

            <DetailRow
              label="Purchase Date"
              value={customer.start_date?.split("T")[0]}
            />

            <DetailRow
              label="Renewal Date"
              value={customer.renewal_date?.split("T")[0]}
            />
            {String(customer.subscription_plan || "").toLowerCase() === "advanced" && <>
              <DetailRow label="Engineers" value={customer.custom_users} />
              <DetailRow label="Projects" value={customer.custom_projects} />
              <DetailRow label="Custom yearly price" value={customer.custom_price ? `₹${customer.custom_price}` : "—"} />
              <DetailRow label="GST" value={customer.gst_rate !== undefined ? `${customer.gst_rate}%` : "—"} />
              <DetailRow label="Features" value={(customer.custom_features?.features || []).join(", ") || "None"} />
              <DetailRow label="Support" value={customer.custom_features?.support_level} />
              {customer.custom_features?.dedicated_setup && <DetailRow label="Dedicated setup" value={customer.custom_features?.notes || "Yes"} />}
            </>}
          </div>
        </div>

        {/* Notes */}
        {customer.notes && (
          <div className="mt-8">
            <h4 className="text-xs font-bold tracking-wider text-gray-400 uppercase mb-4">
              Notes
            </h4>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-700">
              {customer.notes}
            </div>
          </div>
        )}

        {/* Subscription History */}
        <div className="mt-8">
          <h4 className="text-xs font-bold tracking-wider text-gray-400 uppercase mb-4">
            Subscription History
          </h4>

          {historyLoading && (
            <p className="text-sm text-gray-400 text-center py-4">
              Loading...
            </p>
          )}

          {!historyLoading && subscriptionHistory.length === 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-400 text-sm text-center">
              No subscription history found
            </div>
          )}

          {!historyLoading && subscriptionHistory.length > 0 && (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />

              <div className="space-y-5">
                {subscriptionHistory.map((item) => (
                  <div key={item.id} className="flex gap-4 relative">

                    <div className="w-8 h-8 rounded-full bg-[#F5C518] flex items-center justify-center text-xs font-bold text-black shrink-0 z-10">
                      {item.action_type?.charAt(0)?.toUpperCase()}
                    </div>

                    <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 capitalize">
                          {item.action_type}
                        </span>

                        <span className="text-xs text-gray-400">
                          {item.created_at
                            ? new Date(item.created_at).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </span>
                      </div>

                      <p className="text-sm text-gray-700 mb-2">
                        {formatHistoryPlan(item)}
                        {item.amount && ` • ₹${item.amount}`}
                      </p>

                      <div className="text-xs text-gray-500">
                        {safe(item.start_date)} → {safe(item.end_date)}
                      </div>
                    </div>

                  </div>
                ))}
              </div>
           
            </div>
            
          )}
          
        </div>

     
      </div>

      {/* Footer */}
     
<button
  onClick={() => {
    onClose();
    onEdit(customer);
  }}
  className="absolute bottom-6 right-6 z-50 bg-[#F5C518] hover:bg-[#eab308] text-black font-semibold px-5 py-3 rounded-full shadow-lg transition-all duration-200 hover:scale-105"
>
  Edit
</button>
    </div>
  </div>
</>
  );
}
