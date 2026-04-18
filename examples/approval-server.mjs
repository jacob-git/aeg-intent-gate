import http from "node:http";
import { createIntentGate, createPolicy, gateOpenAIToolCall } from "../dist/index.js";

const port = Number(process.env.PORT ?? 3333);
const approvals = new Map();

const gate = createIntentGate({
  agent: {
    agentId: "approval_demo_agent",
    capabilities: ["email.send", "refund.create", "shell.exec"],
  },
  policies: [
    createPolicy({
      name: "block-dangerous-shell",
      match: (intent) => intent.type === "shell.exec"
        && /rm\s+-rf|shutdown|mkfs/.test(String(intent.metadata.args.command)),
      evaluate: () => ({
        outcome: "blocked",
        reason: "Dangerous shell command blocked.",
      }),
    }),
    createPolicy({
      name: "side-effects-need-review",
      match: (intent) => ["email.send", "refund.create"].includes(intent.type),
      evaluate: () => ({
        outcome: "requires_approval",
        reason: "Side-effecting tool calls require human approval.",
      }),
    }),
  ],
});

const demoCalls = [
  {
    id: "fc_email_1",
    call_id: "call_email_1",
    type: "function_call",
    name: "email.send",
    arguments: JSON.stringify({
      to: "customer@example.com",
      subject: "Refund update",
      body: "Your refund has been processed.",
    }),
  },
  {
    id: "fc_refund_1",
    call_id: "call_refund_1",
    type: "function_call",
    name: "refund.create",
    arguments: JSON.stringify({
      customerId: "cus_123",
      amount: 250,
      reason: "Duplicate charge.",
    }),
  },
  {
    id: "fc_shell_1",
    call_id: "call_shell_1",
    type: "function_call",
    name: "shell.exec",
    arguments: JSON.stringify({
      command: "rm -rf /tmp/demo",
    }),
  },
];

for (const toolCall of demoCalls) {
  const result = await gateOpenAIToolCall(gate, toolCall, {
    target: toolCall.name === "email.send" ? "postmark" : "demo",
  });

  approvals.set(result.intent.id, {
    intent: result.intent,
    decision: result.decision,
    command: result.command,
    toolCall,
    approvedCommand: undefined,
  });
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/") {
      return sendHtml(response, renderPage());
    }

    if (request.method === "GET" && url.pathname === "/api/intents") {
      return sendJson(response, [...approvals.values()].map(toPublicIntent));
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      return sendJson(response, {
        ok: true,
        pending: [...approvals.values()].filter((record) => record.decision.outcome === "requires_approval").length,
        blocked: [...approvals.values()].filter((record) => record.decision.outcome === "blocked").length,
      });
    }

    if (request.method === "POST" && url.pathname.startsWith("/approve/")) {
      const intentId = decodeURIComponent(url.pathname.slice("/approve/".length));
      const record = approvals.get(intentId);
      if (!record) return sendJson(response, { error: "Unknown intent." }, 404);
      if (record.decision.outcome !== "requires_approval") {
        return sendJson(response, { error: `Cannot approve ${record.decision.outcome} intent.` }, 400);
      }
      const approved = await gate.approveIntent(record.intent, record.decision, {
        approvedBy: "local_reviewer",
        reason: "Approved from the local demo UI.",
      });
      record.decision = approved;
      record.approvedCommand = gate.toCommand(record.intent, approved);
      return sendJson(response, toPublicIntent(record));
    }

    return sendJson(response, { error: "Not found." }, 404);
  } catch (error) {
    return sendJson(response, { error: error instanceof Error ? error.message : "Unknown error." }, 500);
  }
});

server.listen(port, () => {
  console.log(`Approval demo running at http://localhost:${port}`);
});

function toPublicIntent(record) {
  return {
    intent: {
      id: record.intent.id,
      type: record.intent.type,
      target: record.intent.target,
      status: record.intent.status,
      metadata: record.intent.metadata,
    },
    decision: record.decision,
    command: record.command ?? record.approvedCommand,
  };
}

function renderPage() {
  const rows = [...approvals.values()].map((record) => {
    const publicIntent = toPublicIntent(record);
    const canApprove = publicIntent.decision.outcome === "requires_approval";
    return `
      <article>
        <header>
          <strong>${escapeHtml(publicIntent.intent.type)}</strong>
          <span class="${escapeHtml(publicIntent.decision.outcome)}">${escapeHtml(publicIntent.decision.outcome)}</span>
        </header>
        <p>${escapeHtml(publicIntent.decision.reason ?? "No reason supplied.")}</p>
        <pre>${escapeHtml(JSON.stringify(publicIntent.intent.metadata.args, null, 2))}</pre>
        ${publicIntent.command ? `<pre>${escapeHtml(JSON.stringify(publicIntent.command, null, 2))}</pre>` : ""}
        ${canApprove ? `<form method="post" action="/approve/${encodeURIComponent(publicIntent.intent.id)}"><button>Approve</button></form>` : ""}
      </article>
    `;
  }).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>aeg-intent-gate approval demo</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #f6f7f9; color: #111827; }
    main { max-width: 900px; margin: 0 auto; padding: 32px 20px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    .lead { margin: 0 0 24px; color: #4b5563; }
    article { background: #fff; border: 1px solid #d9dee7; border-radius: 8px; padding: 16px; margin: 14px 0; }
    header { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
    span { border-radius: 999px; padding: 4px 10px; font-size: 13px; font-weight: 700; }
    .approved { background: #dcfce7; color: #166534; }
    .requires_approval { background: #fef3c7; color: #92400e; }
    .blocked { background: #fee2e2; color: #991b1b; }
    pre { overflow: auto; background: #111827; color: #e5e7eb; padding: 12px; border-radius: 6px; }
    button { background: #111827; color: #fff; border: 0; border-radius: 6px; padding: 9px 14px; font-weight: 700; cursor: pointer; }
  </style>
</head>
<body>
  <main>
    <h1>AI tool-call approval queue</h1>
    <p class="lead">These model-proposed actions cannot become executable commands until policy approves them or a human reviewer approves them.</p>
    ${rows}
  </main>
</body>
</html>`;
}

function sendHtml(response, body) {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(body);
}

function sendJson(response, body, status = 200) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body, null, 2));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
