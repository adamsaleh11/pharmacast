import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "navy" | "teal" | "green" | "amber" | "red";
};

const toneClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
  navy: "bg-primary text-white",
  teal: "bg-teal-50 text-pharma-teal",
  green: "bg-green-50 text-pharma-green",
  amber: "bg-amber-50 text-pharma-amber",
  red: "bg-red-50 text-pharma-red"
};

export function StatCard({ title, value, detail, icon: Icon, tone = "navy" }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 font-mono text-2xl font-semibold tracking-normal text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className={cn("rounded-md p-2", toneClasses[tone])}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </CardContent>
    </Card>
  );
}
