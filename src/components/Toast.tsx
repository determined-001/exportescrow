'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Tone = 'info' | 'error' | 'success';
interface ToastState {
  message: string;
  tone: Tone;
}

const ToastContext = createContext<{ push: (message: string, tone?: Tone) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const push = useCallback((message: string, tone: Tone = 'info') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const toneClass =
    toast?.tone === 'error'
      ? 'bg-red-600 text-white'
      : toast?.tone === 'success'
        ? 'bg-emerald-600 text-white'
        : 'bg-slate-800 text-white';

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 rounded px-4 py-2 text-sm shadow-lg ${toneClass}`}>
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
