import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../config/api";
import StatsCards from "../../components/department/marketing/Statscards";
import FilterTabs from "../../components/department/marketing/FilterTabs";
import TicketBoard from "../../components/department/marketing/TicketBoard";
import MarketingLeadTable from "../../components/department/marketing/MarketingLeadTable";
import AddLeadModal from "../../components/leads/AddleadForm";
import LeadDetails from "../../components/leads/LeadsViewPage";

const MARKETING_CHANNELS = ["Whatsapp", "Facebook", "Website", "Email"];
const VIEW_MODES = ["Table", "Cards"];

const normalizeChannel = (value) => {
  const channel = String(value || "").trim().toLowerCase();

  if (channel === "whatsapp" || channel === "whats app") return "Whatsapp";
  if (channel === "facebook" || channel === "fb" || channel === "meta ads") return "Facebook";
  if (channel === "website" || channel === "web") return "Website";
  if (channel === "email" || channel === "mail") return "Email";

  return "";
};

export default function MarketingPage() {
  const [activeTab, setActiveTab] = useState("All");
  const [viewMode, setViewMode] = useState("Table");
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedLead, setSelectedLead] = useState(null);
  const [editingLead, setEditingLead] = useState(null);

  const fetchLeads = async () => {
    setLoading(true);
    setError("");

    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/leads`);
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError("Failed to load marketing leads.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const marketingLeads = useMemo(
    () =>
      leads
        .map((lead) => ({ ...lead, marketingChannel: normalizeChannel(lead.channel) }))
        .filter((lead) => MARKETING_CHANNELS.includes(lead.marketingChannel)),
    [leads]
  );

  const visibleLeads = useMemo(
    () =>
      activeTab === "All"
        ? marketingLeads
        : marketingLeads.filter((lead) => lead.marketingChannel === activeTab),
    [activeTab, marketingLeads]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[32px] font-bold text-[#111111]">Marketing</h1>
      </div>

      <StatsCards leads={marketingLeads} channels={MARKETING_CHANNELS} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          channels={MARKETING_CHANNELS}
        />

        <div className="flex w-full rounded-xl border border-gray-200 bg-white p-1 shadow-sm sm:w-auto">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`h-9 flex-1 rounded-lg px-4 text-sm font-semibold transition-all sm:flex-none ${
                viewMode === mode
                  ? "bg-[#F5C518] text-black shadow-sm"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {mode} View
            </button>
          ))}
        </div>
      </div>

      {viewMode === "Cards" ? (
        <TicketBoard
          leads={visibleLeads}
          loading={loading}
          error={error}
          onView={setSelectedLead}
          onEdit={setEditingLead}
        />
      ) : (
        <MarketingLeadTable
          leads={visibleLeads}
          loading={loading}
          error={error}
          onView={setSelectedLead}
          onEdit={setEditingLead}
        />
      )}

      {selectedLead && (
        <LeadDetails
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
        />
      )}

      {editingLead && (
        <AddLeadModal
          editData={editingLead}
          onClose={() => setEditingLead(null)}
          onSubmit={() => {
            setEditingLead(null);
            fetchLeads();
          }}
        />
      )}
    </div>
  );
}
