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
    destination_zip?: string;
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
          message: `No shipment found for ${canonical}.`,
        },
        { status: 200 },
      );
    }

    const primaryProduct = order.items[0]
      ? productById.get(order.items[0].product_id)
      : undefined;

    const destination =
      body.destination_zip ?? order.ship_to?.zip ?? order.ship_to_zip;
    const ship = (primaryProduct as { shipping?: unknown } | undefined)
      ?.shipping as
      | {
          standard_days?: string;
          express_days?: string;
          express_fee_usd?: number;
        }
      | undefined;

    return Response.json({
      found: true,
      order_id: order.order_id,
      status: order.status,
      status_detail: order.status_detail,
      carrier: order.carrier,
      tracking_number: order.tracking_number,
      tracking_url: order.tracking_url,
      ship_to: order.ship_to,
      destination_zip: destination,
      shipped_on: order.shipped_on,
      delivered_on: order.delivered_on,
      estimated_delivery: order.estimated_delivery,
      delivery_window_text: order.delivery_window_text,
      address_change: order.address_change,
      shipping_options_for_similar_orders: ship
        ? {
            standard_days: ship.standard_days,
            express_days: ship.express_days,
            express_fee_usd: ship.express_fee_usd,
          }
        : undefined,
      primary_item: primaryProduct?.name ?? order.items[0]?.product_id,
      notes: order.notes,
    });
  } catch (e) {
    return Response.json(
      {
        error: e instanceof Error ? e.message : "track_shipment failed",
      },
      { status: 500 },
    );
  }
}
