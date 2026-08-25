// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

import type { BarDatum } from '../lib/reports';

interface BarChartProps {
  data: BarDatum[];
  /** Formats the number shown at the end of each bar. */
  format: (value: number) => string;
  emptyMessage?: string;
}

/** Horizontal bars sized against the largest value in the set. */
export function BarChart({ data, format, emptyMessage = 'No data' }: BarChartProps) {
  const rows = data.filter((row) => row.value > 0);
  if (rows.length === 0) return <p className="empty-message">{emptyMessage}</p>;

  const max = Math.max(...rows.map((row) => row.value));

  return (
    <>
      {rows.map((row) => (
        <div
          key={row.label}
          className="chart-bar"
          style={{
            width: `${Math.max((row.value / max) * 100, 18)}%`,
            ...(row.color
              ? { background: row.color, borderLeft: `4px solid ${row.color}` }
              : null),
          }}
          title={row.hint}
        >
          <span style={{ flex: 1 }}>{row.label}</span>
          <span>{format(row.value)}</span>
        </div>
      ))}
    </>
  );
}
