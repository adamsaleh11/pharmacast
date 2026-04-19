import {
  BarChart3,
  LayoutDashboard,
  MessageSquareText,
  Settings,
  TrendingUp
} from "lucide-react";

export const productNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Overview", href: "/overview", icon: BarChart3 },
  { name: "Chat", href: "/chat", icon: MessageSquareText },
  { name: "Insights", href: "/insights", icon: TrendingUp },
  { name: "Settings", href: "/settings", icon: Settings }
] as const;
