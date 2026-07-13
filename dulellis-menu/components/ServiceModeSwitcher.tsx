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
      className="mx-auto grid w-full max-w-xl grid-cols-2 gap-2 rounded-[1.6rem] border border-pink-100 bg-white/95 p-2 shadow-lg shadow-pink-100/50"
    >
      {items.map(({ id, label, href, Icon }) => {
        const selected = id === active;
        return (
          <Link
            key={id}
            href={href}
            aria-current={selected ? "page" : undefined}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-[1.2rem] px-3 py-3 text-center text-[11px] font-black uppercase tracking-[0.12em] transition-colors ${
              selected
                ? "bg-pink-600 text-white shadow-md shadow-pink-200"
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
