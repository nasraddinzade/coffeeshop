// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

import type { Category, Order } from '../types';
import { round2, toDateInputValue } from './utils';

export interface PeriodReport {
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  ordersCount: number;
}

export interface DailyRow extends PeriodReport {
  day: string;
  label: string;
}

export interface ProductStat {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface CategoryStat {
  id: string;
  name: string;
  color: string;
  revenue: number;
  profit: number;
  itemsCount: number;
  margin: number;
}

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
  hint?: string;
}

/** Cancelled orders never count towards money figures. */
const counts = (order: Order) => order.status !== 'cancelled';

function summarize(orders: Order[]): PeriodReport {
  let revenue = 0;
  let cost = 0;

  for (const order of orders) {
    revenue += Number(order.total) || 0;
    for (const item of order.items ?? []) {
      cost += (Number(item.cost) || 0) * (Number(item.quantity) || 1);
    }
  }

  revenue = round2(revenue);
  cost = round2(cost);
  const profit = round2(revenue - cost);

  return {
    revenue,
    cost,
    profit,
    margin: revenue > 0 ? round2((profit / revenue) * 100) : 0,
    ordersCount: orders.length,
  };
}

export function reportForDay(orders: Order[], day = toDateInputValue(new Date())): PeriodReport {
  return summarize(
    orders.filter((order) => counts(order) && toDateInputValue(new Date(order.date)) === day),
  );
}

export function reportForMonth(orders: Order[], year: number, month: number): PeriodReport {
  return summarize(
    orders.filter((order) => {
      if (!counts(order)) return false;
      const date = new Date(order.date);
      return date.getFullYear() === year && date.getMonth() === month;
    }),
  );
}

/** Profit & loss for the last `days` days, oldest first. */
export function profitAndLoss(orders: Order[], days = 7): DailyRow[] {
  const rows: DailyRow[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const day = toDateInputValue(date);
    rows.push({ day, label: date.toLocaleDateString(), ...reportForDay(orders, day) });
  }

  return rows;
}

export function topProducts(orders: Order[], limit = 5): ProductStat[] {
  const stats = new Map<string, ProductStat>();

  for (const order of orders.filter(counts)) {
    for (const item of order.items ?? []) {
      const stat = stats.get(item.productId) ?? {
        productId: item.productId,
        name: item.productName,
        quantity: 0,
        revenue: 0,
      };
      stat.quantity += Number(item.quantity) || 0;
      stat.revenue += (Number(item.price) || 0) * (Number(item.quantity) || 0);
      stats.set(item.productId, stat);
    }
  }

  return [...stats.values()].sort((a, b) => b.quantity - a.quantity).slice(0, limit);
}

export type Period = 'today' | 'month' | 'all';

function inPeriod(order: Order, period: Period): boolean {
  if (period === 'all') return true;
  const date = new Date(order.date);
  const now = new Date();
  if (period === 'today') return toDateInputValue(date) === toDateInputValue(now);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function topCategories(
  orders: Order[],
  categories: Category[],
  limit = 5,
  period: Period = 'month',
): CategoryStat[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const stats = new Map<string, CategoryStat>();

  for (const order of orders.filter((order) => counts(order) && inPeriod(order, period))) {
    for (const item of order.items ?? []) {
      const category = item.categoryId ? byId.get(item.categoryId) : undefined;
      if (!category) continue;

      const stat = stats.get(category.id) ?? {
        id: category.id,
        name: category.name,
        color: category.color || '#4CAF50',
        revenue: 0,
        profit: 0,
        itemsCount: 0,
        margin: 0,
      };

      const quantity = Number(item.quantity) || 1;
      const revenue = (Number(item.price) || 0) * quantity;
      const cost = (Number(item.cost) || 0) * quantity;

      stat.revenue += revenue;
      stat.profit += revenue - cost;
      stat.itemsCount += quantity;
      stats.set(category.id, stat);
    }
  }

  return [...stats.values()]
    .map((stat) => ({
      ...stat,
      revenue: round2(stat.revenue),
      profit: round2(stat.profit),
      margin: stat.revenue > 0 ? round2((stat.profit / stat.revenue) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function salesByWeekday(orders: Order[]): BarDatum[] {
  const totals = WEEKDAYS.map(() => 0);

  for (const order of orders.filter(counts)) {
    totals[new Date(order.date).getDay()] += Number(order.total) || 0;
  }

  return WEEKDAYS.map((label, index) => ({ label, value: round2(totals[index]) }));
}

export function salesByHour(orders: Order[]): BarDatum[] {
  const totals = Array.from({ length: 24 }, () => 0);

  for (const order of orders.filter(counts)) {
    totals[new Date(order.date).getHours()] += Number(order.total) || 0;
  }

  return totals.map((value, hour) => ({ label: `${hour}:00`, value: round2(value) }));
}
