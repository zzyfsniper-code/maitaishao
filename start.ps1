$ErrorActionPreference = 'Stop'
$projectPath = $PSScriptRoot
$port = 4317
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 2
    if ($health.app -eq 'family-kitchen') { Start-Process "http://127.0.0.1:$port"; exit }
    throw "Port $port is occupied by another application."
} catch {
    if ($_.Exception.Message -like '*occupied*') { throw }
}
$nodePath = (Get-Command node -ErrorAction Stop).Source
New-Item -ItemType Directory -Path (Join-Path $projectPath 'data') -Force | Out-Null
$process = Start-Process -FilePath $nodePath -ArgumentList '--env-file-if-exists=.env', 'server/index.mjs' -WorkingDirectory $projectPath -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $projectPath 'data/server.log') -RedirectStandardError (Join-Path $projectPath 'data/server-error.log')
$process.Id | Set-Content -LiteralPath (Join-Path $projectPath 'data/server.pid')
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 1
        if ($health.app -eq 'family-kitchen') { Start-Process "http://127.0.0.1:$port"; exit }
    } catch { Start-Sleep -Milliseconds 300 }
}
throw 'Startup failed. See data/server-error.log.'
