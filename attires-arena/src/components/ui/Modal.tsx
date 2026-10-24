"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Visually hide the title (still announced by screen readers). */
  hideTitle?: boolean;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

function useOverlayBehaviour(open: boolean, onClose: () => void, panelRef: React.RefObject<HTMLDivElement | null>) {
  // Keep the latest onClose without re-running the effect (which would steal focus on every render).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(panelRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])') ?? []);
    (focusable()[0] ?? panelRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key === "Tab") {
        const els = focusable();
        if (!els.length) return;
        const first = els[0]!, last = els[els.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [open, panelRef]);
}

export function Modal({ open, onClose, title, hideTitle, description, children, footer, className }: OverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useOverlayBehaviour(open, onClose, panelRef);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-ink/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn("relative flex max-h-[90vh] w-full animate-slide-up flex-col rounded-t-2xl bg-surface shadow-lift sm:max-w-lg sm:rounded-card", className)}
      >
        <div className={cn("flex items-start justify-between gap-4 border-b border-line px-5 py-4", hideTitle && "sr-only")}>
          <div>
            <h2 id={titleId} className="font-serif text-2xl text-ink">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="-mr-2 rounded-full p-2 text-ink-muted hover:bg-ink/5 hover:text-ink" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, hideTitle, children, footer, side = "right", className }: OverlayProps & { side?: "left" | "right" }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useOverlayBehaviour(open, onClose, panelRef);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 animate-fade-in bg-ink/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "absolute top-0 flex h-full w-[88vw] max-w-md flex-col bg-surface shadow-lift",
          side === "right" ? "right-0 animate-slide-in-right" : "left-0 animate-slide-in-left",
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id={titleId} className={cn("font-serif text-2xl text-ink", hideTitle && "sr-only")}>
            {title}
          </h2>
          <button type="button" onClick={onClose} className="-mr-2 ml-auto rounded-full p-2 text-ink-muted hover:bg-ink/5 hover:text-ink" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-line p-5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
