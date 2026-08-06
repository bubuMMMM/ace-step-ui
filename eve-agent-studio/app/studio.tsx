"use client";

import { useCallback, useMemo, useState } from "react";
import { type AgentSpec, BLANK_SPEC, STARTER_SPEC, kebab } from "@/lib/spec";
import { generateProject, lintSpec } from "@/lib/generate";
import { downloadZip } from "@/lib/zip";
import { Builder } from "./builder";
import { Files } from "./files";
import { Assist } from "./assist";
import { CopyButton, DownloadIcon } from "./ui";

type RightTab = "files" | "assist" | "ship";
type MobilePane = "builder" | "output";

export function Studio() {
  const [spec, setSpec] = useState<AgentSpec>(STARTER_SPEC);
  const [tab, setTab] = useState<RightTab>("files");
  const [mobilePane, setMobilePane] = useState<MobilePane>("builder");
  const [selected, setSelected] = useState("agent/instructions.md");

  const files = useMemo(() => generateProject(spec), [spec]);
  const issues = useMemo(() => lintSpec(spec), [spec]);

  const patch = useCallback(
    (values: Partial<AgentSpec>) => setSpec((current) => ({ ...current, ...values })),
    [],
  );

  // Stable identity: Assist runs this from an effect.
  const replaceSpec = useCallback((next: AgentSpec) => {
    setSpec(next);
    setSelected("agent/instructions.md");
  }, []);

  const download = () => {
    const folder = kebab(spec.name);
    downloadZip(
      `${folder}.zip`,
      files.map((file) => ({ path: `${folder}/${file.path}`, content: file.content })),
    );
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            e
          </span>
          <span className="brand-name">Eve Agent Studio</span>
        </div>
        <span className="brand-sub">
          Design an AI agent, export a runnable{" "}
          <a
            href="https://eve.dev"
            target="_blank"
            rel="noreferrer"
            style={{ color: "inherit" }}
          >
            eve
          </a>{" "}
          project
        </span>

        <span className="topbar-spacer" />

        <div className="topbar-actions">
          <span className="pill">
            {files.length} file{files.length === 1 ? "" : "s"}
          </span>
          <button type="button" className="btn btn-primary" onClick={download}>
            <DownloadIcon /> Download project
          </button>
        </div>
      </header>

      <div className="mobile-tabs">
        <div className="tabs">
          <button
            type="button"
            className="tab"
            data-active={mobilePane === "builder"}
            onClick={() => setMobilePane("builder")}
          >
            Builder
          </button>
          <button
            type="button"
            className="tab"
            data-active={mobilePane === "output"}
            onClick={() => setMobilePane("output")}
          >
            Output
          </button>
        </div>
      </div>

      <div className="panes">
        <section className="pane" data-mobile-active={mobilePane === "builder"}>
          <div className="pane-head">
            <span className="pane-title">Builder</span>
            <span style={{ flex: 1 }} />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setSpec(STARTER_SPEC)}
            >
              Example
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setSpec(BLANK_SPEC)}
            >
              Reset
            </button>
          </div>
          <div className="pane-body">
            <Builder spec={spec} onChange={patch} />
          </div>
        </section>

        <section className="pane" data-mobile-active={mobilePane === "output"}>
          <div className="pane-head">
            <div className="tabs">
              <button
                type="button"
                className="tab"
                data-active={tab === "files"}
                onClick={() => setTab("files")}
              >
                Files
              </button>
              <button
                type="button"
                className="tab"
                data-active={tab === "assist"}
                onClick={() => setTab("assist")}
              >
                AI assist
              </button>
              <button
                type="button"
                className="tab"
                data-active={tab === "ship"}
                onClick={() => setTab("ship")}
              >
                Ship it
              </button>
            </div>
            <span style={{ flex: 1 }} />
            {issues.length > 0 && tab !== "ship" ? (
              <button
                type="button"
                className="pill"
                style={{ cursor: "pointer", color: "var(--warn)" }}
                onClick={() => setTab("ship")}
              >
                {issues.length} check{issues.length === 1 ? "" : "s"}
              </button>
            ) : null}
          </div>

          <div
            className="pane-body"
            style={tab === "files" ? { overflow: "hidden" } : undefined}
          >
            {tab === "files" ? (
              <Files files={files} selected={selected} onSelect={setSelected} />
            ) : null}
            {tab === "assist" ? <Assist spec={spec} onSpec={replaceSpec} /> : null}
            {tab === "ship" ? <Ship spec={spec} issues={issues} /> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function Ship({ spec, issues }: { spec: AgentSpec; issues: string[] }) {
  const folder = kebab(spec.name);
  const commands = `unzip ${folder}.zip
cd ${folder}
npm install
npm run dev`;

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
      {issues.length > 0 ? (
        <div className="notice notice-warn">
          <span aria-hidden="true">⚠</span>
          <span>
            <strong>Worth fixing before you ship</strong>
            <ul>
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </span>
        </div>
      ) : (
        <div className="notice notice-info">
          <span aria-hidden="true">✓</span>
          <span>No issues found. Download the project and run it.</span>
        </div>
      )}

      <Step
        n={1}
        title="Download and run it"
        body="The project is a normal npm package. Node.js 24 or newer is required."
      >
        <CodeBlock text={commands} />
      </Step>

      <Step
        n={2}
        title="Give it a model credential"
        body={`${spec.model} routes through the Vercel AI Gateway, so it needs AI_GATEWAY_API_KEY. Linking a Vercel project works too — VERCEL_OIDC_TOKEN supplies the credential automatically.`}
      >
        <CodeBlock text={`echo "AI_GATEWAY_API_KEY=your-key" >> .env.local`} />
      </Step>

      <Step
        n={3}
        title="Deploy"
        body={
          spec.includeFrontend
            ? "withEve() ships the web app and the agent runtime as a single Vercel project, and turns each schedule into a Vercel Cron Job."
            : "The agent deploys as a standalone eve service. Point a frontend at it with useEveAgent({ host })."
        }
      >
        <CodeBlock text="npx vercel deploy" />
      </Step>

      <div className="notice notice-info">
        <span aria-hidden="true">→</span>
        <span>
          Prefer to start from eve&apos;s own scaffold? <code>npx eve@latest init</code>{" "}
          creates a project, installs dependencies, and opens the dev TUI. The full docs
          live at{" "}
          <a href="https://eve.dev/docs" target="_blank" rel="noreferrer">
            eve.dev/docs
          </a>
          .
        </span>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  body,
  children,
}: {
  n: number;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <span
        aria-hidden="true"
        style={{
          flex: "none",
          width: 22,
          height: 22,
          borderRadius: 99,
          display: "grid",
          placeItems: "center",
          background: "var(--surface-3)",
          border: "1px solid var(--line)",
          fontSize: 11.5,
          fontWeight: 600,
          color: "var(--text-dim)",
          marginTop: 1,
        }}
      >
        {n}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{title}</div>
        <p style={{ margin: "0 0 9px", color: "var(--text-dim)", fontSize: 13 }}>{body}</p>
        {children}
      </div>
    </div>
  );
}

function CodeBlock({ text }: { text: string }) {
  return (
    <div className="card">
      <div className="card-head" style={{ padding: "5px 5px 5px 12px" }}>
        <span className="card-title" style={{ color: "var(--text-faint)" }}>
          shell
        </span>
        <div className="card-actions">
          <CopyButton value={text} className="btn btn-ghost btn-sm" />
        </div>
      </div>
      <pre
        style={{
          margin: 0,
          padding: "10px 12px",
          fontFamily: "var(--mono)",
          fontSize: 12.5,
          lineHeight: 1.7,
          overflowX: "auto",
          color: "var(--text)",
        }}
      >
        {text}
      </pre>
    </div>
  );
}
