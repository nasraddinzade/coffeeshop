// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useConfirm } from '../components/ConfirmProvider';
import { Modal } from '../components/Modal';
import { newId, parseNumber, round2 } from '../lib/utils';
import { useStore } from '../store/useStore';
import type { Resource, ResourceUnit } from '../types';

const UNITS: ResourceUnit[] = ['L', 'ml', 'kg', 'g', 'pcs'];

export function ResourcesSection() {
  const resources = useStore((state) => state.db.resources);
  const currentUser = useStore((state) => state.currentUser)!;
  const isAdmin = currentUser.role === 'admin';

  const [editing, setEditing] = useState<Resource | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="section-header">
        <h3>Resources (Ingredients)</h3>
        {isAdmin ? (
          <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> Add Resource
          </button>
        ) : null}
      </div>

      <p className="section-description">
        Current stock. Quantities are deducted automatically when orders are placed.
      </p>

      <div className="resources-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Unit</th>
              <th>Current quantity</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {resources.length === 0 ? (
              <tr>
                <td colSpan={4} className="empty-message">
                  No resources yet.
                </td>
              </tr>
            ) : (
              resources.map((resource) => {
                const quantity = Number(resource.currentQuantity) || 0;
                return (
                  <tr key={resource.id}>
                    <td>{resource.name}</td>
                    <td>{resource.unit}</td>
                    <td className={quantity <= 0 ? 'text-danger' : undefined}>
                      {quantity.toFixed(2)}
                    </td>
                    <td className="table-actions">
                      {isAdmin ? (
                        <button
                          type="button"
                          className="btn-icon"
                          title="Edit"
                          onClick={() => setEditing(resource)}
                        >
                          <Pencil size={16} />
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {creating ? <ResourceModal onClose={() => setCreating(false)} /> : null}
      {editing ? <ResourceModal resource={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function ResourceModal({ resource, onClose }: { resource?: Resource; onClose: () => void }) {
  const products = useStore((state) => state.db.products);
  const saveResource = useStore((state) => state.saveResource);
  const deleteResource = useStore((state) => state.deleteResource);
  const notify = useStore((state) => state.notify);
  const confirm = useConfirm();

  const [name, setName] = useState(resource?.name ?? '');
  const [unit, setUnit] = useState<ResourceUnit>(resource?.unit ?? 'L');
  const [quantity, setQuantity] = useState(String(resource?.currentQuantity ?? 0));

  const submit = async () => {
    if (!name.trim()) {
      notify('Enter a resource name', 'error');
      return;
    }
    const value = parseNumber(quantity);
    if (value < 0) {
      notify('Enter a valid quantity', 'error');
      return;
    }

    await saveResource({
      id: resource?.id ?? newId(),
      name: name.trim(),
      unit,
      currentQuantity: round2(value),
    });
    notify('Resource saved', 'success');
    onClose();
  };

  const remove = async () => {
    if (!resource) return;
    const used = products.filter((product) =>
      product.sizes.some((size) =>
        size.resourceUsage.some((usage) => usage.resourceId === resource.id),
      ),
    ).length;

    const ok = await confirm({
      title: 'Delete resource',
      message: used
        ? `“${resource.name}” is used by ${used} product(s); those recipes will stop deducting it. Continue?`
        : `Delete “${resource.name}”?`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    await deleteResource(resource.id);
    notify('Resource deleted', 'success');
    onClose();
  };

  return (
    <Modal
      title={resource ? 'Edit resource' : 'New resource'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {resource ? (
            <button type="button" className="btn-danger" onClick={remove}>
              <Trash2 size={16} /> Delete
            </button>
          ) : null}
          <button type="button" className="btn-primary" onClick={submit}>
            <Save size={16} /> Save
          </button>
        </>
      }
    >
      <div className="form-group">
        <label>Resource name:</label>
        <input
          type="text"
          className="form-control"
          placeholder="e.g. Milk"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="form-group">
        <label>Unit:</label>
        <select
          className="form-control"
          value={unit}
          onChange={(event) => setUnit(event.target.value as ResourceUnit)}
        >
          {UNITS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Current quantity:</label>
        <input
          type="text"
          inputMode="decimal"
          className="form-control"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />
      </div>
    </Modal>
  );
}
