import http from 'node:http';
import { readFileSync } from 'node:fs';
import { createHash, timingSafeEqual } from 'node:crypto';

const config = JSON.parse(readFileSync(new URL('../data/share-config.json', import.meta.url), 'utf8'));
const expected = createHash('sha256').update(config.passcode).digest();
const attempts = new Map();
const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const reply = (status, error) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ error })); };
  res.setHeader('Vary', 'Origin');
  if (origin && origin !== config.allowedOrigin) return reply(403, '此页面无权连接厨房。');
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  let target;
  try { target = new URL(req.url || '/', 'http://127.0.0.1:4317'); }
  catch { return reply(400, '请求地址无效。'); }
  if (target.origin !== 'http://127.0.0.1:4317' || !target.pathname.startsWith('/api/')) return reply(404, '这里只提供厨房接口。');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600' }); return res.end();
  }
  const ip = String(req.headers['cf-connecting-ip'] || req.socket.remoteAddress);
  const now = Date.now();
  for (const [key, value] of attempts) if (now - value.since > 300000) attempts.delete(key);
  if ((attempts.get(ip)?.count || 0) >= 10) return reply(429, '口令错误次数过多，请五分钟后重试。');
  const supplied = createHash('sha256').update(String(req.headers.authorization || '').replace(/^Bearer /, '')).digest();
  if (!timingSafeEqual(expected, supplied)) {
    const record = attempts.get(ip) || { count: 0, since: now }; record.count++; attempts.set(ip, record);
    return reply(401, '请输入正确的组员访问口令。');
  }
  attempts.delete(ip);
  if (target.pathname === '/api/agent/config') return reply(403, '模型连接配置请在主厨电脑本地修改。');
  if (!['GET', 'POST'].includes(req.method)) return reply(405, '不支持此请求。');
  try {
    const chunks = []; let bytes = 0;
    for await (const chunk of req) { bytes += chunk.length; if (bytes > 9_000_000) return reply(413, '图片过大，请压缩后上传。'); chunks.push(chunk); }
    const response = await fetch(target, { method: req.method,
      headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:4317' },
      body: req.method === 'POST' ? Buffer.concat(chunks) : undefined, signal: AbortSignal.timeout(130000), redirect: 'error' });
    res.writeHead(response.status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch { reply(502, '主厨电脑的厨房服务暂未响应，请稍后重试。'); }
});
server.listen(4319, '127.0.0.1', () => console.log('Authenticated kitchen sharing gateway on 127.0.0.1:4319'));
