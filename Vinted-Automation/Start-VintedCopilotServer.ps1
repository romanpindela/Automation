<#
.SYNOPSIS
    Lightweight zero-dependency local HTTP API and Copilot server for Vinted automation.

.DESCRIPTION
    Start-VintedCopilotServer.ps1 runs a native .NET HttpListener providing an API for the
    VintedCopilot browser extension/userscript as well as a local web dashboard.
    It serves item catalogs, allows 1-click opening of item photo folders in Windows Explorer,
    and moves listed items to the '_Wystawione' archive directory.

.PARAMETER Port
    The local TCP port to listen on. Default is 8080.

.PARAMETER CatalogPath
    Path to catalog.json. Defaults to catalog.json in script root.

.PARAMETER EnableLogging
    If set, logs requests to C:\Logs\<timestamp>-Start-VintedCopilotServer-<computer>-<user>.log.

.PARAMETER Help
    Displays help and usage examples.

.EXAMPLE
    .\Start-VintedCopilotServer.ps1 -Help
    Displays help screen.

.EXAMPLE
    .\Start-VintedCopilotServer.ps1 -Port 8080
    Starts the local API server on http://127.0.0.1:8080.

.NOTES
    Author: Roman Pindela (roman.pindela@gmail.com)
    GitHub: https://github.com/romanpindela
    Version: 1.0.0
#>

[CmdletBinding()]
param (
    [Parameter(Mandatory = $false)]
    [int]$Port = 8080,

    [Parameter(Mandatory = $false)]
    [string]$CatalogPath = "",

    [Parameter(Mandatory = $false)]
    [switch]$EnableLogging,

    [Parameter(Mandatory = $false)]
    [Alias("h")]
    [switch]$Help
)

if ($Help) {
    Write-Host @"
================================================================================
 VINTED COPILOT LOCAL SERVER - CLI HELP
================================================================================
 Author:  Roman Pindela (roman.pindela@gmail.com)
 GitHub:  https://github.com/romanpindela
 Version: 1.0.0

 Description:
   Provides zero-dependency REST endpoints for the VintedCopilot browser extension:
     - GET  /api/catalog      -> Returns items with photos, titles, prices, descriptions
     - POST /api/open-folder  -> Opens the item's photo folder in Windows Explorer
     - POST /api/mark-listed  -> Moves item to '_Wystawione' archive folder
     - GET  /                 -> Modern Web Dashboard for inspecting items

 Parameters:
   -Port <int>          Local port (default: 8080)
   -CatalogPath <string> Path to catalog.json (default: .\catalog.json)
   -EnableLogging       Log to C:\Logs\
   -Help (-h)           Show this help screen

 Examples:
   .\Start-VintedCopilotServer.ps1 -Help
   .\Start-VintedCopilotServer.ps1
   .\Start-VintedCopilotServer.ps1 -Port 8090
================================================================================
"@ -ForegroundColor Cyan
    exit 0
}

# Resolve catalog path
if ([string]::IsNullOrWhiteSpace($CatalogPath)) {
    $CatalogPath = Join-Path $PSScriptRoot "catalog.json"
}

# Setup logging
$scriptName = "Start-VintedCopilotServer"
$logFile = $null
if ($EnableLogging) {
    $logDir = "C:\Logs"
    if (-not (Test-Path -Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $computer = $env:COMPUTERNAME
    $user = $env:USERNAME
    $logFile = Join-Path $logDir "$timestamp-$scriptName-$computer-$user.log"
}

function Write-Log {
    param (
        [string]$Message,
        [string]$Level = "INFO"
    )
    $time = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $formatted = "[$time][$Level] $Message"
    switch ($Level) {
        "INFO"    { Write-Host $formatted -ForegroundColor Green }
        "WARN"    { Write-Host $formatted -ForegroundColor Yellow }
        "ERROR"   { Write-Host $formatted -ForegroundColor Red }
        default   { Write-Host $formatted }
    }
    if ($logFile) {
        Add-Content -Path $logFile -Value $formatted
    }
}

if (-not (Test-Path -Path $CatalogPath)) {
    Write-Log "catalog.json was not found at '$CatalogPath'. Please run Generate-VintedMetadata.ps1 first!" "WARN"
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://127.0.0.1:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Log "Failed to bind to $prefix. Error: $($_.Exception.Message)" "ERROR"
    exit 1
}

Write-Log "=========================================================="
Write-Log "Vinted Copilot Server is RUNNING at $prefix"
Write-Log "Dashboard:       $prefix"
Write-Log "Catalog API:     ${prefix}api/catalog"
Write-Log "Press Ctrl+C in this console window to stop the server."
Write-Log "=========================================================="

# Simple HTML dashboard template
$dashboardHtml = @"
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vinted Automation Dashboard</title>
    <style>
        :root { --primary: #09b1ba; --bg: #0f172a; --card: #1e293b; --text: #f8fafc; --text-muted: #94a3b8; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 24px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 16px; margin-bottom: 24px; }
        h1 { margin: 0; font-size: 24px; color: var(--primary); }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
        .card { background: var(--card); border-radius: 12px; padding: 18px; border: 1px solid #334155; display: flex; flex-direction: column; justify-content: space-between; }
        .title { font-size: 16px; font-weight: 600; margin-bottom: 8px; color: #fff; }
        .badge { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 500; margin-right: 6px; margin-bottom: 6px; background: #334155; }
        .price { font-size: 20px; font-weight: 700; color: #22c55e; margin: 12px 0 6px 0; }
        .desc { font-size: 13px; color: var(--text-muted); white-space: pre-line; max-height: 80px; overflow-y: auto; margin-bottom: 14px; background: #0f172a; padding: 8px; border-radius: 6px; }
        .btn-row { display: flex; gap: 8px; }
        button { cursor: pointer; border: none; border-radius: 6px; padding: 8px 12px; font-size: 13px; font-weight: 600; transition: opacity 0.2s; }
        button:hover { opacity: 0.85; }
        .btn-open { background: #3b82f6; color: white; }
        .btn-vinted { background: var(--primary); color: white; text-decoration: none; padding: 8px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; text-align: center; }
        .btn-mark { background: #10b981; color: white; }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1>🛍️ Vinted Copilot Dashboard</h1>
            <p style="margin: 4px 0 0 0; color: var(--text-muted); font-size: 14px;">Zarządzaj przedmiotami przygotowanymi do wystawienia</p>
        </div>
        <div>
            <a href="https://www.vinted.pl/items/new" target="_blank" class="btn-vinted">+ Otwórz formularz Vinted</a>
        </div>
    </div>
    <div id="cards" class="grid">Ładowanie przedmiotów...</div>
    <script>
        async function loadItems() {
            try {
                const res = await fetch('/api/catalog');
                const data = await res.json();
                const container = document.getElementById('cards');
                container.innerHTML = '';
                data.forEach(item => {
                    const card = document.createElement('div');
                    card.className = 'card';
                    card.innerHTML = `
                        <div>
                            <div class="title">\${item.title}</div>
                            <div>
                                <span class="badge">🏷️ \${item.brand || 'Brak marki'}</span>
                                <span class="badge">📏 \${item.size || 'Uniwersalny'}</span>
                                <span class="badge">📦 \${item.package_size || 'Średnia'}</span>
                                <span class="badge">📷 \${item.photo_count} zdjęć</span>
                            </div>
                            <div class="price">\${item.price} PLN</div>
                            <div class="desc">\${item.description}</div>
                        </div>
                        <div class="btn-row">
                            <button class="btn-open" onclick="openFolder('\${item.id}')">📂 Pokaż zdjęcia</button>
                            <button class="btn-mark" onclick="markListed('\${item.id}')">✅ Wystawione</button>
                        </div>
                    `;
                    container.appendChild(card);
                });
            } catch (e) {
                document.getElementById('cards').innerText = 'Błąd wczytywania katalogu: ' + e;
            }
        }
        async function openFolder(id) {
            await fetch('/api/open-folder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
        }
        async function markListed(id) {
            if (confirm('Czy na pewno chcesz przenieść ten przedmiot do archiwum _Wystawione?')) {
                await fetch('/api/mark-listed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
                loadItems();
            }
        }
        loadItems();
    </script>
</body>
</html>
"@

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # CORS Headers
        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        $rawUrl = $request.RawUrl
        $path = $request.Url.AbsolutePath.ToLower()

        if ($request.HttpMethod -eq "GET" -and ($path -eq "/" -or $path -eq "/index.html")) {
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($dashboardHtml)
            $response.ContentType = "text/html; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        if ($request.HttpMethod -eq "GET" -and $path -eq "/api/catalog") {
            if (Test-Path -Path $CatalogPath) {
                $catalogData = Get-Content -Path $CatalogPath -Raw -Encoding UTF8
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($catalogData)
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            } else {
                $response.StatusCode = 404
            }
            $response.Close()
            continue
        }

        if ($request.HttpMethod -eq "POST" -and $path -eq "/api/open-folder") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $body = $reader.ReadToEnd() | ConvertFrom-Json
            $itemId = $body.id

            if (Test-Path -Path $CatalogPath) {
                $catalog = Get-Content -Path $CatalogPath -Raw -Encoding UTF8 | ConvertFrom-Json
                $target = $catalog | Where-Object { $_.id -eq $itemId } | Select-Object -First 1
                if ($target -and (Test-Path -Path $target.folder_path)) {
                    Write-Log "Opening Explorer for folder: $($target.folder_path)"
                    Start-Process "explorer.exe" -ArgumentList "`"$($target.folder_path)`""
                    $result = '{"status":"ok"}'
                } else {
                    $result = '{"status":"not_found"}'
                }
            } else {
                $result = '{"status":"no_catalog"}'
            }

            $buffer = [System.Text.Encoding]::UTF8.GetBytes($result)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        if ($request.HttpMethod -eq "POST" -and $path -eq "/api/mark-listed") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $body = $reader.ReadToEnd() | ConvertFrom-Json
            $itemId = $body.id

            if (Test-Path -Path $CatalogPath) {
                $catalog = [System.Collections.Generic.List[PSCustomObject]](Get-Content -Path $CatalogPath -Raw -Encoding UTF8 | ConvertFrom-Json)
                $target = $catalog | Where-Object { $_.id -eq $itemId } | Select-Object -First 1

                if ($target -and (Test-Path -Path $target.folder_path)) {
                    $parentDir = Split-Path -Path $target.folder_path -Parent
                    $archiveDir = Join-Path $parentDir "_Wystawione"
                    if (-not (Test-Path -Path $archiveDir)) {
                        New-Item -ItemType Directory -Path $archiveDir -Force | Out-Null
                    }

                    $destination = Join-Path $archiveDir $target.folder_name
                    Write-Log "Moving item folder '$($target.folder_path)' to '$destination'..."
                    Move-Item -Path $target.folder_path -Destination $destination -Force

                    $target.status = "listed"
                    $target.folder_path = $destination

                    # Update catalog.json
                    $updatedJson = $catalog | ConvertTo-Json -Depth 6
                    [System.IO.File]::WriteAllText($CatalogPath, $updatedJson, [System.Text.Encoding]::UTF8)

                    $result = '{"status":"ok"}'
                } else {
                    $result = '{"status":"not_found"}'
                }
            } else {
                $result = '{"status":"no_catalog"}'
            }

            $buffer = [System.Text.Encoding]::UTF8.GetBytes($result)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # Fallback 404
        $response.StatusCode = 404
        $response.Close()
    }
} finally {
    if ($listener.IsListening) {
        $listener.Stop()
        $listener.Close()
    }
    Write-Log "Vinted Copilot Server stopped."
}
