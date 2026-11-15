import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';

const agentDir = path.join(homedir(), '.pi', 'agent');
export function piInfo() {
  try {
    const settings = JSON.parse(readFileSync(path.join(agentDir, 'settings.json'), 'utf8'));
    const config = JSON.parse(readFileSync(path.join(agentDir, 'models.json'), 'utf8'));
    const provider = config.providers?.[settings.defaultProvider];
    const model = provider?.models?.find(m => m.id === settings.defaultModel);
    return { available: !!model, label: `Pi · ${settings.defaultModel}`, model: settings.defaultModel,
      modelProvider: settings.defaultProvider, baseUrl: provider?.baseUrl || '', keyConfigured: !!provider?.apiKey };
  } catch { return { available: false, label: 'Pi 尚未配置', model: '', modelProvider: '', baseUrl: '', keyConfigured: false }; }
}

export async function runPi({ prompt, schema, images, system, cwd, customTools = [] }) {
  const info = piInfo();
  const runtime = await ModelRuntime.create({ modelsPath: path.join(agentDir, 'models.json'), authPath: path.join(agentDir, 'auth.json'), modelsStorePath: path.join(agentDir, 'models-store.json'), allowModelNetwork: false });
  const model = runtime.getModel(info.modelProvider, info.model);
  if (!model || !runtime.hasConfiguredAuth(info.modelProvider)) throw new Error('Pi 模型或凭据未配置，请先在 Pi Web 中完成连接测试。');
  const settingsManager = SettingsManager.inMemory({ packages: [], extensions: [], compaction: { enabled: false }, retry: { enabled: false }, cacheWarming: 'off' });
  const resourceLoader = new DefaultResourceLoader({ cwd, agentDir: cwd, settingsManager,
    noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
    systemPromptOverride: () => system, appendSystemPromptOverride: () => [] });
  await resourceLoader.reload();
  const { session } = await createAgentSession({ cwd, agentDir: cwd, modelRuntime: runtime, model, thinkingLevel: 'off',
    settingsManager, resourceLoader, sessionManager: SessionManager.inMemory(cwd), tools: customTools.map(t => t.name), customTools });
  const toolCalls = [];
  let stopped = false, calls = 0;
  const unsubscribe = session.subscribe(event => {
    if (event.type === 'tool_execution_start' && ++calls > 12) { stopped = true; void session.abort(); }
    if (event.type === 'tool_execution_end') toolCalls.push({ name: event.toolName, ok: !event.isError });
  });
  const timer = setTimeout(() => { stopped = true; void session.abort(); }, 120000);
  try {
    const allowed = new Set(customTools.map(t => t.name));
    if (session.getCallableToolNames().some(name => !allowed.has(name))) throw new Error('Pi 工具权限配置不符合厨房应用要求。');
    await session.prompt(prompt + '\n最终只输出 JSON，不要代码围栏。JSON schema: ' + JSON.stringify(schema), { images, expandPromptTemplates: false });
    if (stopped) throw new Error('Pi 达到本次调用限制，请缩小请求后重试。菜单未修改。');
    const last = session.state.messages.filter(m => m.role === 'assistant').at(-1);
    if (!last || ['error', 'aborted'].includes(last.stopReason)) throw new Error('Pi 模型调用未完成，请检查 Pi Web 的模型连接后重试。');
    const text = session.getLastAssistantText() || '';
    const data = JSON.parse(text.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''));
    return { data, toolCalls };
  } finally { clearTimeout(timer); unsubscribe(); session.dispose(); }
}
