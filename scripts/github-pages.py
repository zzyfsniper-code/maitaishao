"""Publish only site/ to gh-pages; credentials stay in environment or Git credential manager."""
import argparse
import base64
import json
import os
from pathlib import Path
import subprocess
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OWNER, REPO = 'zzyfsniper-code', 'maitaishao'

def credential():
    token = os.getenv('GITHUB_TOKEN') or os.getenv('GH_TOKEN')
    if token:
        return token
    result = subprocess.run(['git', 'credential', 'fill'], input='protocol=https\nhost=github.com\n\n',
        text=True, capture_output=True, timeout=20,
        env=dict(os.environ, GIT_TERMINAL_PROMPT='0', GCM_INTERACTIVE='never'))
    fields = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)
    if not fields.get('password'):
        raise RuntimeError('GitHub authentication is unavailable.')
    return fields['password']

TOKEN = credential()
def api(method, endpoint, data=None, missing=False):
    request = urllib.request.Request('https://api.github.com' + endpoint, method=method,
        headers={'Authorization': 'Bearer ' + TOKEN, 'Accept': 'application/vnd.github+json',
                 'Content-Type': 'application/json', 'User-Agent': 'maitaishao-publisher'},
        data=json.dumps(data).encode() if data is not None else None)
    try:
        with urllib.request.urlopen(request, timeout=40) as response:
            content = response.read()
            return json.loads(content) if content else {}
    except urllib.error.HTTPError as error:
        if missing and error.code == 404:
            return None
        raise RuntimeError(f'GitHub {method} {endpoint}: HTTP {error.code}') from None

parser = argparse.ArgumentParser()
parser.add_argument('action', choices=['init', 'publish', 'status'])
args = parser.parse_args()
base = f'/repos/{OWNER}/{REPO}'
if args.action == 'init':
    repository = api('GET', base, missing=True)
    if repository:
        if repository.get('description') != '买汰烧 · 家庭菜单与 Pi 厨房助手':
            raise RuntimeError('Repository already exists and is not this project; nothing changed.')
    else:
        repository = api('POST', '/user/repos', {'name': REPO, 'description': '买汰烧 · 家庭菜单与 Pi 厨房助手', 'private': False, 'auto_init': False})
    print(repository['html_url'])
elif args.action == 'publish':
    directory = ROOT / 'site'
    if not (directory / 'index.html').exists():
        raise RuntimeError('Run node scripts/build-pages.mjs first.')
    files = sorted(p for p in directory.rglob('*') if p.is_file())
    ref = api('GET', base + '/git/ref/heads/gh-pages', missing=True)
    tree = []
    for i, file in enumerate(files, 1):
        name = file.relative_to(directory).as_posix()
        if name.startswith(('data/', 'server/', '.env', '.git/')):
            raise RuntimeError('Private files cannot be published to Pages.')
        blob = api('POST', base + '/git/blobs', {'content': base64.b64encode(file.read_bytes()).decode(), 'encoding': 'base64'})
        tree.append({'path': name, 'mode': '100644', 'type': 'blob', 'sha': blob['sha']})
        if i % 5 == 0:
            print(f'Uploaded {i}/{len(files)} frontend files', flush=True)
    created_tree = api('POST', base + '/git/trees', {'tree': tree})
    commit = api('POST', base + '/git/commits', {'message': 'Publish 买汰烧 team demo', 'tree': created_tree['sha'], 'parents': [ref['object']['sha']] if ref else []})
    if ref:
        api('PATCH', base + '/git/refs/heads/gh-pages', {'sha': commit['sha'], 'force': False})
    else:
        api('POST', base + '/git/refs', {'ref': 'refs/heads/gh-pages', 'sha': commit['sha']})
    pages = api('GET', base + '/pages', missing=True)
    if not pages:
        pages = api('POST', base + '/pages', {'build_type': 'legacy', 'source': {'branch': 'gh-pages', 'path': '/'}})
    print(json.dumps({'url': pages['html_url'], 'commit': commit['sha']}, ensure_ascii=False))
else:
    pages = api('GET', base + '/pages', missing=True)
    build = api('GET', base + '/pages/builds/latest', missing=True) if pages else None
    print(json.dumps({'url': pages.get('html_url') if pages else None, 'status': pages.get('status') if pages else None,
                      'build': build.get('status') if build else None, 'error': build.get('error') if build else None}, ensure_ascii=False))
