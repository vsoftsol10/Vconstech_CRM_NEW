import { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import {
  FiGrid, FiTrendingUp, FiUsers,
  FiLayers, FiClipboard, FiX, FiChevronDown, FiTag, FiMessageSquare,
} from "react-icons/fi";
import { MdHeadsetMic, MdOutlineCode, MdOutlineCampaign } from "react-icons/md";
import { CreditCard } from 'lucide-react';
// import logo from "../../assets/images/logo.jpeg";
// import logo from "./assets/logo.png"
import logo from "../../assets/logo.png"



const menuItems = [
  { id: "dashboard",    label: "Dashboard",    icon: FiGrid,       path: "/dashboard" },
  { id: "lead-sales",   label: "Lead & Sales", icon: FiTrendingUp, path: "/lead-sales" },
  { id: "lead-inbox",   label: "Lead Inbox",   icon: FiMessageSquare, path: "/lead-inbox" },
  { id: "customer",     label: "Customer",     icon: FiUsers,      path: "/customer" },
  { id: "team-members", label: 'Team Members', icon: CreditCard,   path: '/team-members' },

  {
    id: "department", label: "Department", icon: FiLayers,
    path: "/department",
    children: [
      { id: "sales-team",     label: "Sales Team",     icon: FiTrendingUp,      path: "/department/sales" },
      { id: "support-team",   label: "Support Team",   icon: MdHeadsetMic,      path: "/department/support" },
      { id: "technical-team", label: "Technical Team", icon: MdOutlineCode,     path: "/department/technical" },
      { id: "marketing-team", label: "Marketing Team", icon: MdOutlineCampaign, path: "/department/marketing" },
    ],
  },
  { id: "subscription", label: "Subscription", icon: FiClipboard, path: "/subscription" },
  { id: "ticket", label: "Workspace", icon: FiTag, path: "/ticket" },
];

// Stagger container for nav items on mount
const navContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const navItem = {
  hidden:  { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 26 } },
};

// Sub-items stagger
const subContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const subItem = {
  hidden:  { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 320, damping: 28 } },
};

const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
  const location     = useLocation();
  const navigate     = useNavigate();
  const isDeptActive = location.pathname.startsWith("/department");
  const [deptOpen, setDeptOpen] = useState(isDeptActive);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setSidebarOpen(true);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [setSidebarOpen]);

  useEffect(() => {
    if (isDeptActive) setDeptOpen(true);
  }, [isDeptActive]);

  useEffect(() => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
  }, [location.pathname, setSidebarOpen]);

  // Handler: navigate to /department AND toggle dropdown
  const handleDeptClick = () => {
    navigate("/department");
    setDeptOpen((v) => !v);
  };

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar panel */}
      <aside
        className={`
          fixed top-0 left-0 z-50
          w-[230px] h-screen
          bg-white border-r border-gray-200
          flex flex-col shadow-sm
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        {/* Logo */}
        <motion.div
          className="h-[64px] border-b border-gray-100 flex items-center justify-between px-5 shrink-0"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <motion.img
            src={logo}
            alt="logo"
            className="w-full max-w-[150px] object-contain"
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.12 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          />
          <motion.button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
            whileTap={{ scale: 0.85, rotate: 90 }}
            transition={{ duration: 0.15 }}
          >
            <FiX className="text-lg text-gray-600" />
          </motion.button>
        </motion.div>

        {/* Nav */}
        <motion.nav
          className="flex flex-col py-3 overflow-y-auto flex-1"
          variants={navContainer}
          initial="hidden"
          animate="visible"
        >
          {menuItems.map((item) => {
            const Icon = item.icon;

            /* ── Department (has children) ── */
            if (item.children) {
              // Exact match for /department route (not sub-routes)
              const isDeptPageActive = location.pathname === "/department";

              return (
                <motion.div key={item.id} variants={navItem}>
                  <motion.button
                    onClick={handleDeptClick}
                    whileTap={{ scale: 0.98 }}
                    className={`
                      relative w-full flex items-center justify-between
                      gap-3 h-[48px] px-6
                      transition-colors duration-150
                      ${isDeptPageActive
                        ? "bg-[#F5C518] text-black font-semibold"
                        : "text-gray-500 hover:bg-[#fdf7e0]"
                      }
                    `}
                  >
                    {/* Active left bar */}
                    {isDeptPageActive && (
                      <motion.span
                        layoutId="activeBar"
                        className="absolute left-0 top-0 h-full w-1 bg-yellow-600 rounded-r-md"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}

                    <div className="flex items-center gap-3">
                      <motion.div
                        animate={isDeptPageActive ? { rotate: [0, -10, 0] } : {}}
                        transition={{ duration: 0.35, delay: 0.05 }}
                      >
                        <Icon className="text-[18px]" />
                      </motion.div>
                      <span className="text-[14px] tracking-[0.2px]">{item.label}</span>
                    </div>

                    <motion.div
                      animate={{ rotate: deptOpen ? 180 : 0 }}
                      transition={{ type: "spring", stiffness: 280, damping: 22 }}
                    >
                      <FiChevronDown className="text-[15px]" />
                    </motion.div>
                  </motion.button>

                  {/* Sub-items: height expand + stagger children */}
                  <AnimatePresence initial={false}>
                    {deptOpen && (
                      <motion.div
                        key="dept-children"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                          height:  { type: "spring", stiffness: 300, damping: 30 },
                          opacity: { duration: 0.18 },
                        }}
                        className="overflow-hidden bg-[#fafafa]"
                      >
                        <motion.div
                          variants={subContainer}
                          initial="hidden"
                          animate="visible"
                        >
                          {item.children.map((child) => {
                            const ChildIcon = child.icon;
                            return (
                              <motion.div key={child.id} variants={subItem}>
                                <NavLink
                                  to={child.path}
                                  className={({ isActive }) => `
                                    relative flex items-center gap-3
                                    h-[42px] pl-10 pr-6
                                    transition-colors duration-150
                                    ${isActive
                                      ? "bg-[#FFF9E0] text-[#C89B00] font-semibold"
                                      : "text-gray-500 hover:bg-[#fdf7e0] hover:text-gray-700"
                                    }
                                  `}
                                >
                                  {({ isActive }) => (
                                    <>
                                      <motion.div
                                        animate={isActive ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                                        transition={{ duration: 0.3 }}
                                      >
                                        <ChildIcon className="text-[14px] shrink-0" />
                                      </motion.div>
                                      <span className="text-[13px]">{child.label}</span>

                                    </>
                                  )}
                                </NavLink>
                              </motion.div>
                            );
                          })}
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            }

            /* ── Normal items ── */
            return (
              <motion.div key={item.id} variants={navItem}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) => `
                    relative flex items-center gap-3
                    h-[48px] px-6
                    transition-colors duration-150
                    ${isActive
                      ? "bg-[#F5C518] text-black font-semibold"
                      : "text-gray-500 hover:bg-[#fdf7e0]"
                    }
                  `}
                >
                  {({ isActive }) => (
                    <>
                      {/* Sliding left bar that moves between active items */}
                      {isActive && (
                        <motion.span
                          layoutId="activeBar"
                          className="absolute left-0 top-0 h-full w-1 bg-yellow-600 rounded-r-md"
                          transition={{ type: "spring", stiffness: 400, damping: 32 }}
                        />
                      )}

                      {/* Icon bounces when becoming active */}
                      <motion.div
                        animate={isActive ? { scale: [1, 1.25, 1], rotate: [0, -8, 0] } : { scale: 1, rotate: 0 }}
                        transition={{ duration: 0.35 }}
                      >
                        <Icon className="text-[18px]" />
                      </motion.div>

                      <span className="text-[14px] tracking-[0.2px]">{item.label}</span>
                    </>
                  )}
                </NavLink>
              </motion.div>
            );
          })}
        </motion.nav>
      </aside>
    </>
  );
};

export default Sidebar;
