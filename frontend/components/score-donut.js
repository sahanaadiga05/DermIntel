"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const COLORS = {
  high: "#1b5e20",
  medium: "#f0c05b",
  low: "#ff8b61",
  track: "rgba(16, 35, 26, 0.08)"
};

function getTone(value) {
  if (value >= 75) {
    return COLORS.high;
  }

  if (value >= 50) {
    return COLORS.medium;
  }

  return COLORS.low;
}

export function ScoreDonut({ value, size = 152 }) {
  const safeValue = Math.max(0, Math.min(100, value));
  const data = [
    { name: "score", value: safeValue },
    { name: "remaining", value: 100 - safeValue }
  ];
  const outerRadius = Math.round(size * 0.45);
  const innerRadius = Math.round(size * 0.32);

  return (
    <div className="relative transition-transform duration-300" style={{ height: size, width: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            startAngle={90}
            endAngle={-270}
            stroke="none"
          >
            <Cell fill={getTone(safeValue)} />
            <Cell fill={COLORS.track} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold text-ink sm:text-[2rem]">{safeValue}</span>
        <span className="text-[10px] uppercase tracking-[0.28em] text-pine/60">Score</span>
      </div>
    </div>
  );
}
