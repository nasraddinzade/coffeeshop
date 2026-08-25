// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

import type { Order, OrderItem, Product, Resource, ResourceUsage } from '../types';
import { round2 } from './utils';

/**
 * Barista comments can carry a surcharge: every `+1 AZN` adds one manat and
 * every `+3 AZN` adds three. The regexes are anchored on the digit so
 * `+11 AZN` is not read as a `+1 AZN`.
 */
export function commentSurcharge(comment: string): number {
  const text = comment ?? '';
  const plus1 = text.match(/\+1\s*AZN/gi)?.length ?? 0;
  const plus3 = text.match(/\+3\s*AZN/gi)?.length ?? 0;
  return plus1 * 1 + plus3 * 3;
}

/**
 * Base price + comment surcharge + discount, rounded to cents.
 * `free` zeroes the line, `subscription` leaves the price untouched (it is
 * only a marker for the sale type), everything else is a percentage.
 */
export function applyCommentAndDiscount(
  basePrice: number,
  comment: string,
  discount: string,
): number {
  let price = (Number(basePrice) || 0) + commentSurcharge(comment);

  if (discount === 'free') {
    price = 0;
  } else if (discount && discount !== '0' && discount !== 'subscription') {
    const percent = parseInt(discount, 10) || 0;
    price = price * (1 - percent / 100);
  }

  return round2(price);
}

export function orderTotal(items: OrderItem[]): number {
  return round2(items.reduce((sum, item) => sum + (Number(item.total) || 0), 0));
}

export function orderCost(items: OrderItem[]): number {
  return round2(
    items.reduce((sum, item) => sum + (Number(item.cost) || 0) * (Number(item.quantity) || 1), 0),
  );
}

export function discountLabelFor(item: OrderItem): string | null {
  if (!item.discount || item.discount === '0') return null;
  if (item.discount === 'free') return 'Free';
  if (item.discount === 'subscription') {
    return item.subscription ? `Subscription: ${item.subscription}` : 'Subscription';
  }
  return `Discount: ${item.discount}%`;
}

/** Resource usage for one sold unit: per-size first, product-level as fallback. */
function usageForItem(product: Product | undefined, size: string): ResourceUsage[] {
  if (!product) return [];
  const wanted = (size ?? '').trim();
  const sizeMatch = product.sizes?.find((s) => (s.size ?? '').trim() === wanted);
  return sizeMatch?.resourceUsage ?? [];
}

/**
 * Returns the resources with their stock reduced by what the items consume.
 * Resources that are not touched come back unchanged.
 */
export function subtractResources(
  resources: Resource[],
  items: Pick<OrderItem, 'productId' | 'size' | 'quantity'>[],
  products: Product[],
): Resource[] {
  const productById = new Map(products.map((p) => [p.id, p]));
  const deltas = new Map<string, number>();

  for (const item of items) {
    const quantity = Number(item.quantity) || 0;
    if (quantity <= 0) continue;

    for (const usage of usageForItem(productById.get(item.productId), item.size)) {
      const amount = (Number(usage.quantityPerUnit) || 0) * quantity;
      if (amount <= 0) continue;
      deltas.set(usage.resourceId, (deltas.get(usage.resourceId) ?? 0) + amount);
    }
  }

  if (deltas.size === 0) return resources;

  return resources.map((resource) => {
    const delta = deltas.get(resource.id);
    if (!delta) return resource;
    return { ...resource, currentQuantity: round2((Number(resource.currentQuantity) || 0) - delta) };
  });
}

/**
 * When an order is edited, only the *increase* in quantity consumes stock —
 * removing an item does not put resources back (they were already used).
 */
export function subtractResourcesForDelta(
  resources: Resource[],
  oldItems: OrderItem[],
  newItems: OrderItem[],
  products: Product[],
): Resource[] {
  const key = (item: Pick<OrderItem, 'productId' | 'size'>) =>
    `${item.productId ?? ''}|${item.size ?? ''}`;

  const sum = (items: OrderItem[]) => {
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(key(item), (map.get(key(item)) ?? 0) + (Number(item.quantity) || 0));
    }
    return map;
  };

  const oldSums = sum(oldItems);
  const increases: Pick<OrderItem, 'productId' | 'size' | 'quantity'>[] = [];

  for (const [itemKey, newQuantity] of sum(newItems)) {
    const delta = newQuantity - (oldSums.get(itemKey) ?? 0);
    if (delta <= 0) continue;
    const sample = newItems.find((item) => key(item) === itemKey);
    if (sample) {
      increases.push({ productId: sample.productId, size: sample.size, quantity: delta });
    }
  }

  if (increases.length === 0) return resources;
  return subtractResources(resources, increases, products);
}

/** Human-readable summary of an edit, stored in the order history. */
export function describeOrderChanges(
  previous: Order,
  newItems: OrderItem[],
  newTotal: number,
  newPayment: string,
): string {
  const parts: string[] = [];
  const oldTotal = Number(previous.total) || 0;
  const oldPayment = previous.paymentMethod === 'card' ? 'card' : 'cash';

  if (Math.abs(oldTotal - newTotal) > 0.001) {
    parts.push(`Total: ${oldTotal.toFixed(2)} → ${newTotal.toFixed(2)} AZN`);
  }
  if (oldPayment !== newPayment) {
    parts.push(`Payment: ${oldPayment} → ${newPayment}`);
  }

  const key = (item: OrderItem) =>
    `${item.productName ?? ''}|${item.size ?? ''}|${Number(item.quantity) || 0}|${
      Number(item.price) || 0
    }`;
  const label = (item: OrderItem) =>
    `${item.productName || '?'} ${item.size ? `(${item.size})` : ''}×${item.quantity || 1}`.trim();

  const tally = (items: OrderItem[]) => {
    const map = new Map<string, { count: number; label: string }>();
    for (const item of items) {
      const entry = map.get(key(item)) ?? { count: 0, label: label(item) };
      entry.count += 1;
      map.set(key(item), entry);
    }
    return map;
  };

  const oldMap = tally(previous.items ?? []);
  const newMap = tally(newItems ?? []);

  const removed: string[] = [];
  for (const [k, entry] of oldMap) {
    const diff = entry.count - (newMap.get(k)?.count ?? 0);
    for (let i = 0; i < diff; i += 1) removed.push(entry.label);
  }

  const added: string[] = [];
  for (const [k, entry] of newMap) {
    const diff = entry.count - (oldMap.get(k)?.count ?? 0);
    for (let i = 0; i < diff; i += 1) added.push(entry.label);
  }

  if (removed.length) parts.push(`Removed: ${removed.join('; ')}`);
  if (added.length) parts.push(`Added: ${added.join('; ')}`);

  return parts.length ? parts.join('. ') : 'Order edited';
}
