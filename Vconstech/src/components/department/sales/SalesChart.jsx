import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";

const SalesChart = ({ data = [], loading = false }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: 0.1 }}
    className="min-w-0 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm"
  >
    <h2 className="text-[16px] font-bold text-[#111111] mb-5">Sales Performance</h2>

    {loading ? (
      <div className="h-[280px] rounded-xl bg-gray-50 animate-pulse" />
    ) : data.length > 0 ? (
      <ResponsiveContainer width="100%" height={280} minWidth={0} minHeight={1}>
        <BarChart
          data={data}
          margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
          barSize={60}
        >
          <CartesianGrid vertical={false} stroke="#f0f0f0" />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 13, fill: "#888" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#aaa" }}
            allowDecimals={false}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color || "#F5C518"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    ) : (
      <div className="h-[280px] flex items-center justify-center text-sm text-gray-400">
        No sales performance data.
      </div>
    )}
  </motion.div>
);

export default SalesChart;
