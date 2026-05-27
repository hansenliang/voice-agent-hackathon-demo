"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { executeRealtimeToolCall, toolDisplayFor } from "@/lib/voice/tools";

function PhoneIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" />
    </svg>
  );
}

function MicIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function attachAnalyser(
  stream: MediaStream,
  levelRef: { current: number },
): () => void {
  try {
    const Ctx = (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext) as typeof AudioContext;
    const ctx = new Ctx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getByteFrequencyData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i];
      const avg = sum / buf.length;
      levelRef.current = Math.min(1, avg / 55);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      try {
        source.disconnect();
      } catch {}
      try {
        void ctx.close();
      } catch {}
    };
  } catch {
    return () => {};
  }
}

function VoiceOrb({
  assistantLevelRef,
  userLevelRef,
  state,
}: {
  assistantLevelRef: React.MutableRefObject<number>;
  userLevelRef: React.MutableRefObject<number>;
  state:
    | "idle"
    | "connecting"
    | "listening"
    | "thinking"
    | "speaking"
    | "error";
}) {
  const orbRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const node = orbRef.current;
      if (node) {
        const live =
          state === "speaking"
            ? assistantLevelRef.current
            : state === "listening"
              ? userLevelRef.current
              : 0;
        node.style.setProperty("--level", live.toFixed(3));
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [state, assistantLevelRef, userLevelRef]);

  const colorVars: React.CSSProperties = (() => {
    switch (state) {
      case "listening":
        return {
          ["--c1" as string]: "rgb(125 211 252)",
          ["--c2" as string]: "rgb(56 189 248)",
        } as React.CSSProperties;
      case "thinking":
        return {
          ["--c1" as string]: "rgb(252 211 77)",
          ["--c2" as string]: "rgb(245 158 11)",
        } as React.CSSProperties;
      case "error":
        return {
          ["--c1" as string]: "rgb(252 165 165)",
          ["--c2" as string]: "rgb(239 68 68)",
        } as React.CSSProperties;
      default:
        return {
          ["--c1" as string]: "rgb(255 165 110)",
          ["--c2" as string]: "rgb(255 92 40)",
        } as React.CSSProperties;
    }
  })();

  const label =
    state === "connecting"
      ? "Connecting"
      : state === "listening"
        ? "Listening"
        : state === "thinking"
          ? "Thinking"
          : state === "speaking"
            ? "Speaking"
            : state === "error"
              ? "Error"
              : "";

  return (
    <div className="relative flex flex-col items-center gap-4 py-4">
      <div className="relative flex h-44 w-44 items-center justify-center">
        <div ref={orbRef} className="voice-orb" style={colorVars} />
      </div>
      {label && (
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-400">
          {label}
        </span>
      )}
    </div>
  );
}

function MicOffIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

type CallState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

type MessageItem = {
  kind: "message";
  id: string;
  role: "user" | "assistant";
  text: string;
  partial: boolean;
};

type ToolItem = {
  kind: "tool";
  id: string;
  name: string;
  status: "running" | "done" | "error";
  ms?: number;
  argsPreview?: string;
};

type TranscriptItem = MessageItem | ToolItem;

export default function VoicePage() {
  const [state, setState] = useState<CallState>("idle");
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const toolStartRef = useRef<Map<string, number>>(new Map());
  const assistantLevelRef = useRef(0);
  const userLevelRef = useRef(0);
  const audioCleanupsRef = useRef<Array<() => void>>([]);

  const upsertAssistantPartial = useCallback(
    (responseId: string, deltaText: string) => {
      setTranscript((prev) => {
        const idx = prev.findIndex(
          (item) =>
            item.kind === "message" &&
            item.id === responseId &&
            item.role === "assistant",
        );
        if (idx >= 0) {
          const next = prev.slice();
          const existing = next[idx] as MessageItem;
          next[idx] = { ...existing, text: existing.text + deltaText };
          return next;
        }
        return [
          ...prev,
          {
            kind: "message",
            id: responseId,
            role: "assistant",
            text: deltaText,
            partial: true,
          },
        ];
      });
    },
    [],
  );

  const finalizeAssistant = useCallback(
    (responseId: string, finalText?: string) => {
      setTranscript((prev) =>
        prev.map((item) =>
          item.kind === "message" &&
          item.id === responseId &&
          item.role === "assistant"
            ? { ...item, text: finalText ?? item.text, partial: false }
            : item,
        ),
      );
    },
    [],
  );

  const upsertUserLine = useCallback((itemId: string, text: string) => {
    setTranscript((prev) => {
      const idx = prev.findIndex(
        (item) =>
          item.kind === "message" &&
          item.id === itemId &&
          item.role === "user",
      );
      if (idx >= 0) {
        const next = prev.slice();
        const existing = next[idx] as MessageItem;
        next[idx] = { ...existing, text, partial: false };
        return next;
      }
      return [
        ...prev,
        { kind: "message", id: itemId, role: "user", text, partial: false },
      ];
    });
  }, []);

  const allocateLine = useCallback(
    (itemId: string, role: "user" | "assistant") => {
      setTranscript((prev) => {
        if (
          prev.some(
            (item) =>
              item.kind === "message" &&
              item.id === itemId &&
              item.role === role,
          )
        ) {
          return prev;
        }
        return [
          ...prev,
          { kind: "message", id: itemId, role, text: "", partial: true },
        ];
      });
    },
    [],
  );

  const addToolEntry = useCallback(
    (callId: string, name: string, argsPreview?: string) => {
      setTranscript((prev) => {
        if (prev.some((item) => item.kind === "tool" && item.id === callId)) {
          return prev;
        }
        return [
          ...prev,
          {
            kind: "tool",
            id: callId,
            name,
            status: "running",
            argsPreview,
          },
        ];
      });
    },
    [],
  );

  const updateToolEntry = useCallback(
    (callId: string, status: "done" | "error", ms: number) => {
      setTranscript((prev) =>
        prev.map((item) =>
          item.kind === "tool" && item.id === callId
            ? { ...item, status, ms }
            : item,
        ),
      );
    },
    [],
  );

  const handleServerEvent = useCallback(
    (event: Record<string, unknown>) => {
      const type = event.type as string | undefined;
      if (!type) return;

      switch (type) {
        case "session.created":
        case "session.updated":
          break;

        case "conversation.item.created":
        case "conversation.item.added": {
          const item = event.item as
            | { id?: string; type?: string; role?: "user" | "assistant" }
            | undefined;
          if (
            item?.id &&
            item.type === "message" &&
            (item.role === "user" || item.role === "assistant")
          ) {
            allocateLine(item.id, item.role);
          }
          break;
        }

        case "input_audio_buffer.speech_started":
          setState("listening");
          break;

        case "input_audio_buffer.speech_stopped":
          setState("thinking");
          break;

        case "response.created":
          setState("thinking");
          break;

        case "response.output_audio.delta":
        case "response.audio.delta":
          setState("speaking");
          break;

        case "response.output_audio_transcript.delta":
        case "response.audio_transcript.delta": {
          const lineId =
            (event.item_id as string | undefined) ??
            (event.response_id as string | undefined) ??
            "current";
          const delta = (event.delta as string | undefined) ?? "";
          if (delta) upsertAssistantPartial(lineId, delta);
          break;
        }

        case "response.output_audio_transcript.done":
        case "response.audio_transcript.done": {
          const lineId =
            (event.item_id as string | undefined) ??
            (event.response_id as string | undefined) ??
            "current";
          const finalText = event.transcript as string | undefined;
          finalizeAssistant(lineId, finalText);
          break;
        }

        case "conversation.item.input_audio_transcription.completed": {
          const itemId = event.item_id as string;
          const text = event.transcript as string;
          if (itemId && text) upsertUserLine(itemId, text);
          break;
        }

        case "response.output_item.done": {
          const item = event.item as
            | {
                type?: string;
                name?: string;
                call_id?: string;
                arguments?: string;
              }
            | undefined;
          if (item?.type === "function_call" && item.name && item.call_id) {
            void handleFunctionCall(item.name, item.call_id, item.arguments);
          }
          break;
        }

        case "response.done": {
          setState("listening");
          break;
        }

        case "error": {
          const message =
            (event.error as { message?: string } | undefined)?.message ??
            "Realtime API error";
          setError(message);
          setState("error");
          break;
        }

        default:
          break;
      }
    },
    [
      allocateLine,
      finalizeAssistant,
      upsertAssistantPartial,
      upsertUserLine,
    ],
  );

  const handleFunctionCall = useCallback(
    async (name: string, callId: string, argsJson?: string) => {
      let args: Record<string, unknown> = {};
      try {
        args = argsJson ? JSON.parse(argsJson) : {};
      } catch {
        args = {};
      }

      const argEntries = Object.entries(args).slice(0, 2);
      const argsPreview =
        argEntries.length === 0
          ? undefined
          : argEntries
              .map(([k, v]) => {
                const s = typeof v === "string" ? v : JSON.stringify(v);
                const trimmed = s.length > 48 ? `${s.slice(0, 45)}…` : s;
                return `${k}: ${trimmed}`;
              })
              .join(" · ");

      const start = performance.now();
      toolStartRef.current.set(callId, start);
      addToolEntry(callId, name, argsPreview);

      const result = await executeRealtimeToolCall(name, args);
      const elapsed = Math.round(performance.now() - start);
      updateToolEntry(callId, result.ok ? "done" : "error", elapsed);

      const dc = dcRef.current;
      if (!dc || dc.readyState !== "open") return;

      const outputString = result.ok
        ? JSON.stringify(result.output)
        : JSON.stringify({ error: result.error });

      dc.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: outputString,
          },
        }),
      );
      dc.send(JSON.stringify({ type: "response.create" }));
    },
    [addToolEntry, updateToolEntry],
  );

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    setMuted((prev) => {
      const next = !prev;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
      return next;
    });
  }, []);

  const stopCall = useCallback(() => {
    const pc = pcRef.current;
    if (pc) {
      pc.getSenders().forEach((s) => {
        if (s.track) s.track.stop();
      });
      pc.close();
    }
    pcRef.current = null;

    const ls = localStreamRef.current;
    if (ls) {
      ls.getTracks().forEach((t) => t.stop());
    }
    localStreamRef.current = null;

    audioCleanupsRef.current.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
    audioCleanupsRef.current = [];
    assistantLevelRef.current = 0;
    userLevelRef.current = 0;

    dcRef.current = null;
    setMuted(false);
    setState("idle");
  }, []);

  const startCall = useCallback(async () => {
    setError(null);
    setTranscript([]);
    setState("connecting");

    try {
      const tokenResp = await fetch("/api/voice-token", { method: "POST" });
      if (!tokenResp.ok) {
        const msg = await tokenResp.text();
        throw new Error(`token mint failed: ${msg}`);
      }
      const { value: ephemeralKey } = (await tokenResp.json()) as {
        value: string;
      };
      if (!ephemeralKey) throw new Error("no ephemeral key returned");

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      pc.ontrack = (e) => {
        if (audioElRef.current) {
          audioElRef.current.srcObject = e.streams[0];
        }
        const cleanup = attachAnalyser(e.streams[0], assistantLevelRef);
        audioCleanupsRef.current.push(cleanup);
      };

      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = localStream;
      audioCleanupsRef.current.push(
        attachAnalyser(localStream, userLevelRef),
      );
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.addEventListener("open", () => {
        dc.send(
          JSON.stringify({
            type: "session.update",
            session: {
              type: "realtime",
              audio: {
                input: {
                  turn_detection: {
                    type: "server_vad",
                    threshold: 0.7,
                    prefix_padding_ms: 250,
                    silence_duration_ms: 450,
                    create_response: true,
                    interrupt_response: true,
                  },
                  transcription: { model: "gpt-4o-mini-transcribe" },
                },
              },
            },
          }),
        );
        dc.send(JSON.stringify({ type: "response.create" }));
      });

      dc.addEventListener("message", (e) => {
        try {
          const parsed = JSON.parse(e.data);
          handleServerEvent(parsed);
        } catch {
          // ignore non-JSON frames
        }
      });

      dc.addEventListener("error", (e) => {
        console.error("data channel error", e);
        setError("data channel error");
        setState("error");
      });

      pc.addEventListener("connectionstatechange", () => {
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected"
        ) {
          setError(`connection ${pc.connectionState}`);
          setState("error");
        }
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResp = await fetch(
        "https://api.openai.com/v1/realtime/calls",
        {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            "Content-Type": "application/sdp",
          },
        },
      );

      if (!sdpResp.ok) {
        const msg = await sdpResp.text();
        throw new Error(`SDP exchange failed ${sdpResp.status}: ${msg}`);
      }

      const answer: RTCSessionDescriptionInit = {
        type: "answer",
        sdp: await sdpResp.text(),
      };
      await pc.setRemoteDescription(answer);

      setState("listening");
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "failed to start call");
      setState("error");
      stopCall();
    }
  }, [handleServerEvent, stopCall]);

  useEffect(() => {
    return () => {
      stopCall();
    };
  }, [stopCall]);

  const stateColor =
    state === "speaking"
      ? "bg-emerald-500"
      : state === "listening"
        ? "bg-[#FF5C28]"
        : state === "thinking"
          ? "bg-amber-400"
          : state === "connecting"
            ? "bg-blue-400"
            : state === "error"
              ? "bg-red-500"
              : "bg-zinc-600";

  const stateLabel =
    state === "idle"
      ? "Idle"
      : state === "connecting"
        ? "Connecting…"
        : state === "listening"
          ? "Listening"
          : state === "thinking"
            ? "Lo is thinking"
            : state === "speaking"
              ? "Lo is speaking"
              : "Error";

  const isLive = state !== "idle" && state !== "error";

  const lastTool = [...transcript]
    .reverse()
    .find((item): item is ToolItem => item.kind === "tool");

  return (
    <div className="voice-bg relative flex min-h-full flex-col text-white">
      <header className="relative z-10 border-b border-zinc-900/70 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[#FF5C28]">
            Wayfair Support · Voice Demo
          </p>
          <h1 className="text-xl font-semibold tracking-tight">
            Lo — Customer Service Specialist
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Demo by Hansen Liang · May 26, 2026
          </p>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {!isLive ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-10 py-12">
            <button
              type="button"
              onClick={startCall}
              className="start-call-button flex h-28 w-28 items-center justify-center rounded-full bg-[#FF5C28] text-black shadow-[0_12px_44px_-4px_rgba(255,92,40,0.6)] transition hover:scale-105 hover:bg-[#ff7347] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF5C28]/40 active:scale-95"
              aria-label="Start call"
            >
              <PhoneIcon className="h-12 w-12" />
            </button>
            <div className="text-center">
              <p className="text-lg font-medium text-zinc-100">
                Tap to start your call
              </p>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-500">
                Try: <span className="text-zinc-300">&ldquo;I&rsquo;m looking for a new couch around $1,500 that&rsquo;s cat-friendly.&rdquo;</span>
              </p>
            </div>
          </div>
        ) : (
          <>
            <VoiceOrb
              assistantLevelRef={assistantLevelRef}
              userLevelRef={userLevelRef}
              state={state}
            />

            <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-zinc-900 bg-zinc-950/70 p-4 backdrop-blur">
              {transcript.length === 0 && (
                <div className="flex h-full min-h-[240px] items-center justify-center text-sm text-zinc-600">
                  Listening…
                </div>
              )}

              {transcript.map((item) => {
                if (item.kind === "tool") {
                  const meta = toolDisplayFor(item.name);
                  const isSubconscious =
                    meta.providerTone === "subconscious";
                  return (
                    <div
                      key={`tool-${item.id}`}
                      className="flex justify-center animate-in fade-in slide-in-from-bottom-1 duration-300"
                    >
                      <div
                        className={`flex max-w-[85%] items-center gap-3 rounded-xl border px-3 py-2 text-xs transition ${
                          item.status === "running"
                            ? `tool-chip-running ${
                                isSubconscious
                                  ? "border-[#FF5C28]/40 bg-zinc-950 shadow-[0_0_24px_-6px_rgba(255,92,40,0.35)]"
                                  : "border-zinc-800 bg-zinc-950"
                              }`
                            : item.status === "done"
                              ? "border-zinc-900 bg-zinc-950/60"
                              : "border-red-900/50 bg-red-950/30"
                        }`}
                      >
                        <span
                          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                            item.status === "running"
                              ? "bg-amber-400/10 text-amber-400"
                              : item.status === "done"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {item.status === "running" ? (
                            <svg
                              className="h-3 w-3 animate-spin"
                              viewBox="0 0 24 24"
                              fill="none"
                              aria-hidden="true"
                            >
                              <circle
                                cx="12"
                                cy="12"
                                r="9"
                                stroke="currentColor"
                                strokeOpacity="0.3"
                                strokeWidth="3"
                              />
                              <path
                                d="M21 12a9 9 0 00-9-9"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                              />
                            </svg>
                          ) : item.status === "done" ? (
                            <svg
                              className="h-3 w-3"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M5 12l5 5L20 7" />
                            </svg>
                          ) : (
                            <svg
                              className="h-3 w-3"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              aria-hidden="true"
                            >
                              <path d="M6 6l12 12M6 18L18 6" />
                            </svg>
                          )}
                        </span>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="font-medium text-zinc-200">
                              {item.status === "running"
                                ? `${meta.verb}…`
                                : meta.doneLabel}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                isSubconscious
                                  ? "bg-[#FF5C28]/15 text-[#FF5C28]"
                                  : "bg-zinc-800 text-zinc-300"
                              }`}
                            >
                              {isSubconscious ? "via " : ""}
                              {meta.provider}
                            </span>
                            {item.status !== "running" && item.ms != null && (
                              <span className="font-mono text-[10px] text-zinc-500">
                                {item.ms}ms
                              </span>
                            )}
                          </div>
                          {item.argsPreview && (
                            <span className="truncate font-mono text-[10px] text-zinc-500">
                              {item.argsPreview}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={`msg-${item.role}-${item.id}`}
                    className={`flex animate-in fade-in slide-in-from-bottom-1 duration-200 ${
                      item.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        item.role === "user"
                          ? "bg-[#FF5C28] text-black"
                          : "border border-zinc-800 bg-zinc-900 text-zinc-100"
                      }`}
                    >
                      <div
                        className={`mb-1 text-xs font-medium uppercase tracking-wide ${
                          item.role === "user"
                            ? "text-black/60"
                            : "text-[#FF5C28]"
                        }`}
                      >
                        {item.role === "user" ? "You" : "Lo"}
                      </div>
                      <p className="whitespace-pre-wrap">
                        {item.text || (
                          <span className="inline-flex gap-1 align-middle">
                            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current opacity-60" />
                            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current opacity-60 [animation-delay:150ms]" />
                            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current opacity-60 [animation-delay:300ms]" />
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-16 pt-8 pb-4">
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-pressed={muted}
                  aria-label={muted ? "Unmute microphone" : "Mute microphone"}
                  className={`flex h-16 w-16 items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-4 focus-visible:ring-white/20 active:scale-95 ${
                    muted
                      ? "bg-white text-black hover:bg-zinc-200"
                      : "bg-zinc-800 text-white hover:bg-zinc-700"
                  }`}
                >
                  {muted ? <MicOffIcon className="h-7 w-7" /> : <MicIcon className="h-7 w-7" />}
                </button>
                <span className="text-xs text-zinc-500">
                  {muted ? "muted" : "mute"}
                </span>
              </div>

              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={stopCall}
                  aria-label="End call"
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-[0_6px_24px_-4px_rgba(239,68,68,0.55)] transition hover:bg-red-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-500/40 active:scale-95"
                >
                  <PhoneIcon className="h-7 w-7 rotate-[135deg]" />
                </button>
                <span className="text-xs text-zinc-500">end</span>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-zinc-900 bg-zinc-950/80">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${stateColor} ${
                isLive ? "animate-pulse" : ""
              }`}
            />
            {stateLabel}
          </span>
          <span className="text-zinc-700">·</span>
          <span>voice: openai gpt-realtime-2 / marin</span>
          <span className="text-zinc-700">·</span>
          <span>research: subconscious tim-qwen3.6</span>
          {lastTool && (
            <>
              <span className="text-zinc-700">·</span>
              <span>
                tool: {lastTool.name}{" "}
                {lastTool.status === "running"
                  ? "…"
                  : `${lastTool.ms ?? "?"}ms`}
              </span>
            </>
          )}
          {muted && (
            <>
              <span className="text-zinc-700">·</span>
              <span className="text-red-400">mic muted</span>
            </>
          )}
        </div>
      </footer>

      <audio ref={audioElRef} autoPlay playsInline className="hidden" />
    </div>
  );
}
