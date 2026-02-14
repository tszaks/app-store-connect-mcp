export type ToolDef = {
  name: string;
  description: string;
  // MCP SDK expects JSON Schema; we keep this loosely typed to avoid extra deps.
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<string>;
};
