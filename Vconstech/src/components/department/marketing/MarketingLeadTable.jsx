// import { useMemo, useState } from "react";
// import { FiSearch } from "react-icons/fi";

// const statusColors = {
//   new: "bg-gray-100 text-gray-600",
//   contacted: "bg-blue-100 text-blue-600",
//   qualified: "bg-purple-100 text-purple-600",
//   proposal: "bg-yellow-100 text-yellow-700",
//   won: "bg-green-100 text-green-600",
//   lost: "bg-red-100 text-red-600",
//   converted: "bg-green-100 text-green-600",
// };

// const formatStatus = (value) =>
//   String(value || "New")
//     .split(/\s+/)
//     .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
//     .join(" ");

// const formatDate = (value) => {
//   if (!value) return "-";

//   const date = new Date(value);
//   if (Number.isNaN(date.getTime())) return "-";

//   return date.toLocaleDateString([], {
//     day: "2-digit",
//     month: "short",
//     year: "numeric",
//   });
// };

// const includesTerm = (value, term) =>
//   String(value || "").toLowerCase().includes(term);

// const MarketingLeadTable = ({ leads = [], loading = false, error = "", onView, onEdit }) => {
//   const [search, setSearch] = useState("");

//   const filteredLeads = useMemo(() => {
//     const term = search.trim().toLowerCase();
//     if (!term) return leads;

//     return leads.filter((lead) =>
//       [
//         lead.id,
//         lead.marketingChannel,
//         lead.full_name,
//         lead.company,
//         lead.status,
//         lead.phone,
//         lead.email,
//         lead.plan,
//         lead.location,
//         lead.requirements,
//         lead.assigned_employee_id,
//       ].some((value) => includesTerm(value, term))
//     );
//   }, [leads, search]);

//   return (
//     <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
//       <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-gray-100">
//         <div>
//           <h2 className="text-[18px] font-bold text-gray-900">Marketing Lead Table</h2>
//           <p className="text-[12px] text-gray-500 mt-0.5">
//             {filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""} shown
//           </p>
//         </div>

//         <div className="relative w-full sm:w-[280px]">
//           <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
//           <input
//             value={search}
//             onChange={(event) => setSearch(event.target.value)}
//             placeholder="Search leads..."
//             className="w-full h-10 pl-9 pr-3 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-[#F5C518] focus:ring-2 focus:ring-yellow-100"
//           />
//         </div>
//       </div>

//       {loading ? (
//         <div className="p-5 space-y-3">
//           {[...Array(5)].map((_, index) => (
//             <div key={index} className="h-11 rounded-xl bg-gray-100 animate-pulse" />
//           ))}
//         </div>
//       ) : error ? (
//         <div className="py-14 text-center text-sm font-medium text-red-500">{error}</div>
//       ) : (
//         <div className="overflow-x-auto">
//           <table className="w-full min-w-[980px] text-sm">
//             <thead>
//               <tr className="bg-gray-50 text-left text-[13px] font-semibold text-gray-700">
//                 <th className="px-4 py-3 whitespace-nowrap">Lead ID</th>
//                 <th className="px-4 py-3 whitespace-nowrap">Channel</th>
//                 <th className="px-4 py-3 whitespace-nowrap">Name</th>
//                 <th className="px-4 py-3 whitespace-nowrap">Company</th>
//                 <th className="px-4 py-3 whitespace-nowrap">Status</th>

//                 <th className="px-4 py-3 whitespace-nowrap">Assigned To</th>
//                 <th className="px-4 py-3 whitespace-nowrap">Action</th>
//               </tr>
//             </thead>
//             <tbody>
//               {filteredLeads.length === 0 ? (
//                 <tr>
//                   <td colSpan={11} className="px-4 py-12 text-center text-gray-400">
//                     No marketing leads found.
//                   </td>
//                 </tr>
//               ) : (
//                 filteredLeads.map((lead) => {
//                   const status = String(lead.status || "new").toLowerCase();

//                   return (
//                     <tr key={lead.id} className="border-t border-gray-100 hover:bg-yellow-50/40">
//                       <td className="px-4 py-3 font-semibold text-[#C89B00] whitespace-nowrap">#L-{lead.id}</td>
//                       <td className="px-4 py-3 whitespace-nowrap">
//                         <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-700">
//                           {lead.marketingChannel || "-"}
//                         </span>
//                       </td>
//                       <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{lead.full_name || "-"}</td>
//                       <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{lead.company || "-"}</td>
//                       <td className="px-4 py-3 whitespace-nowrap">
//                         <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusColors[status] || "bg-gray-100 text-gray-600"}`}>
//                           {formatStatus(lead.status)}
//                         </span>
//                       </td>

//                       <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{lead.assigned_employee_id || "Unassigned"}</td>
//                       <td className="px-4 py-3 whitespace-nowrap">
//                         <div className="flex items-center gap-2">
//                           <button
//                             type="button"
//                             onClick={() => onView?.(lead)}
//                             className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-[#F5C518] hover:bg-yellow-50 hover:text-[#C89B00]"
//                           >
//                             View
//                           </button>
//                           <button
//                             type="button"
//                             onClick={() => onEdit?.(lead)}
//                             className="rounded-lg bg-[#F5C518] px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-[#e5b800]"
//                           >
//                             Edit
//                           </button>
//                         </div>
//                       </td>
//                     </tr>
//                   );
//                 })
//               )}
//             </tbody>
//           </table>
//         </div>
//       )}
//     </div>
//   );
// };

// export default MarketingLeadTable;

import { useMemo, useState } from "react";
import { FiSearch } from "react-icons/fi";
import RowActionsMenu from "./RowActionsMenu";

const statusColors = {
  new: "bg-gray-100 text-gray-600",
  contacted: "bg-blue-100 text-blue-600",
  qualified: "bg-purple-100 text-purple-600",
  proposal: "bg-yellow-100 text-yellow-700",
  won: "bg-green-100 text-green-600",
  lost: "bg-red-100 text-red-600",
  converted: "bg-green-100 text-green-600",
};

const formatStatus = (value) =>
  String(value || "New")
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const includesTerm = (value, term) =>
  String(value || "").toLowerCase().includes(term);

const MarketingLeadTable = ({ leads = [], loading = false, error = "", onView, onEdit, onDelete }) => {
  const [search, setSearch] = useState("");

  const filteredLeads = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return leads;

    return leads.filter((lead) =>
      [
        lead.id,
        lead.marketingChannel,
        lead.full_name,
        lead.company,
        lead.status,
        lead.phone,
        lead.email,
        lead.plan,
        lead.location,
        lead.requirements,
        lead.assigned_employee_id,
      ].some((value) => includesTerm(value, term))
    );
  }, [leads, search]);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-gray-100">
        <div>
          <h2 className="text-[18px] font-bold text-gray-900">Marketing Lead Table</h2>
          <p className="text-[12px] text-gray-500 mt-0.5">
            {filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""} shown
          </p>
        </div>

        <div className="relative w-full sm:w-[280px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search leads..."
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-[#F5C518] focus:ring-2 focus:ring-yellow-100"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-5 space-y-3">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="h-11 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="py-14 text-center text-sm font-medium text-red-500">{error}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-[13px] font-semibold text-gray-700">
                <th className="px-4 py-3 whitespace-nowrap">Lead ID</th>
                <th className="px-4 py-3 whitespace-nowrap">Channel</th>
                <th className="px-4 py-3 whitespace-nowrap">Name</th>
                <th className="px-4 py-3 whitespace-nowrap">Company</th>
                <th className="px-4 py-3 whitespace-nowrap">Status</th>

                <th className="px-4 py-3 whitespace-nowrap">Assigned To</th>
                <th className="px-4 py-3 whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    No marketing leads found.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const status = String(lead.status || "new").toLowerCase();

                  return (
                    <tr key={lead.id} className="border-t border-gray-100 hover:bg-yellow-50/40">
                      <td className="px-4 py-3 font-semibold text-[#C89B00] whitespace-nowrap">#L-{lead.id}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-700">
                          {lead.marketingChannel || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{lead.full_name || "-"}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{lead.company || "-"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusColors[status] || "bg-gray-100 text-gray-600"}`}>
                          {formatStatus(lead.status)}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {lead.assigned_employee_id || "Unassigned"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <RowActionsMenu
                          lead={lead}
                          onView={onView}
                          onEdit={onEdit}
                          onDelete={onDelete}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MarketingLeadTable;
