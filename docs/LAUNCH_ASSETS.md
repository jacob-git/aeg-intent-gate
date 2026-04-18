# Launch Assets

These are the concrete assets to create before broad posting.

## Browser Demo GIF

URL: https://aeg-intent-gate-starter.pages.dev

Shot list:

1. Show the pending `email.send` and `refund.create` intents.
2. Click `Approve and execute` for `email.send`.
3. Show the resulting `ApprovedCommand`.
4. End with the blocked `user.delete` intent visible.

Caption:

> Model-proposed tool calls enter an approval gate before any executor runs.

## Terminal GIF

Command:

```sh
npx @pallattu/aeg-intent-gate
```

Shot list:

1. Run the command.
2. Show approved, requires approval, and blocked outcomes.
3. Keep the final frame on the package name and install command.

Caption:

> A tiny approval gate for AI tool calls, MCP tools, and human-in-the-loop workflows.

## Static Screenshots

- Main site hero: https://aeg-intent-gate.pages.dev
- Approval flow diagram: https://aeg-intent-gate.pages.dev/assets/approval-flow.svg
- Starter app queue: https://aeg-intent-gate-starter.pages.dev

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
