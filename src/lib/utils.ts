// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

export const CURRENCY = 'AZN';

let counter = 0;

/** Collision-safe id: timestamp + counter + randomness. */
export function newId(prefix = ''): string {
  counter = (counter + 1) % 100000;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function money(value: number | null | undefined): string {
  const n = Number(value);
  return `${(Number.isFinite(n) ? n : 0).toFixed(2)} ${CURRENCY}`;
}

export function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** Parses user input that may use a comma as the decimal separator. */
export function parseNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toDateInputValue(date: Date): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

/** Compares an ISO timestamp against a `YYYY-MM-DD` day, in local time. */
export function isOnLocalDay(iso: string, day: string): boolean {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return toDateInputValue(date) === day;
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

/** `2026-08-25T14-03-11` — safe for filenames and sorts chronologically. */
export function fileTimestamp(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export function shortOrderId(id: string): string {
  return id.slice(-6);
}

export function roleLabel(role: string): string {
  switch (role) {
    case 'admin':
      return 'Administrator';
    case 'barista1':
      return 'Barista 1';
    case 'barista2':
      return 'Barista 2';
    default:
      return role || '—';
  }
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
