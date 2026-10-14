import { test } from "node:test";
import assert from "node:assert/strict";
import { PLANS, resolveModel } from "../src/models.ts";
import { computeWindow, defaultConfig, formatGauge, gauge, type StatsLike } from "../src/gauge.ts";
import { loadConfig } from "../src/config.ts";
import { createServer } from "../src/server.ts";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const usage = (id: string, cost: number, steps = 1, providerID = "opencode-go") => ({
  model: { id, providerID },
  steps,
  cost,
});

test("resolveModel distinguishes longer aliases", () => {
  assert.equal(resolveModel("opencode-go/glm-5.3", PLANS.go, {})?.weight, 4);
  assert.equal(resolveModel("opencode-go/glm-5.3-flash", PLANS.go, {})?.weight, 1);
  assert.equal(resolveModel("deepseek-v4-flash", PLANS.go, {})?.weight, 2);
  assert.equal(resolveModel("deepseek-v4.1-flash", PLANS.go, {})?.weight, 0.75);
});

test("free models weigh 0, unknown is undefined, overrides win", () => {
  assert.equal(resolveModel("step-5-preview", PLANS.go, {})?.weight, 0);
  assert.equal(resolveModel("mystery-model", PLANS.go, {}), undefined);
  assert.equal(resolveModel("glm-5.3", PLANS.go, { "glm-5.3": 9 })?.weight, 9);
});

test("go-plus scales weights by plan", () => {
  assert.equal(resolveModel("glm-5.3", PLANS["go-plus"], {})?.weight, 16);
});

test("computeWindow applies weights, filters provider, flags unknown", () => {
  const stats: StatsLike = {
    models: [usage("glm-5.3", 1), usage("glm-5.3", 0.5), usage("mystery", 1), usage("glm-5.3", 100, 1, "other")],
  };
  const w = computeWindow("5h", { from: 0, to: 1 }, 12, stats, defaultConfig());
  assert.equal(w.used, 1.5 * 4 + 1 * 4);
  assert.equal(w.rows.find((r) => r.modelId === "mystery")?.known, false);
  assert.equal(w.rows.find((r) => r.modelId === "glm-5.3")?.steps, 2);
  assert.equal(w.remaining, 2);
  assert.equal(w.percent, (10 / 12) * 100);
});

test("provider * counts everything and remaining never goes negative", () => {
  const cfg = { ...defaultConfig(), provider: "*" };
  const w = computeWindow("5h", { from: 0, to: 1 }, 12, { models: [usage("glm-5.3", 100, 1, "other")] }, cfg);
  assert.equal(w.remaining, 0);
  assert.ok(w.percent > 100);
});

test("gauge requests rolling 5h/7d/30d ranges", async () => {
  const seen: Array<{ from: number; to: number }> = [];
  const now = 1_000_000_000_000;
  const out = await gauge(async (r) => (seen.push(r), { models: [] }), defaultConfig(), now);
  assert.deepEqual(out.map((w) => w.label), ["5h", "week", "month"]);
  assert.deepEqual(seen.map((r) => now - r.from), [5 * 3_600_000, 7 * 86_400_000, 30 * 86_400_000]);
  assert.match(formatGauge(out, defaultConfig()), /0\.0%/);
});

test("loadConfig parses env and ignores bad values", () => {
  const c = loadConfig({ GAUGE_PLAN: "go-plus", GAUGE_WEIGHTS: '{"a":2,"b":"x","c":-1}', GAUGE_UNKNOWN_WEIGHT: "3" });
  assert.equal(c.plan.id, "go-plus");
  assert.deepEqual(c.overrides, { a: 2 });
  assert.equal(c.unknownWeight, 3);
  const d = loadConfig({ GAUGE_PLAN: "nope", GAUGE_WEIGHTS: "{bad", GAUGE_UNKNOWN_WEIGHT: "abc" });
  assert.equal(d.plan.id, "go");
  assert.deepEqual(d.overrides, {});
  assert.equal(d.unknownWeight, 4);
});

async function connected(connect: () => Promise<(r: { from: number; to: number }) => Promise<StatsLike>>) {
  const server = createServer({ config: defaultConfig(), connect, now: () => 1_000_000_000_000 });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "t", version: "0" });
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}

test("MCP server lists tools and returns the gauge", async () => {
  const client = await connected(async () => async () => ({ models: [usage("glm-5.3", 1)] }));
  const tools = await client.listTools();
  assert.deepEqual(tools.tools.map((t) => t.name).sort(), ["usage_by_model", "usage_gauge", "usage_weights"]);
  const res = await client.callTool({ name: "usage_gauge", arguments: {} });
  assert.match(JSON.stringify(res.content), /33\.3%/);
  const m = await client.callTool({ name: "usage_by_model", arguments: { window: "month" } });
  assert.match(JSON.stringify(m.content), /GLM-5\.3/);
  const wts = await client.callTool({ name: "usage_weights", arguments: {} });
  assert.match(JSON.stringify(wts.content), /GLM-5\.3: 4\.00x/);
});

test("MCP server reports connection failure as an error result", async () => {
  const client = await connected(async () => {
    throw new Error("No running OpenCode service found.");
  });
  const res = await client.callTool({ name: "usage_gauge", arguments: {} });
  assert.equal(res.isError, true);
  assert.match(JSON.stringify(res.content), /No running OpenCode/);
});
