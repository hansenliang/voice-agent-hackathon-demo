import { readFile } from "node:fs/promises";
import path from "node:path";

export type WayfairOrder = {
  order_id: string;
  customer_email?: string;
  placed_at?: string;
  status: "delivered" | "in_transit" | "processing" | string;
  status_detail?: string;
  items: Array<{
    product_id: string;
    qty: number;
    color?: string;
    unit_price_usd?: number;
    line_total_usd?: number;
    name?: string;
    price_usd?: number;
  }>;
  subtotal_usd?: number;
  tax_usd?: number;
  shipping_fee_usd?: number;
  total_usd?: number;
  /** @deprecated kept for backwards compatibility with older order JSON */
  order_total_usd?: number;
  promo_applied?: {
    code: string;
    discount_usd: number;
    description?: string;
  };
  payment_method?: string;
  ship_to?: {
    name: string;
    street: string;
    unit?: string;
    city: string;
    state: string;
    zip: string;
  };
  /** @deprecated convenience legacy field */
  ship_to_zip?: string;
  carrier?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  shipped_on?: string | null;
  delivered_on?: string | null;
  estimated_delivery?: string;
  delivery_window_text?: string;
  return_eligible?: boolean | null;
  return_window_ends_on?: string | null;
  return_policy_note?: string;
  cancellation?: {
    allowed: boolean;
    deadline: string | null;
    note: string;
  };
  address_change?: {
    allowed: boolean;
    fee_usd: number | null;
    note: string;
  };
  gift_options?: {
    is_gift: boolean;
    gift_message?: string;
    gift_receipt_included?: boolean;
  };
  signature_required?: boolean;
  signature_note?: string;
  notes?: string | null;
};

export type WayfairProduct = {
  id: string;
  name: string;
  price_usd: number;
  shipping?: {
    standard_days?: string;
    express_days?: string;
    express_fee_usd?: number;
  };
  [key: string]: unknown;
};

let ordersCache: WayfairOrder[] | null = null;
let productsCache: WayfairProduct[] | null = null;

export async function loadOrders(): Promise<WayfairOrder[]> {
  if (ordersCache) return ordersCache;
  const file = path.join(process.cwd(), "data", "wayfair-orders.json");
  const raw = await readFile(file, "utf8");
  ordersCache = JSON.parse(raw) as WayfairOrder[];
  return ordersCache;
}

export async function loadProducts(): Promise<WayfairProduct[]> {
  if (productsCache) return productsCache;
  const file = path.join(process.cwd(), "data", "wayfair-products.json");
  const raw = await readFile(file, "utf8");
  productsCache = JSON.parse(raw) as WayfairProduct[];
  return productsCache;
}

/**
 * Normalize a spoken or typed order ID like "WF 100482", "wf-100482",
 * "one zero zero four eight two" (best-effort) into the canonical
 * "WF-100482" format used in the JSON.
 */
export function normalizeOrderId(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/[\s_]/g, "");
  if (/^WF-?\d+$/.test(s)) {
    const digits = s.replace(/^WF-?/, "");
    return `WF-${digits}`;
  }
  if (/^\d+$/.test(s)) return `WF-${s}`;
  return raw.trim();
}
