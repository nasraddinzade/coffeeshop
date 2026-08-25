// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

import { useMemo } from 'react';
import { BarChart } from '../components/BarChart';
import { salesByHour, salesByWeekday, topCategories, topProducts } from '../lib/reports';
import { money } from '../lib/utils';
import { useStore } from '../store/useStore';

export function ReportsSection() {
  const orders = useStore((state) => state.db.orders);
  const categories = useStore((state) => state.db.categories);

  const products = useMemo(
    () =>
      topProducts(orders, 5).map((stat) => ({
        label: stat.name,
        value: stat.quantity,
        hint: `${money(stat.revenue)} revenue`,
      })),
    [orders],
  );

  const categoryBars = useMemo(
    () =>
      topCategories(orders, categories, 5, 'month').map((stat) => ({
        label: stat.name,
        value: stat.revenue,
        color: stat.color,
        hint: `${stat.itemsCount} items · ${stat.margin.toFixed(2)}% margin`,
      })),
    [orders, categories],
  );

  const weekday = useMemo(() => salesByWeekday(orders), [orders]);
  const hourly = useMemo(() => salesByHour(orders), [orders]);

  return (
    <div className="reports-grid">
      <div className="report-card">
        <h4>Top Products</h4>
        <div className="chart-container">
          <BarChart data={products} format={(value) => `${value} pcs.`} />
        </div>
      </div>

      <div className="report-card">
        <h4>Top Categories (this month)</h4>
        <div className="chart-container">
          <BarChart data={categoryBars} format={money} emptyMessage="No category data yet" />
        </div>
      </div>

      <div className="report-card">
        <h4>Sales by Weekday</h4>
        <div className="chart-container">
          <BarChart data={weekday} format={money} />
        </div>
      </div>

      <div className="report-card">
        <h4>Sales by Hour</h4>
        <div className="chart-container">
          <BarChart data={hourly} format={money} />
        </div>
      </div>
    </div>
  );
}
