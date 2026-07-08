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

export function ScoreDonut({ value, label }) {
  const safeValue = Math.max(0, Math.min(100, value));
  const data = [
    { name: "score", value: safeValue },
    { name: "remaining", value: 100 - safeValue }
  ];

  return (
    <div className="relative h-44 w-44">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={52}
            outerRadius={72}
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
        <span className="text-4xl font-bold text-ink">{safeValue}</span>
        <span className="text-xs uppercase tracking-[0.25em] text-pine/60">{label}</span>
      </div>
    </div>
  );
}

