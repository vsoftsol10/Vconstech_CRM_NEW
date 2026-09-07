import { motion } from "framer-motion";
import { FiFacebook, FiGlobe, FiMail, FiMessageCircle, FiUsers } from "react-icons/fi";

const channelIcons = {
  Whatsapp: FiMessageCircle,
  Facebook: FiFacebook,
  Website: FiGlobe,
  Email: FiMail,
};

const StatsCards = ({ leads = [], channels = [] }) => {
  const total = leads.length;
  const stats = channels.map((channel) => {
    const count = leads.filter((lead) => lead.marketingChannel === channel).length;

    return {
      label: `${channel} Leads`,
      value: count,
      sub: total ? `${Math.round((count / total) * 100)}% of marketing leads` : "No leads yet",
      badge: channel.toUpperCase(),
      icon: channelIcons[channel] || FiUsers,
    };
  });

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.08 }}
          className="bg-white border border-gray-200 rounded-2xl px-5 py-4 flex flex-col justify-between gap-2 shadow-sm hover:shadow-md transition-shadow duration-300 h-full"
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-gray-500 font-medium">{stat.label}</span>
            <div className="w-7 h-7 rounded-full bg-[#FFF8E1] flex items-center justify-center">
              <stat.icon className="text-[#F5C518] text-sm" />
            </div>
          </div>

          <p className="text-[28px] font-bold text-gray-900 leading-tight">{stat.value}</p>

          <div className="flex items-center justify-between mt-auto gap-2">
            <span className="text-[12px] font-medium text-gray-500 leading-snug">
              {stat.sub}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-500 shrink-0">
              {stat.badge}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default StatsCards;
