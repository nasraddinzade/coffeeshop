// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

import { Save } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { applyCommentAndDiscount } from '../lib/pricing';
import { money, newId, parseNumber, round2 } from '../lib/utils';
import { useStore } from '../store/useStore';
import type { OrderItem, Product } from '../types';

interface OrderItemModalProps {
  product: Product;
  /** Omitted when adding a new line. */
  item?: OrderItem;
  onSave: (item: OrderItem) => void;
  onClose: () => void;
}

/**
 * Editor for a single order line. The price follows size, comment and
 * discount automatically, and can still be overridden by hand.
 */
export function OrderItemModal({ product, item, onSave, onClose }: OrderItemModalProps) {
  const discounts = useStore((state) => state.db.discounts);
  const notify = useStore((state) => state.notify);

  const sizes = product.sizes ?? [];
  const [size, setSize] = useState(item?.size ?? sizes[0]?.size ?? '');
  const [quantity, setQuantity] = useState(String(item?.quantity ?? 1));
  const [comment, setComment] = useState(item?.comment ?? '');
  const [discount, setDiscount] = useState(item?.discount ?? '0');
  const [subscription, setSubscription] = useState(item?.subscription ?? '');
  const [price, setPrice] = useState((item?.price ?? sizes[0]?.price ?? product.basePrice ?? 0).toFixed(2));

  const sizeData = useMemo(() => sizes.find((entry) => entry.size === size), [sizes, size]);
  const basePrice = sizeData?.price ?? product.basePrice ?? item?.price ?? 0;

  // Recompute the price whenever a pricing input changes, but leave the very
  // first render alone so an existing line keeps its stored price.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setPrice(applyCommentAndDiscount(basePrice, comment, discount).toFixed(2));
  }, [basePrice, comment, discount]);

  const quantityValue = Math.max(1, Math.trunc(parseNumber(quantity)) || 1);
  const priceValue = Math.max(0, parseNumber(price));

  const submit = () => {
    if (priceValue < 0) {
      notify('Price cannot be negative', 'error');
      return;
    }

    onSave({
      id: item?.id ?? newId(),
      productId: product.id,
      productName: product.name,
      categoryId: product.categoryId,
      categoryName: item?.categoryName ?? '',
      size,
      quantity: quantityValue,
      price: round2(priceValue),
      cost: sizeData?.cost ?? product.baseCost ?? item?.cost ?? 0,
      comment: comment.trim(),
      discount,
      subscription: discount === 'subscription' ? subscription.trim() : '',
      total: round2(priceValue * quantityValue),
    });
  };

  return (
    <Modal
      stacked
      title={item ? `Edit “${product.name}”` : `Add ${product.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={submit}>
            <Save size={16} /> {item ? 'Save changes' : 'Add to order'}
          </button>
        </>
      }
    >
      <div className="form-group">
        <label>Size:</label>
        {sizes.length > 0 ? (
          <select
            className="form-control"
            value={size}
            onChange={(event) => setSize(event.target.value)}
          >
            <option value="">No size</option>
            {sizes.map((entry) => (
              <option key={entry.size} value={entry.size}>
                {entry.size} ({money(entry.price)})
              </option>
            ))}
            {size && !sizes.some((entry) => entry.size === size) ? (
              <option value={size}>{size} (current)</option>
            ) : null}
          </select>
        ) : (
          <input
            type="text"
            className="form-control"
            value={size}
            placeholder="e.g. Standard"
            onChange={(event) => setSize(event.target.value)}
          />
        )}
      </div>

      <div className="form-group">
        <label>Quantity:</label>
        <input
          type="text"
          inputMode="numeric"
          className="form-control"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />
      </div>

      <div className="form-group">
        <label>Price (AZN):</label>
        <input
          type="text"
          inputMode="decimal"
          className="form-control"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
        <small className="form-hint">
          Recalculated from size, comment and discount; edit it to override.
        </small>
      </div>

      <div className="form-group">
        <label>Comment:</label>
        <textarea
          className="form-control"
          rows={2}
          placeholder="e.g. +1 AZN, +3 AZN"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </div>

      <div className="form-group">
        <label>Discount / Sale type:</label>
        <select
          className="form-control"
          value={discount}
          onChange={(event) => setDiscount(event.target.value)}
        >
          {discounts.map((entry) => (
            <option key={entry.id} value={entry.value}>
              {entry.label}
            </option>
          ))}
          {discounts.every((entry) => entry.value !== discount) ? (
            <option value={discount}>{discount}</option>
          ) : null}
        </select>
      </div>

      {discount === 'subscription' ? (
        <div className="form-group">
          <label>Subscription №:</label>
          <input
            type="text"
            className="form-control"
            value={subscription}
            onChange={(event) => setSubscription(event.target.value)}
          />
        </div>
      ) : null}

      <p className="form-hint">
        Line total: <strong>{money(priceValue * quantityValue)}</strong>
      </p>
    </Modal>
  );
}
