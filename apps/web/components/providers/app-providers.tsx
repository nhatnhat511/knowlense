"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type AppUser = {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
};

type SessionStoreValue = {
  user: AppUser | null;
  setUser: (user: AppUser | null) => void;
};

type ToastItem = {
  id: string;
  title: string;
};

type ToastContextValue = {
  showToast: (message: string) => void;
};

const SessionStoreContext = createContext<SessionStoreValue | null>(null);
const ToastContext = createContext<ToastContextValue | null>(null);

function ToastViewport({ items }: { items: ToastItem[] }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex max-w-sm flex-col gap-3">
      {items.map((item) => (
        <div
          className="rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm text-gray-700 shadow-[0_20px_55px_rgba(15,23,42,0.12)]"
          key={item.id}
        >
          {item.title}
        </div>
      ))}
    </div>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const sessionValue = useMemo(() => ({ user, setUser }), [user]);

  const toastValue = useMemo(
    () => ({
      showToast(message: string) {
        const id = crypto.randomUUID();
        setToasts((current) => [...current, { id, title: message }]);
        window.setTimeout(() => {
          setToasts((current) => current.filter((toast) => toast.id !== id));
        }, 3200);
      }
    }),
    []
  );

  return (
    <SessionStoreContext.Provider value={sessionValue}>
      <ToastContext.Provider value={toastValue}>
        {children}
        <ToastViewport items={toasts} />
      </ToastContext.Provider>
    </SessionStoreContext.Provider>
  );
}

export function useSessionStore() {
  const context = useContext(SessionStoreContext);

  if (!context) {
    throw new Error("useSessionStore must be used inside AppProviders.");
  }

  return context;
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside AppProviders.");
  }

  return context;
}
