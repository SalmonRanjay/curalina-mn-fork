# Codex agent roles

## How this differs from `.claude/agents/`

Claude Code has first-class subagents: it auto-discovers `.claude/agents/*.md`,
reads the YAML frontmatter (`name`, `description`, `tools`, `model`), and can
delegate to them on its own based on the `description` field.

**Codex has no equivalent auto-dispatch.** Its conventions are:

- **`AGENTS.md` at the repository root** — loaded automatically on every run.
  This is the real Codex extension point, and it carries the shared project
  context, the roster, the coordination model, and the invariants.
- **`~/.codex/prompts/*.md`** — user-level custom prompts, surfaced as slash
  commands. These are per-user, not per-repository, so they are not committed
  here.
- **Profiles in `~/.codex/config.toml`** — named configurations that pin a
  model and reasoning effort. See `config.example.toml` in this folder.

So the files in `agents/` are **role prompts**, not auto-dispatched agents.
You invoke one explicitly.

## Using a role

Three ways, in rough order of convenience:

1. **Paste or reference at the start of a session.** Open a Codex session and
   lead with: "Act as the role defined in `.codex/agents/tech-lead.md`. Read
   that file first, then …". Codex has already loaded `AGENTS.md`, so the role
   file only needs to add role-specific instruction.

2. **Install as a slash command.** Copy a role into your user prompts
   directory so it becomes a reusable command:

   ```bash
   cp .codex/agents/code-reviewer.md ~/.codex/prompts/curalina-review.md
   ```

3. **Pair with a profile.** For roles where model tier matters, run with the
   matching profile from `config.example.toml`:

   ```bash
   codex --profile curalina-lead
   ```

## Why the role files are shorter than the Claude ones

`AGENTS.md` is auto-loaded by Codex on every run, so these files deliberately
do not repeat the project frame, the gate systems, or the invariants — all of
that is already in context. The Claude subagent definitions are longer because
each subagent starts with a fresh context window and has to be self-contained.

That is the intended difference. Do not "fix" it by copying the Claude bodies
over; you would be duplicating what `AGENTS.md` already supplies.

## Keeping the two in sync

The roster is defined once, in `AGENTS.md` section 4. Both `.claude/agents/`
and `.codex/agents/` implement that roster. When a role's responsibilities
change, update `AGENTS.md` first, then both implementations.

| Role | `.claude/agents/` | `.codex/agents/` | Tier | Codex profile |
|---|---|---|---|---|
| Technical lead | `tech-lead.md` | `tech-lead.md` | Opus / high | `curalina-lead` |
| AI/ML lead | `ai-ml-lead.md` | `ai-ml-lead.md` | Opus / high | `curalina-lead` |
| Code reviewer | `code-reviewer.md` | `code-reviewer.md` | Opus / high | `curalina-review` |
| Delivery coordinator | `delivery-coordinator.md` | `delivery-coordinator.md` | Sonnet / medium | `curalina-engineer` |
| Python services engineer | `python-services-engineer.md` | `python-services-engineer.md` | Sonnet / medium | `curalina-engineer` |
| TypeScript app engineer | `typescript-app-engineer.md` | `typescript-app-engineer.md` | Sonnet / medium | `curalina-engineer` |
| ML notebook engineer | `ml-notebook-engineer.md` | `ml-notebook-engineer.md` | Sonnet / medium | `curalina-engineer` |
| Contracts & QA steward | `contracts-qa-steward.md` | `contracts-qa-steward.md` | Sonnet / medium | `curalina-engineer` |
| Research scout | `research-scout.md` | `research-scout.md` | Haiku / low | `curalina-scout` |
| Packet validator | `packet-validator.md` | `packet-validator.md` | Haiku / low | `curalina-scout` |

## Fields that exist only on the Claude side

Claude Code subagents support frontmatter Codex has no equivalent for:
`model` and `effort` (tier and reasoning depth), `memory: project`
(persistent cross-session memory, set on the four leadership roles),
`maxTurns`, `tools`/`disallowedTools`, and `color`.

On the Codex side those map, loosely, onto **profiles** — see
`config.example.toml` and the profile column above. There is no Codex
equivalent of `memory: project`; if you need a role's accumulated decisions
to persist, write them into the repository (an ADR, or the packet's
completion evidence) rather than relying on session state.
