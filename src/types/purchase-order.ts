export type PurchaseOrderReorderStatus = "RED" | "AMBER" | "GREEN";

export type PurchaseOrderPreviewRequest = {
  dins?: string[];
  include_status?: PurchaseOrderReorderStatus[];
};

export type PurchaseOrderPreviewLineItem = {
  din: string;
  drug_name: string;
  strength: string;
  form: string;
  current_stock: number;
  predicted_quantity: number;
  recommended_quantity: number;
  days_of_supply: number;
  reorder_status: PurchaseOrderReorderStatus;
  avg_daily_demand: number;
  lead_time_days: number;
  quantity_to_order: number;
  priority: "URGENT" | "STANDARD" | "OPTIONAL";
};

export type PurchaseOrderPreviewResponse = {
  generated_at: string;
  order_text: string;
  line_items: PurchaseOrderPreviewLineItem[];
};

export type PurchaseOrderGenerateResponse = {
  orderId: string;
  generated_at: string;
  order_text: string;
  line_items: PurchaseOrderPreviewLineItem[];
};

export type PurchaseOrderDetailResponse = PurchaseOrderGenerateResponse;

export type PurchaseOrderHistoryResponse = {
  orderId: string;
  generated_at: string;
  status: "draft" | "reviewed" | "sent" | "cancelled" | string;
  item_count: number;
  total_units: number;
};

export type PurchaseOrderSendRequest = {
  recipient_email: string;
  note?: string;
};
