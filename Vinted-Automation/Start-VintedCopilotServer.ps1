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

# Path to index.html
$indexPath = Join-Path $PSScriptRoot "index.html"

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
            $html = if (Test-Path -Path $indexPath) {
                [System.IO.File]::ReadAllText($indexPath, [System.Text.Encoding]::UTF8)
            } else {
                "<!DOCTYPE html><html><body><h1>index.html not found</h1></body></html>"
            }
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($html)
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
