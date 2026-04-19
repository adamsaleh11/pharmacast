import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

type TableToolbarProps = {
  searchPlaceholder: string;
  actionLabel?: string;
};

export function TableToolbar({ searchPlaceholder, actionLabel }: TableToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <label className="relative block w-full sm:max-w-xs">
        <span className="sr-only">{searchPlaceholder}</span>
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <input
          className="h-9 w-full rounded-md border border-input bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          placeholder={searchPlaceholder}
          type="search"
        />
      </label>
      {actionLabel ? (
        <Button type="button" variant="outline">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
