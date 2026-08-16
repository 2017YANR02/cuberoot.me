'use client';

import { useEffect, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import './auth-callback-status.css';

interface AuthCallbackStatusProps {
  pendingLabel: string;
  error?: string;
  children?: ReactNode;
}

export function AuthCallbackStatus({ pendingLabel, error = '', children }: AuthCallbackStatusProps) {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => { root.style.overflow = previous; };
  }, []);

  return (
    <main className="auth-callback-status">
      {error ? (
        <div className="auth-callback-status__result" role="alert" aria-live="assertive">
          <p className="auth-callback-status__error">
            <CircleAlert aria-hidden="true" size={19} />
            <span>{error}</span>
          </p>
          {children}
        </div>
      ) : (
        <div className="auth-callback-status__result" role="status" aria-live="polite">
          <span className="auth-callback-status__spinner" aria-hidden="true" />
          <p>{pendingLabel}</p>
        </div>
      )}
    </main>
  );
}
