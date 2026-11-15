import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';

export function createKnowledgeClient(databasePath) {
  let client, connecting, closing = false;
  async function connect() {
    if (closing) throw new Error('知识库正在关闭。');
    if (client) return client;
    if (!connecting) connecting = (async () => {
      const next = new Client({ name: 'maitaishao-web', version: '1.0.0' });
      const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('./knowledge-mcp.mjs', import.meta.url)), databasePath], stderr: 'pipe' });
      transport.stderr?.on('data', () => {});
      next.onclose = () => { if (client === next) client = undefined; };
      try {
        await next.connect(transport);
        const { tools } = await next.listTools();
        if (!['knowledge_search_recipes', 'knowledge_save_recipe', 'knowledge_confirm_proposal', 'knowledge_recipe_history'].every(name => tools.some(t => t.name === name))) throw new Error('知识库 MCP 工具不完整。');
        client = next;
        return next;
      } catch (error) { await next.close().catch(() => {}); throw error; }
    })().finally(() => { connecting = undefined; });
    return connecting;
  }
  return {
    async call(name, args) {
      let result;
      try { result = await (await connect()).callTool({ name, arguments: args }, undefined, { timeout: 15000 }); }
      catch { throw Object.assign(new Error('菜谱知识库暂时无法连接，请稍后重试。'), { status: 503 }); }
      const output = JSON.parse(result.content.find(c => c.type === 'text').text);
      if (result.isError) throw Object.assign(new Error(output.error), { status: output.status || 400 });
      return output;
    },
    async close() { closing = true; if (connecting) await connecting.catch(() => {}); if (client) await client.close(); }
  };
}
