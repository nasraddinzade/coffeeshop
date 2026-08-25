// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

import { Banknote, Check, CreditCard, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EditOrderModal } from '../modals/EditOrderModal';
import { formatDateTime, isOnLocalDay, money, roleLabel, shortOrderId, toDateInputValue } from '../lib/utils';
import { useStore } from '../store/useStore';

export function OrdersSection() {
  const orders = useStore((state) => state.db.orders);
  const [day, setDay] = useState(() => toDateInputValue(new Date()));
  const [editing, setEditing] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      orders
        .filter((order) => (day ? isOnLocalDay(order.date, day) : true))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [orders, day],
  );

  return (
    <>
      <div className="section-header">
        <h3>All Orders</h3>
        <div className="date-filter">
          <input type="date" value={day} onChange={(event) => setDay(event.target.value)} />
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setDay(toDateInputValue(new Date()))}
          >
            Today
          </button>
        </div>
      </div>

      <div className="orders-list">
        {visible.length === 0 ? (
          <p className="empty-message">No orders for {day || 'the selected day'}</p>
        ) : (
          visible.map((order) => (
            <div
              key={order.id}
              className={`order-card${order.status === 'edited' ? ' edited-order' : ''}`}
            >
              <div className="order-card-header">
                <span>Order #{shortOrderId(order.id)}</span>
                <span>{formatDateTime(order.date)}</span>
              </div>

              <div className="order-card-body">
                <div className="order-items-preview">
                  {(order.items ?? [])
                    .slice(0, 3)
                    .map((item) => `${item.productName} ×${item.quantity}`)
                    .join(', ')}
                  {(order.items ?? []).length > 3 ? ' …' : ''}
                </div>
                <div className="order-card-total">
                  <strong>{money(order.total)}</strong>
                  <button
                    type="button"
                    className="btn-icon"
                    title="Edit"
                    onClick={() => setEditing(order.id)}
                  >
                    <Pencil size={16} />
                  </button>
                </div>
              </div>

              <div className="order-card-footer">
                <span title="Who took the order">
                  {order.userName || '—'}
                  {order.userRole ? ` (${roleLabel(order.userRole)})` : ''}
                </span>
                <span className="order-payment-badge">
                  {order.paymentMethod === 'card' ? (
                    <>
                      <CreditCard size={14} /> Card
                    </>
                  ) : (
                    <>
                      <Banknote size={14} /> Cash
                    </>
                  )}
                </span>
                {order.status === 'edited' ? (
                  <span className="edited-badge" title="Order was edited after creation">
                    <Pencil size={12} /> Edited
                  </span>
                ) : order.status === 'completed' ? (
                  <span className="completed-badge" title="Order is finished">
                    <Check size={12} /> Finished
                  </span>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      {editing ? <EditOrderModal orderId={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}
