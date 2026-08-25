// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Modal } from './Modal';

interface ConfirmOptions {
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm>(async () => false);

/** `window.confirm` is unavailable in the Tauri webview, so we render our own. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<
    (ConfirmOptions & { resolve: (value: boolean) => void }) | null
  >(null);

  const confirm = useCallback<Confirm>(
    (options) => new Promise<boolean>((resolve) => setRequest({ ...options, resolve })),
    [],
  );

  const close = (value: boolean) => {
    request?.resolve(value);
    setRequest(null);
  };

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {request ? (
        <Modal
          stacked
          title={request.title ?? 'Please confirm'}
          onClose={() => close(false)}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => close(false)}>
                {request.cancelLabel ?? 'Cancel'}
              </button>
              <button
                type="button"
                className={request.danger ? 'btn-danger' : 'btn-primary'}
                onClick={() => close(true)}
              >
                {request.confirmLabel ?? 'Confirm'}
              </button>
            </>
          }
        >
          <div>{request.message}</div>
        </Modal>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Confirm {
  return useContext(ConfirmContext);
}
