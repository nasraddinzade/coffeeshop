// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useConfirm } from '../components/ConfirmProvider';
import { Modal } from '../components/Modal';
import { formatDate, newId, roleLabel } from '../lib/utils';
import { useStore } from '../store/useStore';
import type { Role, User } from '../types';

const ROLES: Role[] = ['barista1', 'barista2', 'admin'];

export function UsersSection() {
  const users = useStore((state) => state.db.users);
  const currentUser = useStore((state) => state.currentUser)!;
  const deleteUser = useStore((state) => state.deleteUser);
  const notify = useStore((state) => state.notify);
  const confirm = useConfirm();

  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);

  const remove = async (user: User) => {
    if (user.id === currentUser.id) {
      notify('You cannot delete your own account', 'error');
      return;
    }
    if (user.login === 'admin') {
      notify('The system administrator account cannot be deleted', 'error');
      return;
    }

    const ok = await confirm({
      title: 'Delete user',
      message: `Delete user “${user.name}”?`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    await deleteUser(user.id);
    notify('User deleted', 'success');
  };

  return (
    <>
      <div className="section-header">
        <h3>User Management</h3>
        <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="users-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Login</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const undeletable = user.login === 'admin' || user.id === currentUser.id;
              return (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>
                    <span className="role-badge" style={{ backgroundColor: user.color }}>
                      {roleLabel(user.role)}
                    </span>
                  </td>
                  <td>{user.login}</td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td className="table-actions">
                    <button
                      type="button"
                      className="btn-icon"
                      title="Edit"
                      onClick={() => setEditing(user)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="btn-icon"
                      title={
                        undeletable ? 'This account cannot be deleted' : 'Delete'
                      }
                      disabled={undeletable}
                      style={undeletable ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                      onClick={() => remove(user)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {creating ? <UserModal onClose={() => setCreating(false)} /> : null}
      {editing ? <UserModal user={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function UserModal({ user, onClose }: { user?: User; onClose: () => void }) {
  const users = useStore((state) => state.db.users);
  const saveUser = useStore((state) => state.saveUser);
  const notify = useStore((state) => state.notify);

  const [name, setName] = useState(user?.name ?? '');
  const [login, setLogin] = useState(user?.login ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(user?.role ?? 'barista1');
  const [color, setColor] = useState(user?.color ?? '#4CAF50');

  const submit = async () => {
    const cleanLogin = login.trim().toLowerCase();
    if (!name.trim() || !cleanLogin) {
      notify('Fill in name and login', 'error');
      return;
    }
    if (!user && !password) {
      notify('Set a password for the new user', 'error');
      return;
    }
    if (users.some((entry) => entry.login === cleanLogin && entry.id !== user?.id)) {
      notify('This login is already taken', 'error');
      return;
    }

    await saveUser({
      id: user?.id ?? newId(),
      name: name.trim(),
      login: cleanLogin,
      role,
      color,
      createdAt: user?.createdAt ?? new Date().toISOString(),
      plainPassword: password || undefined,
    });

    notify(user ? 'User updated' : 'User created', 'success');
    onClose();
  };

  return (
    <Modal
      title={user ? 'Edit user' : 'New user'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={submit}>
            <Save size={16} /> {user ? 'Save' : 'Create'}
          </button>
        </>
      }
    >
      <div className="form-group">
        <label>Name:</label>
        <input
          type="text"
          className="form-control"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="form-group">
        <label>Login:</label>
        <input
          type="text"
          className="form-control"
          value={login}
          onChange={(event) => setLogin(event.target.value)}
        />
      </div>
      <div className="form-group">
        <label>{user ? 'New password (leave empty to keep current):' : 'Password:'}</label>
        <input
          type="password"
          className="form-control"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <div className="form-group">
        <label>Role:</label>
        <select
          className="form-control"
          value={role}
          onChange={(event) => setRole(event.target.value as Role)}
        >
          {ROLES.map((option) => (
            <option key={option} value={option}>
              {roleLabel(option)}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Color:</label>
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
