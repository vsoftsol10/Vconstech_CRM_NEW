import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FiTrendingUp,
  FiTrendingDown,
  FiShield,
  FiTool,
  FiHeadphones,
  FiRadio,
} from "react-icons/fi";
import { API_BASE_URL } from "../../config/api";

const iconMap = {
  Sales:     FiTrendingUp,
  Marketing: FiRadio,
  Technical: FiTool,
  Support:   FiHeadphones,
  Admin:     FiShield,
};

const DepartmentStatCards = () => {
  const [stats,   setStats]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res  = await fetch(`${API_BASE_URL}/api/departments/stats`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        setStats(json.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm animate-pulse h-[110px]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">
        Failed to load stats: {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
      {stats.map((s, i) => {
        const Icon       = iconMap[s.name] || FiTrendingUp;
        const isPositive = s.badge_type === "up";

        return (
          <motion.div
            key={s.name}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: i * 0.1 }}
            whileHover={{ y: -5 }}
            className="
              relative bg-white
              border border-gray-200
              rounded-2xl p-3 sm:p-4 md:p-5
              shadow-sm hover:shadow-xl
              hover:border-[#F5C518]
              transition-all duration-300
              cursor-pointer overflow-hidden
            "
          >
            {/* Top */}
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="
                text-[11px] sm:text-[12px] md:text-[13px]
                font-medium text-gray-500 leading-tight pr-1
              ">
                {s.name}
              </span>
              <div className="
                w-[28px] sm:w-[32px] md:w-[36px]
                h-[28px] sm:h-[32px] md:h-[36px]
                rounded-full bg-yellow-50
                flex items-center justify-center shrink-0
              ">
                <Icon size={14} className="text-[#F5C518]" />
              </div>
            </div>

            {/* Number */}
            <h2 className="
              text-[20px] sm:text-[22px] md:text-[24px]
              font-bold text-[#111111]
              leading-none tracking-tight
              mb-2 sm:mb-3
            ">
              {s.member_count?.toLocaleString()}
            </h2>

            {/* Bottom */}
            <div className="flex items-center justify-between gap-1">
              <span className="
                text-[10px] sm:text-[11px] md:text-[12px]
                text-gray-400 truncate
              ">
                {s.subtitle}
              </span>
              <div className={`
                flex items-center gap-0.5
                px-1.5 py-0.5 rounded-full shrink-0
                text-[9px] sm:text-[10px] font-bold whitespace-nowrap
                ${isPositive
                  ? "bg-green-100 text-green-600"
                  : "bg-red-100 text-red-500"
                }
              `}>
                {isPositive
                  ? <FiTrendingUp size={8} />
                  : <FiTrendingDown size={8} />
                }
                {s.badge}
              </div>
            </div>

            {/* Bottom Hover Line */}
            <div className="
              absolute bottom-0 left-0
              w-0 h-[3px]
              bg-gradient-to-r from-[#F5C518] to-yellow-300
              hover:w-full transition-all duration-500
            "/>
          </motion.div>
        );
      })}
    </div>
  );
};

export default DepartmentStatCards;
