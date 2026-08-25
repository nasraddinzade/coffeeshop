// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

import { useMemo } from 'react';
import { profitAndLoss, reportForDay, reportForMonth } from '../lib/reports';
import { money } from '../lib/utils';
import { useStore } from '../store/useStore';

export function FinanceSection() {
  const orders = useStore((state) => state.db.orders);

  const { today, month, rows } = useMemo(() => {
    const now = new Date();
    return {
      today: reportForDay(orders),
      month: reportForMonth(orders, now.getFullYear(), now.getMonth()),
      rows: profitAndLoss(orders, 7),
    };
  }, [orders]);

  return (
    <>
      <div className="finance-overview">
        <div className="finance-card">
          <h4>Today</h4>
          <div className="finance-value">{money(today.revenue)}</div>
          <div className="finance-label">Revenue</div>
        </div>
        <div className="finance-card">
          <h4>Today</h4>
          <div className="finance-value">{money(today.profit)}</div>
          <div className="finance-label">Profit</div>
        </div>
        <div className="finance-card">
          <h4>This Month</h4>
          <div className="finance-value">{money(month.revenue)}</div>
          <div className="finance-label">Revenue</div>
        </div>
        <div className="finance-card">
          <h4>This Month</h4>
          <div className="finance-value">{money(month.profit)}</div>
          <div className="finance-label">Profit</div>
        </div>
      </div>

      <div className="p-l-details">
        <h4>Profit &amp; Loss Statement</h4>
        <div className="p-l-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Revenue</th>
                <th>Cost Price</th>
                <th>Profit</th>
                <th>Margin</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.day}>
                  <td>{row.label}</td>
                  <td>{money(row.revenue)}</td>
                  <td>{money(row.cost)}</td>
                  <td>{money(row.profit)}</td>
                  <td>{row.margin.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
