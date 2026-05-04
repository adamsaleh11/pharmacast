"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Download,
  FileText,
  Loader2,
  Mail,
  Package,
  Search,
  Send,
  Sparkles,
  Truck
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getBackendAccessToken } from "@/lib/supabase/session";
import { cn } from "@/lib/utils";
import {
  downloadPurchaseOrderCsv,
  downloadPurchaseOrderPdf,
  generatePurchaseOrder,
  previewPurchaseOrder,
  updatePurchaseOrder,
  sendPurchaseOrder
} from "@/lib/api/purchase-orders";
import { normalizedReorderStatus } from "@/lib/forecast-dashboard/model";
import type { DrugRow } from "@/types/forecast-dashboard";
import type {
  PurchaseOrderPreviewLineItem,
  PurchaseOrderPreviewRequest,
  PurchaseOrderPreviewResponse
} from "@/types/purchase-order";

type ToastState = {
  tone: "success" | "warning" | "danger" | "muted";
  message: string;
} | null;

type SelectionMode = "critical" | "red" | "specific";

type PurchaseOrderWorkflowDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string | null;
  locationName: string | null;
  locationAddress: string | null;
  rows: DrugRow[];
  initialDraft?: PurchaseOrderPreviewResponse | null;
  initialSavedOrderId?: string | null;
  isInitialDraftLoading?: boolean;
  initialDraftError?: string | null;
};

function formatOrderDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function formatDownloadDate(value: string) {
  return value.slice(0, 10);
}

function normalizeTitle(value: string | null | undefined) {
  return value?.trim().length ? value.trim() : "Pharmacy";
}

function lineItemLabel(item: PurchaseOrderPreviewLineItem) {
  return `${item.drug_name} ${item.strength} ${item.form}`.replace(/\s+/g, " ").trim();
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-CA", {
    maximumFractionDigits: 0
  }).format(value);
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("en-CA", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value);
}

function buildLineItemReason(item: PurchaseOrderPreviewLineItem) {
  const shortfall = Math.max(item.predicted_quantity - item.current_stock, 0);

  if (item.quantity_to_order > 0) {
    return shortfall > 0
      ? `Forecast shortfall of ${formatNumber(shortfall)} units.`
      : "Quantity carries the order through the forecast window.";
  }

  return "On-hand stock already covers the forecast window.";
}

async function getPurchaseOrderAccessToken(label: string) {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const accessToken = await getBackendAccessToken(supabase, label);

  if (!accessToken) {
    throw new Error("You must be signed in to manage purchase orders.");
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

function statusTone(value: string) {
  if (value === "RED") return "danger";
  if (value === "AMBER") return "warning";
  return "success";
}

function priorityTone(value: PurchaseOrderPreviewLineItem["priority"]) {
  if (value === "URGENT") return "danger";
  if (value === "STANDARD") return "warning";
  return "teal";
}

function summarizeDraft(generatedAt: string, items: number) {
  const date = formatOrderDate(generatedAt);
  return `Purchase Order — ${date} — ${items} item${items === 1 ? "" : "s"}`;
}

function formatChatPrompt(summary: string) {
  return `Review this purchase order: ${summary}`;
}

export function PurchaseOrderWorkflowDialog({
  open,
  onOpenChange,
  locationId,
  locationName,
  locationAddress,
  rows,
  initialDraft = null,
  initialSavedOrderId = null,
  isInitialDraftLoading = false,
  initialDraftError = null
}: PurchaseOrderWorkflowDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<SelectionMode>("critical");
  const [specificSearch, setSpecificSearch] = useState("");
  const [selectedDins, setSelectedDins] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<PurchaseOrderPreviewResponse | null>(() => initialDraft);
  const [savedOrderId, setSavedOrderId] = useState<string | null>(() => initialSavedOrderId);
  const [editedAt, setEditedAt] = useState<string | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [expandedGeneratedText, setExpandedGeneratedText] = useState(false);
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const previewMutation = useMutation({
    mutationFn: async (body: PurchaseOrderPreviewRequest) => {
      if (!locationId) {
        throw new Error("Choose a location first.");
      }

      const accessToken = await getPurchaseOrderAccessToken("purchase-orders-preview");
      return previewPurchaseOrder(locationId, body, accessToken);
    },
    onSuccess: (response) => {
      setPreview(response);
      setSavedOrderId(null);
      setEditedAt(null);
      setToast({ tone: "success", message: "Draft generated. Review the quantities before saving." });
      void queryClient.invalidateQueries({ queryKey: ["purchase-orders", locationId] });
    },
    onError: (error) => {
      setToast({ tone: "danger", message: error instanceof Error ? error.message : "Unable to generate draft." });
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (draft: PurchaseOrderPreviewResponse) => {
      if (!locationId) {
        throw new Error("Choose a location first.");
      }

      const accessToken = await getPurchaseOrderAccessToken("purchase-orders-generate");
      return savedOrderId
        ? updatePurchaseOrder(locationId, savedOrderId, draft, accessToken)
        : generatePurchaseOrder(locationId, draft, accessToken);
    },
    onSuccess: (response) => {
      setSavedOrderId(response.orderId);
      setPreview({
        generated_at: response.generated_at,
        order_text: response.order_text,
        line_items: response.line_items
      });
      setEditedAt(null);
      setToast({ tone: "success", message: "Order saved." });
      void queryClient.invalidateQueries({ queryKey: ["purchase-orders", locationId] });
    },
    onError: (error) => {
      setToast({ tone: "danger", message: error instanceof Error ? error.message : "Unable to save order." });
    }
  });

  const sendMutation = useMutation({
    mutationFn: async ({ orderId, recipient_email, note }: { orderId: string; recipient_email: string; note?: string }) => {
      if (!locationId) {
        throw new Error("Choose a location first.");
      }

      const accessToken = await getPurchaseOrderAccessToken("purchase-orders-send");
      return sendPurchaseOrder(locationId, orderId, { recipient_email, note }, accessToken);
    },
    onSuccess: async (_result, variables) => {
      setToast({ tone: "success", message: `Purchase order sent to ${variables.recipient_email}` });
      setRecipientEmail("");
      setNote("");
      void queryClient.invalidateQueries({ queryKey: ["purchase-orders", locationId] });
    },
    onError: (error) => {
      setToast({ tone: "danger", message: error instanceof Error ? error.message : "Unable to send order." });
    }
  });

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), toast.tone === "danger" ? 5000 : 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const forecastedRows = useMemo(() => rows.filter((row) => row.forecast), [rows]);
  const redRows = useMemo(
    () => forecastedRows.filter((row) => normalizedReorderStatus(row.forecast?.reorder_status) === "RED"),
    [forecastedRows]
  );
  const amberRows = useMemo(
    () => forecastedRows.filter((row) => normalizedReorderStatus(row.forecast?.reorder_status) === "AMBER"),
    [forecastedRows]
  );
  const greenRows = useMemo(
    () => forecastedRows.filter((row) => normalizedReorderStatus(row.forecast?.reorder_status) === "GREEN"),
    [forecastedRows]
  );
  const orderableCount = redRows.length + amberRows.length + greenRows.length;

  const selectedRows = useMemo(() => {
    if (mode === "critical") {
      return [...redRows, ...amberRows];
    }

    if (mode === "red") {
      return redRows;
    }

    const selected = new Set(selectedDins);
    return forecastedRows.filter((row) => selected.has(row.din));
  }, [amberRows, forecastedRows, mode, redRows, selectedDins]);

  const selectedLowConfidenceCount = useMemo(
    () => selectedRows.filter((row) => row.forecast?.confidence?.toLowerCase() === "low").length,
    [selectedRows]
  );

  const orderableLineItems = useMemo(
    () => preview?.line_items.filter((item) => item.quantity_to_order > 0) ?? [],
    [preview]
  );
  const referenceOnlyLineItems = useMemo(
    () => preview?.line_items.filter((item) => item.quantity_to_order <= 0) ?? [],
    [preview]
  );
  const totalOrderQuantity = useMemo(
    () => preview?.line_items.reduce((sum, item) => sum + item.quantity_to_order, 0) ?? 0,
    [preview]
  );
  const totalRecommendedQuantity = useMemo(
    () => preview?.line_items.reduce((sum, item) => sum + item.recommended_quantity, 0) ?? 0,
    [preview]
  );
  const orderableLineCount = orderableLineItems.length;
  const referenceOnlyCount = referenceOnlyLineItems.length;
  const draftSummary = preview
    ? summarizeDraft(preview.generated_at, preview.line_items.length)
    : null;

  const filteredSpecificRows = useMemo(() => {
    const normalized = specificSearch.trim().toLowerCase();
    return forecastedRows.filter((row) => {
      if (!normalized) {
        return true;
      }

      return row.drugName.toLowerCase().includes(normalized) || row.din.toLowerCase().includes(normalized);
    });
  }, [forecastedRows, specificSearch]);

  async function handleGeneratePreview() {
    if (!locationId) {
      setToast({ tone: "warning", message: "Choose a location first." });
      return;
    }

    if (mode === "specific" && selectedDins.size === 0) {
      setToast({ tone: "warning", message: "Select at least one drug." });
      return;
    }

    const includeStatus: PurchaseOrderPreviewRequest["include_status"] =
      mode === "red" ? ["RED"] : mode === "critical" ? ["RED", "AMBER"] : ["RED", "AMBER", "GREEN"];

    const body: PurchaseOrderPreviewRequest =
      mode === "specific"
        ? { dins: Array.from(selectedDins), include_status: includeStatus }
        : { include_status: includeStatus };

    await previewMutation.mutateAsync(body);
  }

  function handleModeChange(nextMode: SelectionMode) {
    setMode(nextMode);

    if (nextMode === "specific" && selectedDins.size === 0 && forecastedRows.length > 0) {
      setSelectedDins(new Set(forecastedRows.map((row) => row.din)));
    }

    if (nextMode !== "specific") {
      setSpecificSearch("");
    }
  }

  function updateLineItem(din: string, quantity: number) {
    if (!preview) {
      return;
    }

    const nextLineItems = preview.line_items.map((item) => (item.din === din ? { ...item, quantity_to_order: quantity } : item));
    setPreview({ ...preview, line_items: nextLineItems });
    setSavedOrderId(null);
    setEditedAt(new Date().toISOString());
  }

  async function handleSaveOrder() {
    if (!preview) {
      return;
    }

    await saveMutation.mutateAsync(preview);
  }

  async function handleDownloadCsv() {
    if (!locationId || !savedOrderId) {
      return;
    }

    setIsDownloadingCsv(true);
    try {
      const accessToken = await getPurchaseOrderAccessToken("purchase-orders-download-csv");
      const blob = await downloadPurchaseOrderCsv(locationId, savedOrderId, accessToken);
      await downloadBlob(blob, `purchase-order-${formatDownloadDate(preview?.generated_at ?? new Date().toISOString())}.csv`);
    } finally {
      setIsDownloadingCsv(false);
    }
  }

  async function handleDownloadPdf() {
    if (!locationId || !savedOrderId) {
      return;
    }

    setIsDownloadingPdf(true);
    try {
      const accessToken = await getPurchaseOrderAccessToken("purchase-orders-download-pdf");
      const blob = await downloadPurchaseOrderPdf(locationId, savedOrderId, accessToken);
      await downloadBlob(blob, `purchase-order-${formatDownloadDate(preview?.generated_at ?? new Date().toISOString())}.pdf`);
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  async function handleSendOrder() {
    if (!savedOrderId || !recipientEmail.trim()) {
      setToast({ tone: "warning", message: "Enter a recipient email." });
      return;
    }

    await sendMutation.mutateAsync({
      orderId: savedOrderId,
      recipient_email: recipientEmail.trim(),
      note: note.trim() || undefined
    });
  }

  function handleEditInChat() {
    if (!draftSummary) {
      return;
    }

    router.push(`/chat?message=${encodeURIComponent(formatChatPrompt(draftSummary))}`);
    onOpenChange(false);
  }

  const generateDisabled =
    previewMutation.isPending || (mode === "specific" && selectedDins.size === 0) || orderableCount === 0;

  const unsavedChanges = Boolean(preview && savedOrderId === null);
  const previewErrorMessage = previewMutation.error instanceof Error ? previewMutation.error.message : null;
  const isPreviewGenerating = previewMutation.isPending && !preview;
  const hasInitialDraftLoadingState = isInitialDraftLoading && !preview && Boolean(initialSavedOrderId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="h-[100dvh] rounded-none p-0 sm:h-[min(90vh,900px)] sm:rounded-2xl"
        aria-labelledby="purchase-order-title"
        aria-describedby="purchase-order-description"
      >
        <DialogHeader className="pr-16">
          <DialogTitle id="purchase-order-title">Generate Purchase Order</DialogTitle>
          <DialogDescription id="purchase-order-description">
            Build a draft from forecasted demand, review quantities, then save and share the order.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {!preview ? (
            hasInitialDraftLoadingState ? (
              <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-6 sm:px-6">
                <Card className="w-full max-w-xl border-slate-200">
                  <CardContent className="flex items-center gap-3 p-4">
                    <Loader2 className="h-4 w-4 animate-spin text-pharma-teal" aria-hidden="true" />
                    <div>
                      <div className="text-sm font-medium text-slate-900">Loading purchase order draft</div>
                      <div className="text-sm text-slate-600">Fetching the saved line items so you can edit them.</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : initialDraftError ? (
              <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-6 sm:px-6">
                <div className="w-full max-w-xl rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700" role="alert">
                  <div className="font-medium">Unable to load purchase order</div>
                  <p className="mt-1">{initialDraftError}</p>
                </div>
              </div>
            ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-4 sm:px-6">
              {previewErrorMessage ? (
                <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">Unable to generate draft</div>
                    <p className="mt-1 text-red-700/90">{previewErrorMessage}</p>
                  </div>
                </div>
              ) : null}

              <Card className="border-slate-200">
                <CardContent className="space-y-4 p-4">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Metric label="Critical drugs" value={`${redRows.length + amberRows.length}`} />
                    <Metric label="Red only" value={`${redRows.length}`} />
                    <Metric label="Forecasted" value={`${orderableCount}`} />
                  </div>
                  <fieldset className="space-y-3">
                    <legend className="text-sm font-medium text-slate-900">Choose which forecasts to include</legend>
                    <OptionCard
                      name="purchase-order-mode"
                      checked={mode === "critical"}
                      value="critical"
                      title="All critical drugs (red + amber)"
                      description={`${redRows.length + amberRows.length} drugs`}
                      onChange={() => handleModeChange("critical")}
                    />
                    <OptionCard
                      name="purchase-order-mode"
                      checked={mode === "red"}
                      value="red"
                      title="Critical only (red)"
                      description={`${redRows.length} drugs`}
                      onChange={() => handleModeChange("red")}
                    />
                    <OptionCard
                      name="purchase-order-mode"
                      checked={mode === "specific"}
                      value="specific"
                      title="Select specific drugs"
                      description={`${forecastedRows.length} forecasted drugs`}
                      onChange={() => handleModeChange("specific")}
                    />
                  </fieldset>

                  {mode === "specific" ? (
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                        <Input
                          className="pl-9"
                          placeholder="Search forecasted drugs"
                          value={specificSearch}
                          onChange={(event) => setSpecificSearch(event.target.value)}
                        />
                      </div>
                      <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                        {filteredSpecificRows.length > 0 ? (
                          <div className="divide-y divide-slate-200">
                            {filteredSpecificRows.map((row) => {
                              const selected = selectedDins.has(row.din);
                              const status = normalizedReorderStatus(row.forecast?.reorder_status) ?? "GREEN";
                              return (
                                <label
                                  key={row.din}
                                  className={cn(
                                    "flex cursor-pointer items-start gap-3 px-4 py-3 text-sm transition hover:bg-slate-50",
                                    selected && "bg-teal-50/60"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-1 h-4 w-4 rounded border-slate-300 text-pharma-teal focus:ring-pharma-teal"
                                    checked={selected}
                                    onChange={() =>
                                      setSelectedDins((current) => {
                                        const next = new Set(current);
                                        if (next.has(row.din)) {
                                          next.delete(row.din);
                                        } else {
                                          next.add(row.din);
                                        }
                                        return next;
                                      })
                                    }
                                  />
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-medium text-slate-900">{row.drugName}</span>
                                      <Badge variant={statusTone(status)}>{status}</Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                                      <span className="font-mono">{row.din}</span>
                                      <span>{row.strength ?? "No strength"}</span>
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="px-4 py-6 text-sm text-slate-500">No forecasted drugs match this search.</div>
                        )}
                      </div>
                      <div className="text-sm text-slate-600">{selectedDins.size} selected</div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {isPreviewGenerating ? (
                <Card className="border-slate-200">
                  <CardContent className="flex items-center gap-3 p-4">
                    <Loader2 className="h-4 w-4 animate-spin text-pharma-teal" aria-hidden="true" />
                    <div>
                      <div className="text-sm font-medium text-slate-900">Building purchase order draft</div>
                      <div className="text-sm text-slate-600">Formatting the line items into a reviewable order.</div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <div className="mt-auto flex flex-col gap-3 border-t border-slate-200 bg-white pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-slate-600">
                  {locationName ? normalizeTitle(locationName) : "Selected location"}{" "}
                  {locationAddress ? `• ${locationAddress}` : ""}
                </div>
                <Button type="button" variant="teal" className="sm:min-w-44" disabled={generateDisabled} onClick={() => void handleGeneratePreview()}>
                  {previewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                  {previewMutation.isPending ? "Generating..." : "Generate Order"}
                </Button>
              </div>
            </div>
            )
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50">
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
                <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                  <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="teal" className="gap-1.5">
                          <Package className="h-3.5 w-3.5" aria-hidden="true" />
                          Purchase Order Draft
                        </Badge>
                        {unsavedChanges ? <Badge variant="warning">Unsaved changes</Badge> : <Badge variant="success">Saved</Badge>}
                        {selectedLowConfidenceCount > 0 ? <Badge variant="warning">{selectedLowConfidenceCount} low-confidence</Badge> : null}
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-semibold tracking-tight text-slate-900">{draftSummary}</h3>
                        <p className="max-w-3xl text-sm leading-6 text-slate-600">
                          Review the line items below, adjust quantities if needed, then save the draft before downloading or sending it.
                        </p>
                        {editedAt ? <p className="text-xs text-slate-500">Last edited {formatOrderDate(editedAt)}</p> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={() => setExpandedGeneratedText((current) => !current)}>
                        {expandedGeneratedText ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                        {expandedGeneratedText ? "Hide draft notes" : "Show draft notes"}
                      </Button>
                      <Button type="button" variant="teal" disabled={saveMutation.isPending || !preview} onClick={() => void handleSaveOrder()}>
                        {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                        {saveMutation.isPending ? "Saving..." : "Save Order"}
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <SummaryStat label="Line items" value={formatNumber(preview.line_items.length)} icon={ClipboardList} />
                    <SummaryStat label="Units to order" value={formatNumber(totalOrderQuantity)} icon={Package} />
                    <SummaryStat label="Recommended total" value={formatNumber(totalRecommendedQuantity)} icon={CheckCircle2} />
                    <SummaryStat label="Needs review" value={formatNumber(referenceOnlyCount)} icon={Truck} />
                  </div>

                  {selectedLowConfidenceCount > 0 ? (
                    <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <div>
                        <div className="font-medium">Low-confidence forecasts in this draft</div>
                        <p className="mt-1 text-amber-800/90">
                          {selectedLowConfidenceCount} item(s) were generated with low forecast confidence. Review the quantities before sending.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <Card className="border-slate-200 shadow-none">
                      <CardContent className="space-y-4 p-4">
                        <div className="flex items-center gap-2">
                          <ClipboardList className="h-4 w-4 text-pharma-teal" aria-hidden="true" />
                          <div>
                            <div className="text-sm font-medium text-slate-900">Order now</div>
                            <div className="text-xs text-slate-500">{orderableLineCount} line(s) require stock.</div>
                          </div>
                        </div>
                        {orderableLineItems.length > 0 ? (
                          <div className="overflow-hidden rounded-2xl border border-slate-200">
                            <PurchaseOrderLineTable items={orderableLineItems} onQuantityChange={updateLineItem} />
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                            No items currently require ordering.
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <div className="space-y-4">
                      <Card className="border-slate-200 shadow-none">
                        <CardContent className="space-y-3 p-4">
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-slate-500" aria-hidden="true" />
                            <div className="text-sm font-medium text-slate-900">Routing details</div>
                          </div>
                          <dl className="grid gap-3 text-sm">
                            <div className="rounded-xl bg-slate-50 p-3">
                              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Pharmacy</dt>
                              <dd className="mt-1 font-medium text-slate-900">{normalizeTitle(locationName)}</dd>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Location</dt>
                              <dd className="mt-1 font-medium text-slate-900">{locationAddress ? locationAddress : "No address on file"}</dd>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Generated</dt>
                              <dd className="mt-1 font-medium text-slate-900">{formatOrderDate(preview.generated_at)}</dd>
                            </div>
                          </dl>
                        </CardContent>
                      </Card>

                      <Card className="border-slate-200 shadow-none">
                        <CardContent className="space-y-3 p-4">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-slate-500" aria-hidden="true" />
                            <div className="text-sm font-medium text-slate-900">Reference only</div>
                          </div>
                          {referenceOnlyLineItems.length > 0 ? (
                            <div className="overflow-hidden rounded-2xl border border-slate-200">
                              <PurchaseOrderLineTable items={referenceOnlyLineItems} onQuantityChange={updateLineItem} subdued />
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                              All forecasted items are currently included in the active order list.
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  {expandedGeneratedText ? (
                    <Card className="border-slate-200 shadow-none">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-slate-500" aria-hidden="true" />
                          <div className="text-sm font-medium text-slate-900">Draft notes</div>
                        </div>
                        <div className="prose prose-slate max-w-none prose-p:my-2 prose-li:my-1 prose-table:border-collapse prose-th:border prose-th:border-slate-200 prose-th:bg-slate-50 prose-th:px-2 prose-th:py-1 prose-td:border prose-td:border-slate-200 prose-td:px-2 prose-td:py-1">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{preview.order_text}</ReactMarkdown>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              </div>

              <div className="border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
                <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" disabled={!savedOrderId || isDownloadingCsv} onClick={() => void handleDownloadCsv()}>
                        {isDownloadingCsv ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
                        Download CSV
                      </Button>
                      <Button type="button" variant="outline" disabled={!savedOrderId || isDownloadingPdf} onClick={() => void handleDownloadPdf()}>
                        {isDownloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
                        Download PDF
                      </Button>
                      <Button type="button" variant="ghost" disabled={!savedOrderId} onClick={handleEditInChat}>
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                        Edit in Chat
                      </Button>
                    </div>
                    <div className="text-xs text-slate-500">
                      Downloads and email sending are enabled after the order is saved.
                    </div>
                  </div>

                  <Card className="border-slate-200 shadow-none">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-slate-500" aria-hidden="true" />
                        <div className="text-sm font-medium text-slate-900">Email to Rep</div>
                      </div>
                      <Input
                        type="email"
                        placeholder="buyer@wholesaler.example"
                        value={recipientEmail}
                        onChange={(event) => setRecipientEmail(event.target.value)}
                        disabled={!savedOrderId || sendMutation.isPending}
                      />
                      <Textarea
                        placeholder="Optional note"
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        disabled={!savedOrderId || sendMutation.isPending}
                        rows={3}
                      />
                      <Button
                        type="button"
                        className="w-full"
                        variant="teal"
                        disabled={!savedOrderId || sendMutation.isPending}
                        onClick={() => void handleSendOrder()}
                      >
                        {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                        {sendMutation.isPending ? "Sending..." : "Send"}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </div>

        {toast ? <OrderToast toast={toast} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
        </div>
        <div className="rounded-full bg-white p-2 text-slate-500 shadow-sm">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

function PurchaseOrderLineTable({
  items,
  onQuantityChange,
  subdued = false
}: {
  items: PurchaseOrderPreviewLineItem[];
  onQuantityChange: (din: string, quantity: number) => void;
  subdued?: boolean;
}) {
  return (
    <div className={cn("overflow-x-auto", subdued && "bg-slate-50")}>
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className={cn("text-xs uppercase tracking-wide", subdued ? "bg-slate-50 text-slate-500" : "bg-slate-50 text-slate-500")}>
          <tr>
            <th className="px-4 py-3 text-left font-medium">Drug</th>
            <th className="px-4 py-3 text-left font-medium">DIN</th>
            <th className="px-4 py-3 text-left font-medium">Qty</th>
            <th className="px-4 py-3 text-left font-medium">Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {items.map((item) => (
            <tr key={item.din} className={subdued ? "align-top text-slate-600" : "align-top"}>
              <td className="px-4 py-3">
                <div className="font-medium text-slate-900">{lineItemLabel(item)}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                  <Badge variant={statusTone(item.reorder_status)}>{item.reorder_status}</Badge>
                  <Badge variant={priorityTone(item.priority)}>{item.priority}</Badge>
                  <span>{formatDecimal(item.days_of_supply)} days supply</span>
                </div>
              </td>
              <td className="px-4 py-3 font-mono text-slate-600">{item.din}</td>
              <td className="px-4 py-3">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={item.quantity_to_order}
                  onChange={(event) => onQuantityChange(item.din, Number(event.target.value || 0))}
                  className="max-w-32 bg-white"
                  aria-label={`Qty to order for ${item.drug_name}`}
                />
                <div className="mt-1 text-xs text-slate-500">Recommended {formatNumber(item.recommended_quantity)}</div>
              </td>
              <td className="px-4 py-3 text-sm leading-6 text-slate-600">{buildLineItemReason(item)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OptionCard({
  name,
  checked,
  value,
  title,
  description,
  onChange
}: {
  name: string;
  checked: boolean;
  value: string;
  title: string;
  description: string;
  onChange: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition",
        checked ? "border-pharma-teal bg-teal-50/60" : "border-slate-200 hover:bg-slate-50"
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-1 h-4 w-4 border-slate-300 text-pharma-teal focus:ring-pharma-teal"
      />
      <div className="space-y-1">
        <div className="text-sm font-medium text-slate-900">{title}</div>
        <div className="text-sm text-slate-600">{description}</div>
      </div>
    </label>
  );
}

function OrderToast({ toast }: { toast: NonNullable<ToastState> }) {
  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-[60] max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg",
        toast.tone === "success" && "border-green-200 bg-green-50 text-green-800",
        toast.tone === "warning" && "border-amber-200 bg-amber-50 text-amber-800",
        toast.tone === "danger" && "border-red-200 bg-red-50 text-red-800",
        toast.tone === "muted" && "border-slate-200 bg-white text-slate-800"
      )}
    >
      <span>{toast.message}</span>
    </div>
  );
}
