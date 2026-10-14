#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.ts";
import { connectStats } from "./connect.ts";
import { createServer } from "./server.ts";

const server = createServer({ config: loadConfig(), connect: connectStats });
await server.connect(new StdioServerTransport());
