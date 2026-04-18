---
name: Framework example
about: Track a new framework or agent-runtime integration example
title: "Add <framework> approval gate example"
labels: documentation, example
assignees: ""
---

## Goal

Add a copy-paste example showing how to gate tool calls before execution.

## Framework

<!-- Express, Vercel AI SDK, LangGraph, OpenAI Agents SDK, MCP proxy, etc. -->

## Acceptance Criteria

- Maps the framework's tool-call shape into `aeg-intent-gate`.
- Shows approved, blocked, and requires-approval handling.
- Keeps raw model output away from real executors.
- Adds a README or docs link.
