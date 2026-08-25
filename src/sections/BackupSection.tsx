// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

import {
  AlertTriangle,
  Box,
  Database as DatabaseIcon,
  Download,
  HardDriveDownload,
  RotateCcw,
  ShoppingCart,
  Tags,
  Trash2,
  Upload,
  Users as UsersIcon,
} from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useConfirm } from '../components/ConfirmProvider';
import { Modal } from '../components/Modal';
import * as backend from '../lib/backend';
import {
  applyImport,
  buildExcelExport,
  buildJsonExport,
  describePayload,
  jsonBytes,
  parseExcelPayload,
  parseJsonPayload,
  readWorkbook,
  summaryMessage,
  type ExportFormat,
  type ExportType,
  type ImportMode,
  type ImportPayload,
  type ImportPreview,
} from '../lib/transfer';
import { databaseStats, useStore } from '../store/useStore';
import { fileTimestamp, formatBytes, money } from '../lib/utils';

export function BackupSection() {
  const db = useStore((state) => state.db);
  const notify = useStore((state) => state.notify);
  const replaceDatabase = useStore((state) => state.replaceDatabase);
  const clearAllData = useStore((state) => state.clearAllData);
  const backupNow = useStore((state) => state.backupNow);
  const confirm = useConfirm();

  const [backups, setBackups] = useState<backend.BackupInfo[]>([]);
  const [dataDir, setDataDir] = useState('');
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [pending, setPending] = useState<{ payload: ImportPayload; preview: ImportPreview; name: string } | null>(
    null,
  );

  const refreshBackups = useCallback(async () => {
    try {
      setBackups(await backend.listBackups());
    } catch (error) {
      notify(`Could not list backups: ${String(error)}`, 'error');
    }
  }, [notify]);

  useEffect(() => {
    void refreshBackups();
    void backend.appDataDir().then(setDataDir);
  }, [refreshBackups]);

  const stats = databaseStats(db);

  const pickImportFile = async () => {
    try {
      const file = await backend.openFile([
        { name: 'Data files', extensions: ['xlsx', 'xls', 'json'] },
      ]);
      if (!file) return;

      const payload = /\.xlsx?$/i.test(file.name)
        ? parseExcelPayload(await readWorkbook(file.bytes))
        : parseJsonPayload(JSON.parse(new TextDecoder().decode(file.bytes)));

      setPending({ payload, preview: describePayload(payload), name: file.name });
    } catch (error) {
      notify(`Could not read the file: ${String(error)}`, 'error');
    }
  };

  const runImport = async (mode: ImportMode) => {
    if (!pending) return;
    try {
      // Always snapshot first: an import can overwrite a lot at once.
      await backend.createBackup(db, `coffeeshop-before-import-${fileTimestamp()}.json`);
      const { database, summary } = await applyImport(db, pending.payload, mode);
      await replaceDatabase(database);
      notify(summaryMessage(summary), 'success');
      setPending(null);
      void refreshBackups();
    } catch (error) {
      notify(`Import failed: ${String(error)}`, 'error');
    }
  };

  const restore = async (name: string) => {
    const ok = await confirm({
      title: 'Restore backup',
      message: `Replace all current data with “${name}”?`,
      confirmLabel: 'Restore',
      danger: true,
    });
    if (!ok) return;

    try {
      await backend.createBackup(db, `coffeeshop-before-restore-${fileTimestamp()}.json`);
      await replaceDatabase(await backend.readBackup(name));
      notify('Backup restored', 'success');
      void refreshBackups();
    } catch (error) {
      notify(`Restore failed: ${String(error)}`, 'error');
    }
  };

  const removeBackup = async (name: string) => {
    const ok = await confirm({
      title: 'Delete backup',
      message: `Delete “${name}”?`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await backend.deleteBackup(name);
    void refreshBackups();
  };

  return (
    <>
      <div className="section-header">
        <h3>Data Export &amp; Import</h3>
      </div>

      <div className="backup-management">
        <div className="backup-admin-panel">
          <div className="admin-actions">
            <div className="action-card" onClick={() => setExporting(true)} role="button" tabIndex={0}>
              <div className="action-icon">
                <Download size={28} />
              </div>
              <h4>Export Data</h4>
              <p>Save everything as an Excel workbook or a JSON backup</p>
            </div>

            <div className="action-card" onClick={pickImportFile} role="button" tabIndex={0}>
              <div className="action-icon">
                <Upload size={28} />
              </div>
              <h4>Import Data</h4>
              <p>Load an .xlsx or .json file, including exports from the old Electron app</p>
            </div>

            <div
              className="action-card"
              role="button"
              tabIndex={0}
              onClick={async () => {
                try {
                  const path = await backupNow();
                  notify(`Backup created: ${path}`, 'success');
                  void refreshBackups();
                } catch (error) {
                  notify(`Backup failed: ${String(error)}`, 'error');
                }
              }}
            >
              <div className="action-icon">
                <HardDriveDownload size={28} />
              </div>
              <h4>Backup Now</h4>
              <p>Write a snapshot next to the database file</p>
            </div>

            <div
              className="action-card"
              style={{ borderColor: '#f44336' }}
              role="button"
              tabIndex={0}
              onClick={() => setClearing(true)}
            >
              <div className="action-icon" style={{ color: '#f44336' }}>
                <Trash2 size={28} />
              </div>
              <h4 style={{ color: '#f44336' }}>Clear All Data</h4>
              <p>Delete all users, products, categories and orders</p>
            </div>
          </div>

          <div className="backup-stats">
            <h4>System Statistics</h4>
            <div className="stats-grid">
              <StatCard icon={<UsersIcon size={20} />} value={stats.users} label="Users" />
              <StatCard icon={<Tags size={20} />} value={stats.categories} label="Categories" />
              <StatCard icon={<Box size={20} />} value={stats.products} label="Products" />
              <StatCard icon={<ShoppingCart size={20} />} value={stats.orders} label="Orders" />
              <StatCard
                icon={<DatabaseIcon size={20} />}
                value={money(stats.revenue)}
                label="Total revenue"
              />
              <StatCard
                icon={<HardDriveDownload size={20} />}
                value={backups.length}
                label="Local backups"
              />
            </div>
            <p className="form-hint" style={{ marginTop: 10 }}>
              Data location: <code>{dataDir}</code>
            </p>
          </div>

          <div className="recent-backups">
            <h4>Local backups</h4>
            {backups.length === 0 ? (
              <p className="empty-backups">No backups yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Size</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((backup) => (
                    <tr key={backup.name}>
                      <td>{backup.name}</td>
                      <td>{formatBytes(backup.size)}</td>
                      <td className="table-actions">
                        <button
                          type="button"
                          className="btn-icon"
                          title="Restore"
                          onClick={() => restore(backup.name)}
                        >
                          <RotateCcw size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          title="Delete"
                          onClick={() => removeBackup(backup.name)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="warning">
            <strong>
              <AlertTriangle size={16} /> Important
            </strong>
            <p>1. Export regularly and keep a copy off this machine.</p>
            <p>2. Passwords are never included in exports.</p>
            <p>3. A snapshot is taken automatically before every import or restore.</p>
          </div>
        </div>
      </div>

      {exporting ? <ExportModal onClose={() => setExporting(false)} /> : null}
      {clearing ? (
        <ClearDataModal
          onClose={() => setClearing(false)}
          onConfirm={async (keepAdmin) => {
            await backend.createBackup(db, `coffeeshop-before-clear-${fileTimestamp()}.json`);
            await clearAllData(keepAdmin);
            notify('All data cleared', 'success');
            setClearing(false);
            void refreshBackups();
          }}
        />
      ) : null}
      {pending ? (
        <ImportModal
          name={pending.name}
          preview={pending.preview}
          onClose={() => setPending(null)}
          onImport={runImport}
        />
      ) : null}
    </>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function ExportModal({ onClose }: { onClose: () => void }) {
  const db = useStore((state) => state.db);
  const notify = useStore((state) => state.notify);

  const [format, setFormat] = useState<ExportFormat>('excel');
  const [type, setType] = useState<ExportType>('full');
  const [pretty, setPretty] = useState(true);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const stamp = fileTimestamp();
      const name = `coffeeshop-${type}-${stamp}.${format === 'excel' ? 'xlsx' : 'json'}`;
      const bytes =
        format === 'excel'
          ? await buildExcelExport(db, type)
          : jsonBytes(buildJsonExport(db, type), pretty);

      const path = await backend.saveFile(
        name,
        format === 'excel'
          ? [{ name: 'Excel workbook', extensions: ['xlsx'] }]
          : [{ name: 'JSON backup', extensions: ['json'] }],
        bytes,
      );

      if (path) {
        notify(`Exported: ${path}`, 'success');
        onClose();
      }
    } catch (error) {
      notify(`Export failed: ${String(error)}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Data Export"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={run} disabled={busy}>
            <Download size={16} /> Export Now
          </button>
        </>
      }
    >
      <div className="form-group">
        <label>Export format:</label>
        <select
          className="form-control"
          value={format}
          onChange={(event) => setFormat(event.target.value as ExportFormat)}
        >
          <option value="excel">Excel spreadsheet (.xlsx)</option>
          <option value="json">JSON backup (.json)</option>
        </select>
        <small className="form-hint">
          Excel is easier to read; JSON restores exactly, including order history.
        </small>
      </div>

      <div className="form-group">
        <label>Data to export:</label>
        <select
          className="form-control"
          value={type}
          onChange={(event) => setType(event.target.value as ExportType)}
        >
          <option value="full">Full system backup</option>
          <option value="orders">Orders only</option>
          <option value="products">Products &amp; categories</option>
          <option value="users">Users (without passwords)</option>
        </select>
      </div>

      {format === 'json' ? (
        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={pretty}
              onChange={(event) => setPretty(event.target.checked)}
            />{' '}
            Pretty print
          </label>
        </div>
      ) : null}
    </Modal>
  );
}

function ImportModal({
  name,
  preview,
  onClose,
  onImport,
}: {
  name: string;
  preview: ImportPreview;
  onClose: () => void;
  onImport: (mode: ImportMode) => Promise<void>;
}) {
  const [mode, setMode] = useState<ImportMode>('append');
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      title="Import Data"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={mode === 'replace' ? 'btn-danger' : 'btn-primary'}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onImport(mode);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Upload size={16} /> Start Import
          </button>
        </>
      }
    >
      <div className="import-info">
        <p>
          File: <strong>{name}</strong>
        </p>
        <p>
          Contents: <strong>{preview.description}</strong>
        </p>
        <div className="stats-grid">
          {Object.entries(preview.statistics).map(([key, value]) => (
            <div className="stat-item" key={key}>
              <span className="stat-label">{key}:</span>{' '}
              <span className="stat-value">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Import strategy:</label>
        <select
          className="form-control"
          value={mode}
          onChange={(event) => setMode(event.target.value as ImportMode)}
        >
          <option value="append">Append new data only</option>
          <option value="merge">Merge and update existing</option>
          <option value="replace">Replace all data</option>
        </select>
        <small className="form-hint">
          <strong>Append:</strong> add new records, skip anything that already exists.
          <br />
          <strong>Merge:</strong> add new records and update matching ones.
          <br />
          <strong>Replace:</strong> wipe everything first (the admin account is kept if the file
          brings no users).
        </small>
      </div>

      <div className="warning-box">
        <p>A snapshot of the current data is saved automatically before importing.</p>
      </div>
    </Modal>
  );
}

function ClearDataModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (keepAdmin: boolean) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [keepAdmin, setKeepAdmin] = useState(true);
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      title="Clear All Data"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger"
            disabled={text !== 'DELETE ALL' || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(keepAdmin);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Trash2 size={16} /> Clear All Data
          </button>
        </>
      }
    >
      <div className="warning">
        <h4>
          <AlertTriangle size={16} /> Warning
        </h4>
        <p>This deletes every user, category, product, resource, order and history entry.</p>
        <p>
          <strong>It cannot be undone</strong> — a snapshot is written to the backups folder first.
        </p>
      </div>

      <div className="form-group">
        <label>Type “DELETE ALL” to confirm:</label>
        <input
          type="text"
          className="form-control"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </div>

      <div className="form-group checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={keepAdmin}
            onChange={(event) => setKeepAdmin(event.target.checked)}
          />{' '}
          Keep the administrator account
        </label>
      </div>
    </Modal>
  );
}
