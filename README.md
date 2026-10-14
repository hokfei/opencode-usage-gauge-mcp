# opencode-usage-gauge-mcp

An MCP server that tells you how much of your **OpenCode Go** allowance you have used, so the agent (or you) can check before starting something expensive.

It reads OpenCode's own local session stats (`session.stats`) and applies the per-model weights from the Go plan's pooled limits. It does **not** call any remote usage endpoint.

## Tools

| Tool | What it does |
|---|---|
| `usage_gauge` | Used / remaining / percent for the rolling 5h, 7d and 30d windows. |
| `usage_by_model` | Per-model breakdown for one window (`5h`, `week`, `month`). |
| `usage_weights` | The weight table in effect (plan caps, overrides, unknown fallback). |

## Install

Add to your OpenCode config:

```jsonc
{
  "mcp": {
    "servers": {
      "usage-gauge": {
        "type": "local",
        "command": ["npx", "-y", "github:hokfei/opencode-usage-gauge-mcp"],
        "environment": { "GAUGE_PLAN": "go" }
      }
    }
  }
}
```

Or: `opencode mcp add usage-gauge --global -- npx -y github:hokfei/opencode-usage-gauge-mcp`

Requires Node >= 20 and a **running** OpenCode service (it discovers one; it never starts one).

## Configuration (environment)

| Variable | Default | Meaning |
|---|---|---|
| `GAUGE_PLAN` | `go` | `go` ($12/5h, $30/week, $60/month) or `go-plus` ($48 / $120 / $240). |
| `GAUGE_PROVIDER` | `opencode-go` | Provider ID to count. `*` counts every provider. |
| `GAUGE_UNKNOWN_WEIGHT` | `4` | Weight for models not in the table (flagged in output). |
| `GAUGE_WEIGHTS` | `{}` | JSON overrides, e.g. `{"glm-5.3": 4}`. |

## How the number is computed

A model with monthly cap `L` counts at weight `60 / L` (Go) or `240 / L` (Go Plus) times its list-price cost, against one pooled allowance. Free preview models weigh 0.

## Caveats

- OpenCode's local `cost` is a list-price estimate; the server's accounting may differ (calendar vs rolling month, other machines or clients).
- Weights and limits come from OpenCode's docs and may change. Update `src/models.ts` or use `GAUGE_WEIGHTS`.
- The provider ID `opencode-go` is unverified; set `GAUGE_PROVIDER` if your stats use another ID.
- Not yet tested against a live OpenCode instance; tested with fakes and an MCP stdio handshake.
- The undocumented `/zen/go/v1/usage` endpoint is intentionally not used.

## Development

```
npm test          # node --test, TypeScript run directly
npm run typecheck
npm run build     # emits dist/
```

`dist/` is committed because `npx github:...` cannot run `.ts` files from `node_modules`. **Run `npm run build` and commit `dist/` before pushing.**
