# Lo — Wayfair Voice Customer Service Agent

A real-time voice agent for Wayfair customer service, built for the Subconscious x Wayfair hackathon (May 2026).

**The premise:** put a state-of-the-art realtime voice model on the front end so the customer experience is sub-second and natural, and a deep-reasoning model on the back end for hard catalog questions. The voice agent fills the latency gap with personality while the research agent thinks.

```
   Browser /voice ──WebRTC──▶ OpenAI gpt-realtime-2  (voice brain)
                                │
                                ├─ identify_caller    ──▶ /api/voice-identify-caller   (Wayfair CRM, fast)
                                ├─ lookup_order       ──▶ /api/voice-lookup-order      (Wayfair OMS, fast)
                                ├─ track_shipment     ──▶ /api/voice-track-shipment    (Wayfair OMS, fast)
                                └─ ask_research_agent ──▶ /api/voice-research          (Subconscious, slow)
                                                         │
                                                         └─ ToolLoopAgent on TIM-Qwen3.6
                                                              ├─ search_products
                                                              └─ get_product_details
```

## What's actually doing the work

| Component | Status |
|---|---|
| Voice loop (mic ↔ OpenAI `gpt-realtime-2`, WebRTC, server-side VAD, barge-in, `gpt-4o-mini-transcribe`) | **REAL** |
| Subconscious dispatch (`ask_research_agent` → real `ToolLoopAgent` on TIM-Qwen3.6, thinking off for speed) | **REAL** |
| Product reasoning over a 111-item catalog (`search_products` + `get_product_details` tools) | **REAL logic, mock JSON catalog** |
| Order lookup, shipment tracking, address change, cancellation, return-window, signature, gift handling | **REAL logic, mock JSON orders** |
| Caller recognition by phone number | **REAL logic, one mocked customer** |

The orchestration, tool dispatch, streaming voice, barge-in, and Subconscious reasoning all run live every call. Only the underlying data (catalog, orders, customer) is mocked — the moment a real Wayfair backend is wired in, none of the agent code changes.

## Demo

See [`docs/demo-script.md`](docs/demo-script.md) for the full 60-second scripted run covering four scenarios:

1. **Couch shopping under constraints** — fires `ask_research_agent` with the orange Subconscious chip, Lo fills the 3–5s wait with conversational filler.
2. **Previous order ETA + signature follow-up** — `identify_caller` then `lookup_order`, multi-turn context retention.
3. **Barge-in + care instructions** — interrupt Lo mid-sentence, she stops within 150ms and answers the new question with full context.
4. **Address change on processing order** — Lo reads the cancellation/address-change policy fields from the order and quotes specific deadlines and fees.

## Running it locally

```bash
pnpm install
cp .env.example .env.local
# Fill in OPENAI_API_KEY and SUBCONSCIOUS_API_KEY
NODE_EXTRA_CA_CERTS=/etc/ssl/cert.pem pnpm dev
# Open http://localhost:3000/voice and tap the phone button
```

`NODE_EXTRA_CA_CERTS` is only needed on Node 25+ on macOS where Node doesn't trust the system root store out of the box.

### Required env

| Variable | Why |
|---|---|
| `OPENAI_API_KEY` | Mints the ephemeral Realtime client secret for the browser to connect over WebRTC. |
| `SUBCONSCIOUS_API_KEY` | Powers the deep-reasoning research agent at `/api/voice-research`. Get one at [subconscious.dev/platform](https://www.subconscious.dev/platform). |

## Layout

```
app/voice/page.tsx               ← voice UI: WebRTC, audio analyser orb, transcript, controls
app/api/voice-token/             ← mints OpenAI Realtime ephemeral session token
app/api/voice-research/          ← Subconscious bridge (non-streaming)
app/api/voice-{lookup-order,track-shipment,identify-caller}/   ← fast Wayfair-side tools

lib/voice/system-prompt.ts       ← Lo's persona, delight directive, policy knowledge
lib/voice/tools.ts               ← realtime tool definitions + browser dispatcher
lib/voice/server-data.ts         ← order/product/customer JSON loaders
lib/agents/voice-research-agent.ts  ← Subconscious ToolLoopAgent
lib/tools/wayfair-tools.ts       ← search_products + get_product_details over catalog

data/wayfair-products.json       ← 111 furniture products
data/wayfair-orders.json         ← 3 orders w/ varied statuses (delivered, in-transit, processing)
data/wayfair-customers.json      ← 1 customer (Hansen Liang)

docs/demo-script.md              ← 60-second demo run sheet
docs/HANDOFF.md                  ← rolling session state
```

## Stack

- **Next.js 16.2.6** (App Router + Turbopack)
- **React 19.2.4**
- **Vercel AI SDK v6** (`ToolLoopAgent`, OpenAI provider configured to point at Subconscious)
- **OpenAI Realtime `gpt-realtime-2`** for voice
- **Subconscious TIM-Qwen3.6** for reasoning
- Tailwind 4, TypeScript 5

## Credit

Forked from the [Subconscious × Wayfair hackathon starter](https://github.com/subconscious-systems/hack-webapp-starter). The starter ships the Subconscious provider config, chat UI, and Vercel AI SDK plumbing — the voice agent, orchestration, tools, mock data, and persona are this project.
