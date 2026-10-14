import { PLANS } from "./models.js";
import { defaultConfig } from "./gauge.js";
function parseOverrides(raw) {
    if (!raw)
        return {};
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
            return {};
        const out = {};
        for (const [k, v] of Object.entries(parsed)) {
            if (typeof v === "number" && Number.isFinite(v) && v >= 0)
                out[k] = v;
        }
        return out;
    }
    catch {
        return {};
    }
}
/**
 * GAUGE_PLAN: "go" (default) or "go-plus"
 * GAUGE_PROVIDER: provider id to count (default "opencode-go"), "*" for all
 * GAUGE_UNKNOWN_WEIGHT: weight for unknown models (default 4)
 * GAUGE_WEIGHTS: JSON object mapping model id to weight, e.g. {"glm-5.3":4}
 */
export function loadConfig(env = process.env) {
    const base = defaultConfig();
    const planId = (env.GAUGE_PLAN ?? "go");
    const unknown = Number(env.GAUGE_UNKNOWN_WEIGHT);
    return {
        plan: PLANS[planId] ?? base.plan,
        provider: env.GAUGE_PROVIDER?.trim() || base.provider,
        unknownWeight: env.GAUGE_UNKNOWN_WEIGHT !== undefined && Number.isFinite(unknown) && unknown >= 0 ? unknown : base.unknownWeight,
        overrides: parseOverrides(env.GAUGE_WEIGHTS),
    };
}
