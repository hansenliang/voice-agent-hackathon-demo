import { LO_VOICE_INSTRUCTIONS } from "@/lib/voice/system-prompt";
import { realtimeToolDefinitions } from "@/lib/voice/tools";

export const runtime = "nodejs";
export const maxDuration = 30;

const REALTIME_MODEL = "gpt-realtime-2";
const REALTIME_VOICE = "marin";

export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Missing OPENAI_API_KEY in environment" },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session: {
            type: "realtime",
            model: REALTIME_MODEL,
            instructions: LO_VOICE_INSTRUCTIONS,
            audio: {
              output: { voice: REALTIME_VOICE },
            },
            tools: realtimeToolDefinitions,
            tool_choice: "auto",
          },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      return Response.json(
        { error: `OpenAI client_secrets ${response.status}: ${errText}` },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      client_secret?: { value?: string; expires_at?: number };
      value?: string;
      expires_at?: number;
    };

    const value = data.client_secret?.value ?? data.value;
    if (!value) {
      return Response.json(
        { error: "client_secret missing from OpenAI response" },
        { status: 502 },
      );
    }

    return Response.json({
      value,
      expires_at: data.client_secret?.expires_at ?? data.expires_at,
      model: REALTIME_MODEL,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to mint realtime client secret",
      },
      { status: 500 },
    );
  }
}
