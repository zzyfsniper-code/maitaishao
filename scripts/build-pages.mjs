import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(path.join(root, 'data/share-config.json'), 'utf8'));
if (!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(config.apiBase || '')) throw new Error('Start the sharing tunnel before building Pages.');
const output = path.join(root, 'site');
await mkdir(output, { recursive: true });
await cp(path.join(root, 'public'), output, { recursive: true });
async function relativize(dir) {
  for (const file of await readdir(dir, { withFileTypes: true })) {
    const target = path.join(dir, file.name);
    if (file.isDirectory()) await relativize(target);
    else if (/\.(?:html|js|css)$/.test(file.name)) {
      const text = await readFile(target, 'utf8');
      await writeFile(target, text.replace(/(["'`(])\/(assets\/|fonts\/|[a-z][\w-]*\.(?:js|css|svg|jpg|png|json))/g, '$1./$2').replaceAll('href="/"', 'href="./"'));
    }
  }
}
await relativize(output);
await writeFile(path.join(output, 'deployment.json'), JSON.stringify({ apiBase: config.apiBase }));
await writeFile(path.join(output, '.nojekyll'), '');
console.log('Pages frontend built; local data and model credentials excluded.');
