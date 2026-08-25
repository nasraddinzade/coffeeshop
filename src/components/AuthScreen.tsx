// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

import { Coffee, LogIn } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useStore } from '../store/useStore';

const ROLES = [
  { role: 'barista1', title: 'Barista 1', hint: 'Sales only', color: '#4CAF50', login: 'barista1' },
  { role: 'barista2', title: 'Barista 2', hint: 'Sales only', color: '#2196F3', login: 'barista2' },
  { role: 'admin', title: 'Administrator', hint: 'Full access', color: '#FF9800', login: 'admin' },
];

export function AuthScreen() {
  const login = useStore((state) => state.login);
  const notify = useStore((state) => state.notify);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      notify('Enter username and password', 'error');
      return;
    }

    setBusy(true);
    try {
      const ok = await login(username, password);
      if (ok) {
        setPassword('');
        notify('Welcome back!', 'success');
      } else {
        notify('Invalid username or password', 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen active" id="auth-screen">
      <div className="auth-container">
        <div className="logo">
          <Coffee size={48} />
          <h1>CoffeeShop</h1>
        </div>

        <div className="role-selection">
          {ROLES.map((role) => (
            <div
              key={role.role}
              className="role-option"
              onClick={() => setUsername(role.login)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => event.key === 'Enter' && setUsername(role.login)}
            >
              <div className="role-color" style={{ backgroundColor: role.color }} />
              <div className="role-info">
                <h3>{role.title}</h3>
                <p>{role.hint}</p>
              </div>
            </div>
          ))}
        </div>

        <form className="login-form" onSubmit={submit}>
          <div className="form-group">
            <input
              type="text"
              placeholder="Login"
              autoComplete="off"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
          <div className="form-group">
            <input
              type="password"
              placeholder="Password"
              autoComplete="off"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={busy}>
            <LogIn size={16} /> Login
          </button>
        </form>
      </div>
    </div>
  );
}
