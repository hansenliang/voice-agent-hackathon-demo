# Demo script — ~60 seconds

A tight, scripted run to show off the voice loop + Subconscious orchestration + barge-in + rich-order policy handling. Practice once before recording — target ~60 seconds plus opener.

---

## 0:00 — 0:10 · Opener (presenter speaks to camera, app not yet open)

> "This is Lo — a customer service voice agent for Wayfair. Voice runs on OpenAI's newest realtime model. The reasoning behind the hard questions runs on Subconscious's TIM model. Watch what she can do when both are working together at full speed."

Open `localhost:3000/voice`. Tap the big orange phone button.

## 0:10 — 0:13 · Greeting (Lo, automatic)

> Lo: "Hey, you've reached Wayfair Support, this is Lo — what can I help you with today?"

---

## 0:13 — 0:28 · Scenario A — couch shopping (Subconscious dispatch)

**You say:**
> "Hey, I'm looking for a new couch — somewhere around $1,500, and it needs to be cat-friendly. No kids, no dogs."

**Expect:**
- Lo: "Let me look into that — quick one, sectional or a regular couch?"
- Orange **"via Subconscious"** chip animates in: *Researching the catalog…*
- You: "Doesn't matter, surprise me."
- ~3–5s later the chip turns green → Lo: "Okay, two solid options — the Harlowe Performance Sectional at $1,399 has a scratch-resistant fabric that holds up great to cats. Or the Zuri Sofa at $1,250 if you want a cleaner silhouette. Either of those sound interesting?"

**The wow:** orange Subconscious chip + the filler-while-thinking bridge. The "via Subconscious" badge is what differentiates this from a single-model voice agent.

---

## 0:28 — 0:42 · Scenario B — previous order ETA + signature follow-up

**You say:**
> "By the way, while I have you here — can I check in on my previous order? I think it shipped a while ago. When will it arrive?"

**Expect:**
- Two gray chips, fast: *Recognizing caller…* → *Looking up your order…*
- Lo: "Yeah — I see your Harlowe sectional in charcoal. It's with FedEx, last scan this morning heading into Boston. You're looking at Saturday between 9 and 2."

**You say (follow-up):**
> "Will I have to be there to sign for it? I might be traveling that day."

**Expect:**
- Lo: "Nope — no signature required. Driver does curbside drop, so FedEx will leave it secured at the building entrance even if no one's home. One heads-up though: it's curbside only, so you'll want a plan for getting it inside when you're back."

**The wow:** multi-turn context retention (Lo knows "it" = the Harlowe sectional without you re-naming it), AND a specific policy answer with concrete consequences.

---

## 0:42 — 0:52 · Scenario C — barge-in + care instructions

**You say:**
> "Nice. Hey, the coffee table you delivered a few weeks ago—"

Wait for Lo to start her sentence. As soon as you hear her voice — INTERRUPT.

> "—wait, how do I clean it?"

**Expect:**
- Lo stops mid-word within ~150ms.
- Chip: *Looking up your order…*
- Lo: "The Linden Reclaimed Oak — just dust with a soft dry cloth, no harsh chemicals since it's a natural oil finish. Blot spills fast with a damp cloth and dry it off. You're also still inside the return window if anything's off — you've got til Saturday."

**The wow:** barge-in works, and Lo still has full context about which coffee table you mean.

---

## 0:52 — 1:05 · Scenario D — address change (processing order)

**You say:**
> "Last thing — that order I placed this morning, I need to swap the shipping address."

**Expect:**
- Chip: *Looking up your order…*
- Lo: "The processing order with the two Pierce chairs and the Avery floor lamp going to Priya in New York? Yeah — still in fulfillment, so the address change is free pre-ship. What's the new spot?"

**You say:**
> "245 East 12th Street, apartment 4A."

**Expect:**
- Lo: "Got it, updating it now. She'll get a confirmation email in a couple minutes."

End the call (red phone button).

---

## Tips for a clean take

- Mute button is right next to End — tap it if a notification dings mid-demo.
- One sentence at a time. Don't pile questions. Each scenario is a fresh turn.
- Don't apologize if Lo varies the wording — judges hear "real conversation," not memorized script. Variations help.
- If Subconscious takes 6+s in Scenario A, the filler is doing its job. Lo will keep talking. Don't break character.
- For the barge-in (Scenario C): the interrupt only works if Lo has actually started speaking. Wait for her voice, then cut in. If you start before she does, server VAD treats it as one continuous turn.

## What's real vs mocked (for Q&A after)

| | Status |
|---|---|
| Voice loop (mic ↔ OpenAI gpt-realtime-2, WebRTC, VAD, barge-in, Whisper) | **REAL** |
| Subconscious dispatch (`ask_research_agent` → real ToolLoopAgent on TIM-Qwen3.6) | **REAL** |
| Product search / reasoning (Subconscious agent uses real `search_products` + `get_product_details` tools over 111 catalog records) | **REAL logic, mock data** |
| Order lookup / shipment / signature / address change / cancellation flows | **REAL logic, mock data** |
| Caller recognition by phone number | **REAL logic, mock data** (one customer: Hansen Liang) |
