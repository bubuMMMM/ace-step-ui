export type ParamType = "string" | "number" | "boolean";

export type Reasoning =
  | "provider-default"
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

export interface ToolParam {
  id: string;
  name: string;
  type: ParamType;
  description: string;
  optional: boolean;
}

export interface ToolSpec {
  id: string;
  name: string;
  description: string;
  parameters: ToolParam[];
  requiresApproval: boolean;
}

export interface SkillSpec {
  id: string;
  name: string;
  description: string;
  body: string;
}

export interface ScheduleSpec {
  id: string;
  name: string;
  cron: string;
  prompt: string;
}

export type AuthMode = "vercelOidc" | "localDev" | "none" | "httpBasic";

export interface AgentSpec {
  name: string;
  description: string;
  model: string;
  reasoning: Reasoning;
  instructions: string;
  tools: ToolSpec[];
  skills: SkillSpec[];
  schedules: ScheduleSpec[];
  auth: AuthMode[];
  includeFrontend: boolean;
}

export const MODELS: { id: string; label: string; note: string }[] = [
  {
    id: "anthropic/claude-sonnet-5",
    label: "Claude Sonnet 5",
    note: "eve's default — the balanced choice",
  },
  {
    id: "anthropic/claude-opus-4.8",
    label: "Claude Opus 4.8",
    note: "Hardest reasoning, highest cost",
  },
  {
    id: "anthropic/claude-haiku-4.5",
    label: "Claude Haiku 4.5",
    note: "Fast and cheap for shallow, high-volume work",
  },
  { id: "openai/gpt-5.5", label: "GPT-5.5", note: "OpenAI's frontier model" },
  {
    id: "google/gemini-3-pro",
    label: "Gemini 3 Pro",
    note: "Long context, strong multimodal",
  },
];

export const REASONING_LEVELS: Reasoning[] = [
  "provider-default",
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
];

let counter = 0;
export function uid(prefix = "id"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

/** snake_case slug used for filenames and identifiers. */
export function slug(input: string, fallback = "untitled"): string {
  const value = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (value.length === 0) return fallback;
  return /^[0-9]/.test(value) ? `a_${value}` : value;
}

/** kebab-case slug for the npm package name. */
export function kebab(input: string, fallback = "my-agent"): string {
  return slug(input, fallback).replace(/_/g, "-");
}

export function emptyTool(): ToolSpec {
  return {
    id: uid("tool"),
    name: "",
    description: "",
    parameters: [],
    requiresApproval: false,
  };
}

export function emptyParam(): ToolParam {
  return {
    id: uid("param"),
    name: "",
    type: "string",
    description: "",
    optional: false,
  };
}

export function emptySkill(): SkillSpec {
  return { id: uid("skill"), name: "", description: "", body: "" };
}

export function emptySchedule(): ScheduleSpec {
  return { id: uid("sched"), name: "", cron: "0 9 * * 1-5", prompt: "" };
}

export const STARTER_SPEC: AgentSpec = {
  name: "Release Notes Agent",
  description:
    "Turns merged pull requests into a clean, human-readable changelog and posts it on Fridays.",
  model: "anthropic/claude-sonnet-5",
  reasoning: "low",
  instructions: `You write release notes for a software team.

## What you do

Given a set of merged pull requests, you produce a changelog that a customer can
read: grouped by theme, written in plain language, and led by what changed for
the user rather than which files moved.

## How to write

- Group entries under **Added**, **Changed**, **Fixed**, and **Removed**. Drop any
  heading with nothing under it.
- One line per change, starting with a verb. No PR numbers in the line itself.
- Translate internal names into user-facing ones. If a PR title says
  "bump ratelimiter to v2", the entry is about faster retries, not the bump.
- Skip pure chores: dependency bumps, lint fixes, and CI changes never ship in
  customer notes.

## When you are unsure

If a pull request's intent is not clear from its title and body, call
\`fetch_pull_requests\` for the full description before guessing. If it is still
unclear, list it under **Needs review** at the bottom rather than inventing a
user-facing story for it.`,
  tools: [
    {
      id: "tool_starter_1",
      name: "fetch_pull_requests",
      description:
        "Fetch pull requests merged into a repository within a date range. Call this before writing any changelog, and again when a single PR's intent is unclear.",
      parameters: [
        {
          id: "param_starter_1",
          name: "repository",
          type: "string",
          description: "Repository in owner/name form, for example acme/web.",
          optional: false,
        },
        {
          id: "param_starter_2",
          name: "since",
          type: "string",
          description: "ISO date. Only pull requests merged on or after this date.",
          optional: false,
        },
        {
          id: "param_starter_3",
          name: "limit",
          type: "number",
          description: "Maximum pull requests to return. Defaults to 100.",
          optional: true,
        },
      ],
      requiresApproval: false,
    },
    {
      id: "tool_starter_2",
      name: "publish_changelog",
      description:
        "Publish a finished changelog to the public releases page. This is visible to customers immediately.",
      parameters: [
        {
          id: "param_starter_4",
          name: "version",
          type: "string",
          description: "Release version, for example 2.4.0.",
          optional: false,
        },
        {
          id: "param_starter_5",
          name: "markdown",
          type: "string",
          description: "The full changelog body in markdown.",
          optional: false,
        },
      ],
      requiresApproval: true,
    },
  ],
  skills: [
    {
      id: "skill_starter_1",
      name: "voice_guide",
      description:
        "Use when writing anything customer-facing — changelogs, release announcements, or upgrade notes.",
      body: `Write like a competent colleague explaining what changed, not like a
marketing page.

- Active voice, present tense: "Exports now include totals", never "Totals have
  been added to exports".
- No superlatives. Nothing is "powerful", "seamless", or "blazing fast".
- Name the limit alongside the feature when one exists. A reader who hits it
  later should not feel misled.
- If a change requires action from the reader, say so in the first clause of the
  line, not at the end.`,
    },
  ],
  schedules: [
    {
      id: "sched_starter_1",
      name: "weekly_notes",
      cron: "0 16 * * 5",
      prompt:
        "Fetch pull requests merged into the main repository since last Friday, draft the changelog, and post it to the team channel for review. Do not publish it.",
    },
  ],
  auth: ["vercelOidc", "localDev"],
  includeFrontend: true,
};

export const BLANK_SPEC: AgentSpec = {
  name: "My Agent",
  description: "",
  model: "anthropic/claude-sonnet-5",
  reasoning: "provider-default",
  instructions: "You are a helpful assistant.\n",
  tools: [],
  skills: [],
  schedules: [],
  auth: ["vercelOidc", "localDev"],
  includeFrontend: true,
};
