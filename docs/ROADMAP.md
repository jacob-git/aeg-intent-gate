# Roadmap

Goal: make `aeg-intent-gate` the default small approval gate developers add before executing AI tool calls.

## Near Term

- Add an MCP proxy starter that gates tool calls before forwarding to an MCP server.
- Add an OpenAI Agents SDK example.
- Add copy-paste deployment examples for Cloudflare Pages, Vercel, and plain Node.
- Create launch GIFs and screenshots from the live demos.

## Completed Examples

- Hono approval endpoint example.
- Express approval endpoint example.
- Vercel AI SDK tool invocation gate.
- LangGraph-style tool call gate.
- Durable approval queue example.

## Issue Backlog

### [Add OpenAI Agents SDK Example](https://github.com/jacob-git/aeg-intent-gate/issues/1)

Show how to gate tool calls emitted by an OpenAI Agents SDK workflow before calling real tool implementations.

Acceptance criteria:

- Example maps the SDK's tool-call shape into `gateToolCall()` or `gateOpenAIToolCall()`.
- Example returns `execute`, `requires_approval`, or `blocked`.
- Documentation explains where approval state should live.

### [Add MCP Proxy Starter](https://github.com/jacob-git/aeg-intent-gate/issues/2)

Create a separate starter that gates MCP tool calls before forwarding them.

Acceptance criteria:

- Proxy receives MCP-style tool call requests.
- Dangerous tools are blocked, side-effecting tools require approval.
- Approved calls are forwarded to a configured MCP server.

### [Add Deployment Examples](https://github.com/jacob-git/aeg-intent-gate/issues/3)

Document copy-paste deployment patterns for Cloudflare Pages, Vercel, and plain Node.

Acceptance criteria:

- Cloudflare Pages Functions notes cover build command, output directory, and compatibility flags.
- Vercel notes explain where the gate runs and how pending approvals should be persisted.
- Plain Node notes show a minimal server deployment.
- README links to the deployment guide.

### [Create Launch GIFs And Screenshots](https://github.com/jacob-git/aeg-intent-gate/issues/5)

Create visual assets from the live starter and terminal demo.

Acceptance criteria:

- Browser GIF shows the starter queue, one approval, the `ApprovedCommand`, and the blocked `user.delete` action.
- Terminal GIF shows `npx @pallattu/aeg-intent-gate`.
- Static screenshots include the main hero, approval flow diagram, and starter queue.

## Non-Goals

- Become a full agent framework.
- Become a durable audit database.
- Become a sandbox or permissions system for arbitrary executors.
- Replace application authentication or authorization.
