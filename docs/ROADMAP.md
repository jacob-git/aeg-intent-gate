# Roadmap

Goal: make `aeg-intent-gate` the default small approval gate developers add before executing AI tool calls.

## Near Term

- Add a durable approval queue example with persistence.
- Add an MCP proxy starter that gates tool calls before forwarding to an MCP server.
- Add an OpenAI Agents SDK example.
- Add copy-paste deployment examples for Cloudflare Pages, Vercel, and plain Node.

## Completed Examples

- Hono approval endpoint example.
- Express approval endpoint example.
- Vercel AI SDK tool invocation gate.
- LangGraph-style tool call gate.

## Issue Backlog

### Add OpenAI Agents SDK Example

Show how to gate tool calls emitted by an OpenAI Agents SDK workflow before calling real tool implementations.

Acceptance criteria:

- Example maps the SDK's tool-call shape into `gateToolCall()` or `gateOpenAIToolCall()`.
- Example returns `execute`, `requires_approval`, or `blocked`.
- Documentation explains where approval state should live.

### Add Durable Approval Queue Example

The current approval demo is intentionally in-memory. Add an example using a small persistence boundary.

Acceptance criteria:

- Pending approvals survive process restart in the example.
- Approval records include `approvedBy`, reason, and timestamp.
- Executor accepts only `ApprovedCommand`.

### Add MCP Proxy Starter

Create a separate starter that gates MCP tool calls before forwarding them.

Acceptance criteria:

- Proxy receives MCP-style tool call requests.
- Dangerous tools are blocked, side-effecting tools require approval.
- Approved calls are forwarded to a configured MCP server.

## Non-Goals

- Become a full agent framework.
- Become a durable audit database.
- Become a sandbox or permissions system for arbitrary executors.
- Replace application authentication or authorization.
