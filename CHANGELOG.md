# Changelog

All notable changes to this package will be documented in this file.

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
