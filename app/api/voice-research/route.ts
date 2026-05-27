import { voiceResearchAgent } from "@/lib/agents/voice-research-agent";
import { requireSubconsciousApiKey } from "@/lib/subconscious";

/**
 * POST /api/voice-research
 *
 * Request: { question: string, context?: string }
 * Response 200: { answer: string }  // 2-3 sentences, speakable
 * Response 4xx/5xx: { error: string }
 *
 * Called by the OpenAI Realtime voice agent (Lo) via the `ask_research_agent`
 * tool. The agent does the catalog lookups via Subconscious and returns a
 * short, voice-ready answer that Lo will speak.
 */

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    requireSubconsciousApiKey();
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Missing Subconscious API key",
      },
      { status: 500 },
    );
  }

  let body: { question?: unknown; context?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Body must be valid JSON." },
      { status: 400 },
    );
  }

  const question =
    typeof body.question === "string" ? body.question.trim() : "";
  const context =
    typeof body.context === "string" ? body.context.trim() : "";

  if (!question) {
    return Response.json(
      { error: "Field 'question' is required and must be a non-empty string." },
      { status: 400 },
    );
  }

  const prompt = context
    ? `Conversation context so far: ${context}\n\nUser's current question: ${question}`
    : question;

  try {
    const result = await voiceResearchAgent.generate({ prompt });
    const answer = (result.text ?? "").trim();
    if (!answer) {
      return Response.json(
        {
          error:
            "Research agent returned no text. Check Subconscious connectivity and tool outputs.",
        },
        { status: 502 },
      );
    }
    return Response.json({ answer });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Voice research agent failed.",
      },
      { status: 500 },
    );
  }
}
