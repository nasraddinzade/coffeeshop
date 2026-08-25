// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

/**
 * Export and import of the whole dataset.
 *
 * Two formats are supported:
 *  - `.xlsx` — one sheet per entity, meant for humans;
 *  - `.json` — a faithful dump, meant for backups and migration. Exports
 *    produced by earlier versions of the app are recognised as well.
 */

import type { Workbook } from 'exceljs';
import type {
  Category,
  Database,
  Discount,
  Order,
  Product,
  Resource,
  ResourceUnit,
  Role,
  User,
} from '../types';
import { hashPassword } from './backend';
import { normalizeDatabase } from './seed';
import { newId, parseNumber, round2 } from './utils';

export type ExportType = 'full' | 'orders' | 'products' | 'users';
export type ExportFormat = 'excel' | 'json';
export type ImportMode = 'append' | 'merge' | 'replace';

export interface ImportCounters {
  added: number;
  updated: number;
  skipped: number;
}

export type ImportSummary = Record<string, ImportCounters>;

export interface ImportPreview {
  description: string;
  statistics: Record<string, number>;
}

const SHA256_HEX = /^[a-f0-9]{64}$/i;
const DEFAULT_IMPORT_PASSWORD = '123';

const emptyCounters = (): ImportCounters => ({ added: 0, updated: 0, skipped: 0 });

/* ------------------------------------------------------------------ export */

/** Users are always exported without their password digests. */
function safeUsers(users: User[]): Omit<User, 'password'>[] {
  return users.map(({ password: _password, ...rest }) => rest);
}

export function buildJsonExport(database: Database, type: ExportType): unknown {
  const meta = {
    app: 'CoffeeShop POS',
    version: '2.0',
    exportDate: new Date().toISOString(),
    type,
  };

  switch (type) {
    case 'orders':
      return { ...meta, data: { orders: database.orders, history: database.history } };
    case 'products':
      return { ...meta, data: { categories: database.categories, products: database.products } };
    case 'users':
      return { ...meta, data: { users: safeUsers(database.users) } };
    case 'full':
    default:
      return {
        ...meta,
        data: {
          users: safeUsers(database.users),
          categories: database.categories,
          products: database.products,
          orders: database.orders,
          resources: database.resources,
          discounts: database.discounts,
          history: database.history,
        },
      };
  }
}

export function jsonBytes(payload: unknown, pretty = true): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(payload, null, pretty ? 2 : 0));
}

function addSheet<T extends object>(
  workbook: Workbook,
  name: string,
  columns: Array<{ header: string; key: string; width?: number }>,
  rows: T[],
): void {
  if (rows.length === 0) return;
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns.map((column) => ({ ...column, width: column.width ?? 18 }));
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));
}

export async function buildExcelExport(
  database: Database,
  type: ExportType,
): Promise<Uint8Array> {
  // Loaded on demand: ExcelJS is by far the heaviest dependency and most
  // sessions never touch import/export.
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CoffeeShop POS';
  workbook.created = new Date();

  const wantsUsers = type === 'full' || type === 'users';
  const wantsCatalog = type === 'full' || type === 'products';
  const wantsOrders = type === 'full' || type === 'orders';

  if (wantsUsers) {
    addSheet(
      workbook,
      'Users',
      [
        { header: 'ID', key: 'id' },
        { header: 'Name', key: 'name' },
        { header: 'Login', key: 'login' },
        { header: 'Role', key: 'role' },
        { header: 'Color', key: 'color' },
        { header: 'Created At', key: 'createdAt' },
      ],
      safeUsers(database.users),
    );
  }

  if (wantsCatalog) {
    addSheet(
      workbook,
      'Categories',
      [
        { header: 'ID', key: 'id' },
        { header: 'Name', key: 'name' },
        { header: 'Color', key: 'color' },
      ],
      database.categories,
    );

    const productRows = database.products.flatMap((product) =>
      (product.sizes.length ? product.sizes : [{ size: 'Standard', cost: product.baseCost, price: product.basePrice }]).map(
        (size) => ({
          productId: product.id,
          productName: product.name,
          categoryId: product.categoryId,
          size: size.size,
          cost: size.cost,
          price: size.price,
        }),
      ),
    );

    addSheet(
      workbook,
      'Products',
      [
        { header: 'Product ID', key: 'productId' },
        { header: 'Product Name', key: 'productName' },
        { header: 'Category ID', key: 'categoryId' },
        { header: 'Size', key: 'size' },
        { header: 'Cost Price', key: 'cost' },
        { header: 'Sale Price', key: 'price' },
      ],
      productRows,
    );
  }

  if (type === 'full') {
    addSheet(
      workbook,
      'Resources',
      [
        { header: 'ID', key: 'id' },
        { header: 'Name', key: 'name' },
        { header: 'Unit', key: 'unit' },
        { header: 'Quantity', key: 'currentQuantity' },
      ],
      database.resources,
    );

    addSheet(
      workbook,
      'Discounts',
      [
        { header: 'ID', key: 'id' },
        { header: 'Value', key: 'value' },
        { header: 'Label', key: 'label' },
        { header: 'Order', key: 'order' },
      ],
      database.discounts,
    );
  }

  if (wantsOrders) {
    const orderRows = database.orders.flatMap((order) =>
      (order.items ?? []).map((item) => ({
        orderId: order.id,
        date: order.date,
        status: order.status,
        payment: order.paymentMethod,
        total: order.total,
        cashierId: order.userId,
        cashierName: order.userName,
        productId: item.productId,
        productName: item.productName,
        categoryId: item.categoryId ?? '',
        size: item.size,
        quantity: item.quantity,
        price: item.price,
        cost: item.cost,
        comment: item.comment,
        discount: item.discount,
        itemTotal: item.total,
      })),
    );

    addSheet(
      workbook,
      'Orders',
      [
        { header: 'Order ID', key: 'orderId' },
        { header: 'Date', key: 'date', width: 24 },
        { header: 'Status', key: 'status' },
        { header: 'Payment', key: 'payment' },
        { header: 'Total', key: 'total' },
        { header: 'Cashier ID', key: 'cashierId' },
        { header: 'Cashier Name', key: 'cashierName' },
        { header: 'Product ID', key: 'productId' },
        { header: 'Product Name', key: 'productName' },
        { header: 'Category ID', key: 'categoryId' },
        { header: 'Size', key: 'size' },
        { header: 'Quantity', key: 'quantity' },
        { header: 'Unit Price', key: 'price' },
        { header: 'Cost', key: 'cost' },
        { header: 'Comment', key: 'comment', width: 28 },
        { header: 'Discount', key: 'discount' },
        { header: 'Item Total', key: 'itemTotal' },
      ],
      orderRows,
    );
  }

  addSheet(
    workbook,
    'Summary',
    [
      { header: 'Export Date', key: 'exportDate', width: 24 },
      { header: 'Users', key: 'users' },
      { header: 'Categories', key: 'categories' },
      { header: 'Products', key: 'products' },
      { header: 'Orders', key: 'orders' },
      { header: 'Revenue', key: 'revenue' },
      { header: 'Note', key: 'note', width: 46 },
    ],
    [
      {
        exportDate: new Date().toLocaleString(),
        users: database.users.length,
        categories: database.categories.length,
        products: database.products.length,
        orders: database.orders.length,
        revenue: round2(database.orders.reduce((sum, order) => sum + (order.total || 0), 0)),
        note: 'Passwords are never exported.',
      },
    ],
  );

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

/* ------------------------------------------------------------------ import */

type Row = Record<string, unknown>;

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const rich = value as { text?: string; result?: unknown };
    if (typeof rich.text === 'string') return rich.text;
    if (rich.result !== undefined) return String(rich.result);
    if (value instanceof Date) return value.toISOString();
  }
  return String(value).trim();
}

/** Reads a sheet into plain objects keyed by the header row. */
function sheetRows(workbook: Workbook, name: string): Row[] {
  const sheet = workbook.getWorksheet(name);
  if (!sheet) return [];

  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, column) => {
    headers[column] = cellText(cell.value);
  });

  const rows: Row[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const entry: Row = {};
    row.eachCell((cell, column) => {
      const header = headers[column];
      if (header) entry[header] = cell.value;
    });
    if (Object.keys(entry).length) rows.push(entry);
  });

  return rows;
}

/** A payload ready to be merged into the database. */
export interface ImportPayload {
  users?: Partial<User>[];
  categories?: Partial<Category>[];
  products?: Partial<Product>[];
  orders?: Partial<Order>[];
  resources?: Partial<Resource>[];
  discounts?: Partial<Discount>[];
  history?: Database['history'];
}

export function parseJsonPayload(raw: unknown): ImportPayload {
  if (!raw || typeof raw !== 'object') throw new Error('Unsupported JSON structure');

  // Full export, in both the current and the legacy shape.
  const wrapper = raw as { data?: unknown; type?: string };
  if (wrapper.data && typeof wrapper.data === 'object' && !Array.isArray(wrapper.data)) {
    return wrapper.data as ImportPayload;
  }
  if (wrapper.type === 'orders' && Array.isArray(wrapper.data)) {
    return { orders: wrapper.data as Partial<Order>[] };
  }

  const flat = raw as ImportPayload;
  if (flat.users || flat.categories || flat.products || flat.orders || flat.resources) {
    return flat;
  }

  // A bare array — guess the entity from the first element.
  if (Array.isArray(raw)) {
    const first = (raw[0] ?? {}) as Record<string, unknown>;
    if ('login' in first) return { users: raw as Partial<User>[] };
    if ('items' in first) return { orders: raw as Partial<Order>[] };
    if ('categoryId' in first) return { products: raw as Partial<Product>[] };
    if ('currentQuantity' in first) return { resources: raw as Partial<Resource>[] };
    if ('color' in first) return { categories: raw as Partial<Category>[] };
  }

  throw new Error('Unknown JSON data format');
}

export function parseExcelPayload(workbook: Workbook): ImportPayload {
  const categories: Partial<Category>[] = sheetRows(workbook, 'Categories')
    .map((row) => ({
      id: cellText(row['ID']) || undefined,
      name: cellText(row['Name']),
      color: cellText(row['Color']) || '#4CAF50',
    }))
    .filter((category) => Boolean(category.name));

  const productsBySignature = new Map<string, Partial<Product>>();
  for (const row of sheetRows(workbook, 'Products')) {
    const name = cellText(row['Product Name']);
    const categoryId = cellText(row['Category ID']);
    if (!name || !categoryId) continue;

    const signature = `${name}|${categoryId}`;
    const product = productsBySignature.get(signature) ?? {
      id: cellText(row['Product ID']) || undefined,
      name,
      categoryId,
      sizes: [],
    };
    product.sizes?.push({
      size: cellText(row['Size']) || 'Standard',
      cost: parseNumber(cellText(row['Cost Price'])),
      price: parseNumber(cellText(row['Sale Price'])),
      resourceUsage: [],
    });
    productsBySignature.set(signature, product);
  }

  const users: Partial<User>[] = sheetRows(workbook, 'Users')
    .map((row) => ({
      id: cellText(row['ID']) || undefined,
      name: cellText(row['Name']),
      login: cellText(row['Login']).toLowerCase(),
      role: (cellText(row['Role']) || 'barista1') as Role,
      color: cellText(row['Color']) || '#4CAF50',
      createdAt: cellText(row['Created At']) || new Date().toISOString(),
    }))
    .filter((user) => Boolean(user.name && user.login));

  const resources: Partial<Resource>[] = sheetRows(workbook, 'Resources')
    .map((row) => ({
      id: cellText(row['ID']) || undefined,
      name: cellText(row['Name']),
      unit: (cellText(row['Unit']) || 'L') as ResourceUnit,
      currentQuantity: parseNumber(cellText(row['Quantity'])),
    }))
    .filter((resource) => Boolean(resource.name));

  const discounts: Partial<Discount>[] = sheetRows(workbook, 'Discounts')
    .map((row, index) => ({
      id: cellText(row['ID']) || undefined,
      value: cellText(row['Value']) || '0',
      label: cellText(row['Label']),
      order: Number(cellText(row['Order'])) || index,
    }))
    .filter((discount) => Boolean(discount.label));

  const ordersById = new Map<string, Partial<Order>>();
  for (const row of sheetRows(workbook, 'Orders')) {
    const orderId = cellText(row['Order ID']);
    if (!orderId) continue;

    const order = ordersById.get(orderId) ?? {
      id: orderId,
      date: cellText(row['Date']) || new Date().toISOString(),
      status: (cellText(row['Status']) || 'completed') as Order['status'],
      paymentMethod: cellText(row['Payment']) === 'card' ? 'card' : 'cash',
      userId: cellText(row['Cashier ID']) || 'imported',
      userName: cellText(row['Cashier Name']) || 'Imported',
      userRole: '',
      items: [],
      total: 0,
    };

    const quantity = Number(parseNumber(cellText(row['Quantity']))) || 1;
    const price = parseNumber(cellText(row['Unit Price']));
    const itemTotal = parseNumber(cellText(row['Item Total'])) || price * quantity;

    order.items?.push({
      id: newId(),
      productId: cellText(row['Product ID']),
      productName: cellText(row['Product Name']),
      categoryId: cellText(row['Category ID']) || undefined,
      size: cellText(row['Size']),
      quantity,
      price,
      cost: parseNumber(cellText(row['Cost'])),
      comment: cellText(row['Comment']),
      discount: cellText(row['Discount']) || '0',
      total: itemTotal,
    });
    order.total = round2((order.total ?? 0) + itemTotal);
    ordersById.set(orderId, order);
  }

  return {
    categories,
    products: [...productsBySignature.values()],
    users,
    resources,
    discounts,
    orders: [...ordersById.values()],
  };
}

export async function readWorkbook(bytes: Uint8Array): Promise<Workbook> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const copy = new Uint8Array(bytes);
  await workbook.xlsx.load(copy.buffer as ArrayBuffer);
  return workbook;
}

export function describePayload(payload: ImportPayload): ImportPreview {
  const statistics: Record<string, number> = {};
  const add = (label: string, list?: unknown[]) => {
    if (list?.length) statistics[label] = list.length;
  };

  add('Users', payload.users);
  add('Categories', payload.categories);
  add('Products', payload.products);
  add('Orders', payload.orders);
  add('Resources', payload.resources);
  add('Discounts', payload.discounts);
  add('History entries', payload.history);

  const kinds = Object.keys(statistics);
  const description =
    kinds.length === 0
      ? 'Nothing recognised in this file'
      : kinds.length > 2
        ? 'Full data set'
        : kinds.join(' and ');

  return { description, statistics };
}

/** Merges a payload into the database. Returns a fresh database — no mutation. */
export async function applyImport(
  current: Database,
  payload: ImportPayload,
  mode: ImportMode,
): Promise<{ database: Database; summary: ImportSummary }> {
  const summary: ImportSummary = {};
  const track = (entity: string) => (summary[entity] ??= emptyCounters());

  const keepAdmin = current.users.find((user) => user.login === 'admin');
  const database: Database =
    mode === 'replace'
      ? normalizeDatabase({
          ...normalizeDatabase(null),
          // Never lock the operator out: the admin account survives a replace
          // unless the imported file brings its own users.
          users: payload.users?.length ? [] : keepAdmin ? [keepAdmin] : [],
        })
      : normalizeDatabase(JSON.parse(JSON.stringify(current)) as Database);

  /* users */
  for (const raw of payload.users ?? []) {
    const counters = track('users');
    const login = String(raw.login ?? '').trim().toLowerCase();
    const name = String(raw.name ?? '').trim();
    if (!login || !name) {
      counters.skipped += 1;
      continue;
    }

    const existing = database.users.find((user) => user.login === login);
    if (existing && mode === 'append') {
      counters.skipped += 1;
      continue;
    }

    const plain = typeof raw.password === 'string' ? raw.password : '';
    const password = plain
      ? SHA256_HEX.test(plain)
        ? plain
        : await hashPassword(plain)
      : (existing?.password ?? (await hashPassword(DEFAULT_IMPORT_PASSWORD)));

    const user: User = {
      id: existing?.id ?? String(raw.id ?? newId()),
      name,
      login,
      password,
      role: (raw.role as Role) ?? existing?.role ?? 'barista1',
      color: raw.color ?? existing?.color ?? '#4CAF50',
      createdAt: raw.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
    };

    if (existing) {
      database.users = database.users.map((u) => (u.id === existing.id ? user : u));
      counters.updated += 1;
    } else {
      database.users.push(user);
      counters.added += 1;
    }
  }

  /* categories */
  for (const raw of payload.categories ?? []) {
    const counters = track('categories');
    const name = String(raw.name ?? '').trim().replace(/\s+/g, ' ');
    if (!name) {
      counters.skipped += 1;
      continue;
    }

    const existing = database.categories.find(
      (category) => category.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing && mode === 'append') {
      counters.skipped += 1;
      continue;
    }

    const category: Category = {
      id: existing?.id ?? String(raw.id ?? newId()),
      name,
      color: raw.color ?? existing?.color ?? '#4CAF50',
    };

    if (existing) {
      database.categories = database.categories.map((c) => (c.id === existing.id ? category : c));
      counters.updated += 1;
    } else {
      database.categories.push(category);
      counters.added += 1;
    }
  }

  /* products */
  for (const raw of payload.products ?? []) {
    const counters = track('products');
    const name = String(raw.name ?? '').trim();
    const categoryId = String(raw.categoryId ?? '');
    if (!name || !categoryId) {
      counters.skipped += 1;
      continue;
    }

    const existing = database.products.find(
      (product) =>
        product.name.toLowerCase() === name.toLowerCase() && product.categoryId === categoryId,
    );
    if (existing && mode === 'append') {
      counters.skipped += 1;
      continue;
    }

    const sizes = (raw.sizes ?? []).map((size) => ({
      size: size.size ?? 'Standard',
      cost: Number(size.cost) || 0,
      price: Number(size.price) || 0,
      resourceUsage: size.resourceUsage ?? [],
    }));
    const divisor = sizes.length || 1;

    const product: Product = {
      id: existing?.id ?? String(raw.id ?? newId()),
      name,
      categoryId,
      sizes,
      baseCost: round2(sizes.reduce((sum, size) => sum + size.cost, 0) / divisor),
      basePrice: round2(sizes.reduce((sum, size) => sum + size.price, 0) / divisor),
    };

    if (existing) {
      database.products = database.products.map((p) => (p.id === existing.id ? product : p));
      counters.updated += 1;
    } else {
      database.products.push(product);
      counters.added += 1;
    }
  }

  /* resources */
  for (const raw of payload.resources ?? []) {
    const counters = track('resources');
    const name = String(raw.name ?? '').trim();
    if (!name) {
      counters.skipped += 1;
      continue;
    }

    const existing = database.resources.find(
      (resource) => resource.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing && mode === 'append') {
      counters.skipped += 1;
      continue;
    }

    const resource: Resource = {
      id: existing?.id ?? String(raw.id ?? newId()),
      name,
      unit: (raw.unit as ResourceUnit) ?? existing?.unit ?? 'L',
      currentQuantity: round2(Number(raw.currentQuantity) || 0),
    };

    if (existing) {
      database.resources = database.resources.map((r) => (r.id === existing.id ? resource : r));
      counters.updated += 1;
    } else {
      database.resources.push(resource);
      counters.added += 1;
    }
  }

  /* discounts */
  for (const raw of payload.discounts ?? []) {
    const counters = track('discounts');
    const label = String(raw.label ?? '').trim();
    if (!label) {
      counters.skipped += 1;
      continue;
    }

    const value = String(raw.value ?? '0').trim().toLowerCase();
    const existing = database.discounts.find((discount) => discount.value === value);
    if (existing && mode === 'append') {
      counters.skipped += 1;
      continue;
    }

    const discount: Discount = {
      id: existing?.id ?? String(raw.id ?? newId('d')),
      value,
      label,
      order: raw.order ?? existing?.order ?? database.discounts.length,
    };

    if (existing) {
      database.discounts = database.discounts.map((d) => (d.id === existing.id ? discount : d));
      counters.updated += 1;
    } else {
      database.discounts.push(discount);
      counters.added += 1;
    }
  }

  /* orders */
  for (const raw of payload.orders ?? []) {
    const counters = track('orders');
    const items = (raw.items ?? []).map((item) => ({
      ...item,
      id: item.id ?? newId(),
      quantity: Number(item.quantity) || 1,
      price: Number(item.price) || 0,
      cost: Number(item.cost) || 0,
      total: Number(item.total) || (Number(item.price) || 0) * (Number(item.quantity) || 1),
    }));

    const order: Order = {
      id: String(raw.id ?? newId()),
      date: raw.date ?? new Date().toISOString(),
      userId: raw.userId ?? 'imported',
      userName: raw.userName ?? 'Imported',
      userRole: raw.userRole ?? '',
      items,
      total: Number(raw.total) || round2(items.reduce((sum, item) => sum + item.total, 0)),
      status: raw.status ?? 'completed',
      paymentMethod: raw.paymentMethod === 'card' ? 'card' : 'cash',
      createdAt: raw.createdAt ?? raw.date,
    };

    const index = database.orders.findIndex((existing) => existing.id === order.id);
    if (index >= 0) {
      if (mode === 'append') {
        counters.skipped += 1;
        continue;
      }
      database.orders[index] = order;
      counters.updated += 1;
    } else {
      database.orders.push(order);
      counters.added += 1;
    }
  }

  /* history */
  for (const entry of payload.history ?? []) {
    const counters = track('history');
    if (database.history.some((existing) => existing.id === entry.id)) {
      counters.skipped += 1;
      continue;
    }
    database.history.push({ ...entry, id: entry.id ?? newId() });
    counters.added += 1;
  }

  return { database, summary };
}

export function summaryMessage(summary: ImportSummary): string {
  const parts = Object.entries(summary)
    .filter(([, counters]) => counters.added || counters.updated)
    .map(([entity, counters]) => {
      const bits = [];
      if (counters.added) bits.push(`${counters.added} new`);
      if (counters.updated) bits.push(`${counters.updated} updated`);
      return `${entity}: ${bits.join(', ')}`;
    });

  const skipped = Object.values(summary).reduce((sum, counters) => sum + counters.skipped, 0);
  if (parts.length === 0) return `Nothing imported${skipped ? ` (${skipped} skipped)` : ''}.`;

  return `Imported ${parts.join('; ')}${skipped ? `. Skipped ${skipped}.` : '.'}`;
}
