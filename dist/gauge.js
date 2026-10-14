import { PLANS, resolveModel } from "./models.js";
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export function defaultConfig() {
    return { plan: PLANS.go, provider: "opencode-go", unknownWeight: 4, overrides: {} };
}
export function computeWindow(label, range, limit, stats, config) {
    const byModel = new Map();
    for (const m of stats.models) {
        if (config.provider !== "*" && m.model.providerID !== config.provider)
            continue;
        const cur = byModel.get(m.model.id) ?? { steps: 0, cost: 0 };
        cur.steps += m.steps;
        cur.cost += m.cost;
        byModel.set(m.model.id, cur);
    }
    const rows = [];
    for (const [modelId, v] of byModel) {
        const resolved = resolveModel(modelId, config.plan, config.overrides);
        const weight = resolved ? resolved.weight : config.unknownWeight;
        rows.push({
            modelId,
            name: resolved ? resolved.name : modelId,
            known: resolved !== undefined,
            steps: v.steps,
            listCost: v.cost,
            weight,
            counted: v.cost * weight,
        });
    }
    rows.sort((a, b) => b.counted - a.counted);
    const used = rows.reduce((sum, r) => sum + r.counted, 0);
    return {
        label,
        ...range,
        used,
        limit,
        remaining: Math.max(0, limit - used),
        percent: limit > 0 ? (used / limit) * 100 : 0,
        rows,
    };
}
export async function gauge(source, config, now = Date.now()) {
    const specs = [
        { label: "5h", span: 5 * HOUR, limit: config.plan.limits.fiveHour },
        { label: "week", span: 7 * DAY, limit: config.plan.limits.week },
        { label: "month", span: 30 * DAY, limit: config.plan.limits.month },
    ];
    return Promise.all(specs.map(async (s) => {
        const range = { from: now - s.span, to: now };
        return computeWindow(s.label, range, s.limit, await source(range), config);
    }));
}
const money = (n) => `$${n.toFixed(2)}`;
export function formatGauge(windows, config) {
    const lines = [`OpenCode ${config.plan.id} usage (estimate)`];
    for (const w of windows) {
        lines.push(`${w.label.padEnd(5)} ${w.percent.toFixed(1).padStart(5)}%  ${money(w.used)} / ${money(w.limit)}  (${money(w.remaining)} left)`);
    }
    const unknown = new Set(windows.flatMap((w) => w.rows.filter((r) => !r.known).map((r) => r.modelId)));
    if (unknown.size > 0) {
        lines.push(`Unknown models counted at ${config.unknownWeight}x: ${[...unknown].join(", ")}`);
    }
    lines.push("Local list-price estimate; the server's own accounting may differ.");
    return lines.join("\n");
}
export function formatModels(w) {
    if (w.rows.length === 0)
        return `No usage in the ${w.label} window.`;
    const lines = [`Per-model usage, ${w.label} window (list cost x weight = counted)`];
    for (const r of w.rows) {
        lines.push(`${r.name}${r.known ? "" : " (unknown)"}: ${r.steps} steps, ${money(r.listCost)} x ${r.weight.toFixed(2)} = ${money(r.counted)}`);
    }
    return lines.join("\n");
}
