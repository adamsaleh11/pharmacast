import { Bell, Building2, MapPin } from "lucide-react";
import { AppPageHeader } from "@/components/product/app-page-header";
import { SectionCard } from "@/components/product/section-card";

const settings = [
  { title: "Organization", description: "Tenant profile and subscription status will be managed here.", icon: Building2 },
  { title: "Locations", description: "Location switching and access controls will be connected after auth.", icon: MapPin },
  { title: "Notifications", description: "Daily digest, weekly insights, and critical alerts will use backend settings.", icon: Bell }
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <AppPageHeader title="Settings" description="Configure organization, location, and notification preferences after backend APIs are available." />
      <div className="grid gap-4">
        {settings.map((item) => (
          <SectionCard key={item.title} title={item.title} description={item.description}>
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-4 text-sm text-muted-foreground">
              <item.icon className="h-5 w-5 text-pharma-teal" aria-hidden="true" />
              Integration-ready placeholder. No settings are saved by this scaffold.
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
