// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useConfirm } from '../components/ConfirmProvider';
import { Modal } from '../components/Modal';
import { newId } from '../lib/utils';
import { useStore } from '../store/useStore';
import type { Category } from '../types';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function CategoriesSection() {
  const db = useStore((state) => state.db);
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="section-header">
        <h3>Category Management</h3>
        <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> Add Category
        </button>
      </div>

      <div className="categories-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Color</th>
              <th>Products</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {db.categories.length === 0 ? (
              <tr>
                <td colSpan={4} className="empty-message">
                  No categories yet.
                </td>
              </tr>
            ) : (
              db.categories.map((category) => (
                <tr key={category.id}>
                  <td>{category.name}</td>
                  <td>
                    <span className="color-badge" style={{ backgroundColor: category.color }} />
                  </td>
                  <td>
                    {db.products.filter((product) => product.categoryId === category.id).length}
                  </td>
                  <td className="table-actions">
                    <button
                      type="button"
                      className="btn-icon"
                      title="Edit"
                      onClick={() => setEditing(category)}
                    >
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {creating ? <CategoryModal onClose={() => setCreating(false)} /> : null}
      {editing ? <CategoryModal category={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function CategoryModal({ category, onClose }: { category?: Category; onClose: () => void }) {
  const categories = useStore((state) => state.db.categories);
  const products = useStore((state) => state.db.products);
  const saveCategory = useStore((state) => state.saveCategory);
  const deleteCategory = useStore((state) => state.deleteCategory);
  const notify = useStore((state) => state.notify);
  const confirm = useConfirm();

  const [name, setName] = useState(category?.name ?? '');
  const [color, setColor] = useState(category?.color ?? '#4CAF50');

  const submit = async () => {
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!clean) {
      notify('Enter a category name', 'error');
      return;
    }
    if (clean.length > 100) {
      notify('Category name is too long (max 100 characters)', 'error');
      return;
    }
    if (!HEX_COLOR.test(color)) {
      notify('Invalid colour. Use #RRGGBB', 'error');
      return;
    }
    if (
      categories.some(
        (entry) => entry.name.toLowerCase() === clean.toLowerCase() && entry.id !== category?.id,
      )
    ) {
      notify('A category with this name already exists', 'error');
      return;
    }

    await saveCategory({ id: category?.id ?? newId(), name: clean, color });
    notify('Category saved', 'success');
    onClose();
  };

  const remove = async () => {
    if (!category) return;
    const used = products.filter((product) => product.categoryId === category.id).length;
    const ok = await confirm({
      title: 'Delete category',
      message: used
        ? `“${category.name}” still has ${used} product(s). They will stay in the catalogue without a category. Continue?`
        : `Delete “${category.name}”?`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await deleteCategory(category.id);
    notify('Category deleted', 'success');
    onClose();
  };

  return (
    <Modal
      title={category ? 'Edit category' : 'New category'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {category ? (
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
        <label>Category Name:</label>
        <input
          type="text"
          className="form-control"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="form-group">
        <label>Category Color:</label>
        <input
          type="color"
          className="form-control"
          value={color}
          onChange={(event) => setColor(event.target.value)}
        />
      </div>
    </Modal>
  );
}
