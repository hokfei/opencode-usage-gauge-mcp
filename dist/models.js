export const PLANS = {
    go: { id: "go", limits: { fiveHour: 12, week: 30, month: 60 } },
    "go-plus": { id: "go-plus", limits: { fiveHour: 48, week: 120, month: 240 } },
};
// From the OpenCode Go docs (console/go.mdx). Caps can change; override with GAUGE_WEIGHTS.
export const MODELS = [
    { name: "Muse Spark 1.3", aliases: ["musespark13"], cap: 60 },
    { name: "MiMo-V2.6-Flash", aliases: ["mimov26flash"], cap: 60 },
    { name: "GLM-5.3-Flash", aliases: ["glm53flash"], cap: 60 },
    { name: "DeepSeek V4.1 Flash", aliases: ["deepseekv41flash"], cap: 80 },
    { name: "Qwen3.8 Flash", aliases: ["qwen38flash"], cap: 30 },
    { name: "Space Bunny", aliases: ["spacebunny"], cap: 30 },
    { name: "DeepSeek V4 Flash", aliases: ["deepseekv4flash"], cap: 30 },
    { name: "GLM-5.3", aliases: ["glm53"], cap: 15 },
    { name: "Kimi K3", aliases: ["kimik3"], cap: 15 },
    { name: "Haiku 5.5", aliases: ["claudehaiku55", "haiku55"], cap: 15 },
    { name: "Grok 4.7", aliases: ["grok47"], cap: 15 },
    { name: "MiMo-V2.6-Pro", aliases: ["mimov26pro"], cap: 15 },
    { name: "GPT 6 Luna", aliases: ["gpt6luna"], cap: 15 },
    { name: "DeepSeek V4 Pro", aliases: ["deepseekv4pro"], cap: 15 },
    { name: "Step 5 Preview", aliases: ["step5preview"], cap: Infinity },
    { name: "LongCat 2.5 Preview", aliases: ["longcat25preview"], cap: Infinity },
];
export function normalize(id) {
    const base = id.includes("/") ? id.slice(id.lastIndexOf("/") + 1) : id;
    return base.toLowerCase().replace(/[^a-z0-9]/g, "");
}
export function resolveModel(modelId, plan, overrides = {}) {
    const key = normalize(modelId);
    for (const [alias, weight] of Object.entries(overrides)) {
        if (normalize(alias) === key)
            return { name: modelId, weight };
    }
    let best;
    for (const entry of MODELS) {
        for (const alias of entry.aliases) {
            if (!key.includes(alias))
                continue;
            if (!best || alias.length > best.len)
                best = { entry, len: alias.length };
        }
    }
    if (!best)
        return undefined;
    const weight = Number.isFinite(best.entry.cap) ? plan.limits.month / best.entry.cap : 0;
    return { name: best.entry.name, weight };
}
