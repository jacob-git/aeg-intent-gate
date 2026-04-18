# Launch Assets

These are the concrete assets for broad posting.

## Browser Demo GIF

Asset:

```text
docs/assets/browser-demo.gif
```

Source:

```text
docs/assets/browser-demo-storyboard.svg
docs/assets/browser-demo-storyboard.png
```

Caption:

> Model-proposed tool calls enter an approval gate before any executor runs.

## Terminal GIF

Asset:

```text
docs/assets/terminal-demo.gif
```

Source:

```text
docs/assets/terminal-demo.svg
docs/assets/terminal-demo.png
```

Caption:

> A tiny approval gate for AI tool calls, MCP tools, and human-in-the-loop workflows.

## Static Screenshots

```text
docs/assets/main-hero-screenshot.png
docs/assets/starter-queue-screenshot.png
docs/assets/starter-queue-screenshot.svg
site/assets/approval-flow.svg
```

## Short Social Copy

```text
Do not execute AI tool calls directly. Gate them first.

I built aeg-intent-gate: a tiny TypeScript approval gate for OpenAI function calls, Anthropic tool use, MCP tools, and human-in-the-loop workflows.

Demo: https://aeg-intent-gate.pages.dev
Starter: https://aeg-intent-gate-starter.pages.dev
npm: https://www.npmjs.com/package/@pallattu/aeg-intent-gate
```

## Technical Post Outline

Title: Do not execute AI tool calls directly

- AI tool calls look like commands, but they are still model output.
- Applications need a boundary between proposal and execution.
- `aeg-intent-gate` models that boundary as `Intent -> Decision -> ApprovedCommand`.
- Policies block dangerous calls and require human approval for risky calls.
- Executors should accept only `ApprovedCommand`.
- Show OpenAI, Anthropic, MCP, and framework examples.
