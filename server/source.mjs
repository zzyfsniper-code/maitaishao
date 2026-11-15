import { lookup } from 'node:dns/promises';
import { fail } from './domain.mjs';
export function publicAddress(record) {
  if (record.family === 6) return /^[23][0-9a-f]{3}:/i.test(record.address) && !/^2001:db8:/i.test(record.address);
  return record.family === 4 && !/^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|198\.(18|19)\.|22[4-9]\.|23\d\.|24\d\.|25[0-5]\.)/.test(record.address);
}
export async function sourceText(input) {
  if (input.type !== 'link') return String(input.text || '').slice(0, 24000);
  let url;
  try { url = new URL(input.text); } catch { fail('链接格式不正确。'); }
  for (let i = 0; i < 4; i++) {
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) fail('导入仅支持公开 HTTPS 链接。');
    const records = await lookup(url.hostname, { all: true });
    if (!records.length || records.some(r => !publicAddress(r))) fail('不能读取本机或内网链接，请粘贴正文或上传截图。');
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'FamilyKitchenDemo/0.1' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) { url = new URL(response.headers.get('location'), url); continue; }
    if (!response.ok) fail(`页面读取失败（HTTP ${response.status}），请上传截图或粘贴文字。`, 422);
    if (!/text\/(html|plain)/.test(response.headers.get('content-type') || '')) fail('链接不是可读取的网页，请上传截图或粘贴文字。');
    const reader = response.body.getReader();
    const chunks = []; let size = 0;
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 2_000_000) { await reader.cancel(); fail('页面过大，请改用截图或文字。'); } chunks.push(Buffer.from(value)); }
    const text = Buffer.concat(chunks).toString('utf8').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (/环境异常|去验证|访问过于频繁|完成安全验证/.test(text)) fail('微信要求环境验证，当前未读取到真实食谱。请改为上传食谱截图或粘贴文字。', 422);
    if (text.length < 30) fail('未读到可用正文，食谱可能在图片中，请上传食谱截图。', 422);
    return text.slice(0, 24000);
  }
  fail('页面重定向次数过多，请上传截图或粘贴文字。', 422);
}
