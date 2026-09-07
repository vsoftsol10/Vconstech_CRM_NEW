import TicketCard from "./TicketCard";

const getInitials = (name) =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "LD";

const formatTime = (lead) => {
  const rawDate = lead.follow_up_date || lead.lead_date || lead.created_at;
  const rawTime = lead.follow_up_time;

  if (rawTime) return String(rawTime).slice(0, 5);
  if (!rawDate) return "No time";

  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return "No time";

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatAgo = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const toTicket = (lead) => ({
  channel: lead.marketingChannel || lead.channel || "Unknown",
  name: lead.full_name || lead.name || "Unnamed Lead",
  company: lead.company || "-",
  initials: getInitials(lead.full_name || lead.name),
  status: lead.status || "New",
  nextAction: lead.requirements || lead.plan || "Follow up",
  time: formatTime(lead),
  id: `#L-${lead.id}`,
  ago: formatAgo(lead.created_at || lead.lead_date),
});

const TicketBoard = ({ leads = [], loading = false, error = "", onView, onEdit }) => {
  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6 text-sm font-medium text-gray-500">
        Loading marketing leads...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-red-100 rounded-2xl p-6 text-sm font-medium text-red-500">
        {error}
      </div>
    );
  }

  if (!leads.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6 text-sm font-medium text-gray-500">
        No marketing leads found for Whatsapp, Facebook, Website, or Email.
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
      {leads.map((lead, i) => (
        <TicketCard
          key={lead.id || i}
          lead={lead}
          ticket={toTicket(lead)}
          index={i}
          onView={onView}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
};

export default TicketBoard;
