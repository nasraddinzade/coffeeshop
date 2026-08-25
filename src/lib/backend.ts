// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

/**
 * Bridge to the native backend.
 *
 * Inside the Tauri shell every call goes to a Rust command. Opened as a plain
 * web page (`npm run dev` in a browser) the same API falls back to
 * localStorage and ordinary download/upload, so the UI stays fully usable
 * without the desktop shell.
 */

import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import type { Database } from '../types';

export interface BackupInfo {
  name: string;
  size: number;
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface PickedFile {
  name: string;
  bytes: Uint8Array;
}

const DB_KEY = 'coffeeshop.database';
const BACKUP_PREFIX = 'coffeeshop.backup.';

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function loadDatabase(): Promise<Database | null> {
  if (isTauri()) {
    return (await invoke<Database | null>('load_database')) ?? null;
  }
  const raw = localStorage.getItem(DB_KEY);
  return raw ? (JSON.parse(raw) as Database) : null;
}

export async function saveDatabase(database: Database): Promise<void> {
  if (isTauri()) {
    await invoke('save_database', { database });
    return;
  }
  localStorage.setItem(DB_KEY, JSON.stringify(database));
}

export async function hashPassword(password: string): Promise<string> {
  if (isTauri()) {
    return invoke<string>('hash_password', { password });
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createBackup(database: Database, filename: string): Promise<string> {
  if (isTauri()) {
    return invoke<string>('create_backup', { database, filename });
  }
  localStorage.setItem(BACKUP_PREFIX + filename, JSON.stringify(database));
  return filename;
}

export async function listBackups(): Promise<BackupInfo[]> {
  if (isTauri()) {
    return invoke<BackupInfo[]>('list_backups');
  }
  return Object.keys(localStorage)
    .filter((key) => key.startsWith(BACKUP_PREFIX))
    .map((key) => ({
      name: key.slice(BACKUP_PREFIX.length),
      size: localStorage.getItem(key)?.length ?? 0,
    }))
    .sort((a, b) => b.name.localeCompare(a.name));
}

export async function readBackup(name: string): Promise<Database> {
  if (isTauri()) {
    return invoke<Database>('read_backup', { name });
  }
  const raw = localStorage.getItem(BACKUP_PREFIX + name);
  if (!raw) throw new Error(`Backup not found: ${name}`);
  return JSON.parse(raw) as Database;
}

export async function deleteBackup(name: string): Promise<void> {
  if (isTauri()) {
    await invoke('delete_backup', { name });
    return;
  }
  localStorage.removeItem(BACKUP_PREFIX + name);
}

export async function appDataDir(): Promise<string> {
  if (isTauri()) {
    return invoke<string>('app_data_dir');
  }
  return 'browser localStorage';
}

/** Ask for a destination and write the bytes. Returns the path, or null if cancelled. */
export async function saveFile(
  defaultName: string,
  filters: FileFilter[],
  bytes: Uint8Array,
): Promise<string | null> {
  if (isTauri()) {
    const path = await save({ defaultPath: defaultName, filters });
    if (!path) return null;
    await invoke('write_binary_file', { path, contents: Array.from(bytes) });
    return path;
  }

  const blob = new Blob([bytes as BlobPart]);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = defaultName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  return defaultName;
}

/** Ask for a file and read it. Returns null if cancelled. */
export async function openFile(filters: FileFilter[]): Promise<PickedFile | null> {
  if (isTauri()) {
    const path = await open({ multiple: false, directory: false, filters });
    if (typeof path !== 'string') return null;
    const contents = await invoke<number[]>('read_binary_file', { path });
    return { name: path.split(/[\\/]/).pop() ?? path, bytes: new Uint8Array(contents) };
  }

  return new Promise<PickedFile | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = filters.flatMap((f) => f.extensions.map((ext) => `.${ext}`)).join(',');
    input.style.display = 'none';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) {
        resolve(null);
        return;
      }
      resolve({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    });
    document.body.appendChild(input);
    input.click();
  });
}
