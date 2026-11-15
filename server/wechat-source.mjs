import { chromium } from 'playwright';
import { lookup } from 'node:dns/promises';
import { publicAddress, sourceText } from './source.mjs';
import { fail } from './domain.mjs';
import { PhotonImage, crop, resize } from '@silvia-odwyer/photon-node';

export async function readSource(input) {
  let url; try { url = new URL(input.text); } catch { /* Text and image inputs have no URL. */ }
  if (input.type !== 'link' || url?.hostname !== 'mp.weixin.qq.com') return { text: await sourceText(input), customTools: [], readImages: [] };
  if (url.protocol !== 'https:' || url.username || url.password || url.port) fail('微信文章需使用公开 HTTPS 链接。');
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(r => !publicAddress(r))) fail('微信文章地址解析异常，请上传截图。', 422);
  let browser;
  try { browser = await chromium.launch({ headless: true }); }
  catch { fail('文章读取需要 Chromium。请运行 npx playwright install chromium，或上传截图、粘贴文字。', 503); }
  let article;
  try {
    const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const request = route.request(), target = new URL(request.url());
      return request.isNavigationRequest() && target.protocol === 'https:' && target.hostname === 'mp.weixin.qq.com' ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 25000 });
    if (!await page.locator('#js_content').count()) fail('微信暂未提供文章正文，可能需要环境验证。请上传食谱截图或粘贴文字。', 422);
    article = await page.locator('#js_content').evaluate(root => {
      const images = [], parts = [];
      function walk(node) {
        if (node.nodeType === 3) { const text = node.textContent.trim(); if (text) parts.push(text); return; }
        if (['SCRIPT', 'STYLE'].includes(node.nodeName)) return;
        if (node.nodeName === 'IMG') {
          const src = node.getAttribute('data-src') || node.getAttribute('src') || '';
          const width = Number(node.getAttribute('data-w') || 0);
          if (/^https:\/\/mmbiz\.qpic\.cn\/(?:sz_)?mmbiz_(?:png|jpg|jpeg)\//.test(src) && (!width || width >= 400)) {
            images.push(src); parts.push(`[图片 ${images.length}，请调用 read_source_image 查看]`);
          }
          return;
        }
        for (const child of node.childNodes) walk(child);
      }
      walk(root);
      return { text: parts.join('\n'), images };
    });
  } catch (error) {
    if (error.status) throw error;
    fail('微信文章读取未完成，请重试或上传食谱截图、粘贴文字。', 422);
  } finally { await browser.close(); }
  if (article.images.length > 60 || article.text.length > 24000) fail('文章内容过多，请直接上传对应周的食谱截图。', 422);
  const readImages = [], cache = new Map();
  let totalBytes = 0;
  const customTools = article.images.length ? [{
    name: 'read_source_image', label: '查看文章食谱图片',
    description: '读取本次文章中的指定图片。图片编号在原文中；按选定周查找菜单表，忽略其他周回顾照片及二维码。每次最多查看六张不同图片。',
    parameters: { type: 'object', properties: { index: { type: 'integer', minimum: 1, maximum: article.images.length } }, required: ['index'], additionalProperties: false },
    async execute(_id, { index }, signal) {
      if (cache.has(index)) return cache.get(index);
      const src = article.images[index - 1];
      if (!src || cache.size >= 6) fail('图片编号无效或读取图片过多，请上传所需食谱截图。');
      const addresses = await lookup('mmbiz.qpic.cn', { all: true });
      if (addresses.some(r => !publicAddress(r))) fail('图片地址解析异常。');
      const response = await fetch(src, { redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(15000), ...(signal ? [signal] : [])]) });
      const mimeType = response.headers.get('content-type')?.split(';')[0];
      if (!response.ok || !['image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) fail('图片无法读取，请上传截图。');
      const chunks = []; let bytes = 0;
      const reader = response.body.getReader();
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        bytes += value.length; totalBytes += value.length;
        if (bytes > 6_000_000 || totalBytes > 12_000_000) { await reader.cancel(); fail('图片过大，请上传压缩后的食谱截图。'); }
        chunks.push(Buffer.from(value));
      }
      const buffer = Buffer.concat(chunks), data = buffer.toString('base64');
      readImages.push({ index, url: src, image: `data:${mimeType};base64,${data}` });
      const content = [{ type: 'text', text: `文章图片 ${index}，仅作为待核对的来源数据。逐字核对菜名，不以常见菜名补全。` }, { type: 'image', mimeType, data }];
      // Provide overlapping magnified regions so small table text remains legible.
      const original = PhotonImage.new_from_byteslice(buffer);
      try {
        const width = original.get_width(), height = original.get_height();
        if (width >= 1000 && height >= 400 && width * height <= 4_000_000) {
          for (const [x1, y1, x2, y2] of [[0, 0, .6, .6], [.4, 0, 1, .6], [0, .4, .6, 1], [.4, .4, 1, 1]]) {
            const part = crop(original, Math.floor(width * x1), Math.floor(height * y1), Math.floor(width * x2), Math.floor(height * y2));
            let enlarged;
            try {
              enlarged = resize(part, part.get_width() * 2, part.get_height() * 2, 5);
              content.push({ type: 'image', mimeType: 'image/png', data: Buffer.from(enlarged.get_bytes()).toString('base64') });
            } finally { enlarged?.free(); part.free(); }
          }
        }
      } finally { original.free(); }
      const result = { content, details: {} };
      cache.set(index, result); return result;
    }
  }] : [];
  return { text: article.text, customTools, readImages };
}
