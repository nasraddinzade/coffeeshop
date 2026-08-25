// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

import { create } from 'zustand';
import * as backend from '../lib/backend';
import {
  describeOrderChanges,
  orderTotal,
  subtractResources,
  subtractResourcesForDelta,
} from '../lib/pricing';
import { normalizeDatabase, seedDatabase } from '../lib/seed';
import { fileTimestamp, newId, round2 } from '../lib/utils';
import type {
  Category,
  Database,
  Discount,
  HistoryAction,
  Order,
  OrderItem,
  PaymentMethod,
  Product,
  Resource,
  SafeUser,
  Section,
  Toast,
  User,
} from '../types';

const SESSION_KEY = 'coffeeshop.session';
const DRAFT_KEY = 'coffeeshop.draft';

export interface DraftOrder {
  items: OrderItem[];
  paymentMethod: PaymentMethod;
}

const emptyDraft = (): DraftOrder => ({ items: [], paymentMethod: 'cash' });

interface AppState {
  ready: boolean;
  loadError: string | null;
  db: Database;
  currentUser: SafeUser | null;
  section: Section;
  toasts: Toast[];
  draft: DraftOrder;

  init: () => Promise<void>;
  notify: (message: string, type?: Toast['type']) => void;
  dismissToast: (id: string) => void;
  setSection: (section: Section) => void;

  login: (login: string, password: string) => Promise<boolean>;
  logout: () => void;

  saveUser: (user: Omit<User, 'password'> & { plainPassword?: string }) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;

  saveCategory: (category: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  saveProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;

  saveResource: (resource: Resource) => Promise<void>;
  deleteResource: (id: string) => Promise<void>;

  saveDiscount: (discount: Discount) => Promise<void>;
  deleteDiscount: (id: string) => Promise<void>;

  addDraftItem: (item: OrderItem) => void;
  removeDraftItem: (index: number) => void;
  setDraftPayment: (method: PaymentMethod) => void;
  clearDraft: () => void;

  createOrder: () => Promise<Order | null>;
  saveOrderEdits: (orderId: string, items: OrderItem[]) => Promise<void>;
  finishOrder: (orderId: string, items: OrderItem[], payment: PaymentMethod) => Promise<void>;
  deleteOrder: (orderId: string) => Promise<void>;

  replaceDatabase: (database: Database) => Promise<void>;
  clearAllData: (keepAdmin: boolean) => Promise<void>;
  backupNow: () => Promise<string>;
}

/** Persist is debounced: rapid edits collapse into a single disk write. */
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistFailureReported = false;

function schedulePersist(database: Database, onError: (message: string) => void): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    backend
      .saveDatabase(database)
      .then(() => {
        persistFailureReported = false;
      })
      .catch((error: unknown) => {
        if (persistFailureReported) return;
        persistFailureReported = true;
        onError(`Could not save data: ${String(error)}`);
      });
  }, 150);
}

function readSession(): SafeUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SafeUser) : null;
  } catch {
    return null;
  }
}

function readDraft(): DraftOrder {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return emptyDraft();
    const parsed = JSON.parse(raw) as DraftOrder;
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      paymentMethod: parsed.paymentMethod === 'card' ? 'card' : 'cash',
    };
  } catch {
    return emptyDraft();
  }
}

const stripPassword = ({ password: _password, ...rest }: User): SafeUser => rest;

function writeDraft(draft: DraftOrder): void {
  if (draft.items.length === 0) localStorage.removeItem(DRAFT_KEY);
  else localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export const useStore = create<AppState>()((set, get) => {
  /** Applies a change to the database, stores it and schedules a disk write. */
  const commit = (update: (database: Database) => Database): Database => {
    const next = update(get().db);
    set({ db: next });
    schedulePersist(next, (message) => get().notify(message, 'error'));
    return next;
  };

  const addHistory = (
    database: Database,
    orderId: string,
    action: HistoryAction,
    changes: string,
  ): Database => {
    const user = get().currentUser;
    return {
      ...database,
      history: [
        ...database.history,
        {
          id: newId(),
          orderId,
          action,
          userId: user?.id ?? '',
          userName: user?.name ?? '',
          userRole: user?.role ?? '',
          changes,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  };

  return {
    ready: false,
    loadError: null,
    db: normalizeDatabase(null),
    currentUser: null,
    section: 'sales',
    toasts: [],
    draft: emptyDraft(),

    async init() {
      try {
        const stored = await backend.loadDatabase();
        const database = stored ? normalizeDatabase(stored) : await seedDatabase();
        if (!stored) await backend.saveDatabase(database);

        // Re-read the account from disk so a session cannot outlive a
        // deleted user or carry stale name/role/colour.
        const session = readSession();
        const match = session ? database.users.find((user) => user.id === session.id) : undefined;

        set({
          db: database,
          ready: true,
          draft: readDraft(),
          currentUser: match ? stripPassword(match) : null,
        });
      } catch (error) {
        set({ ready: true, loadError: String(error) });
      }
    },

    notify(message, type = 'info') {
      const toast: Toast = { id: newId(), message, type };
      set((state) => ({ toasts: [...state.toasts, toast] }));
      setTimeout(() => get().dismissToast(toast.id), 3500);
    },

    dismissToast(id) {
      set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
    },

    setSection(section) {
      set({ section });
    },

    async login(login, password) {
      const user = get().db.users.find(
        (candidate) => candidate.login.toLowerCase() === login.trim().toLowerCase(),
      );
      if (!user) return false;

      const digest = await backend.hashPassword(password);
      if (digest !== user.password) return false;

      const safe = stripPassword(user);
      localStorage.setItem(SESSION_KEY, JSON.stringify(safe));
      set({ currentUser: safe, section: 'sales' });
      return true;
    },

    logout() {
      localStorage.removeItem(SESSION_KEY);
      set({ currentUser: null, section: 'sales' });
    },

    async saveUser({ plainPassword, ...user }) {
      const existing = get().db.users.find((candidate) => candidate.id === user.id);
      const password = plainPassword
        ? await backend.hashPassword(plainPassword)
        : (existing?.password ?? (await backend.hashPassword('123')));

      const record: User = { ...user, password };

      commit((database) => ({
        ...database,
        users: existing
          ? database.users.map((candidate) => (candidate.id === record.id ? record : candidate))
          : [...database.users, record],
      }));

      const current = get().currentUser;
      if (current?.id === record.id) {
        const safe = stripPassword(record);
        localStorage.setItem(SESSION_KEY, JSON.stringify(safe));
        set({ currentUser: safe });
      }
    },

    async deleteUser(id) {
      commit((database) => ({
        ...database,
        users: database.users.filter((user) => user.id !== id),
      }));
    },

    async saveCategory(category) {
      commit((database) => ({
        ...database,
        categories: database.categories.some((candidate) => candidate.id === category.id)
          ? database.categories.map((candidate) =>
              candidate.id === category.id ? category : candidate,
            )
          : [...database.categories, category],
      }));
    },

    async deleteCategory(id) {
      commit((database) => ({
        ...database,
        categories: database.categories.filter((category) => category.id !== id),
      }));
    },

    async saveProduct(product) {
      commit((database) => ({
        ...database,
        products: database.products.some((candidate) => candidate.id === product.id)
          ? database.products.map((candidate) => (candidate.id === product.id ? product : candidate))
          : [...database.products, product],
      }));
    },

    async deleteProduct(id) {
      commit((database) => ({
        ...database,
        products: database.products.filter((product) => product.id !== id),
      }));
    },

    async saveResource(resource) {
      commit((database) => ({
        ...database,
        resources: database.resources.some((candidate) => candidate.id === resource.id)
          ? database.resources.map((candidate) =>
              candidate.id === resource.id ? resource : candidate,
            )
          : [...database.resources, resource],
      }));
    },

    async deleteResource(id) {
      commit((database) => ({
        ...database,
        resources: database.resources.filter((resource) => resource.id !== id),
      }));
    },

    async saveDiscount(discount) {
      commit((database) => ({
        ...database,
        discounts: (database.discounts.some((candidate) => candidate.id === discount.id)
          ? database.discounts.map((candidate) =>
              candidate.id === discount.id ? discount : candidate,
            )
          : [...database.discounts, discount]
        ).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      }));
    },

    async deleteDiscount(id) {
      commit((database) => ({
        ...database,
        discounts: database.discounts.filter((discount) => discount.id !== id),
      }));
    },

    addDraftItem(item) {
      const draft = { ...get().draft, items: [...get().draft.items, item] };
      writeDraft(draft);
      set({ draft });
    },

    removeDraftItem(index) {
      const draft = {
        ...get().draft,
        items: get().draft.items.filter((_item, position) => position !== index),
      };
      writeDraft(draft);
      set({ draft });
    },

    setDraftPayment(method) {
      const draft = { ...get().draft, paymentMethod: method };
      writeDraft(draft);
      set({ draft });
    },

    clearDraft() {
      writeDraft(emptyDraft());
      set({ draft: emptyDraft() });
    },

    async createOrder() {
      const { draft, currentUser } = get();
      if (!currentUser) {
        get().notify('Session expired. Please log in again.', 'error');
        return null;
      }
      if (draft.items.length === 0) {
        get().notify('Add items to the order', 'error');
        return null;
      }

      const now = new Date().toISOString();
      const order: Order = {
        id: newId(),
        date: now,
        createdAt: now,
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        items: draft.items,
        total: orderTotal(draft.items),
        status: 'created',
        paymentMethod: draft.paymentMethod,
      };

      commit((database) =>
        addHistory(
          {
            ...database,
            orders: [...database.orders, order],
            resources: subtractResources(database.resources, order.items, database.products),
          },
          order.id,
          'create',
          'Order created',
        ),
      );

      get().clearDraft();
      return order;
    },

    async saveOrderEdits(orderId, items) {
      const previous = get().db.orders.find((order) => order.id === orderId);
      if (!previous) return;

      const total = orderTotal(items);
      const changes = describeOrderChanges(previous, items, total, previous.paymentMethod);
      const user = get().currentUser;

      const updated: Order = {
        ...previous,
        items,
        total,
        status: previous.status === 'completed' ? 'completed' : 'edited',
        editedAt: new Date().toISOString(),
        editedBy: user?.id,
        editedByName: user?.name,
      };

      commit((database) =>
        addHistory(
          {
            ...database,
            orders: database.orders.map((order) => (order.id === orderId ? updated : order)),
            resources: subtractResourcesForDelta(
              database.resources,
              previous.items,
              items,
              database.products,
            ),
          },
          orderId,
          'edit',
          changes,
        ),
      );
    },

    async finishOrder(orderId, items, payment) {
      const previous = get().db.orders.find((order) => order.id === orderId);
      if (!previous) return;

      const total = orderTotal(items);
      const changes = describeOrderChanges(previous, items, total, payment);
      const user = get().currentUser;

      const updated: Order = {
        ...previous,
        items,
        total,
        status: 'completed',
        paymentMethod: payment,
        editedAt: new Date().toISOString(),
        editedBy: user?.id,
        editedByName: user?.name,
      };

      commit((database) =>
        addHistory(
          {
            ...database,
            orders: database.orders.map((order) => (order.id === orderId ? updated : order)),
            resources: subtractResourcesForDelta(
              database.resources,
              previous.items,
              items,
              database.products,
            ),
          },
          orderId,
          'edit',
          `Order finished. ${changes}`,
        ),
      );
    },

    async deleteOrder(orderId) {
      commit((database) =>
        addHistory(
          { ...database, orders: database.orders.filter((order) => order.id !== orderId) },
          orderId,
          'delete',
          'Order deleted',
        ),
      );
    },

    async replaceDatabase(database) {
      const normalized = normalizeDatabase(database);
      set({ db: normalized });
      await backend.saveDatabase(normalized);

      const current = get().currentUser;
      if (current && !normalized.users.some((user) => user.id === current.id)) {
        get().logout();
      }
    },

    async clearAllData(keepAdmin) {
      const admin =
        get().db.users.find((user) => user.login === 'admin') ??
        get().db.users.find((user) => user.role === 'admin');

      const cleared = normalizeDatabase({
        ...normalizeDatabase(null),
        users: keepAdmin && admin ? [admin] : [],
      });

      set({ db: cleared, draft: emptyDraft() });
      writeDraft(emptyDraft());
      await backend.saveDatabase(cleared);

      const current = get().currentUser;
      if (!current || !cleared.users.some((user) => user.id === current.id)) {
        get().logout();
      }
    },

    async backupNow() {
      const filename = `coffeeshop-backup-${fileTimestamp()}.json`;
      return backend.createBackup(get().db, filename);
    },
  };
});

/** Totals used in more than one section. */
export function databaseStats(database: Database) {
  return {
    users: database.users.length,
    categories: database.categories.length,
    products: database.products.length,
    orders: database.orders.length,
    resources: database.resources.length,
    revenue: round2(database.orders.reduce((sum, order) => sum + (order.total || 0), 0)),
  };
}
