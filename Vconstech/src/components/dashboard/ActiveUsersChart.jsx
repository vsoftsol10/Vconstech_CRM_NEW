import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import { motion } from "framer-motion";


const CustomTooltip = ({
  active,
  payload,
  label,
}) => {
  if (
    active &&
    payload &&
    payload.length
  ) {
    return (
      <div className="
        bg-[#1E1E1E]
        rounded-xl
        px-3
        py-2
        shadow-xl
        border
        border-[#2d2d2d]
        min-w-[90px]
      ">

        <p className="
          text-white
          text-[13px]
          font-semibold
          mb-[2px]
        ">
          {label}
        </p>

        <p className="
          text-[#F5C518]
          text-[12px]
          font-medium
        ">
          Users : {payload[0].value}
        </p>

      </div>
    );
  }

  return null;
};

const ActiveUsersChart = ({ data = [], selectedYear, yearOptions = [], onYearChange }) => {
  const hasData = data.length > 0;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="
        bg-white
        border
        border-gray-200
        rounded-2xl
        p-4
        shadow-sm
        transition-all
        duration-300
      "
    >

      {/* Header */}
      <div className="
        flex
        items-center
        justify-between
        mb-6
      ">

        <h2 className="
          text-[18px]
          font-semibold
          text-[#111111]
        ">
          Active Users Over Time
        </h2>

        <select
          value={selectedYear}
          onChange={(event) => onYearChange?.(Number(event.target.value))}
          className="
          border
          border-yellow-300
          text-gray-700
          text-sm
          px-4
          py-2
          rounded-lg
          bg-white
          hover:bg-[#FFF9E0]
          focus:border-[#F5C518]
          outline-none
          transition-all
          duration-300
        "
        >
          {yearOptions.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>

      </div>

      {/* Chart */}
      <div className="
        w-full
        min-w-0
        h-[300px]
      ">

        {!hasData ? (
          <div className="flex h-full items-center justify-center text-sm font-medium text-gray-400">
            No records found for this year
          </div>
        ) : (
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          minHeight={1}
        >

          <LineChart
            data={data}
           
            margin={{ top: 10, right: 8, left: -20, bottom: 0 }}
          >

            {/* Grid */}
            <CartesianGrid
              stroke="#f1f1f1"
              vertical={false}
            />

            {/* X Axis */}
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{
                fontSize: 12,
                fill: "#8a8a8a",
              }}
            />

            {/* Y Axis */}
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{
                fontSize: 12,
                fill: "#8a8a8a",
              }}
              domain={[0, 200]}
              ticks={[50, 100, 150, 200]}
            />

            {/* Tooltip */}
            <Tooltip
              content={<CustomTooltip />}
              cursor={{
                stroke: "#d4d4d4",
                strokeWidth: 1,
              }}
            />

            {/* Line */}
            <Line
              type="monotone"
              dataKey="users"
              stroke="#EAB308"
              strokeWidth={2.5}
              dot={{
                r: 5,
                fill: "#ffffff",
                stroke: "#EAB308",
                strokeWidth: 2,
              }}
              activeDot={{
                r: 6,
                fill: "#EAB308",
                stroke: "#ffffff",
                strokeWidth: 2,
              }}
              animationDuration={1500}
            />

          </LineChart>

        </ResponsiveContainer>
        )}

      </div>

    </motion.div>
  );
};

export default ActiveUsersChart;
