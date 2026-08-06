import {
  type AgentSpec,
  type ParamType,
  type Reasoning,
  REASONING_LEVELS,
  uid,
} from "./spec";

/**
 * Normalize a `draft_agent_spec` tool call into an AgentSpec.
 *
 * The input crosses a model boundary, so nothing here trusts its shape: every
 * field is checked, and anything missing falls back to the current spec rather
 * than wiping the user's work.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function paramType(value: unknown): ParamType {
  return value === "number" || value === "boolean" ? value : "string";
}

function reasoning(value: unknown, fallback: Reasoning): Reasoning {
  return typeof value === "string" && (REASONING_LEVELS as string[]).includes(value)
    ? (value as Reasoning)
    : fallback;
}

export function specFromToolInput(input: unknown, current: AgentSpec): AgentSpec | null {
  if (!isRecord(input)) return null;

  // A call with no usable content should not blank the builder.
  const hasSubstance =
    typeof input.name === "string" ||
    typeof input.instructions === "string" ||
    Array.isArray(input.tools);
  if (!hasSubstance) return null;

  return {
    name: str(input.name, current.name).trim() || current.name,
    description: str(input.description, current.description),
    model: str(input.model, current.model).trim() || current.model,
    reasoning: reasoning(input.reasoning, current.reasoning),
    instructions: str(input.instructions, current.instructions),
    tools: arr(input.tools)
      .filter(isRecord)
      .map((tool) => ({
        id: uid("tool"),
        name: str(tool.name),
        description: str(tool.description),
        requiresApproval: bool(tool.requiresApproval),
        parameters: arr(tool.parameters)
          .filter(isRecord)
          .map((param) => ({
            id: uid("param"),
            name: str(param.name),
            type: paramType(param.type),
            description: str(param.description),
            optional: bool(param.optional),
          })),
      })),
    skills: arr(input.skills)
      .filter(isRecord)
      .map((skill) => ({
        id: uid("skill"),
        name: str(skill.name),
        description: str(skill.description),
        body: str(skill.body),
      })),
    schedules: arr(input.schedules)
      .filter(isRecord)
      .map((schedule) => ({
        id: uid("sched"),
        name: str(schedule.name),
        cron: str(schedule.cron, "0 9 * * 1-5"),
        prompt: str(schedule.prompt),
      })),
    auth: current.auth,
    includeFrontend: current.includeFrontend,
  };
}

const TOOL_NAME = "draft_agent_spec";

/**
 * Pull the newest `draft_agent_spec` arguments out of whatever the stream gave
 * us. eve's event and message-part shapes both carry the call, and the exact
 * field names differ by source, so this checks the known spellings and gives up
 * quietly rather than throwing inside a render.
 */
export function findLatestDraft(events: readonly unknown[]): unknown | null {
  let latest: unknown = null;

  const consider = (name: unknown, input: unknown) => {
    if (name === TOOL_NAME && isRecord(input)) latest = input;
  };

  for (const event of events) {
    if (!isRecord(event)) continue;

    const data = isRecord(event.data) ? event.data : event;

    // `actions.requested` carries a batch of calls.
    for (const key of ["actions", "calls", "toolCalls"] as const) {
      for (const call of arr(data[key])) {
        if (!isRecord(call)) continue;
        consider(
          call.toolName ?? call.name ?? call.tool,
          call.input ?? call.args ?? call.arguments,
        );
      }
    }

    // A single call or result on the event itself.
    consider(
      data.toolName ?? data.name ?? data.tool,
      data.input ?? data.args ?? data.arguments,
    );
  }

  return latest;
}

/** The same extraction over `data.messages` parts, as a second source. */
export function findDraftInMessages(messages: readonly unknown[]): unknown | null {
  let latest: unknown = null;

  for (const message of messages) {
    if (!isRecord(message)) continue;
    for (const part of arr(message.parts)) {
      if (!isRecord(part)) continue;
      const name = part.toolName ?? part.name;
      const input = part.input ?? part.args ?? part.arguments;
      if (name === TOOL_NAME && isRecord(input)) latest = input;
    }
  }

  return latest;
}
