"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

type SalesCalendarProps = {
  selectedDate: string;
  salesByDate: Record<string, number>;
  onSelectDate: (date: string) => void;
  className?: string;
};

const WEEK_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return {
    year: year || new Date().getFullYear(),
    month: month ? month - 1 : new Date().getMonth(),
    day: day || 1,
  };
}

export function SalesCalendar({
  selectedDate,
  salesByDate,
  onSelectDate,
  className = "",
}: SalesCalendarProps) {
  const selected = parseDateKey(selectedDate);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(selected.year, selected.month, 1),
  );

  const days = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const mondayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
    return [
      ...Array.from({ length: mondayOffset }, () => null),
      ...Array.from({ length: totalDays }, (_, index) => index + 1),
    ];
  }, [visibleMonth]);

  const today = new Date();
  const todayKey = dateKey(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const maxSales = Math.max(1, ...Object.values(salesByDate));
  const monthLabel = visibleMonth.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <section
      className={`rounded-[2rem] border border-rose-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label="Mês anterior"
          onClick={() =>
            setVisibleMonth(
              new Date(
                visibleMonth.getFullYear(),
                visibleMonth.getMonth() - 1,
                1,
              ),
            )
          }
          className="rounded-xl border border-slate-200 p-2.5 text-slate-600 transition hover:bg-slate-50"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-600">
            Calendário de vendas
          </p>
          <h2 className="mt-1 text-lg font-black capitalize text-slate-900">
            {monthLabel}
          </h2>
        </div>
        <button
          type="button"
          aria-label="Próximo mês"
          onClick={() =>
            setVisibleMonth(
              new Date(
                visibleMonth.getFullYear(),
                visibleMonth.getMonth() + 1,
                1,
              ),
            )
          }
          className="rounded-xl border border-slate-200 p-2.5 text-slate-600 transition hover:bg-slate-50"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-2">
        {WEEK_DAYS.map((day) => (
          <div
            key={day}
            className="pb-1 text-center text-[9px] font-black uppercase tracking-wider text-slate-400 sm:text-[10px]"
          >
            {day}
          </div>
        ))}
        {days.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} aria-hidden="true" />;
          }
          const key = dateKey(
            visibleMonth.getFullYear(),
            visibleMonth.getMonth(),
            day,
          );
          const count = salesByDate[key] || 0;
          const isSelected = key === selectedDate;
          const isToday = key === todayKey;
          const intensity = count / maxSales;
          const salesClass = count
            ? intensity > 0.66
              ? "border-rose-500 bg-rose-500 text-white"
              : intensity > 0.33
                ? "border-rose-300 bg-rose-200 text-rose-950"
                : "border-rose-200 bg-rose-100 text-rose-900"
            : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200";

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(key)}
              aria-pressed={isSelected}
              aria-label={`${day} de ${monthLabel}: ${count} venda(s)`}
              className={`relative min-h-14 rounded-xl border p-1 text-center transition sm:min-h-16 ${salesClass} ${
                isSelected
                  ? "z-10 ring-3 ring-red-600 ring-offset-2"
                  : "hover:-translate-y-0.5"
              } ${isToday ? "outline outline-2 outline-slate-700 outline-offset-1" : ""}`}
            >
              <span className="block text-sm font-black">{day}</span>
              {count ? (
                <span className="mt-0.5 block text-[9px] font-black sm:text-[10px]">
                  {count} venda{count === 1 ? "" : "s"}
                </span>
              ) : (
                <span className="mt-0.5 block text-[9px] font-bold opacity-50">
                  —
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-bold text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-rose-100 ring-1 ring-rose-200" />
          Teve vendas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-rose-500" />
          Mais vendas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-white ring-2 ring-red-600" />
          Dia selecionado
        </span>
      </div>
    </section>
  );
}
