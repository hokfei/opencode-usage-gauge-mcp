#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { connectStats } from "./connect.js";
import { createServer } from "./server.js";
const server = createServer({ config: loadConfig(), connect: connectStats });
await server.connect(new StdioServerTransport());
