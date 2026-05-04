import { createApiClient } from "@/lib/api/client";
import { getPublicEnv } from "@/lib/env";
import type {
  PurchaseOrderDetailResponse,
  PurchaseOrderGenerateResponse,
  PurchaseOrderHistoryResponse,
  PurchaseOrderPreviewRequest,
  PurchaseOrderPreviewResponse,
  PurchaseOrderSendRequest
} from "@/types/purchase-order";

const apiClient = createApiClient();

export function purchaseOrdersQueryKey(locationId: string | null | undefined) {
  return ["purchase-orders", locationId] as const;
}

export function listPurchaseOrders(locationId: string, accessToken: string): Promise<PurchaseOrderHistoryResponse[]> {
  return apiClient.get<PurchaseOrderHistoryResponse[]>(`/locations/${locationId}/purchase-orders`, { accessToken });
}

export function previewPurchaseOrder(
  locationId: string,
  body: PurchaseOrderPreviewRequest,
  accessToken: string
): Promise<PurchaseOrderPreviewResponse> {
  return apiClient.post<PurchaseOrderPreviewResponse>(`/locations/${locationId}/purchase-orders/preview`, body, {
    accessToken
  });
}

export function generatePurchaseOrder(
  locationId: string,
  body: PurchaseOrderPreviewResponse,
  accessToken: string
): Promise<PurchaseOrderGenerateResponse> {
  return apiClient.post<PurchaseOrderGenerateResponse>(`/locations/${locationId}/purchase-orders/generate`, body, {
    accessToken
  });
}

export function updatePurchaseOrder(
  locationId: string,
  orderId: string,
  body: PurchaseOrderPreviewResponse,
  accessToken: string
): Promise<PurchaseOrderGenerateResponse> {
  return apiClient.put<PurchaseOrderGenerateResponse>(`/locations/${locationId}/purchase-orders/${orderId}`, body, {
    accessToken
  });
}

export function getPurchaseOrder(
  locationId: string,
  orderId: string,
  accessToken: string
): Promise<PurchaseOrderDetailResponse> {
  return apiClient.get<PurchaseOrderDetailResponse>(`/locations/${locationId}/purchase-orders/${orderId}`, {
    accessToken
  });
}

export function sendPurchaseOrder(
  locationId: string,
  orderId: string,
  body: PurchaseOrderSendRequest,
  accessToken: string
): Promise<void> {
  return apiClient.post<void>(`/locations/${locationId}/purchase-orders/${orderId}/send`, body, { accessToken });
}

async function fetchPurchaseOrderBlob(
  locationId: string,
  orderId: string,
  suffix: "csv" | "pdf",
  accessToken: string
): Promise<Blob> {
  const env = getPublicEnv();

  if (!env.hasApiConfig) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  const response = await fetch(`${env.apiUrl}/locations/${locationId}/purchase-orders/${orderId}/export/${suffix}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}.`);
  }

  return response.blob();
}

export function downloadPurchaseOrderCsv(locationId: string, orderId: string, accessToken: string) {
  return fetchPurchaseOrderBlob(locationId, orderId, "csv", accessToken);
}

export function downloadPurchaseOrderPdf(locationId: string, orderId: string, accessToken: string) {
  return fetchPurchaseOrderBlob(locationId, orderId, "pdf", accessToken);
}
