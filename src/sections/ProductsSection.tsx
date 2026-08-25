// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useConfirm } from '../components/ConfirmProvider';
import { money, round2 } from '../lib/utils';
import { ProductModal } from '../modals/ProductModal';
import { useStore } from '../store/useStore';
import type { Product } from '../types';

export function ProductsSection() {
  const db = useStore((state) => state.db);
  const deleteProduct = useStore((state) => state.deleteProduct);
  const notify = useStore((state) => state.notify);
  const confirm = useConfirm();

  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);

  const average = (product: Product, field: 'cost' | 'price') =>
    product.sizes.length
      ? round2(product.sizes.reduce((sum, size) => sum + size[field], 0) / product.sizes.length)
      : field === 'cost'
        ? product.baseCost
        : product.basePrice;

  const remove = async (product: Product) => {
    const ok = await confirm({
      title: 'Delete product',
      message: `Delete “${product.name}”?`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await deleteProduct(product.id);
    notify('Product deleted', 'success');
  };

  return (
    <>
      <div className="section-header">
        <h3>Product Management</h3>
        <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> Add Product
        </button>
      </div>

      <div className="products-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Size</th>
              <th>Cost Price</th>
              <th>Sale Price</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {db.products.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-message">
                  No products yet.
                </td>
              </tr>
            ) : (
              db.products.map((product) => {
                const category = db.categories.find((entry) => entry.id === product.categoryId);
                return (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td>{category?.name ?? '-'}</td>
                    <td>
                      {product.sizes.length === 0
                        ? 'No sizes'
                        : product.sizes.map((size) => (
                            <div key={size.size}>
                              {size.size}: {money(size.price)}
                            </div>
                          ))}
                    </td>
                    <td>{money(average(product, 'cost'))}</td>
                    <td>{money(average(product, 'price'))}</td>
                    <td className="table-actions">
                      <button
                        type="button"
                        className="btn-icon"
                        title="Edit"
                        onClick={() => setEditing(product)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn-icon"
                        title="Delete"
                        onClick={() => remove(product)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {creating ? <ProductModal onClose={() => setCreating(false)} /> : null}
      {editing ? <ProductModal product={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}
