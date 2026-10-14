import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { API_BASE_URL } from "../../config/api";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_OPTIONS = MONTH_NAMES.map((label, index) => ({ label, value: index + 1 }));

// colour cycle by quarter
const quarterColor = (month) => {
  if (month <= 3)  return "#F5C518";
  if (month <= 6)  return "#22c55e";
  if (month <= 9)  return "#3b82f6";
  return "#8b5cf6";
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "8px 12px", fontSize: "13px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
        <p style={{ fontWeight: 600, color: "#374151", margin: "0 0 2px 0" }}>{label}</p>
        <p style={{ color: "#6b7280", margin: 0 }}>{payload[0].value}%</p>
      </div>
    );
  }
  return null;
};

const OverPerformanceChart = () => {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear,  setSelectedYear]  = useState(now.getFullYear());
  const [years,         setYears]         = useState([now.getFullYear()]);
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    const fetchYears = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/departments/performance/years`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length) {
          setYears(json.data);
        }
      } catch {
        setYears([now.getFullYear()]);
      }
    };
    fetchYears();
  }, []);

  useEffect(() => {
    const fetchPerformance = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = `year=${selectedYear}&month=${selectedMonth}`;
        const res    = await fetch(`${API_BASE_URL}/api/departments/performance?${params}`);
        const json   = await res.json();
        if (!json.success) throw new Error(json.error);

        // aggregate by month — sum values across departments
        const byMonth = {};
        json.data.forEach(row => {
          const key = row.month;
          byMonth[key] = (byMonth[key] || 0) + (row.value || 0);
        });

        const chartData = Object.entries(byMonth)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([month, value]) => ({
            month: MONTH_NAMES[Number(month) - 1],
            value: Math.round(value),
            color: quarterColor(Number(month)),
          }));

        setData(chartData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPerformance();
  }, [selectedMonth, selectedYear]);

  return (
    <motion.div
      style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#2d3a4a", margin: 0 }}>Over All Performance</h3>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <select
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(Number(event.target.value))}
            className="h-[38px] rounded-xl border border-[#F5C518] bg-white px-3 text-[13px] font-semibold text-gray-700 outline-none transition-colors hover:bg-[#FFF9E0] focus:bg-[#FFF9E0]"
          >
            {MONTH_OPTIONS.map((month) => (
              <option key={month.value} value={month.value}>{month.label}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
            className="h-[38px] rounded-xl border border-[#F5C518] bg-white px-3 text-[13px] font-semibold text-gray-700 outline-none transition-colors hover:bg-[#FFF9E0] focus:bg-[#FFF9E0]"
          >
            {years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* States */}
      {loading && (
        <div style={{ height: "220px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: "32px", height: "32px", border: "3px solid #f1f5f9", borderTop: "3px solid #F5C518", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {error && !loading && (
        <div style={{ height: "220px", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", fontSize: "13px" }}>
          Failed to load: {error}
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <div style={{ height: "220px", display: "flex", alignItems: "center", justifyContent: "center", color: "#a0aec0", fontSize: "13px" }}>
          No performance data for this period.
        </div>
      )}

      {!loading && !error && data.length > 0 && (
        <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={1}>
          <BarChart data={data} barCategoryGap="45%" barGap={4}>
            <CartesianGrid vertical={false} stroke="#f0f0f0" strokeDasharray="0" />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#b0bac8" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#b0bac8" }}
              domain={[0, 100]}
              ticks={[0, 10, 20, 30,50, 70, 100]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(245,197,24,0.06)" }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={24}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
};

export default OverPerformanceChart;
