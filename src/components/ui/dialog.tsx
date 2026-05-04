import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type DialogContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  return <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>;
}

type DialogContentProps = React.HTMLAttributes<HTMLDivElement> & {
  className?: string;
};

export function DialogContent({ className, children, ...props }: DialogContentProps) {
  const context = React.useContext(DialogContext);
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

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]"
        aria-hidden="true"
        onClick={() => context.onOpenChange(false)}
      />
      <div className="absolute inset-0 flex items-center justify-center p-0 sm:p-4">
        <div
          ref={contentRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          className={cn(
            "relative flex max-h-screen w-full flex-col overflow-hidden bg-white shadow-2xl outline-none",
            "sm:max-h-[min(90vh,900px)] sm:max-w-[1100px] sm:rounded-2xl",
            className
          )}
          onClick={(event) => event.stopPropagation()}
          {...props}
        >
          {children}
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute right-3 top-3 rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            onClick={() => context.onOpenChange(false)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-2 border-b border-slate-200 px-4 py-4 sm:px-6", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-semibold leading-tight tracking-tight sm:text-xl", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-slate-600", className)} {...props} />;
}
