// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

import { Coffee } from 'lucide-react';
import { useState } from 'react';
import { Modal } from '../components/Modal';
import { money } from '../lib/utils';
import { useStore } from '../store/useStore';
import type { Product } from '../types';

interface PickProductModalProps {
  onPick: (product: Product) => void;
  onClose: () => void;
}

/** Category → product picker used when adding a line to an existing order. */
export function PickProductModal({ onPick, onClose }: PickProductModalProps) {
  const db = useStore((state) => state.db);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const category = db.categories.find((entry) => entry.id === categoryId);
  const products = categoryId
    ? db.products.filter((product) => product.categoryId === categoryId)
    : [];

  return (
    <Modal
      stacked
      wide
      title="Select product to add"
      onClose={onClose}
      footer={
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
      }
    >
      <div className="categories-selection">
        {db.categories.map((entry) => (
          <div
            key={entry.id}
            className="category-select-card"
            onClick={() => setCategoryId(entry.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => event.key === 'Enter' && setCategoryId(entry.id)}
          >
            <div className="category-color" style={{ backgroundColor: entry.color }} />
            <h4>{entry.name}</h4>
          </div>
        ))}
      </div>

      {category ? (
        <div className="products-selection" style={{ marginTop: 20 }}>
          <h4>{category.name}</h4>
          <div className="products-grid">
            {products.length === 0 ? (
              <p className="empty-message">No products in this category.</p>
            ) : (
              products.map((product) => (
                <div className="product-select-card" key={product.id}>
                  <Coffee size={24} />
                  <h5>{product.name}</h5>
                  <p>
                    {product.sizes.length
                      ? product.sizes.map((size) => `${size.size}: ${money(size.price)}`).join(', ')
                      : money(product.basePrice)}
                  </p>
                  <button type="button" className="btn-primary" onClick={() => onPick(product)}>
                    Select
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
