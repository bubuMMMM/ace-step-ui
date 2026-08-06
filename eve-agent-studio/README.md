# Eve Agent Studio

A browser interface for building AI agents with [eve](https://eve.dev), Vercel's
filesystem-first framework for durable agents.

Describe an agent in plain language, or fill in the builder by hand. The studio
generates a complete, runnable eve project — instructions, typed tools with zod
schemas, on-demand skills, cron schedules, channel auth, and an optional Next.js
chat UI — and hands it back as a zip.

## The two halves

**The builder** is pure client-side generation. Every keystroke re-renders the
project file tree, and the download needs no server, no key, and no account.

**The architect** is a real eve agent running inside this same app. It reads your
description and calls a `draft_agent_spec` tool; the browser watches the session
stream for that call and loads the arguments straight into the builder. This is
also the app's own reference implementation of an eve integration — `withEve()`
in `next.config.ts` mounts the agent at `/eve/v1/*` on this origin, and
`useEveAgent()` in `app/assist.tsx` talks to it same-origin with no CORS.

## Run it

```bash
npm install
npm run dev
```

Requires Node.js 24 or newer (eve's engine floor).

The architect needs a model credential. Without one, the builder and the export
keep working and only the AI assist panel reports itself unavailable:

```bash
cp .env.example .env.local   # then set AI_GATEWAY_API_KEY
```

## Layout

```text
eve-agent-studio/
├── agent/                    # the studio's own eve agent
│   ├── agent.ts              # model, reasoning, per-session spend limits
│   ├── instructions.md       # how the architect drafts an agent
│   ├── channels/eve.ts       # HTTP routes + auth policy
│   ├── skills/               # eve project conventions, loaded on demand
│   └── tools/
│       └── draft_agent_spec.ts   # the handoff into the builder UI
├── app/
│   ├── studio.tsx            # state root: spec → files
│   ├── builder.tsx           # the form
│   ├── files.tsx             # file tree + code viewer
│   ├── assist.tsx            # useEveAgent chat
│   └── globals.css
├── lib/
│   ├── spec.ts               # the AgentSpec model
│   ├── generate.ts           # spec → eve project files
│   ├── apply.ts              # tool call → AgentSpec (defensive)
│   ├── zip.ts                # dependency-free zip writer
│   └── highlight.ts          # small syntax highlighter
└── next.config.ts            # withEve()
```

## ⚠️ The deployed agent's routes are public

`agent/channels/eve.ts` ends its auth list with `none()`, which accepts anonymous
traffic so the hosted demo works for anyone who opens it. **Anyone with the URL
can spend the project's model credits.**

Before pointing this at anything real, drop `none()`:

```ts
export default eveChannel({ auth: [vercelOidc(), localDev()] });
```

`agent/agent.ts` also caps per-session input and output tokens, which bounds the
damage from a single session but not the number of sessions.

## Deploy

```bash
npx vercel deploy
```

`withEve()` emits Build Output services for the agent alongside the Next.js app,
so both ship as one project. Set `AI_GATEWAY_API_KEY` in the project's
environment variables for the architect to work in production.

`EVE_DISABLED=1` builds the studio without the agent runtime — the builder and
export only. It exists as an escape hatch for environments that cannot run the
agent build.
