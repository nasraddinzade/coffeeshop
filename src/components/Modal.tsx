// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Renders above another modal (item editor on top of the order editor). */
  stacked?: boolean;
  wide?: boolean;
}

export function Modal({ title, onClose, children, footer, stacked, wide }: ModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return createPortal(
    <>
      <div
        className={`modal-overlay active${stacked ? ' stacked' : ''}`}
        onClick={onClose}
        role="presentation"
      />
      <div
        className={`modal active${stacked ? ' stacked' : ''}${wide ? ' modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </>,
    document.body,
  );
}
