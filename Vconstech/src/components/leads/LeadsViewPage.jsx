import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import axios from "axios";
import { API_BASE_URL } from "../../config/api";

const statusColors = {
  won:       "bg-green-100 text-green-600",
  lost:      "bg-red-100 text-red-600",
  new:       "bg-blue-100 text-blue-600",
  contacted: "bg-purple-100 text-purple-600",
  qualified: "bg-indigo-100 text-indigo-600",
  proposal:  "bg-orange-100 text-orange-600",
};

const sectionHeadingClass = "text-sm font-semibold text-gray-800 mb-4 capitalize";

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatFollowUp = (date, time) =>
  date ? `${formatDate(date)}${time ? ` at ${time}` : ""}` : "—";

export default function LeadDetails({ lead, onClose }) {
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!lead?.id) return;
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const res = await axios.get(`${API_BASE_URL}/api/leads/work-history/${lead.id}`);
        setHistory(res.data);
      } catch (err) {
        console.error("Failed to load work history", err);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
  }, [lead?.id]);

  if (!lead) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[24px] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
          <h2 className="text-[30px] font-bold text-[#1f2937]">Lead Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-black transition">
            <FiX size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto max-h-[75vh] px-6 py-6">

          {/* Profile */}
          <div className="flex items-center gap-4 pb-6 border-b border-gray-200">
            <div className="w-16 h-16 rounded-full bg-[#F5C518] flex items-center justify-center text-xl font-bold text-black">
              {lead.full_name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-800">{lead.full_name}</h3>
              <p className="text-gray-500 text-sm">{lead.company}</p>
              <p className="text-xs text-gray-400 mt-1">LEAD-{lead.id}</p>
            </div>
          </div>

          {/* Personal */}
          <div className="mt-6">
            <h4 className={sectionHeadingClass}>Personal</h4>
            <div className="space-y-4">
              <div className="flex justify-between border-b pb-3">
                <span className="text-gray-500">Email</span>
                <span className="font-medium text-gray-800">{lead.email}</span>
              </div>
              <div className="flex justify-between border-b pb-3">
                <span className="text-gray-500">Phone</span>
                <span className="font-medium text-gray-800">{lead.phone}</span>
              </div>
              <div className="flex justify-between border-b pb-3 gap-4">
                <span className="text-gray-500">Location</span>
                <span className="font-medium text-gray-800 text-right">{lead.location || "—"}</span>
              </div>
            </div>
          </div>

          {/* Lead Information */}
          <div className="mt-8">
            <h4 className={sectionHeadingClass}>Lead Information</h4>
            <div className="space-y-4">
              <div className="flex justify-between border-b pb-3">
                <span className="text-gray-500">Channel</span>
                <span className="font-medium text-gray-800 capitalize">{lead.channel}</span>
              </div>
              {(lead.facebook_id || lead.instagram_id) && (
                <div className="flex justify-between gap-4 border-b pb-3">
                  <span className="text-gray-500">
                    {lead.instagram_id ? "Instagram ID" : "Facebook ID"}
                  </span>
                  <span className="break-all text-right font-medium text-gray-800">
                    {lead.instagram_id || lead.facebook_id}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-b pb-3">
                <span className="text-gray-500">Status</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${statusColors[lead.status] || "bg-yellow-100 text-yellow-700"}`}>
                  {lead.status}
                </span>
              </div>
              <div className="flex justify-between border-b pb-3">
                <span className="text-gray-500">Plan</span>
                <span className="font-medium text-gray-800 capitalize">{lead.plan || "—"}</span>
              </div>
              <div className="flex justify-between border-b pb-3">
                <span className="text-gray-500">Lead Date</span>
                {/* <span className="font-medium text-gray-800">{lead.lead_date || "—"}</span> */}
                <span className="font-medium text-gray-800">
  {formatDate(lead.lead_date)}
</span>
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="mt-8">
            <h4 className={sectionHeadingClass}>Address</h4>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-700 leading-relaxed whitespace-pre-wrap">
              {lead.address || "No address provided"}
            </div>
          </div>

          {/* Requirements */}
          <div className="mt-8">
            <h4 className={sectionHeadingClass}>Requirements</h4>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-700 leading-relaxed">
              {lead.requirements || "No requirements provided"}
            </div>
          </div>

          {/* ── Work History ── */}
          <div className="mt-8">
            <h4 className={sectionHeadingClass}>
              Work History
            </h4>

            {loadingHistory && (
              <p className="text-sm text-gray-400 text-center py-4">Loading...</p>
            )}

            {!loadingHistory && history.length === 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-400 text-sm text-center">
                No work updates yet
              </div>
            )}

            {!loadingHistory && history.length > 0 && (
              <div className="relative">
                {/* vertical timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />

                <div className="space-y-5">
                  {history.map((h) => (
                    <div key={h.id} className="flex gap-4 relative">

                      {/* dot */}
                      <div className="w-8 h-8 rounded-full bg-[#F5C518] flex items-center justify-center text-xs font-bold text-black shrink-0 z-10">
                        {h.stage?.charAt(0)?.toUpperCase()}
                      </div>

                      {/* card */}
                      <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-4">

                        {/* top row */}
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColors[h.stage] || "bg-yellow-100 text-yellow-700"}`}>
                            {h.stage}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatDateTime(h.created_at)}
                          </span>
                        </div>

                        {/* note */}
                        {h.note && (
                          <p className="text-sm text-gray-700 mb-2">{h.note}</p>
                        )}

                        {/* follow-up */}
                        {h.follow_up_date && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <span>📅</span>
                            <span>
                              Follow-up: {formatFollowUp(h.follow_up_date, h.follow_up_time)}
                            </span>
                          </div>
                        )}

                        {/* reminder badge */}
                        {h.reminder && (
                          <div className="mt-2">
                            <span className="text-[11px] bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full font-medium">
                              🔔 Reminder set
                            </span>
                          </div>
                        )}

                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
