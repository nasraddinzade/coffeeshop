// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

import { ArrowLeft, Check, Coffee, CreditCard, Banknote, Plus, ShoppingCart, Tag, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { applyCommentAndDiscount, discountLabelFor, orderTotal } from '../lib/pricing';
import { money, newId } from '../lib/utils';
import { useStore } from '../store/useStore';
import type { Category, OrderItem, Product, ProductSize } from '../types';

const PRESET_COMMENTS = ['No sugar', 'To go'];

type Step = 'categories' | 'products' | 'details';

export function SalesSection() {
  const db = useStore((state) => state.db);
  const draft = useStore((state) => state.draft);
  const addDraftItem = useStore((state) => state.addDraftItem);
  const removeDraftItem = useStore((state) => state.removeDraftItem);
  const setDraftPayment = useStore((state) => state.setDraftPayment);
  const clearDraft = useStore((state) => state.clearDraft);
  const createOrder = useStore((state) => state.createOrder);
  const notify = useStore((state) => state.notify);

  const [step, setStep] = useState<Step>('categories');
  const [category, setCategory] = useState<Category | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [sizeIndex, setSizeIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [preset, setPreset] = useState<string | null>(null);
  const [customComment, setCustomComment] = useState('');
  const [discount, setDiscount] = useState('0');
  const [subscription, setSubscription] = useState('');
  const [busy, setBusy] = useState(false);

  const comment = [preset, customComment.trim()].filter(Boolean).join(', ');

  const sizes: ProductSize[] = useMemo(() => {
    if (!product) return [];
    return product.sizes.length
      ? product.sizes
      : [
          {
            size: '',
            cost: product.baseCost ?? 0,
            price: product.basePrice ?? 0,
            resourceUsage: [],
          },
        ];
  }, [product]);

  const selectedSize = sizes[sizeIndex] ?? sizes[0];
  const unitPrice = selectedSize ? applyCommentAndDiscount(selectedSize.price, comment, discount) : 0;

  const resetDetails = () => {
    setSizeIndex(0);
    setQuantity(1);
    setPreset(null);
    setCustomComment('');
    setDiscount('0');
    setSubscription('');
  };

  const openCategory = (next: Category) => {
    setCategory(next);
    setStep('products');
  };

  const openProduct = (next: Product) => {
    setProduct(next);
    resetDetails();
    setStep('details');
  };

  const addToOrder = () => {
    if (!product || !selectedSize) return;

    const item: OrderItem = {
      id: newId(),
      productId: product.id,
      productName: product.name,
      categoryId: product.categoryId,
      categoryName: category?.name ?? '',
      size: selectedSize.size,
      quantity,
      price: unitPrice,
      cost: selectedSize.cost,
      comment,
      discount,
      subscription: discount === 'subscription' ? subscription : '',
      total: Math.round(unitPrice * quantity * 100) / 100,
    };

    addDraftItem(item);
    notify('Item added to order', 'success');
    resetDetails();
    setStep('categories');
  };

  const complete = async () => {
    setBusy(true);
    try {
      const order = await createOrder();
      if (order) notify('Order saved', 'success');
    } finally {
      setBusy(false);
    }
  };

  const productsInCategory = category
    ? db.products.filter((candidate) => candidate.categoryId === category.id)
    : [];

  return (
    <>
      <div className="section-header">
        <h3>New Order</h3>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            clearDraft();
            resetDetails();
            setStep('categories');
          }}
        >
          <Plus size={16} /> New Order
        </button>
      </div>

      <div className="order-wizard">
        {step === 'categories' ? (
          <div className="wizard-step active">
            <h4>Select Category:</h4>
            <div className="categories-grid">
              {db.categories.length === 0 ? (
                <p className="empty-message">No categories yet. An administrator can add them.</p>
              ) : (
                db.categories.map((item) => (
                  <div
                    key={item.id}
                    className="category-card"
                    style={{ borderColor: item.color }}
                    onClick={() => openCategory(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => event.key === 'Enter' && openCategory(item)}
                  >
                    <div style={{ color: item.color, marginBottom: 10 }}>
                      <Tag size={28} />
                    </div>
                    <h4>{item.name}</h4>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        {step === 'products' ? (
          <div className="wizard-step active">
            <div className="wizard-header">
              <button type="button" className="btn-back" onClick={() => setStep('categories')}>
                <ArrowLeft size={16} /> Back
              </button>
              <h4>{category?.name}</h4>
            </div>
            <div className="products-grid">
              {productsInCategory.length === 0 ? (
                <p className="empty-message">No products in this category.</p>
              ) : (
                productsInCategory.map((item) => {
                  const prices = item.sizes.map((size) => size.price);
                  const label = prices.length
                    ? prices.length > 1
                      ? `${Math.min(...prices).toFixed(2)}–${Math.max(...prices).toFixed(2)} AZN`
                      : money(prices[0])
                    : money(item.basePrice);
                  return (
                    <div
                      key={item.id}
                      className="product-card"
                      onClick={() => openProduct(item)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => event.key === 'Enter' && openProduct(item)}
                    >
                      <Coffee size={28} />
                      <h4>{item.name}</h4>
                      <p>{label}</p>
                      {item.sizes.length > 1 ? <small>{item.sizes.length} sizes</small> : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : null}

        {step === 'details' && product ? (
          <div className="wizard-step active">
            <div className="wizard-header">
              <button type="button" className="btn-back" onClick={() => setStep('products')}>
                <ArrowLeft size={16} /> Back
              </button>
              <h4>{product.name}</h4>
            </div>

            <div className="product-details">
              <div className="size-selection">
                <h5>Select Size:</h5>
                <div className="size-options">
                  {sizes.map((size, index) => (
                    <div
                      key={`${size.size}-${index}`}
                      className={`size-option${index === sizeIndex ? ' active' : ''}`}
                      onClick={() => setSizeIndex(index)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => event.key === 'Enter' && setSizeIndex(index)}
                    >
                      {size.size ? `${size.size} — ${money(size.price)}` : money(size.price)}
                    </div>
                  ))}
                </div>
              </div>

              <div className="quantity-selection">
                <h5>Quantity:</h5>
                <div className="quantity-control">
                  <button
                    type="button"
                    className="btn-quantity"
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  >
                    -
                  </button>
                  <span>{quantity}</span>
                  <button
                    type="button"
                    className="btn-quantity"
                    onClick={() => setQuantity((value) => value + 1)}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="barista-comment">
                <h5>Barista Comment:</h5>
                <div className="comment-options">
                  {PRESET_COMMENTS.map((option) => (
                    <div
                      key={option}
                      className={`comment-option${preset === option ? ' active' : ''}`}
                      onClick={() => setPreset(preset === option ? null : option)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) =>
                        event.key === 'Enter' && setPreset(preset === option ? null : option)
                      }
                    >
                      {option}
                    </div>
                  ))}
                </div>
                <textarea
                  placeholder="Other comment… (+1 AZN / +3 AZN add a surcharge)"
                  value={customComment}
                  onChange={(event) => setCustomComment(event.target.value)}
                />
              </div>

              <div className="discount-selection">
                <h5>Discount / Sale Type:</h5>
                <select value={discount} onChange={(event) => setDiscount(event.target.value)}>
                  {db.discounts.map((option) => (
                    <option key={option.id} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {discount === 'subscription' ? (
                  <input
                    type="text"
                    placeholder="Subscription №"
                    value={subscription}
                    onChange={(event) => setSubscription(event.target.value)}
                  />
                ) : null}
              </div>

              <p className="form-hint">
                Unit price: <strong>{money(unitPrice)}</strong> · Line total:{' '}
                <strong>{money(unitPrice * quantity)}</strong>
              </p>

              <button type="button" className="btn-primary btn-block" onClick={addToOrder}>
                <ShoppingCart size={16} /> Add to Order
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="current-order">
        <h4>Current Order:</h4>
        <div className="order-items">
          {draft.items.length === 0 ? (
            <p className="empty-message">Order is empty</p>
          ) : (
            draft.items.map((item, index) => {
              const label = discountLabelFor(item);
              return (
                <div className="order-item" key={item.id}>
                  <div className="order-item-info">
                    <strong>
                      {item.productName}
                      {item.size ? ` (${item.size})` : ''}
                    </strong>
                    <div className="item-details">
                      {item.quantity} × {money(item.price)}
                      {item.comment ? (
                        <>
                          <br />
                          <small>{item.comment}</small>
                        </>
                      ) : null}
                      {label ? (
                        <>
                          <br />
                          <small>{label}</small>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="order-item-actions">
                    <span className="item-total">{money(item.total)}</span>
                    <button
                      type="button"
                      className="btn-icon"
                      title="Remove"
                      onClick={() => removeDraftItem(index)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="order-summary">
          <div className="payment-method-row">
            <span>Payment:</span>
            <div className="payment-method-btns">
              <button
                type="button"
                className={`btn-payment${draft.paymentMethod === 'cash' ? ' active' : ''}`}
                onClick={() => setDraftPayment('cash')}
              >
                <Banknote size={16} /> Cash
              </button>
              <button
                type="button"
                className={`btn-payment${draft.paymentMethod === 'card' ? ' active' : ''}`}
                onClick={() => setDraftPayment('card')}
              >
                <CreditCard size={16} /> Card
              </button>
            </div>
          </div>

          <div className="summary-row">
            <span>Total:</span>
            <span>{money(orderTotal(draft.items))}</span>
          </div>

          <button
            type="button"
            className="btn-success btn-block"
            onClick={complete}
            disabled={busy || draft.items.length === 0}
          >
            <Check size={16} /> Complete Order
          </button>
        </div>
      </div>
    </>
  );
}
