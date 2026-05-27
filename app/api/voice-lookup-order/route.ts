import {
  loadOrders,
  loadProducts,
  normalizeOrderId,
} from "@/lib/voice/server-data";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    order_id?: string;
  };

  if (!body.order_id) {
    return Response.json({ error: "order_id required" }, { status: 400 });
  }

  const canonical = normalizeOrderId(body.order_id);

  try {
    const [orders, products] = await Promise.all([
      loadOrders(),
      loadProducts(),
    ]);

    const productById = new Map(products.map((p) => [p.id, p]));

    const order = orders.find(
      (o) =>
        o.order_id.toUpperCase() === canonical.toUpperCase() ||
        o.order_id.replace(/[^0-9]/g, "") ===
          canonical.replace(/[^0-9]/g, ""),
    );

    if (!order) {
      return Response.json(
        {
          found: false,
          order_id: canonical,
          message: `No order found for ${canonical}. Try one of the orders on file for the caller.`,
        },
        { status: 200 },
      );
    }

    const enrichedItems = order.items.map((item) => {
      const p = productById.get(item.product_id) as
        | (Record<string, unknown> & { name?: string; price_usd?: number })
        | undefined;
      const { id: _ignoredId, ...productDetails } = p ?? {};
      void _ignoredId;
      return {
        ...productDetails,
        product_id: item.product_id,
        qty: item.qty,
        selected_color: item.color,
        unit_price_usd: item.unit_price_usd ?? p?.price_usd,
        line_total_usd: item.line_total_usd,
      };
    });

    return Response.json({
      found: true,
      ...order,
      items: enrichedItems,
    });
  } catch (e) {
    return Response.json(
      {
        error: e instanceof Error ? e.message : "lookup_order failed",
      },
      { status: 500 },
    );
  }
}
