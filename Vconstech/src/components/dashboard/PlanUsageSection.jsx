import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#F5D547", "#4F6BED", "#1DB954", "#FF4D6D", "#A855F7"];

const formatLeadChannel = (value) => {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized) return null;
  if (normalized.includes("gmail")) return "Gmail";
  if (normalized.includes("email")) return "Email";

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
};

export default function PlanUsageSection({ customers = [], leads = [] }) {
  const planRows = customers.length ? customers : leads;
  const total = planRows.length;

  // ───────── PLAN (BAR) ─────────
  const planMap = {};

  planRows.forEach((item) => {
    const plan = (item.subscription_plan || item.plan || "unknown").trim().toLowerCase();
    planMap[plan] = (planMap[plan] || 0) + 1;
  });

  const plans = Object.keys(planMap).map((key, i) => ({
    label: key,
    percent: total ? Math.round((planMap[key] / total) * 100) : 0,
  }));

  // ───────── CHANNEL (PIE) ─────────
  const channelMap = {};

  leads.forEach((lead) => {
    const channel = formatLeadChannel(lead.channel);
    if (!channel) return;

    channelMap[channel] = (channelMap[channel] || 0) + 1;
  });

  const channelTotal = Object.values(channelMap).reduce((sum, count) => sum + count, 0);

  const chartData = Object.keys(channelMap).map((key, i) => ({
    name: key,
    value: channelTotal ? Math.round((channelMap[key] / channelTotal) * 100) : 0,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.9fr] gap-4">

      {/* PLAN BAR */}
      <motion.div
        whileHover={{ y: -2 }}
        className="bg-white border rounded-2xl p-4"
      >
        <h2 className="font-semibold mb-4">Plan Usage</h2>

       {plans.map((plan, i) => (
  <div key={plan.label} className="mb-4">
    <div className="flex justify-between mb-1">
      <span className="text-sm text-gray-600 capitalize">
        {plan.label}
      </span>

      <span className="text-sm font-medium text-gray-700">
        {plan.percent}%
      </span>
    </div>

    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${plan.percent}%` }}
        transition={{ duration: 0.8, delay: i * 0.1 }}
        className="h-full bg-yellow-400"
      />
    </div>
  </div>
))}
      </motion.div>

      {/* PIE CHART */}
      <motion.div
        whileHover={{ y: -2 }}
        className="bg-white border rounded-2xl p-4"
      >
        <h2 className="font-semibold mb-4">Lead Channels</h2>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">

          {/* LEGEND */}
          <div className="min-w-[120px]">
            {chartData.length ? chartData.map((item) => (
              <div key={item.name} className="flex items-center gap-2 mb-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm">{item.name}</span>
                <span className="text-xs text-gray-400">
                  {item.value}%
                </span>
              </div>
            )) : (
              <p className="text-sm text-gray-400">No channel data</p>
            )}
          </div>

          {/* PIE */}
          <div className="h-[180px] min-w-0 flex-1">
            <ResponsiveContainer width="100%" height={180} minWidth={0} minHeight={1}>
              <PieChart>
                <Pie
  data={chartData}
  dataKey="value"
  innerRadius="40%"
  outerRadius="70%"
  stroke="none"
   labelLine={false}
  label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
    const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
    

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={9}
        fontWeight={600}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  }}
>
  {chartData.map((entry, i) => (
    <Cell key={i} fill={entry.color} />
  ))}
</Pie>
                <Tooltip formatter={(v) => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
