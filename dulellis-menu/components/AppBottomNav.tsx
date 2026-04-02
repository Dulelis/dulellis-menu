"use client";

import type { LucideIcon } from "lucide-react";
import { House, ShoppingBag, Sparkles, UtensilsCrossed } from "lucide-react";

type AppTab = "home" | "highlights" | "menu" | "order";

type AppBottomNavProps = {
  activeTab: AppTab;
  cartCount: number;
  isLoggedIn: boolean;
  canTrackOrder: boolean;
  onHome: () => void;
  onHighlights: () => void;
  onMenu: () => void;
  onOrder: () => void;
};

type NavItem = {
  id: AppTab;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  badge?: string;
};

export function AppBottomNav({
  activeTab,
  cartCount,
  isLoggedIn,
  canTrackOrder,
  onHome,
  onHighlights,
  onMenu,
  onOrder,
}: AppBottomNavProps) {
  const orderLabel = cartCount > 0 ? "Carrinho" : canTrackOrder ? "Pedido" : isLoggedIn ? "Conta" : "Entrar";
  const orderBadge = cartCount > 0 ? String(cartCount) : canTrackOrder ? "ok" : undefined;

  const items: NavItem[] = [
    { id: "home", label: "Inicio", icon: House, onClick: onHome },
    { id: "highlights", label: "Destaques", icon: Sparkles, onClick: onHighlights },
    { id: "menu", label: "Cardapio", icon: UtensilsCrossed, onClick: onMenu },
    { id: "order", label: orderLabel, icon: ShoppingBag, onClick: onOrder, badge: orderBadge },
  ];

  return (
    <div className="app-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-pink-100/80 bg-white/95 shadow-[0_-16px_36px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <nav className="mx-auto flex w-full max-w-xl items-center gap-1 px-3 py-2 sm:px-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeTab;

          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[1.35rem] px-2 py-2.5 transition-all ${
                active ? "bg-pink-600 text-white shadow-lg shadow-pink-200/80" : "text-slate-500"
              }`}
            >
              <span className="relative flex h-9 w-9 items-center justify-center rounded-2xl bg-white/12">
                <Icon size={18} />
                {item.badge ? (
                  <span
                    className={`absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] font-black uppercase ${
                      active ? "bg-white text-pink-600" : "bg-pink-600 text-white"
                    }`}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </span>
              <span className="max-w-full truncate text-[10px] font-black uppercase tracking-[0.18em]">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
