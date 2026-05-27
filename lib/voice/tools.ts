/**
 * Realtime tool DEFINITIONS (the JSON schemas registered with the OpenAI Realtime
 * session) and the BROWSER-side HANDLERS that execute when the model calls them.
 *
 * Handlers proxy to server routes (so secrets stay server-side and so we can
 * read mock JSON from disk). The Subconscious-side route is owned by the parallel
 * agent; the order/shipment routes are owned here.
 */

export type RealtimeToolDefinition = {
  type: "function";
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
};

export type ToolDisplayMeta = {
  /** Short present-continuous verb shown in the UI while running. */
  verb: string;
  /** Past-tense label shown once finished. */
  doneLabel: string;
  /** Provider badge text (e.g. "Subconscious", "Wayfair OMS"). */
  provider: string;
  /** Provider tone — affects badge color. */
  providerTone: "subconscious" | "wayfair";
};

export const TOOL_DISPLAY: Record<string, ToolDisplayMeta> = {
  identify_caller: {
    verb: "Recognizing caller",
    doneLabel: "Recognized caller",
    provider: "Wayfair CRM",
    providerTone: "wayfair",
  },
  lookup_order: {
    verb: "Looking up your order",
    doneLabel: "Order looked up",
    provider: "Wayfair OMS",
    providerTone: "wayfair",
  },
  track_shipment: {
    verb: "Checking shipment status",
    doneLabel: "Shipment checked",
    provider: "Wayfair OMS",
    providerTone: "wayfair",
  },
  ask_research_agent: {
    verb: "Researching the catalog",
    doneLabel: "Research complete",
    provider: "Subconscious",
    providerTone: "subconscious",
  },
};

export function toolDisplayFor(name: string): ToolDisplayMeta {
  return (
    TOOL_DISPLAY[name] ?? {
      verb: name,
      doneLabel: name,
      provider: "tool",
      providerTone: "wayfair",
    }
  );
}

export const realtimeToolDefinitions: RealtimeToolDefinition[] = [
  {
    type: "function",
    name: "identify_caller",
    description:
      "Recognize the customer calling in from their phone number. Returns the customer's name, address on file, loyalty tier, and a summary of their recent orders. Call this PROACTIVELY at the start of a service interaction OR whenever the customer references 'my order' / 'my package' / 'where's my stuff' without giving an order ID — you should already know who they are. Fast (<1s).",
    parameters: {
      type: "object",
      properties: {
        phone: {
          type: "string",
          description:
            "Optional. The caller's phone number if known. Defaults to the active call's caller ID.",
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "lookup_order",
    description:
      "Look up a Wayfair order by its order ID. Returns status, items, carrier, tracking, and estimated delivery. Fast (<1s) — use this directly without filler narration.",
    parameters: {
      type: "object",
      properties: {
        order_id: {
          type: "string",
          description:
            "The order ID, e.g. 'WF-100482'. Accept any reasonable variant the customer says aloud — strip spaces, normalize case.",
        },
      },
      required: ["order_id"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "track_shipment",
    description:
      "Track an in-transit shipment for an existing Wayfair order. Returns carrier, tracking number, ship-to zip, and estimated delivery window with standard vs express options. Fast (<1s).",
    parameters: {
      type: "object",
      properties: {
        order_id: {
          type: "string",
          description: "The order ID, e.g. 'WF-100482'.",
        },
        destination_zip: {
          type: "string",
          description:
            "Optional destination ZIP code if the customer specifies a different address than the one on file.",
        },
      },
      required: ["order_id"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "ask_research_agent",
    description:
      "Dispatch a research question to the Wayfair product research specialist. Use for ANY question that needs reasoning over the catalog: product recommendations under constraints (room size, budget, pets, kids, style), comparisons between products, color/material/dimension questions, fit-checking. SLOW (3-15 seconds) — you MUST narrate the wait with filler conversation. Do NOT use for simple order or shipment lookups.",
    parameters: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description:
            "The question to research, in plain English. Include the customer's constraints verbatim (room size, budget, pets/kids, style, color preferences). Example: 'Sectional for 12x14 room, two kids, dog that sheds, budget around $1500. What fits?'",
        },
        context: {
          type: "string",
          description:
            "Optional. Any prior context from the conversation the researcher should know (e.g. 'customer was previously interested in the Harlowe Performance Sectional').",
        },
      },
      required: ["question"],
      additionalProperties: false,
    },
  },
];

export type ToolCallResult =
  | { ok: true; output: unknown }
  | { ok: false; error: string };

/**
 * Browser-side dispatcher. Maps a tool name + arguments object to a server route
 * call and returns the result that should be sent back to the Realtime session
 * as a function_call_output.
 */
export async function executeRealtimeToolCall(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolCallResult> {
  try {
    switch (name) {
      case "identify_caller": {
        const response = await fetch("/api/voice-identify-caller", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args),
        });
        if (!response.ok) {
          return {
            ok: false,
            error: `identify_caller ${response.status}: ${await response.text()}`,
          };
        }
        return { ok: true, output: await response.json() };
      }
      case "lookup_order": {
        const response = await fetch("/api/voice-lookup-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args),
        });
        if (!response.ok) {
          return {
            ok: false,
            error: `lookup_order ${response.status}: ${await response.text()}`,
          };
        }
        return { ok: true, output: await response.json() };
      }
      case "track_shipment": {
        const response = await fetch("/api/voice-track-shipment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args),
        });
        if (!response.ok) {
          return {
            ok: false,
            error: `track_shipment ${response.status}: ${await response.text()}`,
          };
        }
        return { ok: true, output: await response.json() };
      }
      case "ask_research_agent": {
        const response = await fetch("/api/voice-research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args),
        });
        if (!response.ok) {
          return {
            ok: false,
            error: `ask_research_agent ${response.status}: ${await response.text()}`,
          };
        }
        return { ok: true, output: await response.json() };
      }
      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "tool dispatch failed",
    };
  }
}
