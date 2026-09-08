import { motion } from "framer-motion";
import { FiSliders } from "react-icons/fi";

const FilterTabs = ({ activeTab, setActiveTab, channels = [] }) => {
  const tabs = ["All", ...channels];

  return (
    <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative h-[40px] px-5 rounded-xl text-sm font-semibold transition-all duration-300 ${
              activeTab === tab
                ? "bg-[#F5C518] text-black shadow-sm"
                : "bg-white border border-gray-200 text-gray-500 hover:bg-[#fdf7e0]"
            }`}
          >
            {tab}
            {activeTab === tab && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 rounded-xl bg-[#F5C518] -z-10"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      
    </div>
  );
};

export default FilterTabs;
