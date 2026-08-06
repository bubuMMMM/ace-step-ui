---
description: Use when drafting or reviewing the file layout of an eve agent — which capability belongs in which file, and the conventions each one follows.
---

# eve project conventions

eve builds an agent from files under `agent/`. A file's location decides what eve
loads, and the path also supplies the name — never add a duplicate `name` or `id`
field to a definition.

```text
my-agent/
├── package.json
└── agent/
    ├── agent.ts          # model + runtime config (optional)
    ├── instructions.md   # the always-on system prompt (required)
    ├── tools/            # typed functions the model can call
    ├── skills/           # procedures loaded on demand
    ├── channels/         # HTTP and messaging entry points
    ├── connections/      # MCP and OpenAPI services
    ├── subagents/        # specialists the root agent delegates to
    ├── schedules/        # recurring work
    └── lib/              # shared code imported by agent files
```

## Naming

- `agent/tools/get_weather.ts` is the `get_weather` tool.
- `agent/skills/research/SKILL.md` is the `research` skill.
- `agent/schedules/billing/sweep.ts` is the `billing/sweep` schedule.

## Tools vs skills

Reach for a **tool** when the agent needs to *do* something — the action stays in
code you control and runs in your app runtime with access to `process.env`.

Reach for a **skill** when the agent needs to *know* something situationally. A
skill adds instructions to the turn, never a new execution surface, and the model
loads it only when the description matches the task.

If you find yourself writing "call the API by doing X" in a skill, that is a tool.

## Instructions

`agent/instructions.md` is loaded on every turn, so every line costs context on
every call. Write the durable rules there — identity, priorities, tool routing,
escalation — and push situational procedure into skills.

## Approval

Gate irreversible work with `approval` from `eve/tools/approval`:

```ts
import { always } from "eve/tools/approval";
// ...
approval: always(), // or once() / never()
```

A gated call pauses the run durably and emits `input.requested`; the session
resumes exactly where it left off once a human answers.

## Credentials

A gateway model id (`anthropic/claude-sonnet-5`) routes through the Vercel AI
Gateway and needs `AI_GATEWAY_API_KEY`, or a linked Vercel project supplying
`VERCEL_OIDC_TOKEN`. To call a provider directly, install its AI SDK package and
pass a `LanguageModel` instead — note that direct provider ids use the provider's
native format (`claude-opus-4-8`), not the gateway's (`anthropic/claude-opus-4.8`).
