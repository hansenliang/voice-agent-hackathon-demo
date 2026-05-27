# HANDOFF — Wayfair Voice CS

## Last updated: 2026-05-26 by Subconscious-half agent

## Where we are
Subconscious research half done and verified. Voice loop in progress in parallel.

## What works (verified)
- POST /api/voice-research returns a speakable 2-3 sentence answer grounded in catalog
- search_products + get_product_details over data/wayfair-products.json
- voiceResearchAgent (Subconscious / TIM-Qwen3.6, thinking off)

## What's pending
- /voice page + WebRTC
- /api/voice-token (ephemeral key mint)
- Realtime tool wiring (lookup_order, track_shipment, ask_research_agent)
- Lo system prompt + delight directive
- Demo dress (3 flows)

## How to verify locally
```bash
pnpm dev
# in another shell:
curl -X POST http://localhost:3000/api/voice-research \
  -H "Content-Type: application/json" \
  -d '{"question":"I need a sectional for a 12x14 room with kids and a dog, budget around $1500"}'
# expect: 200 with { "answer": "<2-3 sentences naming real products>" }
```

## Demo flows (LOCKED)
1. **Sectional under constraints** — "I'm looking for a sectional for my 12x14 apartment, two kids, a dog that sheds, budget around $1500. What do you recommend?" → Lo: filler narration while Subconscious researches → reasoned recommendation naming 1-2 products.
2. **Mid-turn color barge-in** — Lo mid-sentence, user cuts in: "Wait — does the first one come in dark gray?" → Lo stops ~150ms → answers using product detail.
3. **Shipping ETA follow-up** — "How fast would that ship to 02134?" → fast tool path (NOT through Subconscious) → standard vs express delivery answer.

## Architecture (LOCKED)
- OpenAI Realtime `gpt-realtime-2` = voice brain. Sub-second turn-taking. Native function calls.
- Subconscious (TIM-Qwen3.6) = research specialist via `ask_research_agent` tool.
- The latency bridge (Lo's filler during Subconscious's 3-15s wait) is the demo.

## Don't re-litigate
- Engine: gpt-realtime-2 for voice, subconscious/tim-qwen3.6-27b with thinking OFF for research.
- Voice: marin
- Persona: Lo from Wayfair Support
- Out of scope: anything that doesn't serve flows 1/2/3

## Files this session created
- `data/wayfair-products.json` — 8-product catalog (2 sectionals at ~$1399 / ~$1649 that both fit a 12x14 room with pets+kids; 1 sectional NOT pet-friendly to make filters meaningful)
- `data/wayfair-orders.json` — 3 orders, shipped/delivered/processing, ship-to 02134 on the shipped one
- `lib/tools/wayfair-tools.ts` — `searchProducts` + `getProductDetails`, registered under snake_case names (`search_products`, `get_product_details`) to match the system prompt
- `lib/agents/voice-research-agent.ts` — `ToolLoopAgent` tuned for 2-3 sentence speakable output, maxOutputTokens 400, 10 step cap
- `app/api/voice-research/route.ts` — non-streaming POST handler, uses `voiceResearchAgent.generate({ prompt })` and returns `{ answer }`
- `docs/HANDOFF.md` (this file)
- `docs/demo-script.md` — the lines to say + what to expect

## Notes for the voice-half agent
- The non-streaming method on `ToolLoopAgent` is `.generate({ prompt | messages })` and the assistant text is `result.text`. No need to accumulate stream chunks.
- Tools are registered as `search_products` and `get_product_details` (snake_case) so the model invocation names line up with how the system prompt refers to them.
- Color synonyms are handled in `wayfair-tools.ts` (`COLOR_SYNONYMS`): "dark gray" → charcoal/slate, "off-white" → ivory/oatmeal, etc. Flow 2 ("dark gray") relies on this.
- Subconscious thinking is OFF (see `lib/subconscious.ts`). Don't turn it on — round-trip latency matters for the demo and the filler bridge is already built around the 3-15s window.
- If the answer is empty, the route returns 502 — that means tool outputs reached the model but it produced no text. Usually a sign the model decided to keep tool-looping and hit the step cap; bump `stepCountIs` or tighten the prompt.
