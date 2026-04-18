# Roadmap

Goal: make `aeg-intent-gate` the default small approval gate developers add before executing AI tool calls.

## Near Term

- Create launch GIFs and screenshots from the live demos.

## Completed Examples

- Hono approval endpoint example.
- Express approval endpoint example.
- Vercel AI SDK tool invocation gate.
- LangGraph-style tool call gate.
- Durable approval queue example.
- MCP proxy starter for gating JSON-RPC-style `tools/call` requests before forwarding.
- Deployment examples for Cloudflare Pages Functions, Vercel route handlers, and plain Node.
- OpenAI Agents SDK approval gate example.

## Issue Backlog

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
