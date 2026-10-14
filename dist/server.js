import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatGauge, formatModels, gauge } from "./gauge.js";
import { MODELS } from "./models.js";
const text = (t, isError = false) => ({
    content: [{ type: "text", text: t }],
    ...(isError ? { isError: true } : {}),
});
export function createServer(deps) {
    const server = new McpServer({ name: "opencode-usage-gauge", version: "0.1.0" });
    const now = deps.now ?? Date.now;
    async function run(fn) {
        try {
            return await fn(await deps.connect());
        }
        catch (e) {
            return text(e instanceof Error ? e.message : String(e), true);
        }
    }
    server.registerTool("usage_gauge", {
        description: "Estimate how much of the OpenCode Go pooled allowance is used in the 5-hour, weekly and monthly windows.",
        inputSchema: {},
    }, () => run(async (source) => text(formatGauge(await gauge(source, deps.config, now()), deps.config))));
    server.registerTool("usage_by_model", {
        description: "Per-model breakdown (list cost, weight, counted cost) for one window.",
        inputSchema: { window: z.enum(["5h", "week", "month"]).default("5h") },
    }, ({ window }) => run(async (source) => {
        const windows = await gauge(source, deps.config, now());
        const w = windows.find((x) => x.label === window) ?? windows[0];
        return text(formatModels(w));
    }));
    server.registerTool("usage_weights", { description: "Show the active plan, limits, provider filter and model weights.", inputSchema: {} }, async () => {
        const { plan, provider, unknownWeight, overrides } = deps.config;
        const lines = [
            `plan: ${plan.id} (5h $${plan.limits.fiveHour}, week $${plan.limits.week}, month $${plan.limits.month})`,
            `provider filter: ${provider}`,
            `unknown model weight: ${unknownWeight}x`,
            ...MODELS.map((m) => `${m.name}: ${Number.isFinite(m.cap) ? (plan.limits.month / m.cap).toFixed(2) : "0"}x`),
            `overrides: ${Object.keys(overrides).length ? JSON.stringify(overrides) : "none"}`,
        ];
        return text(lines.join("\n"));
    });
    return server;
}
