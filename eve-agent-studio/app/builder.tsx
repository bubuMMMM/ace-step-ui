"use client";

import {
  type AgentSpec,
  type AuthMode,
  type Reasoning,
  type ScheduleSpec,
  type SkillSpec,
  type ToolSpec,
  MODELS,
  REASONING_LEVELS,
  emptyParam,
  emptySchedule,
  emptySkill,
  emptyTool,
  slug,
} from "@/lib/spec";
import { Field, PlusIcon, Section, TrashIcon } from "./ui";

interface BuilderProps {
  spec: AgentSpec;
  onChange: (patch: Partial<AgentSpec>) => void;
}

const AUTH_OPTIONS: { mode: AuthMode; label: string; hint: string }[] = [
  {
    mode: "vercelOidc",
    label: "vercelOidc()",
    hint: "Verifies a Vercel OIDC bearer token — the usual production path.",
  },
  {
    mode: "localDev",
    label: "localDev()",
    hint: "Accepts requests only while running under eve dev or vercel dev.",
  },
  {
    mode: "httpBasic",
    label: "httpBasic()",
    hint: "Shared username and password, read from env vars.",
  },
  {
    mode: "none",
    label: "none()",
    hint: "Anonymous access. Anyone with the URL can spend your model credits.",
  },
];

export function Builder({ spec, onChange }: BuilderProps) {
  const updateTool = (id: string, patch: Partial<ToolSpec>) =>
    onChange({
      tools: spec.tools.map((tool) => (tool.id === id ? { ...tool, ...patch } : tool)),
    });

  const updateSkill = (id: string, patch: Partial<SkillSpec>) =>
    onChange({
      skills: spec.skills.map((skill) =>
        skill.id === id ? { ...skill, ...patch } : skill,
      ),
    });

  const updateSchedule = (id: string, patch: Partial<ScheduleSpec>) =>
    onChange({
      schedules: spec.schedules.map((schedule) =>
        schedule.id === id ? { ...schedule, ...patch } : schedule,
      ),
    });

  const toggleAuth = (mode: AuthMode) =>
    onChange({
      auth: spec.auth.includes(mode)
        ? spec.auth.filter((value) => value !== mode)
        : [...spec.auth, mode],
    });

  return (
    <>
      <Section title="Identity" defaultOpen>
        <Field label="Name">
          {(id) => (
            <input
              id={id}
              type="text"
              value={spec.name}
              placeholder="Support Triage"
              onChange={(event) => onChange({ name: event.target.value })}
            />
          )}
        </Field>
        <Field label="Description" hint="One sentence — used in the README.">
          {(id) => (
            <input
              id={id}
              type="text"
              value={spec.description}
              placeholder="Routes inbound support email to the right team."
              onChange={(event) => onChange({ description: event.target.value })}
            />
          )}
        </Field>
      </Section>

      <Section title="Model" defaultOpen>
        <Field label="Model" hint="Gateway id — routes through the Vercel AI Gateway.">
          {(id) => (
            <select
              id={id}
              className="input-mono"
              value={spec.model}
              onChange={(event) => onChange({ model: event.target.value })}
            >
              {MODELS.every((model) => model.id !== spec.model) ? (
                <option value={spec.model}>{spec.model}</option>
              ) : null}
              {MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.id} — {model.note}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Reasoning effort">
          {(id) => (
            <select
              id={id}
              className="input-mono"
              value={spec.reasoning}
              onChange={(event) =>
                onChange({ reasoning: event.target.value as Reasoning })
              }
            >
              {REASONING_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          )}
        </Field>
      </Section>

      <Section title="Instructions" defaultOpen>
        <Field
          label="agent/instructions.md"
          hint="The always-on system prompt. Loaded on every turn, so keep it to durable rules."
        >
          {(id) => (
            <textarea
              id={id}
              className="prose"
              rows={16}
              value={spec.instructions}
              placeholder="You are…"
              onChange={(event) => onChange({ instructions: event.target.value })}
            />
          )}
        </Field>
      </Section>

      <Section title="Tools" count={spec.tools.length}>
        {spec.tools.length === 0 ? (
          <p className="empty">
            No tools yet. A tool is a typed action the agent can call — an API request,
            a query, a write.
          </p>
        ) : null}

        {spec.tools.map((tool) => (
          <div className="card" key={tool.id}>
            <div className="card-head">
              <span className="card-title" data-empty={tool.name.trim() === ""}>
                {tool.name.trim()
                  ? `agent/tools/${slug(tool.name, "tool")}.ts`
                  : "unnamed tool"}
              </span>
              <div className="card-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-danger"
                  aria-label={`Remove ${tool.name || "tool"}`}
                  onClick={() =>
                    onChange({ tools: spec.tools.filter((item) => item.id !== tool.id) })
                  }
                >
                  <TrashIcon />
                </button>
              </div>
            </div>

            <div className="card-body">
              <div className="row row-2">
                <Field label="Name">
                  {(id) => (
                    <input
                      id={id}
                      type="text"
                      className="input-mono"
                      value={tool.name}
                      placeholder="search_orders"
                      onChange={(event) =>
                        updateTool(tool.id, { name: event.target.value })
                      }
                    />
                  )}
                </Field>
                <div className="field">
                  <span className="field-label">Approval</span>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={tool.requiresApproval}
                      onChange={(event) =>
                        updateTool(tool.id, { requiresApproval: event.target.checked })
                      }
                    />
                    Pause for a human first
                  </label>
                </div>
              </div>

              <Field label="Description" hint="Written for the model: say when to call it.">
                {(id) => (
                  <textarea
                    id={id}
                    rows={2}
                    value={tool.description}
                    placeholder="Look up an order by id. Call before answering any question about order status."
                    onChange={(event) =>
                      updateTool(tool.id, { description: event.target.value })
                    }
                  />
                )}
              </Field>

              <div className="field">
                <span className="field-label">
                  Parameters
                  <span className="field-hint">Become the tool&apos;s zod inputSchema.</span>
                </span>

                {tool.parameters.map((param) => (
                  <div className="param" key={param.id}>
                    <input
                      type="text"
                      className="input-mono"
                      value={param.name}
                      placeholder="order_id"
                      aria-label="Parameter name"
                      onChange={(event) =>
                        updateTool(tool.id, {
                          parameters: tool.parameters.map((item) =>
                            item.id === param.id
                              ? { ...item, name: event.target.value }
                              : item,
                          ),
                        })
                      }
                    />
                    <select
                      className="input-mono"
                      value={param.type}
                      aria-label="Parameter type"
                      onChange={(event) =>
                        updateTool(tool.id, {
                          parameters: tool.parameters.map((item) =>
                            item.id === param.id
                              ? {
                                  ...item,
                                  type: event.target.value as typeof param.type,
                                }
                              : item,
                          ),
                        })
                      }
                    >
                      <option value="string">string</option>
                      <option value="number">number</option>
                      <option value="boolean">boolean</option>
                    </select>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={param.optional}
                        onChange={(event) =>
                          updateTool(tool.id, {
                            parameters: tool.parameters.map((item) =>
                              item.id === param.id
                                ? { ...item, optional: event.target.checked }
                                : item,
                            ),
                          })
                        }
                      />
                      optional
                    </label>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-danger"
                      aria-label={`Remove parameter ${param.name || ""}`}
                      onClick={() =>
                        updateTool(tool.id, {
                          parameters: tool.parameters.filter(
                            (item) => item.id !== param.id,
                          ),
                        })
                      }
                    >
                      <TrashIcon />
                    </button>
                    <input
                      type="text"
                      className="param-desc"
                      value={param.description}
                      placeholder="What this parameter is, written for the model."
                      aria-label="Parameter description"
                      onChange={(event) =>
                        updateTool(tool.id, {
                          parameters: tool.parameters.map((item) =>
                            item.id === param.id
                              ? { ...item, description: event.target.value }
                              : item,
                          ),
                        })
                      }
                    />
                  </div>
                ))}

                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ alignSelf: "flex-start", marginTop: 4 }}
                  onClick={() =>
                    updateTool(tool.id, {
                      parameters: [...tool.parameters, emptyParam()],
                    })
                  }
                >
                  <PlusIcon /> Parameter
                </button>
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          className="btn"
          style={{ alignSelf: "flex-start" }}
          onClick={() => onChange({ tools: [...spec.tools, emptyTool()] })}
        >
          <PlusIcon /> Add tool
        </button>
      </Section>

      <Section title="Skills" count={spec.skills.length}>
        {spec.skills.length === 0 ? (
          <p className="empty">
            No skills yet. A skill is a procedure the model loads only when a turn calls
            for it — a checklist or playbook that would waste context every turn.
          </p>
        ) : null}

        {spec.skills.map((skill) => (
          <div className="card" key={skill.id}>
            <div className="card-head">
              <span className="card-title" data-empty={skill.name.trim() === ""}>
                {skill.name.trim()
                  ? `agent/skills/${slug(skill.name, "skill")}.md`
                  : "unnamed skill"}
              </span>
              <div className="card-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-danger"
                  aria-label={`Remove ${skill.name || "skill"}`}
                  onClick={() =>
                    onChange({
                      skills: spec.skills.filter((item) => item.id !== skill.id),
                    })
                  }
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
            <div className="card-body">
              <Field label="Name">
                {(id) => (
                  <input
                    id={id}
                    type="text"
                    className="input-mono"
                    value={skill.name}
                    placeholder="release_checklist"
                    onChange={(event) =>
                      updateSkill(skill.id, { name: event.target.value })
                    }
                  />
                )}
              </Field>
              <Field
                label="Description"
                hint="The trigger the model routes on: “Use when the user needs…”."
              >
                {(id) => (
                  <textarea
                    id={id}
                    rows={2}
                    value={skill.description}
                    placeholder="Use when the user needs a release checklist or changelog workflow."
                    onChange={(event) =>
                      updateSkill(skill.id, { description: event.target.value })
                    }
                  />
                )}
              </Field>
              <Field label="Procedure" hint="Markdown, loaded on demand.">
                {(id) => (
                  <textarea
                    id={id}
                    rows={6}
                    value={skill.body}
                    placeholder="1. Verify the changelog is complete…"
                    onChange={(event) =>
                      updateSkill(skill.id, { body: event.target.value })
                    }
                  />
                )}
              </Field>
            </div>
          </div>
        ))}

        <button
          type="button"
          className="btn"
          style={{ alignSelf: "flex-start" }}
          onClick={() => onChange({ skills: [...spec.skills, emptySkill()] })}
        >
          <PlusIcon /> Add skill
        </button>
      </Section>

      <Section title="Schedules" count={spec.schedules.length}>
        {spec.schedules.length === 0 ? (
          <p className="empty">
            No schedules yet. A schedule starts the agent on its own clock — digests,
            syncs, sweeps.
          </p>
        ) : null}

        {spec.schedules.map((schedule) => (
          <div className="card" key={schedule.id}>
            <div className="card-head">
              <span className="card-title" data-empty={schedule.name.trim() === ""}>
                {schedule.name.trim()
                  ? `agent/schedules/${slug(schedule.name, "schedule")}.ts`
                  : "unnamed schedule"}
              </span>
              <div className="card-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-danger"
                  aria-label={`Remove ${schedule.name || "schedule"}`}
                  onClick={() =>
                    onChange({
                      schedules: spec.schedules.filter((item) => item.id !== schedule.id),
                    })
                  }
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
            <div className="card-body">
              <div className="row row-2">
                <Field label="Name">
                  {(id) => (
                    <input
                      id={id}
                      type="text"
                      className="input-mono"
                      value={schedule.name}
                      placeholder="daily_digest"
                      onChange={(event) =>
                        updateSchedule(schedule.id, { name: event.target.value })
                      }
                    />
                  )}
                </Field>
                <Field label="Cron" hint="5 fields, UTC.">
                  {(id) => (
                    <input
                      id={id}
                      type="text"
                      className="input-mono"
                      value={schedule.cron}
                      placeholder="0 9 * * 1-5"
                      onChange={(event) =>
                        updateSchedule(schedule.id, { cron: event.target.value })
                      }
                    />
                  )}
                </Field>
              </div>
              <Field label="Prompt" hint="What the agent runs when it fires.">
                {(id) => (
                  <textarea
                    id={id}
                    rows={3}
                    value={schedule.prompt}
                    placeholder="Summarize yesterday's signups and post to the team channel."
                    onChange={(event) =>
                      updateSchedule(schedule.id, { prompt: event.target.value })
                    }
                  />
                )}
              </Field>
            </div>
          </div>
        ))}

        <button
          type="button"
          className="btn"
          style={{ alignSelf: "flex-start" }}
          onClick={() => onChange({ schedules: [...spec.schedules, emptySchedule()] })}
        >
          <PlusIcon /> Add schedule
        </button>
      </Section>

      <Section title="Access & output" count={spec.auth.length}>
        <div className="field">
          <span className="field-label">
            Channel auth
            <span className="field-hint">
              eve fails closed — with nothing selected, every request gets a 401.
            </span>
          </span>
          {AUTH_OPTIONS.map((option) => (
            <label className="checkbox" key={option.mode} style={{ alignItems: "start" }}>
              <input
                type="checkbox"
                checked={spec.auth.includes(option.mode)}
                onChange={() => toggleAuth(option.mode)}
                style={{ marginTop: 3 }}
              />
              <span>
                <code style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>
                  {option.label}
                </code>
                <span className="field-hint" style={{ display: "block" }}>
                  {option.hint}
                </span>
              </span>
            </label>
          ))}
        </div>

        {spec.auth.includes("none") ? (
          <p className="notice notice-danger">
            <span aria-hidden="true">⚠</span>
            <span>
              <code>none()</code> accepts anonymous traffic. Anyone who finds the URL can
              spend your model credits — remove it before this agent handles anything
              real.
            </span>
          </p>
        ) : null}

        <div className="field">
          <span className="field-label">Project shape</span>
          <label className="checkbox" style={{ alignItems: "start" }}>
            <input
              type="checkbox"
              checked={spec.includeFrontend}
              onChange={(event) => onChange({ includeFrontend: event.target.checked })}
              style={{ marginTop: 3 }}
            />
            <span>
              Include a Next.js chat UI
              <span className="field-hint" style={{ display: "block" }}>
                Adds <code>withEve()</code> and a <code>useEveAgent</code> chat page, so
                the app and the agent deploy as one Vercel project.
              </span>
            </span>
          </label>
        </div>
      </Section>
    </>
  );
}
