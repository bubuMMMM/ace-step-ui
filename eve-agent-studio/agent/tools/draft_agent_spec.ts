import { defineTool } from "eve/tools";
import { z } from "zod";

/**
 * The handoff between the architect agent and the studio UI.
 *
 * The model calls this tool with a complete agent spec; the browser watches the
 * session stream for the call and loads the arguments straight into the builder
 * form, which re-renders the generated eve project. The return value only closes
 * the loop for the model — the spec itself travels as the tool *input*.
 */

const parameter = z.object({
  name: z
    .string()
    .describe("Parameter name in snake_case, for example `order_id`."),
  type: z
    .enum(["string", "number", "boolean"])
    .describe("Scalar type of the parameter."),
  description: z
    .string()
    .describe("What this parameter is, written for the model that fills it in."),
  optional: z.boolean().describe("True when the model may omit this parameter."),
});

const tool = z.object({
  name: z
    .string()
    .describe("Tool name in snake_case, verb first — becomes agent/tools/<name>.ts."),
  description: z
    .string()
    .describe("What the tool does and when the model should reach for it."),
  parameters: z.array(parameter).describe("The tool's typed inputs. May be empty."),
  requiresApproval: z
    .boolean()
    .describe(
      "True for irreversible or costly actions, which pause for human approval before running.",
    ),
});

const skill = z.object({
  name: z
    .string()
    .describe("Skill name in snake_case — becomes agent/skills/<name>.md."),
  description: z
    .string()
    .describe(
      "The trigger the model routes on, phrased as the task: `Use when the user needs ...`.",
    ),
  body: z
    .string()
    .describe("The procedure itself, in markdown. This is loaded on demand."),
});

const schedule = z.object({
  name: z
    .string()
    .describe("Schedule name in snake_case — becomes agent/schedules/<name>.ts."),
  cron: z
    .string()
    .describe("Standard 5-field cron expression, evaluated in UTC."),
  prompt: z.string().describe("The prompt the agent runs when the schedule fires."),
});

export default defineTool({
  description:
    "Draft a complete eve agent and load it into the studio builder. Call this as soon as the user has described an agent, then summarize what you drafted.",
  inputSchema: z.object({
    name: z.string().describe("Human-readable agent name, for example `Support Triage`."),
    description: z.string().describe("One sentence on what this agent is for."),
    model: z
      .string()
      .describe(
        "AI Gateway model id, for example `anthropic/claude-sonnet-5` or `anthropic/claude-opus-4.8`.",
      ),
    reasoning: z
      .enum(["provider-default", "none", "minimal", "low", "medium", "high", "xhigh"])
      .describe("Reasoning effort for the agent's model calls."),
    instructions: z
      .string()
      .describe(
        "The always-on system prompt in markdown. This is the most important field — make it specific and complete.",
      ),
    tools: z.array(tool).describe("Typed actions the agent can call."),
    skills: z.array(skill).describe("Procedures loaded on demand. Often empty."),
    schedules: z.array(schedule).describe("Recurring work. Often empty."),
  }),
  async execute(spec) {
    return {
      loaded: true,
      name: spec.name,
      tools: spec.tools.length,
      skills: spec.skills.length,
      schedules: spec.schedules.length,
    };
  },
  toModelOutput(output) {
    return {
      type: "text",
      value: `Loaded "${output.name}" into the builder (${output.tools} tools, ${output.skills} skills, ${output.schedules} schedules). The user can see the generated files now — summarize the draft and the choices you made.`,
    };
  },
});
