const actions = [
  {
    id: "safe-email",
    type: "email.send",
    status: "approved",
    reason: "Ops notification is allowed.",
    target: "postmark",
    args: { to: "ops@example.com", subject: "Deploy finished" },
  },
  {
    id: "large-refund",
    type: "refund.create",
    status: "requires_approval",
    reason: "Refunds above $100 require human approval.",
    target: "stripe",
    args: { customerId: "cus_123", amount: 250, reason: "Duplicate charge" },
  },
  {
    id: "dangerous-shell",
    type: "shell.exec",
    status: "blocked",
    reason: "Dangerous shell command blocked.",
    target: "local-dev",
    args: { command: "rm -rf /tmp/demo" },
  },
];

const snippets = {
  openai: `import { gateOpenAIToolCall } from "@pallattu/aeg-intent-gate";

const result = await gateOpenAIToolCall(gate, {
  type: "function_call",
  call_id: "call_123",
  name: "email.send",
  arguments: JSON.stringify({ to, subject }),
});`,
  anthropic: `import { gateAnthropicToolUse } from "@pallattu/aeg-intent-gate";

const result = await gateAnthropicToolUse(gate, {
  id: "toolu_123",
  type: "tool_use",
  name: "service.restart",
  input: { service: "api" },
});`,
  mcp: `import { gateMcpToolCall } from "@pallattu/aeg-intent-gate";

const result = await gateMcpToolCall(gate, {
  server: "local-dev",
  name: "filesystem.write",
  arguments: { path, content },
});`,
};

const queue = document.querySelector("#queue");
const output = document.querySelector("#command-output");
const code = document.querySelector("#adapter-code");

function renderQueue() {
  queue.innerHTML = actions.map((action) => `
    <section class="item">
      <header>
        <strong>${action.type}</strong>
        <span class="badge ${action.status}">${action.status}</span>
      </header>
      <p>${action.reason}</p>
      <pre>${JSON.stringify(action.args, null, 2)}</pre>
      <button data-id="${action.id}" ${action.status !== "requires_approval" ? "disabled" : ""}>Approve</button>
    </section>
  `).join("");
}

function approve(id) {
  const action = actions.find((item) => item.id === id);
  if (!action || action.status !== "requires_approval") return;
  action.status = "approved";
  action.reason = "Approved by a human reviewer.";
  output.textContent = JSON.stringify({
    id: `command_${id}`,
    intentId: id,
    type: action.type,
    target: action.target,
    payload: { args: action.args },
  }, null, 2);
  renderQueue();
}

function setTab(name) {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === name);
  });
  code.textContent = snippets[name];
}

queue.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-id]");
  if (button) approve(button.dataset.id);
});

document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => setTab(button.dataset.tab));
});

renderQueue();
setTab("openai");
