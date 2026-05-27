<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — Wayfair Voice CS (Subconscious Hackathon)

## Bootstrap for any new session
1. Read this file.
2. Read `docs/HANDOFF.md` if it exists.
3. Run `git status` + `git log --oneline -10`.
4. State your plan in chat. Ask before contradicting these rules.

## Demo target
Three scripted flows in `docs/demo-script.md`. **Anything that doesn't serve them is out of scope.**

## Architecture (locked)
- **OpenAI Realtime (`gpt-realtime-2`)** = conversational brain. Sub-second voice. Native function calls over WebRTC.
- **Subconscious (`subconscious/tim-qwen3.6-27b`, thinking OFF)** = deep-reasoning research specialist, dispatched from the voice agent via the `ask_research_agent` tool.
- The **latency bridge** — Lo's filler narration while Subconscious thinks (3–15s) — is the demo. Don't lose it.

```
Browser /voice ──WebRTC──► OpenAI Realtime (gpt-realtime-2)
                            │
                            ├─ lookup_order      ──► /api/voice-lookup-order   (fast, mock JSON)
                            ├─ track_shipment    ──► /api/voice-track-shipment (fast, mock JSON)
                            └─ ask_research_agent ──► /api/voice-research      (slow, Subconscious ToolLoopAgent)
```

## Principles
- **Latency is the product on voice.** No buffering, no text-LLM in the voice path. Streaming end to end.
- **Barge-in is non-negotiable.** Server VAD with `interrupt_response: true`. User cuts in → agent stops within ~150ms.
- **Subconscious is for reasoning, not for being a slow chatbot.** Trivial lookups go through fast tools, not Subconscious.
- **Mock the world, not the voice or the reasoning.** Product/order data is JSON; voice loop and Subconscious dispatch are real every session.
- **Test the demo path, not the code path.** Acceptance = open browser, talk to it, watch 3 demo flows work.
- **Web-verify anything that moves** (realtime model IDs, Subconscious engine names — these change weekly).

## Anti-patterns (do not)
- Don't introduce a text-LLM between the user and the realtime model.
- Don't synthesize Lo's voice with a separate TTS step. Use realtime native audio.
- Don't buffer user audio. Stream as it arrives.
- Don't swallow realtime socket errors silently — surface in UI state.
- Don't call Subconscious from the browser. Server-side only.
- Don't route trivial lookups through Subconscious.
- Don't add features that don't serve the 3 demo flows.
- Don't gold-plate the UI.

## Build discipline
- One concern per session. Out-of-scope work waits.
- Hand-write docs. No LLM-generated context files.
- When done with a slice, update `docs/HANDOFF.md`.
- Parallel sessions: use `git worktree`. Suggest worktree boundaries before splitting.

## Project structure
```
/AGENTS.md
/CLAUDE.md             ← one-line pointer
/docs/HANDOFF.md       ← rolling state, updated each slice
/docs/demo-script.md   ← exact lines for the 3 demo flows
/data/
  wayfair-products.json
  wayfair-orders.json
/lib/voice/
  system-prompt.ts     ← Lo persona + delight directive
  tools.ts             ← realtime tool defs + browser dispatcher
/lib/tools/
  wayfair-tools.ts     ← search_products + get_product_details (Subconscious-side)
/lib/agents/
  voice-research-agent.ts ← Subconscious ToolLoopAgent for /api/voice-research
/app/voice/
  page.tsx             ← voice UI
/app/api/
  voice-token/route.ts            ← ephemeral OpenAI Realtime session token
  voice-research/route.ts         ← Subconscious bridge (non-streaming)
  voice-lookup-order/route.ts     ← mock order lookup
  voice-track-shipment/route.ts   ← mock shipment tracking
```

## Env
- `OPENAI_API_KEY` — required for realtime
- `SUBCONSCIOUS_API_KEY` — required for research dispatch (`sky_...`)

Set both in `.env.local`.
