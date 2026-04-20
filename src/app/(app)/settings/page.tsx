"use client";

import { useState } from "react";
import { Bell, Building2, MapPin, Database } from "lucide-react";
import { AppPageHeader } from "@/components/product/app-page-header";
import { SectionCard } from "@/components/product/section-card";
import { useAppContext } from "@/providers/app-context";
import { CsvUploadZone } from "@/components/product/csv-upload-zone";
import { UploadHistoryTable } from "@/components/product/upload-history-table";
import { cn } from "@/lib/utils";

const generalSettings = [
  {
    title: "Organization",
    description: "Tenant profile and subscription status will be managed here.",
    icon: Building2
  },
  {
    title: "Locations",
    description: "Location switching and access controls will be connected after auth.",
    icon: MapPin
  },
  {
    title: "Notifications",
    description: "Daily digest, weekly insights, and critical alerts will use backend settings.",
    icon: Bell
  }
];

export default function SettingsPage() {
  const { user, currentLocation } = useAppContext();
  const [activeTab, setActiveTab] = useState("general");
  const isOwner = user?.role === "owner";

  const tabs = [
    { id: "general", label: "General", icon: Building2 },
    ...(isOwner ? [{ id: "data", label: "Data Management", icon: Database }] : [])
  ];

  return (
    <div className="space-y-6">
      <AppPageHeader
        title="Settings"
        description="Configure organization, location, and data management preferences."
      />

      <div className="flex border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === tab.id
                ? "border-pharma-teal text-pharma-teal"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "general" && (
        <div className="grid gap-4">
          {generalSettings.map((item) => (
            <SectionCard key={item.title} title={item.title} description={item.description}>
              <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                <item.icon className="h-5 w-5 text-pharma-teal" aria-hidden="true" />
                This section will be fully functional once backend management APIs are finalized.
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      {activeTab === "data" && isOwner && (
        <div className="space-y-8">
          <SectionCard
            title="Upload Dispensing History"
            description="Import your Kroll dispensing exports to update inventory forecasts for this location."
          >
            <div className="max-w-2xl mt-2">
              <CsvUploadZone locationId={currentLocation?.id || null} />
            </div>
          </SectionCard>

          <SectionCard
            title="Upload History"
            description="View the 10 most recent data imports and their processing status."
          >
            <div className="mt-4">
              <UploadHistoryTable locationId={currentLocation?.id || null} />
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
