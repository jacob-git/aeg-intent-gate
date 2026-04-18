# Launch Plan

Goal: make `aeg-intent-gate` the default tiny approval gate developers reach for before executing AI tool calls.

## Positioning

Primary line:

> Do not execute AI tool calls directly. Gate them first.

Short description:

> `aeg-intent-gate` is a tiny TypeScript approval gate for OpenAI function calls, Anthropic tool use, MCP tools, and human-in-the-loop workflows.

## Launch Post

Title ideas:

- Do not execute AI tool calls directly
- A tiny approval gate for AI tool calls
- Human approval before MCP tool execution

Draft:

```md
AI agents increasingly return structured tool calls that look safe to execute:

- send this email
- create this refund
- write this file
- run this shell command

The mistake is treating model output as a command too early.

I built `aeg-intent-gate`, a tiny TypeScript approval gate that sits between proposed AI tool calls and real executors.

It supports:

- OpenAI Responses API function calls
- OpenAI Chat Completions tool calls
- Anthropic tool-use blocks
- MCP-style tool calls
- human approval flows
- fail-closed fallback behavior
- command payload snapshots so approved commands cannot be mutated later

Try it:

https://aeg-intent-gate.pages.dev

```sh
npx @pallattu/aeg-intent-gate
```

Install:

```sh
npm install @pallattu/aeg-intent-gate
```

Demo: https://aeg-intent-gate.pages.dev
Repo: https://github.com/jacob-git/aeg-intent-gate
```

## Distribution Checklist

- Pin the GitHub repo description to "A tiny TypeScript approval gate for AI tool calls, MCP tools, and human-in-the-loop workflows."
- Set the GitHub website URL to `https://aeg-intent-gate.pages.dev`.
- Add GitHub topics: `ai`, `ai-agents`, `mcp`, `tool-calling`, `tool-calls`, `human-in-the-loop`, `approval`, `approval-gate`, `intent-gate`, `guardrails`, `openai`, `anthropic`, `typescript`.
- Share the launch post in MCP, OpenAI, Anthropic, TypeScript, and agent-builder communities.
- Create a short terminal GIF from `npx @pallattu/aeg-intent-gate`.
- Create a short browser GIF from `npm run example:approval-server`.
- Publish a follow-up article focused only on MCP approval gates.
- Publish a follow-up article focused only on OpenAI function-call approval.

## Next Engineering Bets

- Separate MCP proxy starter repository.
- Approval server with persistent storage adapters.
- Hono/Express middleware.
- Vercel AI SDK example.
- LangGraph example.
