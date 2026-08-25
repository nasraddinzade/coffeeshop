// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useConfirm } from '../components/ConfirmProvider';
import { Modal } from '../components/Modal';
import { newId } from '../lib/utils';
import { useStore } from '../store/useStore';
import type { Discount } from '../types';

/** `0`, `1`–`100`, `free` or `subscription`. */
function normalizeValue(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (value === 'free' || value === 'subscription') return value;
  if (value === '' || value === 'no' || value === 'none') return '0';
  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number) || number < 0 || number > 100) return null;
  return String(number);
}

export function DiscountsSection() {
  const discounts = useStore((state) => state.db.discounts);
  const deleteDiscount = useStore((state) => state.deleteDiscount);
  const notify = useStore((state) => state.notify);
  const confirm = useConfirm();

  const [editing, setEditing] = useState<Discount | null>(null);
  const [creating, setCreating] = useState(false);

  const remove = async (discount: Discount) => {
    const ok = await confirm({
      title: 'Delete discount',
      message: `Delete “${discount.label}”?`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await deleteDiscount(discount.id);
    notify('Discount deleted', 'success');
  };

  return (
    <>
      <div className="section-header">
        <h3>Discounts</h3>
        <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> Add discount
        </button>
      </div>

      <p className="section-description">
        Discount types offered when creating or editing orders. Value: 0 = no discount, 1–100 =
        percent, or “free” / “subscription”.
      </p>

      <div className="discounts-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Value</th>
              <th>Label</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {discounts.map((discount, index) => (
              <tr key={discount.id}>
                <td>{index + 1}</td>
                <td>{discount.value}</td>
                <td>{discount.label}</td>
                <td className="table-actions">
                  <button
                    type="button"
                    className="btn-icon"
                    title="Edit"
                    onClick={() => setEditing(discount)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    title="Delete"
                    onClick={() => remove(discount)}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating ? <DiscountModal onClose={() => setCreating(false)} /> : null}
      {editing ? <DiscountModal discount={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function DiscountModal({ discount, onClose }: { discount?: Discount; onClose: () => void }) {
  const discounts = useStore((state) => state.db.discounts);
  const saveDiscount = useStore((state) => state.saveDiscount);
  const notify = useStore((state) => state.notify);

  const [value, setValue] = useState(discount?.value ?? '');
  const [label, setLabel] = useState(discount?.label ?? '');

  const submit = async () => {
    if (!label.trim()) {
      notify('Enter a label', 'error');
      return;
    }
    const normalized = normalizeValue(value);
    if (normalized === null) {
      notify('Value must be 0–100, “free” or “subscription”', 'error');
      return;
    }

    await saveDiscount({
      id: discount?.id ?? newId('d'),
      value: normalized,
      label: label.trim(),
      order: discount?.order ?? discounts.length,
    });
    notify('Discount saved', 'success');
    onClose();
  };

  return (
    <Modal
      title={discount ? 'Edit discount' : 'Add discount'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={submit}>
            <Save size={16} /> Save
          </button>
        </>
      }
    >
      <div className="form-group">
        <label>Value:</label>
        <input
          type="text"
          className="form-control"
          placeholder="0, 1-100, free, subscription"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <small className="form-hint">
          0 = no discount, 1–100 = percent, or “free” / “subscription”.
        </small>
      </div>
      <div className="form-group">
        <label>Label (display text):</label>
        <input
          type="text"
          className="form-control"
          placeholder="e.g. -20% or Free"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </div>
    </Modal>
  );
}
