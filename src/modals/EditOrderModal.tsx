// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

import { Check, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { useConfirm } from '../components/ConfirmProvider';
import { discountLabelFor, orderTotal } from '../lib/pricing';
import { formatDateTime, money, roleLabel, shortOrderId } from '../lib/utils';
import { useStore } from '../store/useStore';
import type { OrderItem, PaymentMethod, Product } from '../types';
import { OrderItemModal } from './OrderItemModal';
import { PickProductModal } from './PickProductModal';

interface EditOrderModalProps {
  orderId: string;
  onClose: () => void;
}

interface Editing {
  product: Product;
  item?: OrderItem;
  index?: number;
}

export function EditOrderModal({ orderId, onClose }: EditOrderModalProps) {
  const db = useStore((state) => state.db);
  const currentUser = useStore((state) => state.currentUser)!;
  const saveOrderEdits = useStore((state) => state.saveOrderEdits);
  const finishOrder = useStore((state) => state.finishOrder);
  const deleteOrder = useStore((state) => state.deleteOrder);
  const notify = useStore((state) => state.notify);
  const confirm = useConfirm();

  const order = db.orders.find((candidate) => candidate.id === orderId);
  const [items, setItems] = useState<OrderItem[]>(order ? [...order.items] : []);
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [finishing, setFinishing] = useState(false);

  const history = useMemo(
    () =>
      db.history
        .filter((entry) => entry.orderId === orderId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [db.history, orderId],
  );

  if (!order) {
    return (
      <Modal title="Order" onClose={onClose}>
        <p className="error-message">This order no longer exists.</p>
      </Modal>
    );
  }

  const total = orderTotal(items);
  const dirty = JSON.stringify(items) !== JSON.stringify(order.items);
  const isAdmin = currentUser.role === 'admin';

  const openItemEditor = (item: OrderItem, index: number) => {
    const product = db.products.find((candidate) => candidate.id === item.productId);
    if (!product) {
      notify('The product behind this line no longer exists', 'error');
      return;
    }
    setEditing({ product, item, index });
  };

  const removeItem = async (index: number) => {
    const ok = await confirm({
      title: 'Remove item',
      message: 'Delete this item from the order?',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    setItems((current) => current.filter((_item, position) => position !== index));
  };

  const applyItem = (item: OrderItem) => {
    setItems((current) => {
      if (editing?.index === undefined) return [...current, item];
      return current.map((existing, position) => (position === editing.index ? item : existing));
    });
    setEditing(null);
  };

  const save = async () => {
    await saveOrderEdits(orderId, items);
    notify('Changes saved', 'success');
    onClose();
  };

  const finish = async (payment: PaymentMethod) => {
    await finishOrder(orderId, items, payment);
    notify('Order finished', 'success');
    setFinishing(false);
    onClose();
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete order',
      message: `Delete order #${shortOrderId(orderId)}? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await deleteOrder(orderId);
    notify('Order deleted', 'success');
    onClose();
  };

  return (
    <>
      <Modal
        title="Edit Order"
        onClose={onClose}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            {isAdmin ? (
              <button type="button" className="btn-danger" onClick={remove}>
                <Trash2 size={16} /> Delete
              </button>
            ) : null}
            <button
              type="button"
              className="btn-primary"
              onClick={save}
              disabled={!dirty}
              title={dirty ? '' : 'No changes were made'}
            >
              <Save size={16} /> Save Changes
            </button>
            <button type="button" className="btn-success" onClick={() => setFinishing(true)}>
              <Check size={16} /> Finish Order
            </button>
          </>
        }
      >
        <div className="order-info">
          <p>
            <strong>Order #{shortOrderId(order.id)}</strong>
          </p>
          <p>Date: {formatDateTime(order.date)}</p>
          <p>
            Created by: {order.userName || '—'}
            {order.userRole ? ` (${roleLabel(order.userRole)})` : ''}
          </p>
          <p>
            Total: <span>{money(total)}</span>
          </p>
          <p>
            Payment: <strong>{order.paymentMethod === 'card' ? 'Card' : 'Cash'}</strong> (can be
            changed when finishing the order)
          </p>
        </div>

        {history.length > 0 ? (
          <div className="order-history-block">
            <h4>Order history</h4>
            <ul className="order-history-list">
              {history.map((entry) => (
                <li key={entry.id}>
                  <strong>
                    {entry.action === 'create'
                      ? 'Created'
                      : entry.action === 'edit'
                        ? 'Edited'
                        : 'Deleted'}
                  </strong>{' '}
                  by {entry.userName || '—'}
                  {entry.userRole ? ` (${roleLabel(entry.userRole)})` : ''} ·{' '}
                  {formatDateTime(entry.timestamp)}
                  {entry.changes && entry.changes !== 'Order edited' ? (
                    <div>
                      <small>{entry.changes}</small>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="edit-order-items">
          {items.length === 0 ? (
            <p className="empty-message">This order has no items.</p>
          ) : (
            items.map((item, index) => {
              const label = discountLabelFor(item);
              return (
                <div className="edit-order-item" key={item.id}>
                  <div style={{ flex: 1 }}>
                    <strong>
                      {item.productName}
                      {item.size ? ` (${item.size})` : ''}
                    </strong>
                    <div>
                      {item.quantity} × {money(item.price)} = {money(item.total)}
                    </div>
                    {item.comment ? (
                      <div>
                        <small>{item.comment}</small>
                      </div>
                    ) : null}
                    {label ? (
                      <div>
                        <small>{label}</small>
                      </div>
                    ) : null}
                  </div>
                  <div className="edit-order-item-actions">
                    <button
                      type="button"
                      className="btn-icon"
                      title="Edit"
                      onClick={() => openItemEditor(item, index)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="btn-icon"
                      title="Delete item"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <button type="button" className="btn-secondary btn-block" onClick={() => setPicking(true)}>
          <Plus size={16} /> Add item
        </button>
      </Modal>

      {picking ? (
        <PickProductModal
          onClose={() => setPicking(false)}
          onPick={(product) => {
            setPicking(false);
            setEditing({ product });
          }}
        />
      ) : null}

      {editing ? (
        <OrderItemModal
          product={editing.product}
          item={editing.item}
          onSave={applyItem}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {finishing ? (
        <FinishOrderModal
          summary={`Order #${shortOrderId(order.id)} · Items: ${items.length} · Total: ${money(total)}`}
          initialPayment={order.paymentMethod}
          onConfirm={finish}
          onClose={() => setFinishing(false)}
        />
      ) : null}
    </>
  );
}

interface FinishOrderModalProps {
  summary: string;
  initialPayment: PaymentMethod;
  onConfirm: (payment: PaymentMethod) => void;
  onClose: () => void;
}

function FinishOrderModal({ summary, initialPayment, onConfirm, onClose }: FinishOrderModalProps) {
  const [payment, setPayment] = useState<PaymentMethod>(initialPayment);

  return (
    <Modal
      stacked
      title="Finish Order"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-success" onClick={() => onConfirm(payment)}>
            <Check size={16} /> Confirm
          </button>
        </>
      }
    >
      <p>{summary}</p>
      <div className="form-group">
        <label>Payment method:</label>
        <select
          className="form-control"
          value={payment}
          onChange={(event) => setPayment(event.target.value === 'card' ? 'card' : 'cash')}
        >
          <option value="cash">Cash</option>
          <option value="card">Card</option>
        </select>
      </div>
    </Modal>
  );
}
