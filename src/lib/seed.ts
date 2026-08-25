// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

import type { Database, Discount, User } from '../types';
import { hashPassword } from './backend';

export const DATABASE_VERSION = 2;

export function emptyDatabase(): Database {
  return {
    version: DATABASE_VERSION,
    users: [],
    categories: [],
    products: [],
    orders: [],
    resources: [],
    discounts: [],
    history: [],
  };
}

export const DEFAULT_DISCOUNTS: Discount[] = [
  { id: 'd0', value: '0', label: 'No discount', order: 0 },
  { id: 'd1', value: '20', label: '-20%', order: 1 },
  { id: 'd2', value: '25', label: '-25%', order: 2 },
  { id: 'd3', value: '30', label: '-30%', order: 3 },
  { id: 'd4', value: '40', label: '-40%', order: 4 },
  { id: 'd5', value: '50', label: '-50%', order: 5 },
  { id: 'd6', value: 'free', label: 'Free', order: 6 },
  { id: 'd7', value: 'subscription', label: 'Subscription', order: 7 },
];

/**
 * Accounts created on a fresh install. They exist so the app is usable out of
 * the box — the README tells operators to change these passwords immediately.
 */
const DEFAULT_ACCOUNTS: Array<Omit<User, 'password' | 'createdAt'> & { plainPassword: string }> = [
  { id: '1', name: 'Barista 1', login: 'barista1', role: 'barista1', color: '#4CAF50', plainPassword: '123' },
  { id: '2', name: 'Barista 2', login: 'barista2', role: 'barista2', color: '#2196F3', plainPassword: '123' },
  { id: '3', name: 'Administrator', login: 'admin', role: 'admin', color: '#FF9800', plainPassword: 'admin123' },
];

export async function seedDatabase(): Promise<Database> {
  const createdAt = new Date().toISOString();

  const users: User[] = await Promise.all(
    DEFAULT_ACCOUNTS.map(async ({ plainPassword, ...account }) => ({
      ...account,
      password: await hashPassword(plainPassword),
      createdAt,
    })),
  );

  return { ...emptyDatabase(), users, discounts: [...DEFAULT_DISCOUNTS] };
}

/** Fills in anything a stored or imported document is missing. */
export function normalizeDatabase(input: Partial<Database> | null | undefined): Database {
  const base = emptyDatabase();
  if (!input) return base;

  return {
    version: DATABASE_VERSION,
    users: Array.isArray(input.users) ? input.users : base.users,
    categories: Array.isArray(input.categories) ? input.categories : base.categories,
    products: Array.isArray(input.products)
      ? input.products.map((product) => ({
          ...product,
          sizes: Array.isArray(product.sizes)
            ? product.sizes.map((size) => ({ ...size, resourceUsage: size.resourceUsage ?? [] }))
            : [],
        }))
      : base.products,
    orders: Array.isArray(input.orders)
      ? input.orders.map((order) => ({ ...order, items: Array.isArray(order.items) ? order.items : [] }))
      : base.orders,
    resources: Array.isArray(input.resources) ? input.resources : base.resources,
    discounts: Array.isArray(input.discounts) && input.discounts.length
      ? [...input.discounts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      : [...DEFAULT_DISCOUNTS],
    history: Array.isArray(input.history) ? input.history : base.history,
  };
}
