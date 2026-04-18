# Changelog

All notable changes to this package will be documented in this file.

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
