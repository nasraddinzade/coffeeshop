// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

export type Role = 'admin' | 'barista1' | 'barista2';

export type PaymentMethod = 'cash' | 'card';

/** `created` — rung up in Sales, `completed` — finished in Orders. */
export type OrderStatus = 'created' | 'edited' | 'completed' | 'cancelled';

export interface User {
  id: string;
  name: string;
  login: string;
  /** SHA-256 hex digest, never plain text. */
  password: string;
  role: Role;
  color: string;
  createdAt: string;
}

/** A user without the password digest — what the session keeps in memory. */
export type SafeUser = Omit<User, 'password'>;

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface ResourceUsage {
  resourceId: string;
  /** How much of the resource one sold unit consumes. */
  quantityPerUnit: number;
}

export interface ProductSize {
  size: string;
  cost: number;
  price: number;
  resourceUsage: ResourceUsage[];
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  sizes: ProductSize[];
  baseCost: number;
  basePrice: number;
}

export type ResourceUnit = 'L' | 'ml' | 'kg' | 'g' | 'pcs';

export interface Resource {
  id: string;
  name: string;
  unit: ResourceUnit;
  currentQuantity: number;
}

/** `value` is `'0'`, a percentage `'1'`–`'100'`, `'free'` or `'subscription'`. */
export interface Discount {
  id: string;
  value: string;
  label: string;
  order: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  categoryId?: string;
  categoryName?: string;
  size: string;
  quantity: number;
  /** Unit price after comment surcharges and discount. */
  price: number;
  cost: number;
  comment: string;
  discount: string;
  subscription?: string;
  total: number;
}

export interface Order {
  id: string;
  date: string;
  userId: string;
  userName: string;
  userRole: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  createdAt?: string;
  editedAt?: string;
  editedBy?: string;
  editedByName?: string;
}

export type HistoryAction = 'create' | 'edit' | 'delete';

export interface HistoryEntry {
  id: string;
  orderId: string;
  action: HistoryAction;
  userId: string;
  userName: string;
  userRole: string;
  changes: string;
  timestamp: string;
}

export interface Database {
  version: number;
  users: User[];
  categories: Category[];
  products: Product[];
  orders: Order[];
  resources: Resource[];
  discounts: Discount[];
  history: HistoryEntry[];
}

export type Section =
  | 'sales'
  | 'orders'
  | 'products'
  | 'categories'
  | 'discounts'
  | 'resources'
  | 'finance'
  | 'reports'
  | 'users'
  | 'backup';

export type NotificationType = 'info' | 'success' | 'error' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: NotificationType;
}
