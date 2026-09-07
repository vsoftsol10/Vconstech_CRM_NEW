import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  FiHeadphones,
  FiMail,
  FiPhone,
  FiRadio,
  FiSearch,
  FiShield,
  FiX,
  FiTool,
  FiTrendingUp,
  FiUser,
} from "react-icons/fi";
import { API_BASE_URL } from "../../config/api";

const DEPARTMENTS = [
  { name: "Sales", icon: FiTrendingUp, accent: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  { name: "Marketing", icon: FiRadio, accent: "bg-sky-50 text-sky-600 border-sky-100" },
  { name: "Technical", icon: FiTool, accent: "bg-violet-50 text-violet-600 border-violet-100" },
  { name: "Support", icon: FiHeadphones, accent: "bg-amber-50 text-amber-600 border-amber-100" },
  { name: "Admin", icon: FiShield, accent: "bg-rose-50 text-rose-600 border-rose-100" },
];

const formatDate = (value) => {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getInitials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "TM";

const getAvatarUrl = (avatarUrl) => {
  if (!avatarUrl) return "";
  if (/^https?:\/\//i.test(avatarUrl)) return avatarUrl;
  return `${API_BASE_URL}/uploads/${avatarUrl}`;
};

const MemberAvatar = ({ member }) => {
  const avatar = getAvatarUrl(member.avatar_url);

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={member.name}
        className="h-10 w-10 rounded-full object-cover border border-gray-200 shrink-0"
      />
    );
  }

  return (
    <div className="h-10 w-10 rounded-full bg-gray-100 text-gray-700 border border-gray-200 flex items-center justify-center text-xs font-bold shrink-0">
      {getInitials(member.name)}
    </div>
  );
};

const MemberRow = ({ member, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25, delay: index * 0.03 }}
    className="rounded-xl border border-gray-100 bg-white px-3 py-3 shadow-sm"
  >
    <div className="flex items-start gap-3">
      <MemberAvatar member={member} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-900">{member.name || "Unnamed member"}</p>
            <p className="truncate text-xs text-gray-500">{member.role || "Team member"}</p>
          </div>
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-600">
            {member.status || "Active"}
          </span>
        </div>

        <div className="mt-3 space-y-1.5 text-xs text-gray-500">
          <p className="flex items-center gap-2 min-w-0">
            <FiMail className="shrink-0" size={13} />
            <span className="truncate">{member.email || "No email"}</span>
          </p>
          <p className="flex items-center gap-2 min-w-0">
            <FiPhone className="shrink-0" size={13} />
            <span className="truncate">{member.phone || "No phone"}</span>
          </p>
          <p className="flex items-center gap-2 min-w-0">
            <FiUser className="shrink-0" size={13} />
            <span className="truncate">Joined {formatDate(member.joined_date)}</span>
          </p>
        </div>
      </div>
    </div>
  </motion.div>
);

const DepartmentColumn = ({ department, members, onMore }) => {
  const Icon = department.icon;
  const visibleMembers = members.slice(0, 3);
  const hiddenCount = Math.max(members.length - visibleMembers.length, 0);

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-[280px] rounded-2xl border border-gray-200 bg-[#fbfcfe] p-4 shadow-sm"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`h-9 w-9 rounded-xl border flex items-center justify-center ${department.accent}`}>
            <Icon size={17} />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-gray-900">{department.name}</h3>
            <p className="text-xs text-gray-500">{members.length} member{members.length === 1 ? "" : "s"}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {visibleMembers.length > 0 ? (
          visibleMembers.map((member, index) => (
            <MemberRow key={member.id || `${department.name}-${index}`} member={member} index={index} />
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-400">
            No members found.
          </div>
        )}

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => onMore(department.name)}
            className="mt-1 rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm font-bold text-[#9a7600] transition hover:border-[#F5C518] hover:bg-[#fff7d6]"
          >
            More members ({hiddenCount})
          </button>
        )}
      </div>
    </motion.section>
  );
};

const MembersTableModal = ({ department, members, onClose }) => {
  if (!department) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 py-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{department} Members</h3>
            <p className="text-sm text-gray-500">{members.length} member{members.length === 1 ? "" : "s"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:bg-gray-50 hover:text-gray-900"
            aria-label="Close members table"
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead className="sticky top-0 z-10 bg-[#f0f0ee]">
              <tr>
                {["Member", "Role", "Email", "Phone", "Joined", "Status"].map((header) => (
                  <th
                    key={header}
                    className="px-5 py-3 text-left text-[12px] font-semibold text-[#111111]"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-t border-gray-100 hover:bg-[#fffdf3]">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <MemberAvatar member={member} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-gray-900">{member.name || "Unnamed member"}</p>
                        <p className="truncate text-xs text-gray-400">{member.department}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">{member.role || "Team member"}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{member.email || "-"}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{member.phone || "-"}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{formatDate(member.joined_date)}</td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-600">
                      {member.status || "Active"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

const DepartmentMemberColumns = () => {
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState("");
  const [openDepartment, setOpenDepartment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/departments/members`);
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.error || "Unable to load members.");
        }

        setMembers(Array.isArray(json.data) ? json.data : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, []);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return members;

    return members.filter((member) =>
      [member.name, member.email, member.phone, member.role, member.department]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [members, search]);

  const membersByDepartment = useMemo(() => {
    return DEPARTMENTS.reduce((groups, department) => {
      groups[department.name] = filteredMembers.filter(
        (member) => String(member.department || "").toLowerCase() === department.name.toLowerCase()
      );
      return groups;
    }, {});
  }, [filteredMembers]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {DEPARTMENTS.map((department) => (
          <div key={department.name} className="h-[280px] rounded-2xl border border-gray-200 bg-white p-4 shadow-sm animate-pulse">
            <div className="mb-5 h-9 w-32 rounded-lg bg-gray-100" />
            <div className="space-y-3">
              <div className="h-20 rounded-xl bg-gray-100" />
              <div className="h-20 rounded-xl bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">
        Failed to load department members: {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Department Members</h2>
          <p className="text-sm text-gray-500">{filteredMembers.length} of {members.length} members shown</p>
        </div>

        <div className="relative w-full sm:w-72">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search members..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {DEPARTMENTS.map((department) => (
          <DepartmentColumn
            key={department.name}
            department={department}
            members={membersByDepartment[department.name] || []}
            onMore={setOpenDepartment}
          />
        ))}
      </div>

      <MembersTableModal
        department={openDepartment}
        members={membersByDepartment[openDepartment] || []}
        onClose={() => setOpenDepartment(null)}
      />
    </div>
  );
};

export default DepartmentMemberColumns;
