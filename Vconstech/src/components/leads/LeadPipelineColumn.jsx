import { FiMail, FiPhone, FiMoreVertical } from "react-icons/fi";
import LeadDetails from "./LeadsViewPage";
import CustomerFormPage from "../customer/Customerform";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../config/api";
const stages = ["New", "Contacted", "Qualified", "Proposal", "Won"];

const pipelineColors = {
  new: "#60a5fa",
  contacted: "#facc15",
  qualified: "#c084fc",
  proposal: "#fb923c",
  won: "#4ade80",
  lost: "#f87171",
};

const planBadgeStyles = {
  basic: "bg-blue-50 text-blue-500",
  pro: "bg-purple-50 text-purple-500",
  enterprise: "bg-orange-50 text-orange-500",
};

const formatText = (text) =>
  text ? text.charAt(0).toUpperCase() + text.slice(1) : "";

const LeadPipelineColumn = ({ lead, onConverted, activeStage, onRefresh }) => {
  const navigate = useNavigate();
  const menuRef = useRef();

  const [openMenu, setOpenMenu] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [converting, setConverting] = useState(false);
  const [converted, setConverted] = useState(false);
  const [showAdvancedConversion, setShowAdvancedConversion] = useState(false);
  const [advancedPlan, setAdvancedPlan] = useState({
    customMembers: lead?.custom_members ?? "",
    customProjectLimit: lead?.custom_project_limit ?? "",
    customTemplateLimit: lead?.custom_template_limit ?? "",
    customPrice: lead?.custom_price ?? "",
  });
  const [conversionError, setConversionError] = useState("");

  const name = lead?.name || lead?.full_name || "Unknown";
  const company = lead?.company || "-";
  const email = lead?.email || "-";
  const phone = lead?.phone || "-";

  const plan = (lead?.plan || "").toLowerCase();
  const stage = (lead?.status || "new").toLowerCase();
  const isConverted = lead?.is_customer === true || lead?.is_customer === "true";
  const customerId = lead?.customer_id || lead?.crm_customer_id || lead?.erp_customer_id;
  const isCustomerRecord = lead?.record_type === "customer";
  const isConvertedLeadView = activeStage === "Converted Lead" && customerId && (converted || isCustomerRecord);

  // Track conversion locally so UI updates immediately
  useEffect(() => {
    setConverted(isConverted);
  }, [isConverted]);

  const activeIndex = stages.findIndex(
    (item) => item.toLowerCase() === stage
  );

  const pipelineColor =
    pipelineColors[stage] || "#F5C518";

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setOpenMenu(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
  }, []);
const handleDelete = async () => {
  const confirmDelete = window.confirm(
    `Delete ${name}?`
  );

  if (!confirmDelete) return;

  try {
    await axios.delete(
      `${API_BASE_URL}/api/leads/${lead.id}`
    );

    alert("Lead deleted successfully");

    // Refresh page
    window.location.reload();
  } catch (err) {
    console.error(err);
    alert("Failed to delete lead");
  }
};

const handleDeleteCustomer = async () => {
  if (!customerId) {
    alert("Customer record not found for this converted lead.");
    return;
  }

  const confirmDelete = window.confirm(
    `Delete lead ${name} and its linked CRM customer?`
  );

  if (!confirmDelete) return;

  try {
    await axios.delete(
      `${API_BASE_URL}/api/leads/${lead.id}`
    );

    alert("Lead and linked CRM customer deleted successfully");
    onRefresh?.();
  } catch (err) {
    console.error(err);
    alert("Delete failed: " + (err.response?.data?.message || err.message));
  }
};

const handleConvertToCustomer = async () => {
  if (converted || converting) {
    alert("This lead has already been converted to a customer.");
    return;
  }

  if (plan.includes("advanced")) {
    setShowAdvancedConversion(true);
    return;
  }

  await submitLeadConversion();
};

const submitLeadConversion = async (customPlan = null) => {
  if (converting) return;

  setConverting(true);
  try {
    await axios.post(
      `${API_BASE_URL}/api/leads/${lead.id}/convert-to-customer`,
      customPlan || {}
    );

    setShowAdvancedConversion(false);
    setConverted(true);
    onConverted?.(lead.id);
    alert("Lead converted successfully.Check Customer Page");
    if (!onConverted) window.location.reload();
  } catch (err) {
    const message =
      err.response?.status === 409
        ? err.response?.data?.message || "This lead has already been converted to a customer."
        : "Failed to convert lead";
    setConversionError(message);
    if (!showAdvancedConversion) alert(message);
  } finally {
    setConverting(false);
  }
};

const handleAdvancedConversion = (event) => {
  event.preventDefault();
  const values = Object.fromEntries(Object.entries(advancedPlan).map(([key, value]) => [key, Number(value)]));
  if (!Number.isInteger(values.customMembers) || values.customMembers < 1 ||
      !Number.isInteger(values.customProjectLimit) || values.customProjectLimit < 1 ||
      !Number.isInteger(values.customTemplateLimit) || values.customTemplateLimit < 1 || values.customTemplateLimit > 10 ||
      !Number.isFinite(values.customPrice) || values.customPrice <= 0) {
    setConversionError("Enter valid engineer, project, template (1–10), and annual price values.");
    return;
  }
  setConversionError("");
  submitLeadConversion({ ...values, gstRate: 18 });
};


  return (
    <>
      <div
        className="
          bg-white rounded-2xl
          border border-gray-200
          p-4 sm:p-5
          shadow-sm hover:shadow-md
          transition-all duration-300
        "
      >
        {/* MENU */}
        <div ref={menuRef}>
          <div className="relative">
            <button
              onClick={() => setOpenMenu(!openMenu)}
              className="absolute top-0 right-0 text-gray-500 hover:text-black"
            >
              <FiMoreVertical />
            </button>

            {openMenu && (
              <div className="absolute right-0 top-7 w-32 bg-white border rounded-lg shadow-md z-50">
                {!isConvertedLeadView && (
                  <button
                    onClick={() => {
                      setSelectedLead(lead);
                      setOpenMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100"
                  >
                    View
                  </button>
                )}

                {isConvertedLeadView ? (
                  <button
                    onClick={() => {
                      setEditingCustomerId(customerId);
                      setOpenMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100"
                  >
                    Edit
                  </button>
                ) : !(stage === "won" && converted) && (
                  <button
                    onClick={() => {
                      navigate(
                        `/leads/edit/${lead.id}`,
                        {
                          state: { lead },
                        }
                      );
                      setOpenMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100"
                  >
                    Edit
                  </button>
                )}

                <button
  onClick={() => {
    if (isConvertedLeadView) handleDeleteCustomer();
    else handleDelete();
    setOpenMenu(false);
  }}
  className="w-full text-left px-3 py-2 hover:bg-red-100 text-red-500"
>
  Delete
</button>

              </div>
           
           )}
          </div>
        </div>

        {/* TOP SECTION */}
        <div className="flex gap-3 mb-4">
          <div
            className="
              w-10 h-10 sm:w-12 sm:h-12
              rounded-full bg-[#F5C518]
              flex items-center justify-center
              text-base font-bold text-black shrink-0
            "
          >
            {name.charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] sm:text-[16px] font-semibold text-[#111] truncate">
              {name}
            </h3>

            <p className="text-[11px] sm:text-[13px] text-gray-400 truncate mb-2">
              {company}
            </p>

            <div className="flex items-center gap-1.5 text-[11px] sm:text-[12px] text-gray-500 mb-1">
              <FiMail
                className="text-gray-400 shrink-0"
                size={12}
              />
              <span className="truncate">
                {email}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] sm:text-[12px] text-gray-500">
              <FiPhone
                className="text-gray-400 shrink-0"
                size={12}
              />
              <span className="truncate">
                {phone}
              </span>
            </div>

           <div className="flex items-center justify-between mt-2">
  {plan && (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
        planBadgeStyles[plan] || "bg-gray-100 text-gray-500"
      }`}
    >
      {formatText(plan)}
    </span>
  )}

  {isConvertedLeadView && (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-600">
      Customer
    </span>
  )}

  {/* {stage === "won" && !lead.is_customer && ( */}
   {stage === "won" && !converted && (
  <button
    onClick={handleConvertToCustomer}
    disabled={converting}
    className="px-2 py-1 bg-[#F5C518] rounded text-[9px] disabled:opacity-60 disabled:cursor-not-allowed"
  >
    {converting ? "Converting" : "Convert"}
  </button>
)}
</div>
          </div>
        </div>
       
        {/* DIVIDER */}
        <div className="border-t border-gray-100 my-4" />

        {/* PIPELINE */}
        {!isConvertedLeadView && (
        <div>
          <div className="relative flex items-center justify-between mb-3">
            <div className="absolute top-[5px] left-0 w-full h-[2px] bg-gray-200 rounded-full" />

            <div
              className="absolute top-[5px] left-0 h-[2px] rounded-full transition-all duration-500"
              style={{
                width: `${
                  activeIndex >= 0
                    ? (activeIndex /
                        (stages.length - 1)) *
                      100
                    : 0
                }%`,
                backgroundColor:
                  pipelineColor,
              }}
            />

            {stages.map((item, index) => (
              <div
                key={item}
                className="relative z-10"
              >
                <div
                  className="w-[10px] h-[10px] sm:w-[12px] sm:h-[12px] rounded-full border-2 bg-white"
                  style={
                    index <= activeIndex
                      ? {
                          borderColor:
                            pipelineColor,
                          backgroundColor:
                            pipelineColor,
                        }
                      : {
                          borderColor:
                            "#d1d5db",
                        }
                  }
                />
              </div>
            ))}
          </div>

          <div className="flex justify-between mt-2">
            {stages.map((item, index) => (
              <span
                key={item}
                className="flex-1 text-center text-[10px] sm:text-[11px] font-medium"
                style={{
                  color:
                    index <= activeIndex
                      ? pipelineColor
                      : "#9ca3af",
                }}
              >
                {item}
              </span>
            ))}
          </div>
 
        </div>
        )}
      </div>

      {/* VIEW MODAL */}
      {selectedLead && (
        <LeadDetails
          lead={selectedLead}
          onClose={() =>
            setSelectedLead(null)
          }
        />
      )}

      {editingCustomerId && (
        <CustomerFormPage
          propId={editingCustomerId}
          modalMode={true}
          onClose={() => setEditingCustomerId(null)}
          onCustomerAdded={() => {
            setEditingCustomerId(null);
            onRefresh?.();
          }}
          onRefresh={onRefresh}
        />
      )}

      {showAdvancedConversion && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleAdvancedConversion} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-xl font-semibold">Customize Advanced plan</h2>
            <p className="mb-5 text-sm text-gray-500">These values will be saved with the CRM customer and sent to ERP registration.</p>
            {conversionError && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{conversionError}</p>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[["customMembers", "Number of Site Engineers"], ["customProjectLimit", "Number of Projects"], ["customTemplateLimit", "Number of Templates"], ["customPrice", "Custom Annual Price (Rs.)"]].map(([key, label]) => (
                <label key={key} className="text-sm font-medium text-gray-700">{label}
                  <input required min="1" max={key === "customTemplateLimit" ? "10" : undefined} step="1" type="number" value={advancedPlan[key]} onChange={(event) => setAdvancedPlan((prev) => ({ ...prev, [key]: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-300 p-3" />
                </label>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => { setShowAdvancedConversion(false); setConversionError(""); }} className="rounded-lg border px-4 py-2">Cancel</button>
              <button type="submit" disabled={converting} className="rounded-lg bg-[#F5C518] px-4 py-2 font-semibold disabled:opacity-60">{converting ? "Converting..." : "Convert lead"}</button>
            </div>
          </form>
        </div>
      )}
     
    </>
  );
};

export default LeadPipelineColumn;
