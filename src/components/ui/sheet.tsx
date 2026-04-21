import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type SheetContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SheetContext = React.createContext<SheetContextValue | null>(null);

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

export function Sheet({ open, onOpenChange, children }: SheetProps) {
  return <SheetContext.Provider value={{ open, onOpenChange }}>{children}</SheetContext.Provider>;
}

type SheetContentProps = React.HTMLAttributes<HTMLDivElement> & {
  side?: "right" | "left" | "top" | "bottom";
};

export function SheetContent({ className, side = "right", children, ...props }: SheetContentProps) {
  const context = React.useContext(SheetContext);
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!context?.open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [context?.open]);

  React.useEffect(() => {
    if (!context?.open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        context.onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [context]);

  React.useEffect(() => {
    if (context?.open) {
      contentRef.current?.focus();
    }
  }, [context?.open]);

  if (!context?.open || typeof document === "undefined") {
    return null;
  }

  const sideClasses: Record<NonNullable<SheetContentProps["side"]>, string> = {
    right: "inset-y-0 right-0 w-full sm:w-[480px] sm:max-w-[480px] translate-x-0",
    left: "inset-y-0 left-0 w-full sm:w-[480px] sm:max-w-[480px] -translate-x-0",
    top: "inset-x-0 top-0 h-full max-h-[90vh]",
    bottom: "inset-x-0 bottom-0 h-full max-h-[90vh]"
  };

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]"
        aria-hidden="true"
        onClick={() => context.onOpenChange(false)}
      />
      <div
        ref={contentRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute border-l border-border bg-white shadow-2xl outline-none",
          "transition-transform duration-200 ease-out",
          sideClasses[side],
          side === "right" && "animate-in slide-in-from-right",
          side === "left" && "animate-in slide-in-from-left",
          side === "top" && "animate-in slide-in-from-top",
          side === "bottom" && "animate-in slide-in-from-bottom",
          className
        )}
        onClick={(event) => event.stopPropagation()}
        {...props}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-2", className)} {...props} />;
}

export function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-xl font-semibold leading-tight tracking-tight", className)} {...props} />;
}

export function SheetDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

