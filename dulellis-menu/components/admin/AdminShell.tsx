"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Menu, X } from "lucide-react";
import { AdminActionsTarget } from "./AdminPageActions";
import { AdminSaleAlert } from "./AdminSaleAlert";

const items = [
  ["Painel geral", "/admin?tab=painel"],
  ["Estoque / Cardápio", "/admin?tab=estoque"],
  ["Cardápio divulgação", "/admin?tab=cardapio"],
  ["Promoções", "/admin?tab=promocoes"],
  ["Propaganda", "/admin?tab=propagandas"],
  ["Notificar clientes", "/admin/notificacoes"],
  ["Sorteios", "/admin/sorteios"],
  ["Clientes", "/admin?tab=clientes"],
  ["Taxas de entrega", "/admin?tab=taxas"],
  ["Entregadores", "/admin?tab=entregadores"],
  ["Vendas do dia", "/admin?tab=vendas"],
  ["Central de vendas", "/admin/vendas"],
  ["Agenda de encomendas", "/admin/encomendas"],
  ["Loja de produtos naturais", "/admin/naturais"],
  ["Relatórios", "/admin?tab=relatorios"],
  ["Controle administrativo", "/admin?tab=controle"],
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const [actionsTarget, setActionsTarget] = useState<HTMLDivElement | null>(null);
  const router = useRouter();
  const visited = useRef<string[]>([]);
  const content = useRef<HTMLDivElement>(null);
  const tab = params.get("tab") || "estoque";
  const current = pathname === "/admin" ? `/admin?tab=${tab}` : pathname;
  const title = items.find(([, href]) => href === current)?.[0] || "Administração";
  useEffect(() => {
    content.current?.scrollTo(0, 0);
    const url = `${pathname}${params.size ? `?${params.toString()}` : ""}`;
    if (visited.current.at(-1) !== url) visited.current.push(url);
  }, [current, pathname, params]);
  const goBack = () => {
    visited.current.pop();
    router.push(visited.current.at(-1) || "/admin?tab=painel", { scroll: false });
  };
  if (["/admin/login", "/admin/impressao", "/admin/offline"].includes(pathname)) return children;

  return (
    <AdminActionsTarget.Provider value={actionsTarget}>
    <div className={`admin-workspace ${menuOpen ? "admin-menu-expanded" : ""}`}>
      <AdminSaleAlert />
      <aside className={`admin-navigation ${menuOpen ? "is-open" : ""}`} aria-label="Menu administrativo">
        <div className="admin-brand">DULELIS <button type="button" onClick={() => setMenuOpen(false)} className="lg:hidden" aria-label="Fechar menu"><X size={22} /></button></div>
        <nav aria-label="Funções do administrador">
          {items.map(([label, href]) => <Link key={href} href={href} onClick={() => setMenuOpen(false)} aria-current={href === current ? "page" : undefined}>{label}</Link>)}
        </nav>
      </aside>
      {menuOpen && <button type="button" className="admin-menu-backdrop lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" />}
      <div className="admin-content-column">
        <div className="admin-topbar print:hidden">
          <div className="admin-navigation-actions">
            <button type="button" className="admin-toolbar-button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label="Alternar menu"><Menu size={18} /> Menu</button>
            <button type="button" className="admin-toolbar-button" onClick={goBack}><ArrowLeft size={18} /> Voltar</button>
            <span className="min-w-0 truncate font-bold">{title}</span>
          </div>
          <div className="admin-actions-slot" ref={setActionsTarget} />
        </div>
        <div ref={content} className="admin-page-content" key={pathname}>{children}</div>
      </div>
    </div>
    </AdminActionsTarget.Provider>
  );
}
