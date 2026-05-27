import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadOrders, loadProducts } from "@/lib/voice/server-data";

export const runtime = "nodejs";
export const maxDuration = 10;

type Customer = {
  phone_e164: string;
  phone_display: string;
  first_name: string;
  last_name: string;
  email: string;
  address: {
    street: string;
    unit?: string;
    city: string;
    state: string;
    zip: string;
  };
  loyalty_tier: string;
  member_since: string;
  order_ids: string[];
};

let customerCache: Customer[] | null = null;

async function loadCustomers(): Promise<Customer[]> {
  if (customerCache) return customerCache;
  const file = path.join(
    process.cwd(),
    "data",
    "wayfair-customers.json",
  );
  customerCache = JSON.parse(await readFile(file, "utf8")) as Customer[];
  return customerCache;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    phone?: string;
  };

  try {
    const [customers, orders, products] = await Promise.all([
      loadCustomers(),
      loadOrders(),
      loadProducts(),
    ]);

    const productById = new Map(products.map((p) => [p.id, p]));

    const customer = body.phone
      ? customers.find((c) =>
          c.phone_e164.includes(body.phone!.replace(/\D/g, "")),
        ) ?? customers[0]
      : customers[0];

    if (!customer) {
      return Response.json({ found: false }, { status: 200 });
    }

    const orderSummaries = customer.order_ids.map((oid) => {
      const order = orders.find((o) => o.order_id === oid);
      if (!order) return { order_id: oid, status: "unknown" };
      const primary = order.items[0]
        ? productById.get(order.items[0].product_id)
        : undefined;
      return {
        order_id: order.order_id,
        status: order.status,
        status_detail: order.status_detail,
        placed_at: order.placed_at,
        primary_item: primary?.name ?? order.items[0]?.product_id,
        item_count: order.items.reduce((sum, it) => sum + it.qty, 0),
        total_usd: order.total_usd ?? order.order_total_usd,
        estimated_delivery: order.estimated_delivery,
        delivered_on: order.delivered_on,
        carrier: order.carrier,
        is_gift: order.gift_options?.is_gift ?? false,
      };
    });

    return Response.json({
      found: true,
      caller: {
        first_name: customer.first_name,
        last_name: customer.last_name,
        phone_display: customer.phone_display,
        email: customer.email,
        address: customer.address,
        loyalty_tier: customer.loyalty_tier,
        member_since: customer.member_since,
      },
      orders_on_file: orderSummaries,
    });
  } catch (e) {
    return Response.json(
      {
        error: e instanceof Error ? e.message : "identify_caller failed",
      },
      { status: 500 },
    );
  }
}
