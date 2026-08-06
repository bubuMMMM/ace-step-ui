import {
  type AgentSpec,
  type ToolSpec,
  type ScheduleSpec,
  type SkillSpec,
  kebab,
  slug,
} from "./spec";

export interface GeneratedFile {
  path: string;
  content: string;
  language: "ts" | "md" | "json" | "css" | "tsx" | "text";
}

/** Double-quoted TS/JSON string literal. */
function q(value: string): string {
  return JSON.stringify(value);
}

/** Template literal body — escape the two sequences that would break out. */
function tpl(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

function trimTrailing(value: string): string {
  return value.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n");
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

/** Unique, filesystem-safe names — two tools called "search" must not collide. */
function uniqueNames<T>(items: T[], nameOf: (item: T) => string, fallback: string) {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const base = slug(nameOf(item), fallback);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return { item, name: count === 0 ? base : `${base}_${count + 1}` };
  });
}

function toolFile(tool: ToolSpec, name: string): string {
  const params = tool.parameters.filter((param) => param.name.trim().length > 0);
  const imports = [`import { defineTool } from "eve/tools";`];
  if (tool.requiresApproval) {
    imports.push(`import { always } from "eve/tools/approval";`);
  }
  imports.push(`import { z } from "zod";`);

  const schema =
    params.length === 0
      ? `  inputSchema: z.object({}),`
      : [
          `  inputSchema: z.object({`,
          ...params.map((param) => {
            const key = slug(param.name, "value");
            const optional = param.optional ? ".optional()" : "";
            const described = param.description.trim()
              ? `.describe(${q(param.description.trim())})`
              : "";
            return `    ${key}: z.${param.type}()${optional}${described},`;
          }),
          `  }),`,
        ].join("\n");

  const destructured =
    params.length === 0
      ? "()"
      : `({ ${params.map((param) => slug(param.name, "value")).join(", ")} })`;

  const echo =
    params.length === 0
      ? ""
      : `\n      received: { ${params
          .map((param) => slug(param.name, "value"))
          .join(", ")} },`;

  return ensureTrailingNewline(
    [
      imports.join("\n"),
      "",
      `export default defineTool({`,
      `  description: ${q(tool.description.trim() || `The ${name} tool.`)},`,
      schema,
      tool.requiresApproval
        ? `  // Irreversible or costly: eve pauses the run and waits for a human.\n  approval: always(),`
        : null,
      `  async execute${destructured} {`,
      `    // TODO: implement ${name} against your real system.`,
      `    return {`,
      `      ok: false,`,
      `      todo: ${q(`Implement ${name} in agent/tools/${name}.ts.`)},${echo}`,
      `    };`,
      `  },`,
      `});`,
    ]
      .filter((line) => line !== null)
      .join("\n"),
  );
}

function skillFile(skill: SkillSpec, name: string): string {
  const description =
    skill.description.trim() || `Use when the task calls for the ${name} procedure.`;
  const body = trimTrailing(skill.body.trim()) || `Describe the ${name} procedure here.`;
  return ensureTrailingNewline(
    ["---", `description: ${description}`, "---", "", body].join("\n"),
  );
}

function scheduleFile(schedule: ScheduleSpec, name: string): string {
  const prompt =
    trimTrailing(schedule.prompt.trim()) || `Describe what ${name} should do here.`;
  return ensureTrailingNewline(
    [
      `import { defineSchedule } from "eve/schedules";`,
      "",
      `export default defineSchedule({`,
      `  // 5-field cron, evaluated in UTC by Vercel Cron Jobs.`,
      `  cron: ${q(schedule.cron.trim() || "0 9 * * 1-5")},`,
      `  markdown: \`${tpl(prompt)}\`,`,
      `});`,
    ].join("\n"),
  );
}

function agentFile(spec: AgentSpec): string {
  const lines = [
    `import { defineAgent } from "eve";`,
    "",
    `export default defineAgent({`,
    `  model: ${q(spec.model)},`,
  ];
  if (spec.reasoning !== "provider-default") {
    lines.push(`  reasoning: ${q(spec.reasoning)},`);
  }
  lines.push(`});`);
  return ensureTrailingNewline(lines.join("\n"));
}

function channelFile(spec: AgentSpec): string {
  const helpers = spec.auth.length > 0 ? spec.auth : ["vercelOidc", "localDev"];
  // `none()` must come last: the walk stops at the first authenticator that accepts.
  const ordered = [...helpers].sort((a, b) => Number(a === "none") - Number(b === "none"));
  const imported = [...new Set(ordered)].sort();

  const entries = ordered.map((mode) =>
    mode === "httpBasic"
      ? `httpBasic({ username: process.env.AGENT_USER ?? "agent", password: process.env.AGENT_PASSWORD ?? "" })`
      : `${mode}()`,
  );

  const warning = ordered.includes("none")
    ? [
        "",
        "/**",
        " * ⚠️ `none()` accepts anonymous traffic — anyone with the URL can spend your",
        " * model credits. Remove it before this agent handles anything real.",
        " */",
      ].join("\n")
    : "";

  return ensureTrailingNewline(
    [
      `import { eveChannel } from "eve/channels/eve";`,
      `import { ${imported.join(", ")} } from "eve/channels/auth";`,
      warning,
      `export default eveChannel({`,
      `  auth: [${entries.join(", ")}],`,
      `});`,
    ]
      .filter((line) => line !== "")
      .join("\n"),
  );
}

function packageJson(spec: AgentSpec): string {
  const scripts: Record<string, string> = spec.includeFrontend
    ? {
        build: "next build",
        "build:eve": "eve build",
        dev: "next dev",
        "dev:eve": "eve dev",
        start: "next start",
        "start:eve": "eve start",
      }
    : {
        build: "eve build",
        dev: "eve dev",
        start: "eve start",
      };

  const dependencies: Record<string, string> = {
    ai: "^7.0.38",
    eve: "^0.31.0",
    zod: "4.4.3",
  };
  const devDependencies: Record<string, string> = {
    "@types/node": "26",
    typescript: "6.0.3",
  };

  if (spec.includeFrontend) {
    dependencies.next = "16.3.0";
    dependencies.react = "19.2.6";
    dependencies["react-dom"] = "19.2.6";
    devDependencies["@types/react"] = "19.2.15";
    devDependencies["@types/react-dom"] = "19.2.3";
  }

  const sorted = (record: Record<string, string>) =>
    Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));

  return ensureTrailingNewline(
    JSON.stringify(
      {
        name: kebab(spec.name),
        version: "0.1.0",
        private: true,
        engines: { node: ">=24" },
        scripts,
        dependencies: sorted(dependencies),
        devDependencies: sorted(devDependencies),
      },
      null,
      2,
    ),
  );
}

function readme(
  spec: AgentSpec,
  tools: { name: string; item: ToolSpec }[],
  skills: { name: string }[],
  schedules: { name: string; item: ScheduleSpec }[],
): string {
  const lines: string[] = [`# ${spec.name}`, ""];

  if (spec.description.trim()) {
    lines.push(spec.description.trim(), "");
  }

  lines.push(
    "Built with [eve](https://eve.dev), the filesystem-first framework for durable AI agents.",
    "",
    "## Run it",
    "",
    "```bash",
    "npm install",
    "npm run dev",
    "```",
    "",
    `This agent uses \`${spec.model}\` through the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway), so set \`AI_GATEWAY_API_KEY\` before starting — or link a Vercel project and let \`VERCEL_OIDC_TOKEN\` supply the credential.`,
    "",
    "```bash",
    "cp .env.example .env.local",
    "```",
    "",
    "Requires Node.js 24 or newer.",
    "",
    "## What's in here",
    "",
    "```text",
    "agent/",
    "├── agent.ts            # model and runtime config",
    "├── instructions.md     # the always-on system prompt",
    "├── channels/eve.ts     # HTTP routes and their auth policy",
  );

  if (tools.length > 0) {
    lines.push("├── tools/              # typed actions the model can call");
  }
  if (skills.length > 0) {
    lines.push("├── skills/             # procedures loaded on demand");
  }
  if (schedules.length > 0) {
    lines.push("└── schedules/          # recurring work");
  }
  lines.push("```", "");

  if (tools.length > 0) {
    lines.push("### Tools", "");
    for (const { name, item } of tools) {
      const approval = item.requiresApproval ? " _(requires approval)_" : "";
      lines.push(`- **\`${name}\`**${approval} — ${item.description.trim()}`);
    }
    lines.push(
      "",
      "Every tool ships as a stub that returns `{ ok: false, todo: ... }`. Implement each `execute` against your real system before relying on the agent.",
      "",
    );
  }

  if (schedules.length > 0) {
    lines.push("### Schedules", "");
    for (const { name, item } of schedules) {
      lines.push(`- **\`${name}\`** — \`${item.cron}\` (UTC)`);
    }
    lines.push(
      "",
      "On Vercel each schedule becomes a Cron Job. `eve dev` never fires them on their cadence.",
      "",
    );
  }

  if (spec.auth.includes("none")) {
    lines.push(
      "## ⚠️ This agent's routes are public",
      "",
      "`agent/channels/eve.ts` includes `none()`, which accepts anonymous traffic — anyone with the URL can spend your model credits. Drop `none()` and keep `[vercelOidc(), localDev()]` before deploying anything real.",
      "",
    );
  }

  lines.push(
    "## Deploy",
    "",
    "```bash",
    "npx vercel deploy",
    "```",
    "",
    spec.includeFrontend
      ? "`withEve()` in `next.config.ts` ships the web app and the agent runtime as a single Vercel project, so the browser reaches the agent same-origin at `/eve/v1/*`."
      : "The agent deploys as a standalone eve service. Point a frontend at it with `useEveAgent({ host })`, or add a channel under `agent/channels/`.",
    "",
    "---",
    "",
    "_Scaffolded with Eve Agent Studio._",
  );

  return ensureTrailingNewline(lines.join("\n"));
}

function frontendFiles(spec: AgentSpec): GeneratedFile[] {
  const title = spec.name;
  return [
    {
      path: "next.config.ts",
      language: "ts",
      content: `import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {};

// Mounts the agent's routes at /eve/v1/* on this app's own origin, so the
// browser never crosses a CORS boundary and no agent URL env var is needed.
export default withEve(nextConfig);
`,
    },
    {
      path: "tsconfig.json",
      language: "json",
      content: `{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`,
    },
    {
      path: "app/layout.tsx",
      language: "tsx",
      content: `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: ${q(title)},
  description: ${q(spec.description.trim() || `${title}, built with eve.`)},
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
    },
    {
      path: "app/page.tsx",
      language: "tsx",
      content: `import { Chat } from "./chat";

export default function Page() {
  return (
    <main className="shell">
      <header className="header">
        <h1>${title.replace(/</g, "&lt;")}</h1>
      </header>
      <Chat />
    </main>
  );
}
`,
    },
    {
      path: "app/chat.tsx",
      language: "tsx",
      content: `"use client";

import { useState } from "react";
import { useEveAgent } from "eve/react";

export function Chat() {
  const agent = useEveAgent();
  const [draft, setDraft] = useState("");
  const isBusy = agent.status === "submitted" || agent.status === "streaming";

  return (
    <section className="chat">
      <ol className="messages">
        {agent.data.messages.map((message) => (
          <li key={message.id} data-role={message.role}>
            {message.parts.map((part, index) =>
              part.type === "text" ? <p key={index}>{part.text}</p> : null,
            )}
          </li>
        ))}
      </ol>

      {agent.error ? <p className="error">{agent.error.message}</p> : null}

      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          const message = draft.trim();
          if (message.length === 0 || isBusy) return;
          setDraft("");
          void agent.send(message);
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask the agent…"
          disabled={isBusy}
        />
        <button type="submit" disabled={isBusy || draft.trim().length === 0}>
          {isBusy ? "…" : "Send"}
        </button>
      </form>
    </section>
  );
}
`,
    },
    {
      path: "app/globals.css",
      language: "css",
      content: `*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  background: #09090b;
  color: #e4e4e7;
  line-height: 1.6;
}

.shell {
  max-width: 44rem;
  margin: 0 auto;
  padding: 2rem 1.25rem 3rem;
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

.header h1 {
  font-size: 1.25rem;
  margin: 0 0 1.5rem;
}

.chat {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
}

.messages {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex: 1;
}

.messages li {
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  background: #18181b;
  border: 1px solid #27272a;
}

.messages li[data-role="user"] {
  background: #1e293b;
  border-color: #334155;
}

.messages p {
  margin: 0;
  white-space: pre-wrap;
}

.error {
  color: #fca5a5;
  font-size: 0.875rem;
  margin: 0;
}

.composer {
  display: flex;
  gap: 0.5rem;
  position: sticky;
  bottom: 1rem;
}

.composer input {
  flex: 1;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid #27272a;
  background: #18181b;
  color: inherit;
  font: inherit;
}

.composer input:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: 1px;
}

.composer button {
  padding: 0.75rem 1.25rem;
  border-radius: 0.75rem;
  border: 0;
  background: #6366f1;
  color: white;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.composer button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
`,
    },
  ];
}

export function generateProject(spec: AgentSpec): GeneratedFile[] {
  const tools = uniqueNames(
    spec.tools.filter((tool) => tool.name.trim().length > 0),
    (tool) => tool.name,
    "tool",
  );
  const skills = uniqueNames(
    spec.skills.filter((skill) => skill.name.trim().length > 0),
    (skill) => skill.name,
    "skill",
  );
  const schedules = uniqueNames(
    spec.schedules.filter((schedule) => schedule.name.trim().length > 0),
    (schedule) => schedule.name,
    "schedule",
  );

  const files: GeneratedFile[] = [
    { path: "package.json", language: "json", content: packageJson(spec) },
    { path: "agent/agent.ts", language: "ts", content: agentFile(spec) },
    {
      path: "agent/instructions.md",
      language: "md",
      content: ensureTrailingNewline(
        trimTrailing(spec.instructions.trim()) || "You are a helpful assistant.",
      ),
    },
    { path: "agent/channels/eve.ts", language: "ts", content: channelFile(spec) },
  ];

  for (const { item, name } of tools) {
    files.push({
      path: `agent/tools/${name}.ts`,
      language: "ts",
      content: toolFile(item, name),
    });
  }
  for (const { item, name } of skills) {
    files.push({
      path: `agent/skills/${name}.md`,
      language: "md",
      content: skillFile(item, name),
    });
  }
  for (const { item, name } of schedules) {
    files.push({
      path: `agent/schedules/${name}.ts`,
      language: "ts",
      content: scheduleFile(item, name),
    });
  }

  if (spec.includeFrontend) {
    files.push(...frontendFiles(spec));
  }

  files.push(
    {
      path: ".env.example",
      language: "text",
      content: `# ${spec.model} routes through the Vercel AI Gateway.
# Get a key at https://vercel.com/dashboard/ai-gateway, or link a Vercel
# project and let VERCEL_OIDC_TOKEN supply the credential instead.
AI_GATEWAY_API_KEY=
`,
    },
    {
      path: ".gitignore",
      language: "text",
      content: `node_modules/
.next/
.output/
.eve/
*.tsbuildinfo
next-env.d.ts

.env
.env.local
.env*.local

.vercel/
.DS_Store
`,
    },
    {
      path: "README.md",
      language: "md",
      content: readme(spec, tools, skills, schedules),
    },
  );

  return files;
}

/** Warnings surfaced in the UI — things that would bite after download. */
export function lintSpec(spec: AgentSpec): string[] {
  const issues: string[] = [];

  if (!spec.instructions.trim()) {
    issues.push("Instructions are empty — this is the agent's system prompt.");
  }
  if (spec.auth.includes("none")) {
    issues.push("Auth includes none(): the agent's routes accept anonymous traffic.");
  }
  if (spec.auth.length === 0) {
    issues.push("No authenticator selected — eve fails closed and rejects every request.");
  }

  for (const tool of spec.tools) {
    if (!tool.name.trim()) {
      issues.push("A tool has no name and will be skipped.");
      continue;
    }
    if (!tool.description.trim()) {
      issues.push(`Tool "${tool.name}" has no description — the model routes on it.`);
    }
    for (const param of tool.parameters) {
      if (param.name.trim() && !param.description.trim()) {
        issues.push(`Parameter "${param.name}" on "${tool.name}" has no description.`);
      }
    }
  }

  for (const skill of spec.skills) {
    if (skill.name.trim() && !skill.description.trim()) {
      issues.push(`Skill "${skill.name}" has no description — it will never load.`);
    }
  }

  for (const schedule of spec.schedules) {
    if (!schedule.name.trim()) continue;
    const fields = schedule.cron.trim().split(/\s+/).filter(Boolean);
    if (fields.length !== 5) {
      issues.push(`Schedule "${schedule.name}" needs a 5-field cron expression.`);
    }
    if (!schedule.prompt.trim()) {
      issues.push(`Schedule "${schedule.name}" has no prompt.`);
    }
  }

  return issues;
}
