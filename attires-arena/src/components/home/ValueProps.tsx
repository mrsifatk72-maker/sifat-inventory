import { Banknote, Lock, RotateCcw, ShieldCheck, Sparkles, Truck } from "lucide-react";
import type { ValueProp } from "@/types";

const icons = { "shield-check": ShieldCheck, truck: Truck, "rotate-ccw": RotateCcw, lock: Lock, sparkles: Sparkles, banknote: Banknote };

export function ValueProps({ items }: { items: ValueProp[] }) {
  return (
    <section aria-label="Why shop with us" className="container">
      <ul className="grid grid-cols-2 gap-x-4 gap-y-5 border-b border-line py-6 md:grid-cols-4 md:py-8">
        {items.map((v) => {
          const Icon = icons[v.icon];
          return (
            <li key={v.title} className="flex items-center gap-3 md:justify-center">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-primary">
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.6} aria-hidden />
              </span>
              <span>
                <span className="block text-[13px] font-medium text-ink">{v.title}</span>
                <span className="block text-xs text-ink-muted">{v.description}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
