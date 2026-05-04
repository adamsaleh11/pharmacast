"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, Building2, Database, Download, Edit3, Loader2, MapPin } from "lucide-react";
import { AppPageHeader } from "@/components/product/app-page-header";
import { NotificationHistoryTable } from "@/components/product/notification-history-table";
import { NotificationPreferences } from "@/components/product/notification-preferences";
import { PurchaseOrderWorkflowDialog } from "@/components/product/purchase-order-dialog";
import { SectionCard } from "@/components/product/section-card";
import { StatusBadge } from "@/components/product/status-badge";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/providers/app-context";
import { CsvUploadZone } from "@/components/product/csv-upload-zone";
import { UploadHistoryTable } from "@/components/product/upload-history-table";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getBackendAccessToken } from "@/lib/supabase/session";
import {
  downloadPurchaseOrderCsv,
  downloadPurchaseOrderPdf,
  getPurchaseOrder,
  listPurchaseOrders
} from "@/lib/api/purchase-orders";
import { cn } from "@/lib/utils";
import type { PurchaseOrderHistoryResponse } from "@/types/purchase-order";
import type { PurchaseOrderPreviewResponse } from "@/types/purchase-order";

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

type ToastState = {
  tone: "success" | "warning" | "danger" | "muted";
  message: string;
} | null;

async function getSettingsAccessToken(label: string) {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const accessToken = await getBackendAccessToken(supabase, label);

  if (!accessToken) {
    throw new Error("You must be signed in to view settings.");
  }

  return accessToken;
}

async function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function formatOrderDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

export default function SettingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, organization, currentLocation } = useAppContext();
  const requestedTab = searchParams.get("tab");
  const [manualTab, setManualTab] = useState("general");
  const activeTab = requestedTab === "notifications" ? "notifications" : manualTab;
  const [toast, setToast] = useState<ToastState>(null);
  const [purchaseOrderEditorOpen, setPurchaseOrderEditorOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const isOwner = user?.role === "owner";
  const canManageNotifications = user?.role === "owner" || user?.role === "admin";

  const tabs = [
    { id: "general", label: "General", icon: Building2 },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "orders", label: "Orders", icon: Download },
    ...(isOwner ? [{ id: "data", label: "Data Management", icon: Database }] : [])
  ];

  const ordersQuery = useQuery({
    queryKey: ["purchase-orders", currentLocation?.id] as const,
    enabled: Boolean(currentLocation?.id),
    staleTime: 15_000,
    queryFn: async () => {
      const accessToken = await getSettingsAccessToken("settings-purchase-orders");
      return listPurchaseOrders(currentLocation?.id ?? "", accessToken);
    }
  });

  const purchaseOrderDetailQuery = useQuery({
    queryKey: ["purchase-order-detail", currentLocation?.id, editingOrderId] as const,
    enabled: Boolean(currentLocation?.id && editingOrderId && purchaseOrderEditorOpen),
    staleTime: 0,
    queryFn: async () => {
      if (!currentLocation?.id || !editingOrderId) {
        throw new Error("Choose a location first.");
      }

      const accessToken = await getSettingsAccessToken("settings-purchase-order-detail");
      return getPurchaseOrder(currentLocation.id, editingOrderId, accessToken);
    }
  });

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), toast.tone === "danger" ? 5000 : 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function handleDownloadCsv(order: PurchaseOrderHistoryResponse) {
    if (!currentLocation?.id) {
      return;
    }

    try {
      const accessToken = await getSettingsAccessToken("settings-purchase-orders-csv");
      const blob = await downloadPurchaseOrderCsv(currentLocation.id, order.orderId, accessToken);
      await downloadBlob(blob, `purchase-order-${order.generated_at.slice(0, 10)}.csv`);
    } catch (error) {
      setToast({ tone: "danger", message: error instanceof Error ? error.message : "Unable to download CSV." });
    }
  }

  async function handleDownloadPdf(order: PurchaseOrderHistoryResponse) {
    if (!currentLocation?.id) {
      return;
    }

    try {
      const accessToken = await getSettingsAccessToken("settings-purchase-orders-pdf");
      const blob = await downloadPurchaseOrderPdf(currentLocation.id, order.orderId, accessToken);
      await downloadBlob(blob, `purchase-order-${order.generated_at.slice(0, 10)}.pdf`);
    } catch (error) {
      setToast({ tone: "danger", message: error instanceof Error ? error.message : "Unable to download PDF." });
    }
  }

  function handleEditOrder(order: PurchaseOrderHistoryResponse) {
    setEditingOrderId(order.orderId);
    setPurchaseOrderEditorOpen(true);
  }

  function handleOrderEditorOpenChange(nextOpen: boolean) {
    setPurchaseOrderEditorOpen(nextOpen);

    if (!nextOpen) {
      setEditingOrderId(null);
    }
  }

  function handleTabChange(tabId: string) {
    setManualTab(tabId);

    if (tabId === "notifications") {
      router.replace(`${pathname}?tab=notifications`);
      return;
    }

    if (requestedTab === "notifications") {
      router.replace(pathname);
    }
  }

  const editingOrder = purchaseOrderDetailQuery.data ?? null;
  const editingOrderPreview: PurchaseOrderPreviewResponse | null = editingOrder
    ? {
        generated_at: editingOrder.generated_at,
        order_text: editingOrder.order_text,
        line_items: editingOrder.line_items
      }
    : null;

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
            onClick={() => handleTabChange(tab.id)}
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

      {activeTab === "notifications" && (
        <div className="space-y-6">
          <SectionCard
            title="Notification preferences"
            description="Control operational email alerts for this organization."
          >
            <NotificationPreferences
              organizationId={organization?.id}
              canUpdate={canManageNotifications}
              getAccessToken={getSettingsAccessToken}
            />
          </SectionCard>

          <SectionCard title="Recent notifications" description="Review the latest organization notification events.">
            <NotificationHistoryTable organizationId={organization?.id} getAccessToken={getSettingsAccessToken} />
          </SectionCard>
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

      {activeTab === "orders" && (
        <SectionCard
          title="Purchase Orders"
          description="Review recent purchase orders and re-download the files for this location."
        >
          <div className="overflow-hidden rounded-xl border border-slate-200">
            {ordersQuery.isLoading ? (
              <div className="flex items-center gap-2 p-4 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading orders...
              </div>
            ) : ordersQuery.error ? (
              <div className="p-4 text-sm text-red-700">
                {(ordersQuery.error as Error).message || "Unable to load purchase orders."}
              </div>
            ) : (ordersQuery.data ?? []).length === 0 ? (
              <div className="p-4 text-sm text-slate-600">No purchase orders yet.</div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-left font-medium">Drug Count</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {(ordersQuery.data ?? []).map((order) => (
                    <tr key={order.orderId}>
                      <td className="px-4 py-3 text-slate-900">{formatOrderDate(order.generated_at)}</td>
                      <td className="px-4 py-3 text-slate-600">{order.item_count}</td>
                      <td className="px-4 py-3">
                        <StatusBadge value={order.status as "draft" | "reviewed" | "sent" | "cancelled"} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => handleEditOrder(order)}>
                            <Edit3 className="h-4 w-4" aria-hidden="true" />
                            Edit
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => void handleDownloadPdf(order)}>
                            <Download className="h-4 w-4" aria-hidden="true" />
                            PDF
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => void handleDownloadCsv(order)}>
                            <Download className="h-4 w-4" aria-hidden="true" />
                            CSV
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </SectionCard>
      )}

      {(purchaseOrderEditorOpen || editingOrderId) && (
        <PurchaseOrderWorkflowDialog
          key={`${editingOrderId ?? "new"}:${editingOrderPreview ? "loaded" : "loading"}`}
          open={purchaseOrderEditorOpen}
          onOpenChange={handleOrderEditorOpenChange}
          locationId={currentLocation?.id ?? null}
          locationName={currentLocation?.name ?? null}
          locationAddress={currentLocation?.address ?? null}
          rows={[]}
          initialDraft={editingOrderPreview}
          initialSavedOrderId={editingOrder?.orderId ?? editingOrderId}
          isInitialDraftLoading={purchaseOrderDetailQuery.isLoading && Boolean(editingOrderId)}
          initialDraftError={purchaseOrderDetailQuery.error instanceof Error ? purchaseOrderDetailQuery.error.message : null}
        />
      )}

      {toast ? (
        <div
          className={cn(
            "fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg",
            toast.tone === "success" && "border-green-200 bg-green-50 text-green-800",
            toast.tone === "warning" && "border-amber-200 bg-amber-50 text-amber-800",
            toast.tone === "danger" && "border-red-200 bg-red-50 text-red-800",
            toast.tone === "muted" && "border-slate-200 bg-white text-slate-800"
          )}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
