// import { motion } from "framer-motion";
// import { FiClock } from "react-icons/fi";

// const channelColors = {
//   Whatsapp: "bg-green-500",
//   Facebook: "bg-blue-500",
//   Website: "bg-purple-500",
//   Email: "bg-orange-400",
// };

// const statusColors = {
//   New: "bg-gray-100 text-gray-600",
//   Contacted: "bg-blue-100 text-blue-600",
//   Qualified: "bg-purple-100 text-purple-600",
//   Proposal: "bg-yellow-100 text-yellow-700",
//   Won: "bg-green-100 text-green-600",
//   Lost: "bg-red-100 text-red-600",
// };

// const avatarBg = ["bg-pink-400", "bg-green-400", "bg-blue-400", "bg-purple-400", "bg-orange-400"];

// const formatStatus = (value) =>
//   String(value || "New")
//     .split(/\s+/)
//     .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
//     .join(" ");

// const TicketCard = ({ lead, ticket, index, onView, onEdit }) => {
//   const status = formatStatus(ticket.status);
//   const dotColor = channelColors[ticket.channel] || "bg-gray-400";
//   const statusStyle = statusColors[status] || "bg-gray-100 text-gray-600";
//   const avatarColor = avatarBg[index % avatarBg.length];

//   return (
//     <motion.div
//       initial={{ opacity: 0, y: 20 }}
//       animate={{ opacity: 1, y: 0 }}
//       transition={{ duration: 0.35, delay: index * 0.07 }}
//       className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow duration-300 min-w-[220px] flex-1 max-w-[280px]"
//     >
//       <div className="flex items-center justify-between mb-3">
//         <div className="flex items-center gap-2 min-w-0">
//           <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
//           <span className="text-[13px] font-semibold text-gray-800 truncate">{ticket.channel}</span>
//         </div>
//         <button
//           type="button"
//           onClick={() => onView?.(lead)}
//           className="text-[11px] font-semibold text-[#C89B00] hover:text-black transition-colors"
//         >
//           View
//         </button>
//       </div>

//       <div className="flex items-center justify-between mb-3 gap-3">
//         <div className="min-w-0">
//           <p className="text-[13px] font-semibold text-gray-900 leading-tight truncate">{ticket.name}</p>
//           <p className="text-[11px] text-gray-400 truncate">{ticket.company}</p>
//         </div>
//         <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center text-white text-[11px] font-bold shrink-0`}>
//           {ticket.initials}
//         </div>
//       </div>

//       <div className="flex items-center gap-1.5 mb-3 flex-wrap">
//         <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
//           {ticket.channel}
//         </span>
//         <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusStyle}`}>
//           {status}
//         </span>
//       </div>

//       <div className="mb-3">
//         <p className="text-[11px] text-gray-400 mb-0.5">Next Action</p>
//         <div className="flex items-start justify-between gap-2">
//           <p className="text-[13px] font-semibold text-gray-800 line-clamp-2">{ticket.nextAction}</p>
//           <div className="flex items-center gap-1 text-gray-400 shrink-0">
//             <FiClock className="text-[11px]" />
//             <span className="text-[11px]">{ticket.time}</span>
//           </div>
//         </div>
//       </div>

//       <div className="flex items-center justify-between pt-2 border-t border-gray-100">
//         <span className="text-[11px] text-gray-400 font-medium">{ticket.id}</span>
//         <div className="flex items-center gap-2">
//           <button
//             type="button"
//             onClick={() => onEdit?.(lead)}
//             className="text-[11px] font-semibold text-gray-600 hover:text-[#C89B00] transition-colors"
//           >
//             Edit
//           </button>
//           <span className="text-[11px] text-gray-400">{ticket.ago}</span>
//         </div>
//       </div>
//     </motion.div>
//   );
// };

// export default TicketCard;

import { motion } from "framer-motion";
import { FiClock } from "react-icons/fi";
import RowActionsMenu from "./RowActionsMenu";

const channelColors = {
  Whatsapp: "bg-green-500",
  Facebook: "bg-blue-500",
  Website: "bg-purple-500",
  Email: "bg-orange-400",
};

const statusColors = {
  New: "bg-gray-100 text-gray-600",
  Contacted: "bg-blue-100 text-blue-600",
  Qualified: "bg-purple-100 text-purple-600",
  Proposal: "bg-yellow-100 text-yellow-700",
  Won: "bg-green-100 text-green-600",
  Lost: "bg-red-100 text-red-600",
};

const avatarBg = ["bg-pink-400", "bg-green-400", "bg-blue-400", "bg-purple-400", "bg-orange-400"];

const formatStatus = (value) =>
  String(value || "New")
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const TicketCard = ({ lead, ticket, index, onView, onEdit, onDelete }) => {
  const status = formatStatus(ticket.status);
  const dotColor = channelColors[ticket.channel] || "bg-gray-400";
  const statusStyle = statusColors[status] || "bg-gray-100 text-gray-600";
  const avatarColor = avatarBg[index % avatarBg.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
      className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow duration-300 min-w-[220px] flex-1 max-w-[280px]"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
          <span className="text-[13px] font-semibold text-gray-800 truncate">{ticket.channel}</span>
        </div>
        <RowActionsMenu lead={lead} onView={onView} onEdit={onEdit} onDelete={onDelete} />
      </div>

      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-gray-900 leading-tight truncate">{ticket.name}</p>
          <p className="text-[11px] text-gray-400 truncate">{ticket.company}</p>
        </div>
        <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center text-white text-[11px] font-bold shrink-0`}>
          {ticket.initials}
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
          {ticket.channel}
        </span>
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusStyle}`}>
          {status}
        </span>
      </div>

      <div className="mb-3">
        <p className="text-[11px] text-gray-400 mb-0.5">Next Action</p>
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-semibold text-gray-800 line-clamp-2">{ticket.nextAction}</p>
          <div className="flex items-center gap-1 text-gray-400 shrink-0">
            <FiClock className="text-[11px]" />
            <span className="text-[11px]">{ticket.time}</span>
          </div>
        </div>
      </div>

      <div className="mb-3">
        <p className="text-[11px] text-gray-400 mb-0.5">Assigned To</p>
        <p className="text-[12px] font-semibold text-gray-800">
          {ticket.assignedEmployeeId || "Unassigned"}
        </p>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <span className="text-[11px] text-gray-400 font-medium">{ticket.id}</span>
        <span className="text-[11px] text-gray-400">{ticket.ago}</span>
      </div>
    </motion.div>
  );
};

export default TicketCard;
