# Deployment Examples

Use `aeg-intent-gate` in the server boundary that receives model-proposed tool calls. Do not run real executors from the browser.

## Cloudflare Pages Functions

Copy:

```text
examples/deployments/cloudflare-pages-function.js
```

to:

```text
functions/tool-calls/openai.js
```

Recommended Cloudflare Pages settings:

```text
Build command: npm ci
Build output directory: public
Root directory: /
```

Minimal `wrangler.toml`:

```toml
name = "aeg-intent-gate-starter"
pages_build_output_dir = "public"
compatibility_date = "2026-04-18"
```

If your app or other dependencies import Node built-ins, add:

```toml
compatibility_flags = ["nodejs_compat"]
```

Pending approvals should live in a database, Durable Object, KV-backed queue, D1 table, or another persistent store. Do not keep pending approvals only in module memory on Cloudflare because isolates can restart.

## Vercel

Copy:

```text
examples/deployments/vercel-route.ts
```

to an App Router route such as:

```text
app/api/tool-calls/openai/route.ts
```

The gate should run in the route handler before any real tool implementation is called. Store pending approvals in Postgres, Redis, Upstash, or another durable store. Serverless memory is not approval state.

For Vercel AI SDK tool invocations, also see:

```text
examples/frameworks/vercel-ai-sdk-tool-gate.ts
```

## Plain Node

Copy:

```text
examples/deployments/node-server.mjs
```

Install and run:

```sh
npm install @pallattu/aeg-intent-gate
node node-server.mjs
```

Example request:

```sh
curl -sS http://localhost:3000/tool-calls/openai \
  -H 'content-type: application/json' \
  -d '{
    "target": "production",
    "toolCall": {
      "type": "function_call",
      "name": "email.send",
      "arguments": "{\"to\":\"customer@example.com\",\"body\":\"Hello\"}"
    }
  }'
```

Use this shape behind Express, Fastify, Hono, or a plain reverse proxy. The key rule is the same everywhere: executors should accept only `ApprovedCommand`, not raw model tool calls.
