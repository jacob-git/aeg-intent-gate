# Changelog

All notable changes to this package will be documented in this file.

## 0.11.0 - 2026-04-18

### Added

- Added an OpenAI Agents SDK approval-gate example that maps tool invocations into `gateToolCall()`.
- Added tests that verify the example exposes routing, approval, and invocation-mapping helpers.

## 0.10.0 - 2026-04-18

### Added

- Added copy-paste deployment examples for Cloudflare Pages Functions, Vercel route handlers, and plain Node.
- Added a deployment guide covering Cloudflare build settings, Vercel approval persistence, and Node server usage.

## 0.9.0 - 2026-04-18

### Added

- Added an MCP proxy starter that gates JSON-RPC-style `tools/call` requests before forwarding to an upstream MCP server.
- Added tests for approved, blocked, queued, and approval-forwarded MCP proxy flows.

## 0.8.0 - 2026-04-18

### Added

- Added a durable approval queue example that persists pending approvals and approves them after a simulated restart.
- Added tests for the durable approval queue example.

## 0.7.0 - 2026-04-18

### Added

- Added Express, Vercel AI SDK, and LangGraph-style framework examples.
- Added public roadmap, launch asset plan, and GitHub issue templates.

## 0.6.3 - 2026-04-18

### Added

- Added the live Cloudflare Pages starter app URL to README, launch copy, and the demo site.

## 0.6.2 - 2026-04-18

### Changed

- Removed the Node-only `node:crypto` import so the package bundles cleanly in edge runtimes such as Cloudflare Pages Functions.

## 0.6.1 - 2026-04-18

### Added

- Added the public starter app link to README, launch copy, and the demo site.

## 0.6.0 - 2026-04-18

### Added

- Added animated approval-flow SVG for README and site visual proof.
- Added Hono-style approval endpoint example under `examples/frameworks`.
- Added clearer GitHub metadata checklist to launch docs.

## 0.5.2 - 2026-04-18

### Changed

- Reworded public package, README, site, and launch copy from "command firewall" to "approval gate" to keep the project focused on AI tool-call gating.
- Replaced the `command-firewall` npm keyword with `approval-gate` and `intent-gate`.

## 0.5.1 - 2026-04-18

### Changed

- Set package homepage to the live Cloudflare Pages demo.
- Added the live demo link to README and launch copy.

## 0.5.0 - 2026-04-18

### Added

- Added a dependency-free browser approval queue demo at `npm run example:approval-server`.
- Added `docs/INTEGRATIONS.md` with OpenAI, Anthropic, MCP, and executor integration guidance.
- Added `docs/LAUNCH.md` with positioning, launch copy, and distribution checklist.

## 0.4.0 - 2026-04-18

### Added

- Added `gateOpenAIToolCall()` for OpenAI Responses API function calls and Chat Completions tool calls.
- Added `gateAnthropicToolUse()` for Anthropic tool-use blocks.
- Added `gateMcpToolCall()` for MCP-style tool calls.
- Added `./adapters` package subpath export.
- Added OpenAI and Anthropic command-firewall examples.
- Added `npx @pallattu/aeg-intent-gate` demo binary.

### Changed

- Repositioned the package as a tiny command firewall for AI tool calls and human approval workflows.
- Expanded npm keywords for MCP, tool calling, guardrails, OpenAI, Anthropic, and human-in-the-loop discovery.

## 0.3.1 - 2026-04-18

### Changed

- Snapshot evaluated command payloads so later intent metadata mutations cannot change approved commands.
- Validate decision outcomes at runtime for fallback and policy-produced decisions.
- Keep intent status unchanged if lifecycle event emission fails during evaluation or approval.
- Generate intent, event, and command ids with `crypto.randomUUID()`.
- Add README security model notes for authentication, persistence, sandboxing, and executor enforcement.

## 0.3.0 - 2026-04-18

### Added

- Added `gateToolCall(gate, toolCall)` for gating common AI tool-call shapes.
- Added tool-call approval and MCP-style tool gating examples.

### Changed

- Changed the default fallback decision to `requires_approval` so unmatched intents fail closed.
- Repositioned the README around safe AI tool execution and human approval workflows.

## 0.2.0 - 2026-04-18

### Added

- Added `approveIntent(intent, decision, approval)` for human or external approval handoff.
- Added `ApprovalContext` with `approvedBy`, optional `reason`, and optional metadata.
- Added `IntentApprovalGranted` lifecycle event.
- Added tests for approval success, forged decisions, mismatched intents, blocked decisions, and command creation after approval.

## 0.1.1 - 2026-04-18

### Added

- Added `examples/basic-lifecycle.mjs`.
- Added `npm run example`.
- Included `CHANGELOG.md` in package files.

## 0.1.0 - 2026-04-18

Initial public release of `@pallattu/aeg-intent-gate`.

### Added

- Intent lifecycle management with `proposeIntent`, `evaluateIntent`, and `toCommand`.
- Intent statuses: `proposed`, `evaluated`, `approved`, `blocked`, and `requires_approval`.
- Capability-based enforcement using agent context and requested intent capabilities.
- Ordered policy evaluation with `createPolicy`.
- In-memory lifecycle events for proposal, evaluation, approval, blocking, and approval-required outcomes.
- Execution gating through `ApprovedCommand`.
- Sanitized command payloads derived from intent metadata.
- TypeScript declarations and ESM package output.
- Node test suite covering lifecycle, policy, capability, event, and execution-boundary behavior.
