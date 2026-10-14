import { OpenCode } from "@opencode/client";
import { Service } from "@opencode/client/service";
export async function connectStats() {
    const endpoint = await Service.discover();
    if (!endpoint) {
        throw new Error("No running OpenCode service found. Start OpenCode first, then retry.");
    }
    const client = OpenCode.make({ baseUrl: endpoint.url, headers: Service.headers(endpoint) });
    return (range) => client.session.stats({
        from: range.from,
        to: range.to,
        tools: "none",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    });
}
