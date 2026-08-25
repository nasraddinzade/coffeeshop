// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

import { Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Modal } from '../components/Modal';
import { newId, parseNumber, round2 } from '../lib/utils';
import { useStore } from '../store/useStore';
import type { Product, ProductSize } from '../types';

const STANDARD_SIZES = ['S', 'M', 'L', 'XL'];

interface UsageRow {
  key: string;
  resourceId: string;
  quantityPerUnit: string;
}

interface SizeRow {
  key: string;
  size: string;
  custom: boolean;
  cost: string;
  price: string;
  usage: UsageRow[];
}

function toRows(sizes: ProductSize[]): SizeRow[] {
  if (sizes.length === 0) {
    return [{ key: newId(), size: 'M', custom: false, cost: '0', price: '0', usage: [] }];
  }
  return sizes.map((size) => ({
    key: newId(),
    size: size.size,
    custom: !STANDARD_SIZES.includes(size.size),
    cost: String(size.cost ?? 0),
    price: String(size.price ?? 0),
    usage: (size.resourceUsage ?? []).map((usage) => ({
      key: newId(),
      resourceId: usage.resourceId,
      quantityPerUnit: String(usage.quantityPerUnit ?? 0),
    })),
  }));
}

interface ProductModalProps {
  product?: Product;
  onClose: () => void;
}

export function ProductModal({ product, onClose }: ProductModalProps) {
  const db = useStore((state) => state.db);
  const saveProduct = useStore((state) => state.saveProduct);
  const notify = useStore((state) => state.notify);

  const [name, setName] = useState(product?.name ?? '');
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? db.categories[0]?.id ?? '');
  const [rows, setRows] = useState<SizeRow[]>(() => toRows(product?.sizes ?? []));

  const patchRow = (key: string, patch: Partial<SizeRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const patchUsage = (rowKey: string, usageKey: string, patch: Partial<UsageRow>) =>
    setRows((current) =>
      current.map((row) =>
        row.key === rowKey
          ? {
              ...row,
              usage: row.usage.map((usage) =>
                usage.key === usageKey ? { ...usage, ...patch } : usage,
              ),
            }
          : row,
      ),
    );

  const submit = async () => {
    if (!name.trim() || !categoryId) {
      notify('Fill in name and category', 'error');
      return;
    }

    const sizes: ProductSize[] = [];
    for (const row of rows) {
      const label = row.size.trim();
      if (!label) continue;
      sizes.push({
        size: label,
        cost: round2(parseNumber(row.cost)),
        price: round2(parseNumber(row.price)),
        resourceUsage: row.usage
          .filter((usage) => usage.resourceId && parseNumber(usage.quantityPerUnit) > 0)
          .map((usage) => ({
            resourceId: usage.resourceId,
            quantityPerUnit: parseNumber(usage.quantityPerUnit),
          })),
      });
    }

    if (sizes.length === 0) {
      notify('Add at least one size', 'error');
      return;
    }

    await saveProduct({
      id: product?.id ?? newId(),
      name: name.trim(),
      categoryId,
      sizes,
      baseCost: round2(sizes.reduce((sum, size) => sum + size.cost, 0) / sizes.length),
      basePrice: round2(sizes.reduce((sum, size) => sum + size.price, 0) / sizes.length),
    });

    notify('Product saved', 'success');
    onClose();
  };

  return (
    <Modal
      wide
      title={product ? 'Edit product' : 'New product'}
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
        <label>Product Name:</label>
        <input
          type="text"
          className="form-control"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="form-group">
        <label>Category:</label>
        <select
          className="form-control"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="">— Category —</option>
          {db.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="sizes-section">
        <h4>Sizes and Prices:</h4>

        {rows.map((row) => (
          <div className="size-row" key={row.key}>
            <div className="size-row-main">
              <div className="form-group">
                <label>Size:</label>
                <select
                  className="form-control"
                  value={row.custom ? 'custom' : row.size}
                  onChange={(event) => {
                    const value = event.target.value;
                    patchRow(row.key, {
                      custom: value === 'custom',
                      size: value === 'custom' ? '' : value,
                    });
                  }}
                >
                  {STANDARD_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                  <option value="custom">Other…</option>
                </select>
                {row.custom ? (
                  <input
                    type="text"
                    className="form-control"
                    style={{ marginTop: 5 }}
                    placeholder="Enter size"
                    value={row.size}
                    onChange={(event) => patchRow(row.key, { size: event.target.value })}
                  />
                ) : null}
              </div>

              <div className="form-group">
                <label>Cost (AZN):</label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="form-control"
                  value={row.cost}
                  onChange={(event) => patchRow(row.key, { cost: event.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Price (AZN):</label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="form-control"
                  value={row.price}
                  onChange={(event) => patchRow(row.key, { price: event.target.value })}
                />
              </div>

              <div className="form-group">
                <button
                  type="button"
                  className="btn-danger remove-size-btn"
                  title="Remove size"
                  onClick={() =>
                    setRows((current) =>
                      current.length > 1
                        ? current.filter((entry) => entry.key !== row.key)
                        : current,
                    )
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="size-row-resources">
              <div className="form-hint">Resource usage for this size (per 1 unit sold):</div>
              {row.usage.map((usage) => (
                <div className="resource-usage-row" key={usage.key}>
                  <select
                    className="form-control"
                    value={usage.resourceId}
                    onChange={(event) =>
                      patchUsage(row.key, usage.key, { resourceId: event.target.value })
                    }
                  >
                    <option value="">— Resource —</option>
                    {db.resources.map((resource) => (
                      <option key={resource.id} value={resource.id}>
                        {resource.name} ({resource.unit})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-control"
                    style={{ width: 90 }}
                    placeholder="Per 1"
                    value={usage.quantityPerUnit}
                    onChange={(event) =>
                      patchUsage(row.key, usage.key, { quantityPerUnit: event.target.value })
                    }
                  />
                  <button
                    type="button"
                    className="btn-icon"
                    title="Remove"
                    onClick={() =>
                      patchRow(row.key, {
                        usage: row.usage.filter((entry) => entry.key !== usage.key),
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="btn-secondary"
                style={{ marginTop: 6, fontSize: 12 }}
                disabled={db.resources.length === 0}
                onClick={() =>
                  patchRow(row.key, {
                    usage: [
                      ...row.usage,
                      { key: newId(), resourceId: '', quantityPerUnit: '0' },
                    ],
                  })
                }
              >
                <Plus size={14} /> Add resource
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            setRows((current) => [
              ...current,
              { key: newId(), size: 'M', custom: false, cost: '0', price: '0', usage: [] },
            ])
          }
        >
          <Plus size={16} /> Add Size
        </button>
      </div>
    </Modal>
  );
}
