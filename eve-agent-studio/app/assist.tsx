"use client";

import { useEffect, useRef, useState } from "react";
import { useEveAgent } from "eve/react";
import type { AgentSpec } from "@/lib/spec";
import { findDraftInMessages, findLatestDraft, specFromToolInput } from "@/lib/apply";
import { SparkIcon } from "./ui";

const SUGGESTIONS = [
  "An agent that triages inbound support email and drafts replies",
  "A weekly agent that turns merged PRs into a changelog",
  "An agent that answers questions about our Postgres schema",
  "An on-call agent that summarizes alerts and pages a human when severity is high",
];

export function Assist({
  spec,
  onSpec,
}: {
  spec: AgentSpec;
  onSpec: (next: AgentSpec) => void;
}) {
  const agent = useEveAgent();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const appliedRef = useRef<string>("");

  // The spec must be read fresh when a draft lands, but it should not re-run
  // this effect on every keystroke in the builder.
  const specRef = useRef(spec);
  specRef.current = spec;

  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  const messages = agent.data.messages;

  // Watch the stream for a draft_agent_spec call and load it into the builder.
  useEffect(() => {
    const input =
      findLatestDraft(agent.events as readonly unknown[]) ??
      findDraftInMessages(messages as readonly unknown[]);
    if (!input) return;

    const fingerprint = JSON.stringify(input);
    if (fingerprint === appliedRef.current) return;

    const next = specFromToolInput(input, specRef.current);
    if (!next) return;

    appliedRef.current = fingerprint;
    onSpec(next);
  }, [agent.events, messages, onSpec]);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, agent.status]);

  const send = (text: string) => {
    const message = text.trim();
    if (message.length === 0 || isBusy) return;
    setDraft("");
    void agent.send(message);
  };

  return (
    <div className="assist">
      <div className="assist-scroll" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="assist-intro">
            <strong>Describe the agent you want.</strong>
            The architect drafts it — instructions, tools, skills, schedules — and loads
            it straight into the builder, where you can edit every line.
          </div>
        ) : null}

        {messages.map((message) => {
          const text = message.parts
            .filter((part) => part.type === "text")
            .map((part) => ("text" in part ? part.text : ""))
            .join("")
            .trim();

          const drafted = message.parts.some(
            (part) =>
              "toolName" in part &&
              (part as { toolName?: unknown }).toolName === "draft_agent_spec",
          );

          if (!text && !drafted) return null;

          return (
            <div key={message.id} style={{ display: "contents" }}>
              {text ? (
                <div className="msg" data-role={message.role}>
                  {text}
                </div>
              ) : null}
              {drafted ? (
                <div className="msg-tool">
                  <SparkIcon /> Loaded into the builder
                </div>
              ) : null}
            </div>
          );
        })}

        {agent.error ? <AgentError message={agent.error.message} /> : null}
      </div>

      <div className="assist-composer">
        {messages.length === 0 ? (
          <div className="suggestions">
            {SUGGESTIONS.map((suggestion) => (
              <button
                type="button"
                key={suggestion}
                className="chip"
                disabled={isBusy}
                onClick={() => send(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        <form
          className="assist-row"
          onSubmit={(event) => {
            event.preventDefault();
            send(draft);
          }}
        >
          <textarea
            rows={1}
            value={draft}
            placeholder="Describe an agent, or ask for a change…"
            aria-label="Message the architect"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send(draft);
              }
            }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isBusy || draft.trim().length === 0}
          >
            {isBusy ? "…" : "Send"}
          </button>
          {isBusy ? (
            <button type="button" className="btn" onClick={() => agent.stop()}>
              Stop
            </button>
          ) : null}
        </form>
      </div>
    </div>
  );
}

/**
 * The two failures worth naming: no model credential configured, and the
 * channel rejecting the browser. Everything else shows the raw message.
 */
function AgentError({ message }: { message: string }) {
  const lower = message.toLowerCase();
  const unauthorized = lower.includes("401") || lower.includes("unauthor");
  const credential =
    lower.includes("api key") ||
    lower.includes("gateway") ||
    lower.includes("credential") ||
    lower.includes("internal server error") ||
    lower.includes("500");

  return (
    <div className="notice notice-warn" style={{ alignSelf: "stretch" }}>
      <span aria-hidden="true">⚠</span>
      <span>
        <strong>The architect is unavailable.</strong>
        {unauthorized ? (
          <>
            {" "}
            The agent&apos;s channel rejected this request. Check the auth policy in{" "}
            <code>agent/channels/eve.ts</code>.
          </>
        ) : credential ? (
          <>
            {" "}
            This usually means no model credential is set. Add{" "}
            <code>AI_GATEWAY_API_KEY</code> to the project&apos;s environment variables
            and redeploy.
          </>
        ) : null}
        <br />
        <span style={{ opacity: 0.75, fontSize: "11.5px" }}>{message}</span>
        <br />
        The builder and the export on the left work without it.
      </span>
    </div>
  );
}
