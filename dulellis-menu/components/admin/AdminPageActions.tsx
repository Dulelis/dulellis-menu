"use client";

import { createContext, useContext } from "react";
import { createPortal } from "react-dom";

export const AdminActionsTarget = createContext<HTMLDivElement | null>(null);

export function AdminPageActions({ children }: { children: React.ReactNode }) {
  const target = useContext(AdminActionsTarget);
  return target ? createPortal(<div className="admin-page-actions">{children}</div>, target) : null;
}
