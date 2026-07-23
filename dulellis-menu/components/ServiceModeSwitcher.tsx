import Link from "next/link";
import { CalendarDays, ShoppingBag } from "lucide-react";

type ServiceModeSwitcherProps = {
  active: "delivery" | "encomendas";
};

export function ServiceModeSwitcher({ active }: ServiceModeSwitcherProps) {
  const items = [
    { id: "delivery" as const, label: "Delivery agora", href: "/", Icon: ShoppingBag },
    { id: "encomendas" as const, label: "Encomendar", href: "/encomendas", Icon: CalendarDays },
  ];

  return (
    <nav
      aria-label="Escolha entre delivery e encomendas"
      className="mx-auto grid w-full max-w-xl grid-cols-2 gap-2 rounded-[1.4rem] border border-pink-100 bg-white/95 p-1.5 shadow-[0_8px_24px_rgba(138,75,29,0.08)]"
    >
      {items.map(({ id, label, href, Icon }) => {
        const selected = id === active;
        return (
          <Link
            key={id}
            href={href}
            aria-current={selected ? "page" : undefined}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-[1.05rem] px-3 py-3 text-center text-xs font-extrabold uppercase tracking-[0.06em] transition-colors ${
              selected
                ? "bg-pink-600 text-white shadow-[0_6px_16px_rgba(189,43,109,0.2)]"
                : "bg-pink-50 text-pink-700 hover:bg-pink-100"
            }`}
          >
            <Icon size={17} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
