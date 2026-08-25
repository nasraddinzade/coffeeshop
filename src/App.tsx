// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

import { useEffect } from 'react';
import { AppShell } from './components/AppShell';
import { AuthScreen } from './components/AuthScreen';
import { ConfirmProvider } from './components/ConfirmProvider';
import { Toasts } from './components/Toasts';
import { useStore } from './store/useStore';

export default function App() {
  const ready = useStore((state) => state.ready);
  const loadError = useStore((state) => state.loadError);
  const currentUser = useStore((state) => state.currentUser);
  const init = useStore((state) => state.init);

  useEffect(() => {
    void init();
  }, [init]);

  if (!ready) {
    return <div className="loading">Loading…</div>;
  }

  if (loadError) {
    return (
      <div className="screen active">
        <div className="auth-container">
          <h2>Could not open the database</h2>
          <p className="error-message">{loadError}</p>
          <p>Restart the application. If the problem persists, restore the latest backup.</p>
        </div>
      </div>
    );
  }

  return (
    <ConfirmProvider>
      {currentUser ? <AppShell /> : <AuthScreen />}
      <Toasts />
    </ConfirmProvider>
  );
}
