<#
================================================================================
  Script Name : deploy-n8n-on-windows-docker-desktop.ps1
  Author      : Roman Pindela
  Contact     : roman.pindela@gmail.com
  Version     : 1.3.0
  Release Date: 2026-10-17
  License     : MIT
  Repository  : https://github.com/romanpindela

  DESCRIPTION:
    Enterprise-grade PowerShell automation script that provisions the WSL2
    environment (wsl.exe --update), downloads and installs Docker Desktop via
    WinGet into a custom SSD directory (default: c:\DANE\rpindela\SSD\Docker\),
    and deploys a self-hosted n8n workflow automation platform in Docker with
    the full official n8n Sandbox Stack (Docker Compose v2) following:
    - https://get.n8n.io
    - https://docs.n8n.io/deploy/host-n8n/install-options/install-using-docker-compose
    - https://docs.n8n.io/deploy/host-n8n/install-options/install-with-docker

    Key Capabilities:
    1. Zero-Parameter Interactive Help (-Help / -h):
       Displays complete usage instructions, architecture overview, version,
       author details, and examples when launched without parameters.
    2. Input Sanitization & Security Shield:
       Validates file system paths, container names, ports, timezones, and
       image tags against command injection and path traversal sequences.
    3. Language-Independent UAC Auto-Elevation:
       Verifies Administrator privileges via well-known Windows SID
       (S-1-5-32-544 / BuiltInAdministratorsSid) for full compatibility across
       Polish ("Administratorzy") and English ("Administrators") Windows systems.
       Automatically relaunches with elevated permissions preserving parameters.
    4. WSL2 Environment Provisioning & Update (wsl.exe --update):
       Ensures Windows Subsystem for Linux (WSL2) and Virtual Machine Platform
       features are enabled, executes 'wsl.exe --update' to install/update the
       WSL2 Linux kernel required by Docker Desktop and n8n, and enforces WSL 2
       as the default version ('wsl.exe --set-default-version 2').
    5. Custom-Path Docker Desktop Provisioning via WinGet:
       Downloads the Docker Desktop installer using WinGet showing real-time
       transfer progress, and installs Docker Desktop binaries, WSL2 data root,
       and Windows container storage into c:\DANE\rpindela\SSD\Docker\.
    6. Official n8n + AI Assistant Sandbox Deployment (Docker Compose v2):
       Generates the complete n8n Sandbox stack in c:\DANE\rpindela\SSD\Docker\n8n-stack\
       (compose.yml, .env with cryptographically random mTLS/API secrets, and
       searxng-settings.yml) and deploys all 6 official services:
       - sandbox-certs    : Generates mutual TLS (mTLS) certificates into sandbox_tls volume
       - sandbox-api      : Control-plane API for n8n AI Assistant code execution
       - sandbox-runner-1 : Privileged Docker-in-Docker (DinD) isolated sandbox runner
       - n8n              : Main n8n editor on port 5678 with persistent volume n8n_data
       - runners          : External Task Runners container for JS/Python Code nodes
       - searxng          : Bundled private web search engine for n8n Assistant
       Also supports legacy single-container mode via -SkipSandbox.
    7. Real-Time Multi-Stage Progress Bars (Write-Progress):
       Displays detailed layer-by-layer download progress for every stack image,
       container startup progress, sandbox-api & n8n health checks, and per-file
       transfer progress when importing local workflow JSON files (-ImportWorkflowsPath).
    8. Post-Install Tool Locations & Quick-Start Summary:
       Displays a concise cheat sheet after installation showing exact paths
       to all installed tools (WSL2, Docker Desktop GUI, Docker CLI, Docker Compose,
       Sandbox Stack files, WSL2 storage, n8n volume, logs) and essential commands.
    9. Detailed Audit Logging:
       Writes UTF-8 timestamped execution logs by default to:
       C:\Logs\<yyyyMMdd_HHmmss>-deploy-n8n-on-windows-docker-desktop-<ComputerName>-<UserName>.logs
================================================================================
.SYNOPSIS
    Provisions WSL2 (wsl.exe --update), installs Docker Desktop via WinGet to a
    custom SSD directory, and deploys self-hosted n8n with the official Docker
    Sandbox Stack (sandbox-certs, sandbox-api, sandbox-runner-1, runners, searxng).

.DESCRIPTION
    Automates the end-to-end provisioning of WSL2, Docker Desktop, and self-hosted
    n8n with the AI Assistant Sandbox on Windows 10/11 and Windows Server.
    Updates the WSL2 environment via 'wsl.exe --update', configures Docker Desktop
    to store binaries and WSL2 data in c:\DANE\rpindela\SSD\Docker\, generates the
    official Docker Compose Sandbox stack (compose.yml, .env, searxng-settings.yml),
    pulls all required images with real-time layer progress bars, starts the stack,
    verifies both sandbox-api and n8n HTTP health endpoints, optionally imports
    local workflow files with detailed transfer progress bars, and outputs a
    complete summary of tool locations and usage commands.

.PARAMETER Deploy
    Triggers the full deployment pipeline (WSL2 update + Docker Desktop check/install +
    n8n Docker Compose Sandbox stack deployment) using default or specified parameters.
    Aliases: -Install, -Run, -Start, -d

.PARAMETER DockerInstallDir
    Target installation directory for Docker Desktop binaries, WSL2 data roots, and n8n stack.
    Default: 'c:\DANE\rpindela\SSD\Docker\'
    Aliases: -InstallDir, -DockerPath, -Path

.PARAMETER StackDir
    Directory where Docker Compose Sandbox configuration files (compose.yml, .env,
    searxng-settings.yml) are generated.
    Default: '<DockerInstallDir>\n8n-stack' (e.g. 'c:\DANE\rpindela\SSD\Docker\n8n-stack')

.PARAMETER ContainerName
    Name of the main Docker container for the n8n instance.
    Default: 'n8n'
    Aliases: -Name, -Container

.PARAMETER DataVolumeName
    Name of the persistent Docker volume mounted to /home/node/.n8n.
    Default: 'n8n_data'
    Aliases: -Volume, -VolumeName

.PARAMETER Port
    Host TCP port mapped to n8n container port 5678.
    Default: 5678
    Aliases: -p, -HostPort

.PARAMETER Timezone
    Timezone string passed to GENERIC_TIMEZONE and TZ environment variables.
    Default: 'Europe/Warsaw'
    Aliases: -tz

.PARAMETER ImageTag
    Docker image tag/version for n8nio/n8n and ghcr.io/n8n-io/runners
    (e.g., 'latest', 'stable', '2.43.7'). When 'latest' or 'stable' is used in
    Sandbox mode, the script resolves the latest stable release version from GitHub
    so n8n and runners tags match cleanly.
    Default: 'latest'
    Aliases: -Tag, -Version

.PARAMETER SandboxVersion
    Version tag for the ghcr.io/n8n-io/n8n-sandbox-service-* images.
    Default: '1.8.1'

.PARAMETER SkipSandbox
    Deploys n8n as a standalone single container (docker run n8nio/n8n) without
    the Docker Compose Sandbox stack (sandbox-certs, sandbox-api, sandbox-runner-1,
    runners, searxng). By default, Sandbox mode is ENABLED.

.PARAMETER Interactive
    Runs the n8n container in foreground interactive mode (-it --rm) when used with
    -SkipSandbox, instead of detached background service mode (-d).

.PARAMETER SkipWslUpdate
    Skips running 'wsl.exe --update' and WSL2 default version configuration during deployment.

.PARAMETER SkipDockerInstall
    Skips the WinGet Docker Desktop installation check and proceeds directly to n8n
    deployment (useful when Docker Engine is already installed and running).

.PARAMETER Update
    Updates an existing n8n deployment by resolving and pulling the latest n8n and
    sandbox images and recreating the Docker Compose Sandbox stack (or standalone
    container) while preserving all data in the persistent volume and .env secrets.
    Aliases: -u, -Upgrade

.PARAMETER ImportWorkflowsPath
    Optional path to a local file (.json) or directory containing n8n workflow JSON files
    to upload/transfer into the running n8n container and import via n8n CLI with a
    detailed file transfer progress bar.
    Aliases: -WorkflowsPath, -UploadPath, -SyncPath

.PARAMETER UsePostgres
    Configures n8n to use an external PostgreSQL database instead of default SQLite.

.PARAMETER PostgresHost
    PostgreSQL server hostname or IP address (used when -UsePostgres is enabled).

.PARAMETER PostgresPort
    PostgreSQL server TCP port. Default: 5432.

.PARAMETER PostgresDatabase
    PostgreSQL database name. Default: 'n8n'.

.PARAMETER PostgresUser
    PostgreSQL username.

.PARAMETER PostgresPassword
    PostgreSQL password.

.PARAMETER PostgresSchema
    PostgreSQL schema name. Default: 'public'.

.PARAMETER Status
    Displays current installation status of WSL2, Docker Desktop, Docker Engine, and the
    n8n Sandbox stack containers, along with the summary of tool locations and usage commands.
    Aliases: -s, -Info

.PARAMETER OpenBrowser
    Automatically opens the n8n Web UI (http://localhost:<Port>) in the default browser
    once the container health check succeeds.

.PARAMETER LogPath
    Custom file path for execution logs.
    Default: C:\Logs\<yyyyMMdd_HHmmss>-deploy-n8n-on-windows-docker-desktop-<ComputerName>-<UserName>.logs
    Aliases: -l, -Log

.PARAMETER Help
    Displays the detailed help guide, parameter reference, examples, author, and version.
    Aliases: -h

.EXAMPLE
    .\deploy-n8n-on-windows-docker-desktop.ps1
    Displays the interactive help screen, usage examples, version, and author info.

.EXAMPLE
    .\deploy-n8n-on-windows-docker-desktop.ps1 -Deploy
    Updates WSL2 (wsl.exe --update), installs Docker Desktop via WinGet to
    c:\DANE\rpindela\SSD\Docker\, provisions the n8n Docker Compose Sandbox stack
    (n8n + sandbox-certs + sandbox-api + sandbox-runner-1 + runners + searxng)
    on port 5678, verifies sandbox & n8n health, and prints the quick-start summary.

.EXAMPLE
    .\deploy-n8n-on-windows-docker-desktop.ps1 -Deploy -DockerInstallDir "c:\DANE\rpindela\SSD\Docker\" -Port 5678 -Timezone "Europe/Warsaw" -OpenBrowser
    Deploys the full n8n + Sandbox stack with Warsaw timezone and opens http://localhost:5678.

.EXAMPLE
    .\deploy-n8n-on-windows-docker-desktop.ps1 -Deploy -ImportWorkflowsPath "C:\Workflows"
    Deploys n8n with Sandbox and uploads all workflow .json files from C:\Workflows into
    the n8n container with a detailed per-file transfer progress bar.

.EXAMPLE
    .\deploy-n8n-on-windows-docker-desktop.ps1 -Update
    Upgrades n8n and the Sandbox services to the latest release while preserving n8n_data and .env secrets.

.EXAMPLE
    .\deploy-n8n-on-windows-docker-desktop.ps1 -Status
    Checks WSL2, Docker & n8n Sandbox stack status and prints tool locations and commands.
#>

[CmdletBinding(DefaultParameterSetName = "Default")]
param (
    [Parameter(Mandatory = $false, ParameterSetName = "DeploySet")]
    [Alias("Install", "Run", "Start", "d")]
    [switch]$Deploy,

    [Parameter(Mandatory = $false, Position = 0, ParameterSetName = "DeploySet")]
    [Parameter(Mandatory = $false, ParameterSetName = "UpdateSet")]
    [Parameter(Mandatory = $false, ParameterSetName = "StatusSet")]
    [Alias("InstallDir", "DockerPath", "Path")]
    [string]$DockerInstallDir = "c:\DANE\rpindela\SSD\Docker\",

    [Parameter(Mandatory = $false, ParameterSetName = "DeploySet")]
    [Parameter(Mandatory = $false, ParameterSetName = "UpdateSet")]
    [Parameter(Mandatory = $false, ParameterSetName = "StatusSet")]
    [string]$StackDir,

    [Parameter(Mandatory = $false, ParameterSetName = "DeploySet")]
    [Parameter(Mandatory = $false, ParameterSetName = "UpdateSet")]
    [Parameter(Mandatory = $false, ParameterSetName = "StatusSet")]
    [Alias("Name", "Container")]
    [string]$ContainerName = "n8n",

    [Parameter(Mandatory = $false, ParameterSetName = "DeploySet")]
    [Parameter(Mandatory = $false, ParameterSetName = "UpdateSet")]
    [Alias("Volume", "VolumeName")]
    [string]$DataVolumeName = "n8n_data",

    [Parameter(Mandatory = $false, ParameterSetName = "DeploySet")]
    [Parameter(Mandatory = $false, ParameterSetName = "UpdateSet")]
    [Parameter(Mandatory = $false, ParameterSetName = "StatusSet")]
    [ValidateRange(1, 65535)]
    [Alias("p", "HostPort")]
    [int]$Port = 5678,

    [Parameter(Mandatory = $false, ParameterSetName = "DeploySet")]
    [Parameter(Mandatory = $false, ParameterSetName = "UpdateSet")]
    [Alias("tz")]
    [string]$Timezone = "Europe/Warsaw",

    [Parameter(Mandatory = $false, ParameterSetName = "DeploySet")]
    [Parameter(Mandatory = $false, ParameterSetName = "UpdateSet")]
    [Alias("Tag", "Version")]
    [string]$ImageTag = "latest",

    [Parameter(Mandatory = $false, ParameterSetName = "DeploySet")]
    [Parameter(Mandatory = $false, ParameterSetName = "UpdateSet")]
    [string]$SandboxVersion = "1.8.1",

    [Parameter(Mandatory = $false, ParameterSetName = "DeploySet")]
    [Parameter(Mandatory = $false, ParameterSetName = "UpdateSet")]
    [switch]$SkipSandbox,

    [Parameter(Mandatory = $false, ParameterSetName = "DeploySet")]
    [switch]$Interactive,

    [Parameter(Mandatory = $false, ParameterSetName = "DeploySet")]
    [switch]$SkipWslUpdate,

    [Parameter(Mandatory = $false, ParameterSetName = "DeploySet")]
    [switch]$SkipDockerInstall,

    [Parameter(Mandatory = $false, ParameterSetName = "UpdateSet")]
    [Alias("u", "Upgrade")]
    [switch]$Update,

    [Parameter(Mandatory = $false, ParameterSetName = "DeploySet")]
    [Parameter(Mandatory = $false, ParameterSetName = "UpdateSet")]
    [Alias("WorkflowsPath", "UploadPath", "SyncPath")]
    [string]$ImportWorkflowsPath,

    [Parameter(Mandatory = $false, ParameterSetName = "DeploySet")]
    [Parameter(Mandatory = $false, ParameterSetName = "UpdateSet")]
    [switch]$UsePostgres,

    [Parameter(Mandatory = $false, ParameterSetName = "DeploySet")]
    [Parameter(Mandatory = $false, ParameterSetName = "UpdateSet")]
    [string]$PostgresHost = "localhost",

    [Parameter(Mandatory = $false, ParameterSetName = "DeploySet")]
    [Parameter(Mandatory = $false, ParameterSetName = "UpdateSet")]
    [ValidateRange(1, 65535)]
    [int]$PostgresPort = 5432,

    [Parameter(Mandatory = $false, ParameterSetName = "DeploySet")]
    [Parameter(Mandatory = $false, ParameterSetName = "UpdateSet")]
    [string]$PostgresDatabase = "n8n",

    [Parameter(Mandatory = $false, ParameterSetName = "DeploySet")]
    [Parameter(Mandatory = $false, ParameterSetName = "UpdateSet")]
    [string]$PostgresUser = "postgres",

    [Parameter(Mandatory = $false, ParameterSetName = "DeploySet")]
    [Parameter(Mandatory = $false, ParameterSetName = "UpdateSet")]
    [string]$PostgresPassword,

    [Parameter(Mandatory = $false, ParameterSetName = "DeploySet")]
    [Parameter(Mandatory = $false, ParameterSetName = "UpdateSet")]
    [string]$PostgresSchema = "public",

    [Parameter(Mandatory = $false, ParameterSetName = "StatusSet")]
    [Alias("s", "Info")]
    [switch]$Status,

    [Parameter(Mandatory = $false, ParameterSetName = "DeploySet")]
    [Parameter(Mandatory = $false, ParameterSetName = "UpdateSet")]
    [switch]$OpenBrowser,

    [Parameter(Mandatory = $false)]
    [Alias("l", "Log")]
    [string]$LogPath,

    [Parameter(Mandatory = $false, ParameterSetName = "HelpSet")]
    [Parameter(Mandatory = $false, ParameterSetName = "Default")]
    [Alias("h")]
    [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ==============================================================================
# SCRIPT METADATA & CONFIGURATION CONSTANTS
# ==============================================================================
$SCRIPT_INFO = @{
    Name              = "deploy-n8n-on-windows-docker-desktop"
    FileName          = "deploy-n8n-on-windows-docker-desktop.ps1"
    Version           = "1.3.0"
    Author            = "Roman Pindela"
    Contact           = "roman.pindela@gmail.com"
    GitHub            = "https://github.com/romanpindela"
    ReleaseDate       = "2026-10-17"
    DocsUrl           = "https://docs.n8n.io/deploy/host-n8n/install-options/install-using-docker-compose"
    LegacyDocsUrl     = "https://docs.n8n.io/deploy/host-n8n/install-options/install-with-docker"
    GetN8nUrl         = "https://get.n8n.io"
    FallbackN8nVer    = "2.43.7"
}

$script:ActiveLogFile = $null

# ==============================================================================
# LOGGING & CONSOLE OUTPUT FUNCTIONS
# ==============================================================================
function Initialize-Logging {
    param (
        [string]$CustomLogPath
    )

    if ([string]::IsNullOrWhiteSpace($CustomLogPath)) {
        $defaultLogDir = "C:\Logs"
        $timeMarker    = (Get-Date).ToString("yyyyMMdd_HHmmss")
        $compName      = $env:COMPUTERNAME
        $userName      = $env:USERNAME
        $scriptName    = $SCRIPT_INFO.Name
        # Standard #14 format: C:\Logs\<dataigodzina>-nazwaskryptu-nazwakomputera-uzytkownik.logs
        $logFileName   = "${timeMarker}-${scriptName}-${compName}-${userName}.logs"
        $CustomLogPath = Join-Path -Path $defaultLogDir -ChildPath $logFileName
    }

    $resolvedLogPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($CustomLogPath)
    $logDirectory    = [System.IO.Path]::GetDirectoryName($resolvedLogPath)

    if (-not [string]::IsNullOrWhiteSpace($logDirectory) -and -not [System.IO.Directory]::Exists($logDirectory)) {
        [System.IO.Directory]::CreateDirectory($logDirectory) | Out-Null
    }

    $script:ActiveLogFile = $resolvedLogPath

    $headerBanner = @"
================================================================================
  Log Initialized : $((Get-Date).ToString("yyyy-MM-dd HH:mm:ss"))
  Script          : $($SCRIPT_INFO.FileName) v$($SCRIPT_INFO.Version)
  Author          : $($SCRIPT_INFO.Author) ($($SCRIPT_INFO.Contact))
  GitHub          : $($SCRIPT_INFO.GitHub)
  Host / User     : $($env:COMPUTERNAME) \ $($env:USERNAME)
  OS              : $([System.Environment]::OSVersion.VersionString)
  Log File        : $($script:ActiveLogFile)
================================================================================
"@
    try {
        [System.IO.File]::AppendAllText($script:ActiveLogFile, "$headerBanner`r`n", [System.Text.Encoding]::UTF8)
    }
    catch {
        # Continue execution even if log write fails
    }
}

function Write-Log {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$Message,

        [Parameter(Mandatory = $false)]
        [ValidateSet("INFO", "SUCCESS", "WARN", "ERROR", "STEP", "PARAM")]
        [string]$Level = "INFO",

        [Parameter(Mandatory = $false)]
        [ConsoleColor]$Color = [ConsoleColor]::White,

        [Parameter(Mandatory = $false)]
        [switch]$NoConsole
    )

    $prefix = switch ($Level) {
        "INFO"    { "[*]" }
        "SUCCESS" { "[+]" }
        "WARN"    { "[!]" }
        "ERROR"   { "[X]" }
        "STEP"    { "[>]" }
        "PARAM"   { "   " }
        default   { "[*]" }
    }

    if (-not $PSBoundParameters.ContainsKey("Color")) {
        $Color = switch ($Level) {
            "INFO"    { [ConsoleColor]::Gray }
            "SUCCESS" { [ConsoleColor]::Green }
            "WARN"    { [ConsoleColor]::Yellow }
            "ERROR"   { [ConsoleColor]::Red }
            "STEP"    { [ConsoleColor]::Cyan }
            "PARAM"   { [ConsoleColor]::White }
            default   { [ConsoleColor]::White }
        }
    }

    $formattedConsole = if ([string]::IsNullOrEmpty($Message)) { "" } else { "$prefix $Message" }

    if (-not $NoConsole) {
        try { [Console]::CursorLeft = 0 } catch {}
        Write-Host $formattedConsole -ForegroundColor $Color
    }

    if (-not [string]::IsNullOrWhiteSpace($script:ActiveLogFile)) {
        try {
            $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
            $logLine   = "[$timestamp] [$Level] $Message`r`n"
            [System.IO.File]::AppendAllText($script:ActiveLogFile, $logLine, [System.Text.Encoding]::UTF8)
        }
        catch {
            # Do not interrupt workflow on file lock
        }
    }
}

# ==============================================================================
# HELP & DOCUMENTATION GUIDE (-Help / -h)
# ==============================================================================
function Show-HelpGuide {
    try { [Console]::CursorLeft = 0 } catch {}
    $helpText = @"
================================================================================
  $($SCRIPT_INFO.FileName) - v$($SCRIPT_INFO.Version) ($($SCRIPT_INFO.ReleaseDate))
  Author : $($SCRIPT_INFO.Author)
  Contact: $($SCRIPT_INFO.Contact)
  GitHub : $($SCRIPT_INFO.GitHub)
================================================================================

DESCRIPTION:
  Automated deployment tool that installs/updates the WSL2 environment
  (wsl.exe --update), downloads and installs Docker Desktop via WinGet into a
  custom directory (default: c:\DANE\rpindela\SSD\Docker\), and deploys a
  self-hosted n8n workflow automation platform in Docker with the complete
  official n8n Sandbox Stack (Docker Compose v2):
    - n8n              : Main workflow editor (http://localhost:5678)
    - sandbox-certs    : Mutual TLS (mTLS) certificate bootstrapper
    - sandbox-api      : Control-plane API for n8n AI Assistant sandbox
    - sandbox-runner-1 : Privileged Docker-in-Docker isolated sandbox runner
    - runners          : External Task Runners for JS/Python Code nodes
    - searxng          : Bundled web search engine for n8n AI Assistant

  References:
    * $($SCRIPT_INFO.DocsUrl)
    * $($SCRIPT_INFO.GetN8nUrl)

  During startup, WSL2 update, download, installation, image pulls, and file
  transfers, the script outputs detailed configuration parameters and real-time
  multi-stage progress bars (Write-Progress) and logs every operation to C:\Logs.

UNBLOCKING THE SCRIPT (REQUIRED AFTER DOWNLOADING FROM GITHUB):
  Unblock-File -Path .\deploy-n8n-on-windows-docker-desktop.ps1
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

SYNTAX:
  # 1. Display this help screen (default when run with no parameters):
  .\deploy-n8n-on-windows-docker-desktop.ps1 [-Help | -h]

  # 2. Full automated deployment (WSL2 + Docker Desktop + n8n with Sandbox Stack):
  .\deploy-n8n-on-windows-docker-desktop.ps1 -Deploy [-DockerInstallDir <Path>] [-StackDir <Path>]
                   [-Port <Int>] [-Timezone <String>] [-ImageTag <Tag>] [-SandboxVersion <Ver>]
                   [-DataVolumeName <Name>] [-ContainerName <Name>] [-ImportWorkflowsPath <Path>]
                   [-SkipWslUpdate] [-SkipSandbox] [-OpenBrowser] [-LogPath <Path>]

  # 3. Deploy n8n + Sandbox Stack with external PostgreSQL database:
  .\deploy-n8n-on-windows-docker-desktop.ps1 -Deploy -UsePostgres -PostgresHost <Host> -PostgresDatabase <DB>
                   -PostgresUser <User> -PostgresPassword <Pass> [-PostgresPort 5432]

  # 4. Update existing n8n + Sandbox Stack to latest (or specific) release:
  .\deploy-n8n-on-windows-docker-desktop.ps1 -Update [-ImageTag <Tag>] [-SandboxVersion <Ver>]

  # 5. Check WSL2, Docker & n8n Sandbox Stack status and display tool locations:
  .\deploy-n8n-on-windows-docker-desktop.ps1 -Status

PARAMETERS:
  -Deploy, -Install, -d   : Executes the full installation & deployment workflow
                            (wsl.exe --update + Docker Desktop + n8n Sandbox Stack).
  -DockerInstallDir, -Path: Custom directory for Docker Desktop & WSL2 storage.
                            Default: c:\DANE\rpindela\SSD\Docker\
  -StackDir               : Directory for Docker Compose Sandbox files (compose.yml,
                            .env, searxng-settings.yml).
                            Default: c:\DANE\rpindela\SSD\Docker\n8n-stack
  -ContainerName, -Name   : Docker container name for main n8n instance. Default: n8n
  -DataVolumeName, -Volume: Persistent Docker volume name. Default: n8n_data
  -Port, -p               : Host port mapped to n8n port 5678. Default: 5678
  -Timezone, -tz          : Timezone for GENERIC_TIMEZONE and TZ. Default: Europe/Warsaw
  -ImageTag, -Tag         : n8nio/n8n version tag (latest, stable, 2.43.7).
                            Default: latest (auto-resolves latest stable release)
  -SandboxVersion         : Version tag for ghcr.io/n8n-io/n8n-sandbox-service-*.
                            Default: 1.8.1
  -SkipSandbox            : Deploys standalone single-container n8n without the
                            Docker Compose Sandbox stack.
  -Interactive            : Runs standalone container interactively (-it --rm).
  -SkipWslUpdate          : Skips executing 'wsl.exe --update' during deployment.
  -SkipDockerInstall      : Skips Docker Desktop installation step if already present.
  -ImportWorkflowsPath    : Local file (.json) or folder of workflows to transfer
                            and import into n8n with detailed progress bars.
  -UsePostgres            : Configures PostgreSQL backend via DB_POSTGRESDB_* env vars.
  -Update, -u, -Upgrade   : Pulls updated n8n & sandbox images and recreates stack.
  -Status, -s, -Info      : Shows WSL2/Docker/n8n Sandbox status and usage guide.
  -OpenBrowser            : Opens http://localhost:<Port> after deployment.
  -LogPath, -l, -Log      : Custom log file path. Default:
                            C:\Logs\<DateTime>-deploy-n8n-on-windows-docker-desktop-<Computer>-<User>.logs
  -Help, -h               : Displays this help guide and exits.

EXAMPLES:
  # Example 1: Show help and usage examples
  .\deploy-n8n-on-windows-docker-desktop.ps1 -h

  # Example 2: Standard deployment (wsl.exe --update + Docker Desktop + n8n with Sandbox)
  .\deploy-n8n-on-windows-docker-desktop.ps1 -Deploy

  # Example 3: Deploy with custom port, timezone, and auto-open Web UI
  .\deploy-n8n-on-windows-docker-desktop.ps1 -Deploy -DockerInstallDir "c:\DANE\rpindela\SSD\Docker\" -Port 5678 -Timezone "Europe/Warsaw" -OpenBrowser

  # Example 4: Deploy and upload/import local workflow JSON files with progress bar
  .\deploy-n8n-on-windows-docker-desktop.ps1 -Deploy -ImportWorkflowsPath "C:\Automation\Workflows"

  # Example 5: Update existing n8n + Sandbox stack to the latest stable release
  .\deploy-n8n-on-windows-docker-desktop.ps1 -Update

  # Example 6: Inspect installed tool paths, Sandbox containers, and quick-start commands
  .\deploy-n8n-on-windows-docker-desktop.ps1 -Status
================================================================================
"@
    Write-Host $helpText -ForegroundColor Yellow
}

# ==============================================================================
# INPUT VALIDATION & SECURITY SANITIZATION
# ==============================================================================
function Protect-ScriptInputs {
    [CmdletBinding()]
    param (
        [string]$InstallDir,
        [string]$ComposeStackDir,
        [string]$Container,
        [string]$Volume,
        [string]$Tz,
        [string]$Tag,
        [string]$SandboxVer,
        [string]$WorkflowsPath,
        [string]$CustomLogPath
    )

    # 1. Validate file system paths against shell injection tokens and traversal
    $pathsToCheck = @(
        @{ Label = "DockerInstallDir"; Path = $InstallDir },
        @{ Label = "StackDir"; Path = $ComposeStackDir },
        @{ Label = "ImportWorkflowsPath"; Path = $WorkflowsPath },
        @{ Label = "LogPath"; Path = $CustomLogPath }
    )

    foreach ($item in $pathsToCheck) {
        if (-not [string]::IsNullOrWhiteSpace($item.Path)) {
            if ($item.Path -match '[`$;&|><*?"\r\n]') {
                throw "Security Alert: Invalid or potentially dangerous characters detected in $($item.Label): '$($item.Path)'."
            }
            if ($item.Path -match '\.\.[\\/]') {
                throw "Security Alert: Path traversal sequence ('..') is not allowed in $($item.Label): '$($item.Path)'."
            }
            if ($item.Path.Length -gt 260) {
                throw "Validation Error: $($item.Label) exceeds maximum path length of 260 characters."
            }
        }
    }

    # 2. Validate Docker identifiers (ContainerName & DataVolumeName)
    if ($Container -notmatch '^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}$') {
        throw "Validation Error: ContainerName '$Container' is invalid. Use only alphanumeric characters, dots, underscores, or hyphens."
    }

    if ($Volume -notmatch '^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}$') {
        throw "Validation Error: DataVolumeName '$Volume' is invalid. Use only alphanumeric characters, dots, underscores, or hyphens."
    }

    # 3. Validate Timezone string (IANA format e.g. Europe/Warsaw or UTC)
    if ($Tz -notmatch '^[a-zA-Z0-9_+\-/]{2,64}$') {
        throw "Validation Error: Timezone '$Tz' contains invalid characters. Expected IANA format (e.g., 'Europe/Warsaw' or 'UTC')."
    }

    # 4. Validate Docker Image Tags
    if ($Tag -notmatch '^[a-zA-Z0-9_.-]{1,128}$') {
        throw "Validation Error: ImageTag '$Tag' contains invalid characters."
    }

    if ($SandboxVer -notmatch '^[a-zA-Z0-9_.-]{1,128}$') {
        throw "Validation Error: SandboxVersion '$SandboxVer' contains invalid characters."
    }
}

# ==============================================================================
# ZERO-PARAMETER & HELP CHECK (BEFORE UAC ELEVATION)
# ==============================================================================
if ($Help -or $PSBoundParameters.Count -eq 0) {
    Show-HelpGuide
    exit 0
}

# Normalize DockerInstallDir and default StackDir
$DockerInstallDirClean = $DockerInstallDir.TrimEnd('\', '/')
if ($DockerInstallDirClean -match '^[a-zA-Z]:$') {
    $DockerInstallDirClean = "$DockerInstallDirClean\"
}

if ([string]::IsNullOrWhiteSpace($StackDir)) {
    $StackDir = Join-Path -Path $DockerInstallDirClean -ChildPath "n8n-stack"
}
$StackDirClean = $StackDir.TrimEnd('\', '/')

# Validate all user inputs before elevating or executing commands
try {
    Protect-ScriptInputs `
        -InstallDir $DockerInstallDir `
        -ComposeStackDir $StackDirClean `
        -Container $ContainerName `
        -Volume $DataVolumeName `
        -Tz $Timezone `
        -Tag $ImageTag `
        -SandboxVer $SandboxVersion `
        -WorkflowsPath $ImportWorkflowsPath `
        -CustomLogPath $LogPath
}
catch {
    Write-Host "[X] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "[!] Run '.\deploy-n8n-on-windows-docker-desktop.ps1 -h' for valid syntax and usage examples." -ForegroundColor Yellow
    exit 1
}

# If user provided parameters like -DockerInstallDir or -Port without explicitly specifying -Deploy, -Update, or -Status, default to Deploy mode
if (-not $Deploy -and -not $Update -and -not $Status) {
    $Deploy = $true
}

# ==============================================================================
# ADMINISTRATOR PRIVILEGE CHECK & AUTO-ELEVATION (LANGUAGE-INDEPENDENT SID)
# ==============================================================================
# Check if the script is already running with Administrator privileges using SID (language-independent)
$identity  = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
$adminSid  = New-Object Security.Principal.SecurityIdentifier([Security.Principal.WellKnownSidType]::BuiltInAdministratorsSid, $null)

$isAdmin = $principal.IsInRole($adminSid)

if (-not $isAdmin) {
    # Build argument list preserving all original bound parameters
    $forwardedArgs = New-Object System.Collections.Generic.List[string]
    $forwardedArgs.Add("-NoProfile")
    $forwardedArgs.Add("-ExecutionPolicy")
    $forwardedArgs.Add("Bypass")
    $forwardedArgs.Add("-File")
    $forwardedArgs.Add("`"$PSCommandPath`"")

    foreach ($kvp in $PSBoundParameters.GetEnumerator()) {
        if ($kvp.Value -is [switch]) {
            if ($kvp.Value.IsPresent) {
                $forwardedArgs.Add("-$($kvp.Key)")
            }
        }
        else {
            $escapedVal = $kvp.Value.ToString().Replace('"', '\"')
            $forwardedArgs.Add("-$($kvp.Key)")
            $forwardedArgs.Add("`"$escapedVal`"")
        }
    }

    # If not running as Admin, prompt for UAC consent and relaunch the script with elevated privileges
    Write-Host "Missing Administrator privileges. Requesting elevation..." -ForegroundColor Yellow
    Start-Process powershell.exe -ArgumentList ($forwardedArgs -join " ") -Verb RunAs
    Exit
}

# ==============================================================================
# HELPER FUNCTIONS FOR WSL2, DOCKER, SANDBOX STACK & N8N DEPLOYMENT
# ==============================================================================
function New-CryptoHexSecret {
    <#
      Generates a cryptographically random 48-character hex secret (24 bytes),
      equivalent to 'openssl rand -hex 24' in https://get.n8n.io.
    #>
    param (
        [int]$ByteLength = 24
    )
    $bytes = New-Object byte[] $ByteLength
    $rng   = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($bytes)
    }
    finally {
        if ($null -ne $rng) { $rng.Dispose() }
    }
    return ([System.BitConverter]::ToString($bytes).Replace("-", "").ToLowerInvariant())
}

function Resolve-N8nReleaseVersion {
    <#
      Resolves the latest stable n8n version from GitHub Releases API when
      -ImageTag is 'latest' or 'stable', matching https://get.n8n.io behavior
      so that docker.io/n8nio/n8n and ghcr.io/n8n-io/runners use identical versions.
    #>
    param (
        [string]$RequestedTag
    )

    if ($RequestedTag -match '^[0-9]+\.[0-9]+\.[0-9]+') {
        return $RequestedTag
    }

    if ($RequestedTag -notin @("latest", "stable")) {
        return $RequestedTag
    }

    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/n8n-io/n8n/releases/latest" -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop
        if ($null -ne $rel -and $rel.tag_name -match 'n8n@([0-9]+\.[0-9]+\.[0-9]+)') {
            return $Matches[1]
        }
    }
    catch {
        Write-Log -Level "INFO" -Message "Could not query GitHub releases API ($($_.Exception.Message)). Using fallback version $($SCRIPT_INFO.FallbackN8nVer)."
    }

    return $SCRIPT_INFO.FallbackN8nVer
}

function Write-Utf8LfFile {
    <#
      Writes a file with UTF-8 (no BOM) encoding and Unix LF (\n) line endings
      so Linux containers (sandbox-certs, searxng, n8n) parse files cleanly.
    #>
    param (
        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [Parameter(Mandatory = $true)]
        [string]$Content
    )

    $lfContent   = $Content -replace "`r`n", "`n"
    $utf8NoBom   = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($FilePath, $lfContent, $utf8NoBom)
}

function Show-ExecutionParameters {
    param (
        [string]$ActionMode
    )

    $wslDataRoot        = Join-Path -Path $DockerInstallDirClean -ChildPath "wsl"
    $winContainersRoot  = Join-Path -Path $DockerInstallDirClean -ChildPath "windows-containers"
    $installerCachePath = Join-Path -Path $DockerInstallDirClean -ChildPath "installer"
    $wslUpdateAction    = if ($SkipWslUpdate) { "Skipped (-SkipWslUpdate)" } else { "Enabled (wsl.exe --update & default version 2)" }
    $sandboxArchitecture = if ($SkipSandbox) { "Disabled (-SkipSandbox: Standalone single container)" } else { "Enabled (Docker Compose: n8n + sandbox-certs + sandbox-api + sandbox-runner-1 + runners + searxng)" }
    $dbBackend          = if ($UsePostgres) { "PostgreSQL ($PostgresHost`:$PostgresPort/$PostgresDatabase)" } else { "SQLite (Default in /home/node/.n8n)" }
    $executionMode      = if ($SkipSandbox -and $Interactive) { "Interactive Foreground (-it --rm)" } elseif ($SkipSandbox) { "Detached Daemon (-d --restart unless-stopped)" } else { "Docker Compose v2 Stack (docker compose up -d)" }

    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host "  $($SCRIPT_INFO.Name) v$($SCRIPT_INFO.Version) - Detailed Execution Parameters" -ForegroundColor Cyan
    Write-Host "  Author: $($SCRIPT_INFO.Author) | Contact: $($SCRIPT_INFO.Contact)" -ForegroundColor Cyan
    Write-Host "================================================================================" -ForegroundColor Cyan

    Write-Log -Level "PARAM" -Message ("  Operation Mode            : {0}" -f $ActionMode) -Color White
    Write-Log -Level "PARAM" -Message ("  WSL2 Environment Setup    : {0}" -f $wslUpdateAction) -Color White
    Write-Log -Level "PARAM" -Message ("  Docker Install Directory  : {0}" -f $DockerInstallDirClean) -Color White
    Write-Log -Level "PARAM" -Message ("  WSL2 Data Root Path       : {0}" -f $wslDataRoot) -Color White
    Write-Log -Level "PARAM" -Message ("  Win Containers Data Root  : {0}" -f $winContainersRoot) -Color White
    Write-Log -Level "PARAM" -Message ("  Installer Staging Folder  : {0}" -f $installerCachePath) -Color White
    Write-Log -Level "PARAM" -Message ("  n8n Sandbox Architecture  : {0}" -f $sandboxArchitecture) -Color White
    if (-not $SkipSandbox) {
        Write-Log -Level "PARAM" -Message ("  Sandbox Stack Directory   : {0}" -f $StackDirClean) -Color White
        Write-Log -Level "PARAM" -Message ("  Sandbox Service Version   : ghcr.io/n8n-io/n8n-sandbox-service-*:{0}" -f $SandboxVersion) -Color White
    }
    Write-Log -Level "PARAM" -Message ("  n8n Image Tag / Version   : n8nio/n8n:{0}" -f $ImageTag) -Color White
    Write-Log -Level "PARAM" -Message ("  n8n Container Name        : {0}" -f $ContainerName) -Color White
    Write-Log -Level "PARAM" -Message ("  n8n Persistent Volume     : {0} -> /home/node/.n8n" -f $DataVolumeName) -Color White
    Write-Log -Level "PARAM" -Message ("  n8n Host Port Mapping     : http://localhost:{0} -> 5678/tcp" -f $Port) -Color White
    Write-Log -Level "PARAM" -Message ("  n8n Timezone (TZ)         : {0}" -f $Timezone) -Color White
    Write-Log -Level "PARAM" -Message ("  n8n File Permissions Enf. : N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true") -Color White
    Write-Log -Level "PARAM" -Message ("  n8n Database Backend      : {0}" -f $dbBackend) -Color White
    Write-Log -Level "PARAM" -Message ("  Container Run Mode        : {0}" -f $executionMode) -Color White
    if (-not [string]::IsNullOrWhiteSpace($ImportWorkflowsPath)) {
        Write-Log -Level "PARAM" -Message ("  Workflows Upload Path     : {0}" -f $ImportWorkflowsPath) -Color White
    }
    Write-Log -Level "PARAM" -Message ("  Active Log File           : {0}" -f $script:ActiveLogFile) -Color Green
    Write-Host "================================================================================" -ForegroundColor Cyan
}

function Initialize-WslEnvironment {
    <#
      Installs and updates the WSL2 environment required for Docker Desktop and n8n:
      1. Verifies/enables Windows Subsystem for Linux & Virtual Machine Platform features.
      2. Executes 'wsl.exe --update' with a live Write-Progress bar.
      3. Sets WSL 2 as the default architecture via 'wsl.exe --set-default-version 2'.
    #>
    [CmdletBinding()]
    param ()

    $wslExe = Join-Path -Path $env:SystemRoot -ChildPath "System32\wsl.exe"
    if (-not [System.IO.File]::Exists($wslExe)) {
        $wslCmd = Get-Command "wsl.exe" -ErrorAction SilentlyContinue
        if ($null -ne $wslCmd) {
            $wslExe = $wslCmd.Source
        }
        else {
            throw "wsl.exe was not found on this Windows installation. Ensure Windows 10/11 or Windows Server 2022+ is used."
        }
    }

    Write-Log -Level "STEP" -Message "Checking and provisioning WSL2 environment for Docker & n8n ($wslExe)..."
    Write-Progress -Id 9 -ParentId 1 -Activity "Provisioning WSL2 Environment" `
        -Status "[1/3] Checking Windows Subsystem for Linux & Virtual Machine Platform features..." -PercentComplete 15

    # Ensure required Windows optional features for WSL2 are enabled (language-independent via /english and Unicode regex)
    $requiredFeatures = @("Microsoft-Windows-Subsystem-Linux", "VirtualMachinePlatform")
    foreach ($feat in $requiredFeatures) {
        try {
            $dismOut  = & dism.exe /online /english /get-featureinfo /featurename:$feat 2>&1
            $dismText = ($dismOut -join "`n")
            if ($dismText -notmatch '(State\s*:\s*Enabled|Stan\s*:\s*W[\u0142l][\u0105a]czon)') {
                Write-Log -Level "INFO" -Message "Enabling required Windows feature '$feat' via DISM..."
                $null = & dism.exe /online /english /enable-feature /featurename:$feat /all /norestart 2>&1
                Write-Log -Level "SUCCESS" -Message "Enabled Windows feature: $feat"
            }
            else {
                Write-Log -Level "INFO" -Message "Windows feature '$feat' is already enabled."
            }
        }
        catch {
            Write-Log -Level "WARN" -Message "Could not query Windows feature '$feat': $($_.Exception.Message)"
        }
    }

    # Execute wsl.exe --update with progress tracking
    Write-Log -Level "STEP" -Message "Executing 'wsl.exe --update' to install/update the WSL2 Linux kernel..."
    Write-Progress -Id 9 -ParentId 1 -Activity "Provisioning WSL2 Environment" `
        -Status "[2/3] Running 'wsl.exe --update' (downloading & installing latest WSL2 package)..." -PercentComplete 50

    $wslProc = Start-Process -FilePath $wslExe -ArgumentList "--update" -NoNewWindow -PassThru
    $wslStart = Get-Date
    while (-not $wslProc.HasExited) {
        Start-Sleep -Seconds 1
        $elapsed = [int]((Get-Date) - $wslStart).TotalSeconds
        $pct     = [math]::Min(50 + [int]($elapsed * 2), 90)
        Write-Progress -Id 9 -ParentId 1 -Activity "Provisioning WSL2 Environment" `
            -Status "[2/3] Running 'wsl.exe --update' (Elapsed: ${elapsed}s)..." -PercentComplete $pct
    }
    $wslProc.WaitForExit()

    if ($wslProc.ExitCode -eq 0 -or $null -eq $wslProc.ExitCode) {
        Write-Log -Level "SUCCESS" -Message "Successfully updated WSL2 environment ('wsl.exe --update' exit code: 0)."
    }
    else {
        Write-Log -Level "WARN" -Message "'wsl.exe --update' finished with exit code $($wslProc.ExitCode). Attempting 'wsl.exe --install --no-distribution'..."
        $installProc = Start-Process -FilePath $wslExe -ArgumentList "--install --no-distribution" -NoNewWindow -Wait -PassThru
        Write-Log -Level "INFO" -Message "'wsl.exe --install --no-distribution' exited with code $($installProc.ExitCode)."
    }

    # Set WSL 2 as default version
    Write-Progress -Id 9 -ParentId 1 -Activity "Provisioning WSL2 Environment" `
        -Status "[3/3] Setting default WSL version to 2 ('wsl.exe --set-default-version 2')..." -PercentComplete 95
    Write-Log -Level "STEP" -Message "Executing 'wsl.exe --set-default-version 2'..."

    $ErrorActionPreferenceBackup = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $null = & $wslExe --set-default-version 2 2>&1
    $setVerExit = $LASTEXITCODE
    $ErrorActionPreference = $ErrorActionPreferenceBackup

    if ($setVerExit -eq 0) {
        Write-Log -Level "SUCCESS" -Message "Configured WSL 2 as the default WSL architecture."
    }
    else {
        Write-Log -Level "INFO" -Message "'wsl.exe --set-default-version 2' returned code $setVerExit."
    }

    Write-Progress -Id 9 -ParentId 1 -Activity "Provisioning WSL2 Environment" -Completed
}

function Resolve-DockerPaths {
    $customDockerExe  = Join-Path -Path $DockerInstallDirClean -ChildPath "resources\bin\docker.exe"
    $customDesktopExe = Join-Path -Path $DockerInstallDirClean -ChildPath "Docker Desktop.exe"
    $defaultDockerExe = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
    $defaultDesktop   = "C:\Program Files\Docker\Docker\Docker Desktop.exe"

    $dockerCli = $null
    if ([System.IO.File]::Exists($customDockerExe)) {
        $dockerCli = $customDockerExe
    }
    elseif ([System.IO.File]::Exists($defaultDockerExe)) {
        $dockerCli = $defaultDockerExe
    }
    else {
        $cmd = Get-Command "docker.exe" -ErrorAction SilentlyContinue
        if ($null -ne $cmd) {
            $dockerCli = $cmd.Source
        }
    }

    $dockerDesktopGui = $null
    if ([System.IO.File]::Exists($customDesktopExe)) {
        $dockerDesktopGui = $customDesktopExe
    }
    elseif ([System.IO.File]::Exists($defaultDesktop)) {
        $dockerDesktopGui = $defaultDesktop
    }

    return [PSCustomObject]@{
        DockerCli        = $dockerCli
        DockerDesktopGui = $dockerDesktopGui
        CustomInstallDir = $DockerInstallDirClean
        WslDataRoot      = (Join-Path -Path $DockerInstallDirClean -ChildPath "wsl")
        WinDataRoot      = (Join-Path -Path $DockerInstallDirClean -ChildPath "windows-containers")
        InstallerDir     = (Join-Path -Path $DockerInstallDirClean -ChildPath "installer")
        StackDir         = $StackDirClean
        ComposeFile      = (Join-Path -Path $StackDirClean -ChildPath "compose.yml")
        EnvFile          = (Join-Path -Path $StackDirClean -ChildPath ".env")
        SearxngFile      = (Join-Path -Path $StackDirClean -ChildPath "searxng-settings.yml")
    }
}

function Add-UserToDockerGroup {
    <#
      Ensures the current user belongs to the local 'docker-users' group.
      Works identically on Polish and English Windows editions.
    #>
    try {
        $groupName = "docker-users"
        $groupObj  = Get-LocalGroup -Name $groupName -ErrorAction SilentlyContinue
        if ($null -ne $groupObj) {
            $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
            $members     = Get-LocalGroupMember -Group $groupName -ErrorAction SilentlyContinue
            $isMember    = $false
            if ($null -ne $members) {
                foreach ($m in $members) {
                    if ($m.Name -eq $currentUser -or $m.SID.Value -eq [Security.Principal.WindowsIdentity]::GetCurrent().User.Value) {
                        $isMember = $true
                        break
                    }
                }
            }
            if (-not $isMember) {
                Add-LocalGroupMember -Group $groupName -Member ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value) -ErrorAction SilentlyContinue
                Write-Log -Level "SUCCESS" -Message "Added user '$currentUser' to local '$groupName' security group."
            }
            else {
                Write-Log -Level "INFO" -Message "User '$currentUser' is already a member of '$groupName'."
            }
        }
    }
    catch {
        Write-Log -Level "WARN" -Message "Could not verify/update 'docker-users' group membership: $($_.Exception.Message)"
    }
}

function Install-DockerDesktopCustom {
    [CmdletBinding()]
    param ()

    $paths = Resolve-DockerPaths

    # Create target directories on SSD
    $dirsToCreate = @(
        $paths.CustomInstallDir,
        $paths.WslDataRoot,
        $paths.WinDataRoot,
        $paths.InstallerDir,
        $paths.StackDir
    )

    Write-Log -Level "STEP" -Message "Preparing Docker & n8n Sandbox directories in '$($paths.CustomInstallDir)'..."
    $dirIdx = 0
    foreach ($dir in $dirsToCreate) {
        $dirIdx++
        $pct = [int](($dirIdx / $dirsToCreate.Count) * 100)
        Write-Progress -Id 10 -ParentId 1 -Activity "Preparing Target Directories" -Status "Directory [$dirIdx/$($dirsToCreate.Count)]: $dir" -PercentComplete $pct
        if (-not [System.IO.Directory]::Exists($dir)) {
            [System.IO.Directory]::CreateDirectory($dir) | Out-Null
            Write-Log -Level "SUCCESS" -Message "Created directory: $dir"
        }
        else {
            Write-Log -Level "INFO" -Message "Directory already exists: $dir"
        }
    }
    Write-Progress -Id 10 -ParentId 1 -Activity "Preparing Target Directories" -Completed

    # Check if Docker Desktop is already installed
    if (-not [string]::IsNullOrWhiteSpace($paths.DockerCli) -and [System.IO.File]::Exists($paths.DockerCli)) {
        Write-Log -Level "SUCCESS" -Message "Docker CLI detected at: $($paths.DockerCli)"
        return $paths
    }

    # Verify winget availability
    $wingetCmd = Get-Command "winget.exe" -ErrorAction SilentlyContinue
    if ($null -eq $wingetCmd) {
        throw "WinGet (Windows Package Manager) was not found on this system. Please install App Installer / WinGet first."
    }

    $installFlags = "install --quiet --accept-license --always-run-service --installation-dir=`"$($paths.CustomInstallDir)`" --wsl-default-data-root=`"$($paths.WslDataRoot)`" --windows-containers-default-data-root=`"$($paths.WinDataRoot)`""

    Write-Log -Level "STEP" -Message "Downloading Docker Desktop (Docker.DockerDesktop) via WinGet into '$($paths.InstallerDir)'..."
    Write-Log -Level "INFO" -Message "Target Install Location : $($paths.CustomInstallDir)"
    Write-Log -Level "INFO" -Message "Installer Override Flags: $installFlags"

    # Check if installer already exists in staging folder
    $existingInstaller = Get-ChildItem -Path $paths.InstallerDir -Filter "*Docker*Installer*.exe" -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1

    if ($null -eq $existingInstaller) {
        # Attempt 1: Use winget download to stage the installer with live file-size progress monitoring
        Write-Progress -Id 11 -ParentId 1 -Activity "Downloading Docker Desktop via WinGet" -Status "Initializing WinGet download for Docker.DockerDesktop..." -PercentComplete 5

        $wingetDownloadArgs = "download --id Docker.DockerDesktop --exact --download-directory `"$($paths.InstallerDir)`" --accept-package-agreements --accept-source-agreements --disable-interactivity"
        Write-Log -Level "INFO" -Message "Executing: winget $wingetDownloadArgs"

        $dlProc = Start-Process -FilePath $wingetCmd.Source -ArgumentList $wingetDownloadArgs -NoNewWindow -PassThru
        $estimatedTotalBytes = 620MB
        $startTime = Get-Date

        while (-not $dlProc.HasExited) {
            Start-Sleep -Milliseconds 500
            $partialFile = Get-ChildItem -Path $paths.InstallerDir -File -ErrorAction SilentlyContinue | Sort-Object Length -Descending | Select-Object -First 1
            if ($null -ne $partialFile -and $partialFile.Length -gt 0) {
                $currentMB = [math]::Round($partialFile.Length / 1MB, 2)
                $totalMB   = [math]::Round($estimatedTotalBytes / 1MB, 0)
                $elapsed   = [math]::Max(((Get-Date) - $startTime).TotalSeconds, 1)
                $speedMBs  = [math]::Round($currentMB / $elapsed, 2)
                $pct       = [math]::Min([int](($partialFile.Length / $estimatedTotalBytes) * 100), 99)
                Write-Progress -Id 11 -ParentId 1 -Activity "Downloading Docker Desktop via WinGet" `
                    -Status "Transferred: $currentMB MB / ~$totalMB MB ($pct%) | Speed: $speedMBs MB/s | File: $($partialFile.Name)" `
                    -PercentComplete $pct
            }
        }
        Write-Progress -Id 11 -ParentId 1 -Activity "Downloading Docker Desktop via WinGet" -Completed

        $existingInstaller = Get-ChildItem -Path $paths.InstallerDir -Filter "*.exe" -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    }

    if ($null -ne $existingInstaller -and [System.IO.File]::Exists($existingInstaller.FullName)) {
        $sizeMB = [math]::Round($existingInstaller.Length / 1MB, 2)
        Write-Log -Level "SUCCESS" -Message "Docker Desktop installer ready: $($existingInstaller.FullName) ($sizeMB MB)"
        Write-Log -Level "STEP" -Message "Installing Docker Desktop to '$($paths.CustomInstallDir)'..."

        Write-Progress -Id 12 -ParentId 1 -Activity "Installing Docker Desktop" `
            -Status "Running Docker Desktop Installer.exe -> $($paths.CustomInstallDir)" -PercentComplete 35

        $instProc = Start-Process -FilePath $existingInstaller.FullName -ArgumentList $installFlags -PassThru -NoNewWindow
        $instStart = Get-Date
        while (-not $instProc.HasExited) {
            Start-Sleep -Seconds 2
            $elapsedSec = [int]((Get-Date) - $instStart).TotalSeconds
            $progPct    = [math]::Min(35 + [int]($elapsedSec / 3), 95)
            Write-Progress -Id 12 -ParentId 1 -Activity "Installing Docker Desktop" `
                -Status "Unpacking & registering services in $($paths.CustomInstallDir) (Elapsed: ${elapsedSec}s)..." `
                -PercentComplete $progPct
        }
        Write-Progress -Id 12 -ParentId 1 -Activity "Installing Docker Desktop" -Completed

        if ($instProc.ExitCode -ne 0 -and $instProc.ExitCode -ne 3010) {
            Write-Log -Level "WARN" -Message "Installer exited with code $($instProc.ExitCode). Attempting fallback via 'winget install --override'..."
            $wingetInstallArgs = @(
                "install", "--id", "Docker.DockerDesktop", "--exact",
                "--location", "`"$($paths.CustomInstallDir)`"",
                "--override", "`"$installFlags`"",
                "--accept-package-agreements", "--accept-source-agreements"
            ) -join " "
            $wgProc = Start-Process -FilePath $wingetCmd.Source -ArgumentList $wingetInstallArgs -Wait -PassThru -NoNewWindow
            if ($wgProc.ExitCode -ne 0 -and $wgProc.ExitCode -ne 3010) {
                throw "Docker Desktop installation via WinGet failed with exit code $($wgProc.ExitCode)."
            }
        }
    }
    else {
        # Direct winget install with --location and --override
        Write-Log -Level "STEP" -Message "Running direct WinGet installation with custom location override..."
        Write-Progress -Id 12 -ParentId 1 -Activity "Installing Docker Desktop via WinGet" `
            -Status "winget install Docker.DockerDesktop -> $($paths.CustomInstallDir)" -PercentComplete 25

        $wingetInstallArgs = @(
            "install", "--id", "Docker.DockerDesktop", "--exact",
            "--location", "`"$($paths.CustomInstallDir)`"",
            "--override", "`"$installFlags`"",
            "--accept-package-agreements", "--accept-source-agreements"
        ) -join " "
        Write-Log -Level "INFO" -Message "Executing: winget $wingetInstallArgs"

        $wgProc = Start-Process -FilePath $wingetCmd.Source -ArgumentList $wingetInstallArgs -Wait -PassThru -NoNewWindow
        Write-Progress -Id 12 -ParentId 1 -Activity "Installing Docker Desktop via WinGet" -Completed

        if ($wgProc.ExitCode -ne 0 -and $wgProc.ExitCode -ne 3010) {
            throw "WinGet failed to install Docker Desktop (Exit Code: $($wgProc.ExitCode))."
        }
    }

    # Refresh PATH environment variable in current session
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath    = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $customBin   = Join-Path -Path $paths.CustomInstallDir -ChildPath "resources\bin"
    $env:Path    = "$customBin;$machinePath;$userPath"

    # Persist custom Docker CLI path in Machine PATH if not already present
    if ([System.IO.Directory]::Exists($customBin) -and ($machinePath -notlike "*$customBin*")) {
        [System.Environment]::SetEnvironmentVariable("Path", "$machinePath;$customBin", "Machine")
        Write-Log -Level "SUCCESS" -Message "Added '$customBin' to system PATH."
    }

    Add-UserToDockerGroup

    $resolved = Resolve-DockerPaths
    Write-Log -Level "SUCCESS" -Message "Docker Desktop installed successfully at '$($resolved.CustomInstallDir)'."
    return $resolved
}

function Start-DockerEngineAndWait {
    param (
        [PSCustomObject]$DockerPaths,
        [int]$TimeoutSeconds = 180
    )

    $dockerCli = $DockerPaths.DockerCli
    if ([string]::IsNullOrWhiteSpace($dockerCli) -or -not [System.IO.File]::Exists($dockerCli)) {
        throw "Docker CLI executable (docker.exe) could not be found. Verify Docker Desktop installation in '$($DockerPaths.CustomInstallDir)'."
    }

    # Check if Docker daemon is already responsive
    $ErrorActionPreferenceBackup = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $null = & $dockerCli info 2>&1
    $daemonReady = ($LASTEXITCODE -eq 0)
    $ErrorActionPreference = $ErrorActionPreferenceBackup

    if ($daemonReady) {
        Write-Log -Level "SUCCESS" -Message "Docker Engine daemon is active and ready."
        return
    }

    Write-Log -Level "STEP" -Message "Starting Docker Desktop service and Engine daemon..."

    # Ensure com.docker.service is started if registered
    $dockerSvc = Get-Service -Name "com.docker.service" -ErrorAction SilentlyContinue
    if ($null -ne $dockerSvc -and $dockerSvc.Status -ne "Running") {
        try {
            Start-Service -Name "com.docker.service" -ErrorAction SilentlyContinue
            Write-Log -Level "INFO" -Message "Started Windows service 'com.docker.service'."
        }
        catch {}
    }

    # Launch Docker Desktop GUI / Backend process if not running
    if (-not [string]::IsNullOrWhiteSpace($DockerPaths.DockerDesktopGui) -and [System.IO.File]::Exists($DockerPaths.DockerDesktopGui)) {
        $runningDesktop = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
        if ($null -eq $runningDesktop) {
            Write-Log -Level "INFO" -Message "Launching '$($DockerPaths.DockerDesktopGui)'..."
            Start-Process -FilePath $DockerPaths.DockerDesktopGui -WindowStyle Minimized
        }
    }

    $startWait = Get-Date
    while (((Get-Date) - $startWait).TotalSeconds -lt $TimeoutSeconds) {
        $elapsed = [int]((Get-Date) - $startWait).TotalSeconds
        $pct     = [math]::Min([int](($elapsed / $TimeoutSeconds) * 100), 99)
        Write-Progress -Id 13 -ParentId 1 -Activity "Waiting for Docker Engine Daemon" `
            -Status "Polling 'docker info' readiness... (${elapsed}s / ${TimeoutSeconds}s)" `
            -PercentComplete $pct

        $ErrorActionPreferenceBackup = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $null = & $dockerCli info 2>&1
        $isReady = ($LASTEXITCODE -eq 0)
        $ErrorActionPreference = $ErrorActionPreferenceBackup

        if ($isReady) {
            Write-Progress -Id 13 -ParentId 1 -Activity "Waiting for Docker Engine Daemon" -Completed
            Write-Log -Level "SUCCESS" -Message "Docker Engine daemon is online (initialized in ${elapsed}s)."
            return
        }

        Start-Sleep -Seconds 3
    }

    Write-Progress -Id 13 -ParentId 1 -Activity "Waiting for Docker Engine Daemon" -Completed
    throw "Timed out waiting for Docker Engine daemon after ${TimeoutSeconds} seconds. Please verify WSL2 / virtualization is enabled in BIOS and Docker Desktop is running."
}

function Invoke-DockerImagePullWithProgress {
    param (
        [string]$DockerCli,
        [string]$ImageReference,
        [int]$ImageIndex = 1,
        [int]$TotalImages = 1
    )

    $prefixLabel = if ($TotalImages -gt 1) { "[$ImageIndex/$TotalImages] " } else { "" }
    Write-Log -Level "STEP" -Message "${prefixLabel}Pulling Docker image '$ImageReference' from registry..."

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName               = $DockerCli
    $psi.Arguments              = "pull $ImageReference"
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError  = $true
    $psi.UseShellExecute        = $false
    $psi.CreateNoWindow         = $true

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    [void]$proc.Start()

    $layerStates = @{}

    while (-not $proc.StandardOutput.EndOfStream) {
        $line = $proc.StandardOutput.ReadLine()
        if ([string]::IsNullOrWhiteSpace($line)) { continue }

        if ($line -match '^([a-f0-9]{12}):\s+(.+)$') {
            $layerId     = $Matches[1]
            $layerStatus = $Matches[2]
            $layerStates[$layerId] = $layerStatus
        }

        $totalLayers = [math]::Max($layerStates.Count, 1)
        $doneLayers  = @($layerStates.Values | Where-Object { $_ -match 'Pull complete|Already exists' }).Count
        $pct         = [math]::Min([int](($doneLayers / $totalLayers) * 100), 99)

        Write-Progress -Id 14 -ParentId 1 -Activity "${prefixLabel}Pulling Docker Image ($ImageReference)" `
            -Status "Layers completed: [$doneLayers/$totalLayers] ($pct%) | $line" `
            -PercentComplete $pct

        Write-Log -Level "INFO" -Message "  [docker pull] $line"
    }

    $stderr = $proc.StandardError.ReadToEnd()
    $proc.WaitForExit()
    Write-Progress -Id 14 -ParentId 1 -Activity "${prefixLabel}Pulling Docker Image ($ImageReference)" -Completed

    if ($proc.ExitCode -ne 0) {
        throw "Failed to pull Docker image '$ImageReference' (Exit Code: $($proc.ExitCode)). Details: $stderr"
    }

    Write-Log -Level "SUCCESS" -Message "${prefixLabel}Successfully pulled Docker image '$ImageReference'."
}

function Copy-WorkflowsToContainerWithProgress {
    <#
      Uploads/transfers local workflow JSON files (or configuration files) to the
      running n8n container with a detailed per-file progress bar, bytes transferred,
      percentage, and imports them into n8n.
    #>
    param (
        [string]$DockerCli,
        [string]$TargetContainer,
        [string]$SourcePath
    )

    if ([string]::IsNullOrWhiteSpace($SourcePath)) { return }

    $resolvedSource = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($SourcePath)
    if (-not (Test-Path -LiteralPath $resolvedSource)) {
        Write-Log -Level "WARN" -Message "Specified ImportWorkflowsPath does not exist: '$resolvedSource'. Skipping file upload."
        return
    }

    $files = @()
    if ([System.IO.File]::Exists($resolvedSource)) {
        $files = @(Get-Item -LiteralPath $resolvedSource)
    }
    else {
        $files = @(Get-ChildItem -LiteralPath $resolvedSource -Filter "*.json" -File -Recurse)
    }

    if ($files.Count -eq 0) {
        Write-Log -Level "WARN" -Message "No workflow (.json) files found in '$resolvedSource'."
        return
    }

    $totalBytes = ($files | Measure-Object -Property Length -Sum).Sum
    if ($null -eq $totalBytes -or $totalBytes -le 0) { $totalBytes = 1 }
    $totalKB = [math]::Round($totalBytes / 1KB, 2)

    Write-Log -Level "STEP" -Message "Uploading $($files.Count) workflow file(s) ($totalKB KB total) to container '$TargetContainer'..."

    # Create target staging directory inside container
    $null = & $DockerCli exec $TargetContainer mkdir -p /home/node/.n8n/imported-workflows 2>&1

    $transferredBytes = 0
    $fileIndex = 0

    foreach ($file in $files) {
        $fileIndex++
        $fileKB = [math]::Round($file.Length / 1KB, 2)
        $pct    = [math]::Min([int](($transferredBytes / $totalBytes) * 100), 99)

        Write-Progress -Id 15 -ParentId 1 -Activity "Uploading Files to n8n Container ($TargetContainer)" `
            -Status "File [$fileIndex/$($files.Count)]: $($file.Name) ($fileKB KB) | Total: $pct%" `
            -PercentComplete $pct

        Write-Log -Level "INFO" -Message ("  -> Sending file [{0}/{1}]: {2} ({3} KB) -> {4}:/home/node/.n8n/imported-workflows/{2}" -f $fileIndex, $files.Count, $file.Name, $fileKB, $TargetContainer)

        $destSpec = "${TargetContainer}:/home/node/.n8n/imported-workflows/$($file.Name)"
        $cpOut    = & $DockerCli cp "$($file.FullName)" $destSpec 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Log -Level "WARN" -Message "Failed to upload '$($file.Name)': $cpOut"
        }
        else {
            $transferredBytes += $file.Length
            $donePct = [math]::Min([int](($transferredBytes / $totalBytes) * 100), 100)
            Write-Progress -Id 15 -ParentId 1 -Activity "Uploading Files to n8n Container ($TargetContainer)" `
                -Status "Completed [$fileIndex/$($files.Count)]: $($file.Name) ($donePct%)" `
                -PercentComplete $donePct

            # Import workflow via n8n CLI inside the container
            Write-Log -Level "INFO" -Message "     Importing workflow '$($file.Name)' via n8n CLI..."
            $importOut = & $DockerCli exec -u node $TargetContainer n8n import:workflow --input="/home/node/.n8n/imported-workflows/$($file.Name)" 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Log -Level "SUCCESS" -Message "     Successfully imported workflow: $($file.Name)"
            }
            else {
                Write-Log -Level "WARN" -Message "     File staged in container; n8n CLI import note: $importOut"
            }
        }
    }

    Write-Progress -Id 15 -ParentId 1 -Activity "Uploading Files to n8n Container ($TargetContainer)" -Completed
    Write-Log -Level "SUCCESS" -Message "Finished transferring $($files.Count) file(s) ($totalKB KB) to container '$TargetContainer'."
}

function Initialize-N8nSandboxStackFiles {
    <#
      Generates the official n8n Docker Compose Sandbox Stack files inside $DockerPaths.StackDir:
      1. searxng-settings.yml (enables JSON API for n8n Assistant web search)
      2. .env (preserves existing secrets on re-runs/upgrades, sets versions, timezone, port, DB)
      3. compose.yml (official 6-service stack: sandbox-certs, sandbox-api, sandbox-runner-1,
         n8n, runners, searxng, bound to the persistent $DataVolumeName volume)
    #>
    param (
        [PSCustomObject]$DockerPaths,
        [string]$ResolvedN8nVersion
    )

    if (-not [System.IO.Directory]::Exists($DockerPaths.StackDir)) {
        [System.IO.Directory]::CreateDirectory($DockerPaths.StackDir) | Out-Null
        Write-Log -Level "SUCCESS" -Message "Created Sandbox stack directory: $($DockerPaths.StackDir)"
    }

    # 1. Write searxng-settings.yml
    $searxngYaml = @"
# Generated by $($SCRIPT_INFO.FileName) v$($SCRIPT_INFO.Version).
# SearXNG configuration for the n8n AI Assistant (enables JSON API).
use_default_settings: true
search:
  formats:
    - html
    - json
"@
    Write-Utf8LfFile -FilePath $DockerPaths.SearxngFile -Content $searxngYaml
    Write-Log -Level "SUCCESS" -Message "Created SearXNG configuration: $($DockerPaths.SearxngFile)"

    # 2. Read existing .env secrets if present so re-runs / upgrades preserve tokens & user AI keys
    $existingEnv = @{}
    if ([System.IO.File]::Exists($DockerPaths.EnvFile)) {
        $lines = [System.IO.File]::ReadAllLines($DockerPaths.EnvFile, [System.Text.Encoding]::UTF8)
        foreach ($line in $lines) {
            if ($line -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$') {
                $existingEnv[$Matches[1]] = $Matches[2]
            }
        }
        Write-Log -Level "INFO" -Message "Preserving existing secrets from '$($DockerPaths.EnvFile)'."
    }

    $runnersToken      = if ($existingEnv.ContainsKey("N8N_RUNNERS_AUTH_TOKEN") -and -not [string]::IsNullOrWhiteSpace($existingEnv["N8N_RUNNERS_AUTH_TOKEN"])) { $existingEnv["N8N_RUNNERS_AUTH_TOKEN"] } else { New-CryptoHexSecret }
    $searxngSecret     = if ($existingEnv.ContainsKey("SEARXNG_SECRET") -and -not [string]::IsNullOrWhiteSpace($existingEnv["SEARXNG_SECRET"])) { $existingEnv["SEARXNG_SECRET"] } else { New-CryptoHexSecret }
    $sandboxApiKey     = if ($existingEnv.ContainsKey("SANDBOX_API_KEYS") -and -not [string]::IsNullOrWhiteSpace($existingEnv["SANDBOX_API_KEYS"])) { $existingEnv["SANDBOX_API_KEYS"] } else { New-CryptoHexSecret }
    $registrationToken = if ($existingEnv.ContainsKey("SANDBOX_API_RUNNER_REGISTRATION_TOKEN") -and -not [string]::IsNullOrWhiteSpace($existingEnv["SANDBOX_API_RUNNER_REGISTRATION_TOKEN"])) { $existingEnv["SANDBOX_API_RUNNER_REGISTRATION_TOKEN"] } else { New-CryptoHexSecret }
    $runnerKey         = if ($existingEnv.ContainsKey("SANDBOX_API_RUNNER_API_KEY") -and -not [string]::IsNullOrWhiteSpace($existingEnv["SANDBOX_API_RUNNER_API_KEY"])) { $existingEnv["SANDBOX_API_RUNNER_API_KEY"] } else { New-CryptoHexSecret }
    $braveApiKey       = if ($existingEnv.ContainsKey("INSTANCE_AI_BRAVE_SEARCH_API_KEY")) { $existingEnv["INSTANCE_AI_BRAVE_SEARCH_API_KEY"] } else { "" }

    $postgresBlock = ""
    if ($UsePostgres) {
        $postgresBlock = @"

# PostgreSQL Database Configuration
DB_TYPE=postgresdb
DB_POSTGRESDB_DATABASE=$PostgresDatabase
DB_POSTGRESDB_HOST=$PostgresHost
DB_POSTGRESDB_PORT=$PostgresPort
DB_POSTGRESDB_USER=$PostgresUser
DB_POSTGRESDB_SCHEMA=$PostgresSchema
DB_POSTGRESDB_PASSWORD=$PostgresPassword
"@
    }

    $envContent = @"
# Generated by $($SCRIPT_INFO.FileName) v$($SCRIPT_INFO.Version)
# Official n8n + Sandbox Service Stack Configuration (https://get.n8n.io)

# Versions & Host Binding
N8N_VERSION=$ResolvedN8nVersion
N8N_SANDBOX_VERSION=$SandboxVersion
N8N_PORT=$Port
N8N_CONTAINER_NAME=$ContainerName
N8N_DATA_VOLUME=$DataVolumeName

# Timezone & Security Permissions
GENERIC_TIMEZONE=$Timezone
TZ=$Timezone
N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true

# External Task Runners (JS & Python Code Node Isolation)
N8N_RUNNERS_MODE=external
N8N_RUNNERS_BROKER_LISTEN_ADDRESS=0.0.0.0
N8N_RUNNERS_AUTH_TOKEN=$runnersToken

# Web Search for n8n AI Assistant (Bundled SearXNG + Optional Brave Search)
INSTANCE_AI_BRAVE_SEARCH_API_KEY=$braveApiKey
N8N_INSTANCE_AI_SEARXNG_URL=http://searxng:8080
SEARXNG_SECRET=$searxngSecret

# n8n AI Assistant Sandbox Service Configuration
N8N_INSTANCE_AI_SANDBOX_ENABLED=true
N8N_INSTANCE_AI_SANDBOX_PROVIDER=n8n-sandbox
N8N_INSTANCE_AI_SANDBOX_API_URL=http://sandbox-api:8080
N8N_SANDBOX_SERVICE_URL=http://sandbox-api:8080

# Sandbox Mutual Authentication Secrets
SANDBOX_API_KEYS=$sandboxApiKey
N8N_SANDBOX_SERVICE_API_KEY=$sandboxApiKey

SANDBOX_API_RUNNER_REGISTRATION_TOKEN=$registrationToken
SANDBOX_RUNNER_REGISTRATION_TOKEN=$registrationToken

SANDBOX_API_RUNNER_API_KEY=$runnerKey
SANDBOX_RUNNER_API_KEYS=$runnerKey$postgresBlock
"@

    # Preserve any custom N8N_INSTANCE_AI_MODEL* or extra user variables from previous .env
    $managedKeys = @(
        "N8N_VERSION", "N8N_SANDBOX_VERSION", "N8N_PORT", "N8N_CONTAINER_NAME", "N8N_DATA_VOLUME",
        "GENERIC_TIMEZONE", "TZ", "N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS",
        "N8N_RUNNERS_MODE", "N8N_RUNNERS_BROKER_LISTEN_ADDRESS", "N8N_RUNNERS_AUTH_TOKEN",
        "INSTANCE_AI_BRAVE_SEARCH_API_KEY", "N8N_INSTANCE_AI_SEARXNG_URL", "SEARXNG_SECRET",
        "N8N_INSTANCE_AI_SANDBOX_ENABLED", "N8N_INSTANCE_AI_SANDBOX_PROVIDER",
        "N8N_INSTANCE_AI_SANDBOX_API_URL", "N8N_SANDBOX_SERVICE_URL",
        "SANDBOX_API_KEYS", "N8N_SANDBOX_SERVICE_API_KEY",
        "SANDBOX_API_RUNNER_REGISTRATION_TOKEN", "SANDBOX_RUNNER_REGISTRATION_TOKEN",
        "SANDBOX_API_RUNNER_API_KEY", "SANDBOX_RUNNER_API_KEYS",
        "DB_TYPE", "DB_POSTGRESDB_DATABASE", "DB_POSTGRESDB_HOST", "DB_POSTGRESDB_PORT",
        "DB_POSTGRESDB_USER", "DB_POSTGRESDB_SCHEMA", "DB_POSTGRESDB_PASSWORD"
    )
    $extraLines = New-Object System.Collections.Generic.List[string]
    foreach ($kvp in $existingEnv.GetEnumerator()) {
        if ($kvp.Key -notin $managedKeys) {
            $extraLines.Add("$($kvp.Key)=$($kvp.Value)")
        }
    }
    if ($extraLines.Count -gt 0) {
        $envContent += "`n# Preserved Custom Variables`n" + ($extraLines -join "`n") + "`n"
    }

    Write-Utf8LfFile -FilePath $DockerPaths.EnvFile -Content $envContent
    Write-Log -Level "SUCCESS" -Message "Created/updated environment secrets file: $($DockerPaths.EnvFile)"

    # 3. Write compose.yml (based on official https://raw.githubusercontent.com/n8n-io/n8n/master/docker/get-n8n-compose.yml)
    $composeYaml = @"
# n8n + Sandbox Service Stack definition (https://get.n8n.io)
# Generated by $($SCRIPT_INFO.FileName) v$($SCRIPT_INFO.Version)
# compose-version: 2

name: n8n-sandbox-stack

volumes:
  n8n-data:
    name: ${DataVolumeName}
  sandbox-tls:
    name: ${DataVolumeName}_sandbox_tls

services:
  sandbox-certs:
    image: ghcr.io/n8n-io/n8n-sandbox-service-api:`${N8N_SANDBOX_VERSION}
    container_name: ${ContainerName}-sandbox-certs
    user: '0:0'
    entrypoint: ['sh', '-c']
    command:
      - >
        bootstrap-mtls.sh --out-dir /tls --api-san sandbox-api
        --control-san-prefix sandbox-runner --world-readable &&
        chown -R sandbox-api:sandbox-api /tls/api && chmod -R a+rX /tls
    environment:
      NUM_RUNNERS: '1'
    volumes:
      - sandbox-tls:/tls

  sandbox-api:
    image: ghcr.io/n8n-io/n8n-sandbox-service-api:`${N8N_SANDBOX_VERSION}
    container_name: ${ContainerName}-sandbox-api
    restart: unless-stopped
    depends_on:
      sandbox-certs:
        condition: service_completed_successfully
    env_file: .env
    environment:
      SANDBOX_API_GRPC_TLS_CERT_FILE: /tls/api/grpc-server.crt
      SANDBOX_API_GRPC_TLS_KEY_FILE: /tls/api/grpc-server.key
      SANDBOX_API_GRPC_TLS_CLIENT_CA_FILE: /tls/api/ca.crt
      SANDBOX_API_RUNNER_CONTROL_GRPC_TLS_CA_FILE: /tls/api/ca.crt
      SANDBOX_API_RUNNER_CONTROL_GRPC_TLS_CERT_FILE: /tls/api/control-grpc-api-client.crt
      SANDBOX_API_RUNNER_CONTROL_GRPC_TLS_KEY_FILE: /tls/api/control-grpc-api-client.key
      SANDBOX_API_RUNNER_CONTROL_GRPC_TLS_SERVER_NAME: sandbox-runner-1
    volumes:
      - sandbox-tls:/tls:ro
    healthcheck:
      test: ['CMD', 'wget', '-qO-', 'http://localhost:8080/healthz']
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 10s

  sandbox-runner-1:
    image: ghcr.io/n8n-io/n8n-sandbox-service-runner-dind:`${N8N_SANDBOX_VERSION}
    container_name: ${ContainerName}-sandbox-runner-1
    restart: unless-stopped
    privileged: true
    depends_on:
      sandbox-api:
        condition: service_healthy
    env_file: .env
    environment:
      SANDBOX_RUNNER_API_GRPC_ADDR: sandbox-api:9090
      SANDBOX_RUNNER_HTTP_BASE_URL: https://sandbox-runner-1:8080
      SANDBOX_RUNNER_CONTROL_GRPC_LISTEN_ADDR: ':9091'
      SANDBOX_RUNNER_CONTROL_GRPC_ADVERTISE_ADDR: sandbox-runner-1:9091
      SANDBOX_RUNNER_ID: runner-1
      SANDBOX_RUNNER_DOCKER_SANDBOX_IMAGE: ghcr.io/n8n-io/n8n-sandbox-service-sandbox:`${N8N_SANDBOX_VERSION}
      SANDBOX_RUNNER_REGISTRATION_GRPC_CA_FILE: /tls/runner/ca.crt
      SANDBOX_RUNNER_REGISTRATION_GRPC_CERT_FILE: /tls/runner/grpc-client.crt
      SANDBOX_RUNNER_REGISTRATION_GRPC_KEY_FILE: /tls/runner/grpc-client.key
      SANDBOX_RUNNER_REGISTRATION_GRPC_SERVER_NAME: sandbox-api
      SANDBOX_RUNNER_CONTROL_GRPC_TLS_CERT_FILE: /tls/runner/control-grpc-server.crt
      SANDBOX_RUNNER_CONTROL_GRPC_TLS_KEY_FILE: /tls/runner/control-grpc-server.key
      SANDBOX_RUNNER_CONTROL_GRPC_TLS_CLIENT_CA_FILE: /tls/runner/ca.crt
    volumes:
      - sandbox-tls:/tls:ro

  n8n:
    image: docker.io/n8nio/n8n:`${N8N_VERSION}
    container_name: ${ContainerName}
    restart: unless-stopped
    depends_on:
      sandbox-api:
        condition: service_healthy
    ports:
      - '${Port}:5678'
    env_file: .env
    volumes:
      - n8n-data:/home/node/.n8n

  runners:
    image: ghcr.io/n8n-io/runners:`${N8N_VERSION}
    container_name: ${ContainerName}-runners
    restart: unless-stopped
    depends_on:
      - n8n
    environment:
      N8N_RUNNERS_AUTH_TOKEN: `${N8N_RUNNERS_AUTH_TOKEN}
      N8N_RUNNERS_TASK_BROKER_URI: http://n8n:5679
      N8N_RUNNERS_AUTO_SHUTDOWN_TIMEOUT: '15'

  searxng:
    image: ghcr.io/searxng/searxng:latest
    container_name: ${ContainerName}-searxng
    restart: unless-stopped
    environment:
      SEARXNG_SECRET: `${SEARXNG_SECRET}
    volumes:
      - ./searxng-settings.yml:/etc/searxng/settings.yml:ro
"@
    Write-Utf8LfFile -FilePath $DockerPaths.ComposeFile -Content $composeYaml
    Write-Log -Level "SUCCESS" -Message "Created Docker Compose Sandbox stack file: $($DockerPaths.ComposeFile)"
}

function Deploy-N8nSandboxStack {
    <#
      Deploys the complete official n8n + Sandbox Service Docker Compose stack:
      - sandbox-certs
      - sandbox-api
      - sandbox-runner-1 (DinD)
      - n8n
      - runners (Task Runners)
      - searxng
    #>
    param (
        [PSCustomObject]$DockerPaths,
        [switch]$IsUpdateMode
    )

    $dockerCli = $DockerPaths.DockerCli

    # Verify Docker Compose v2 plugin availability
    $ErrorActionPreferenceBackup = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $composeVerOut = & $dockerCli compose version 2>&1
    $composeExit   = $LASTEXITCODE
    $ErrorActionPreference = $ErrorActionPreferenceBackup

    if ($composeExit -ne 0) {
        throw "Docker Compose v2 plugin ('docker compose') is not available: $composeVerOut"
    }
    Write-Log -Level "SUCCESS" -Message "Docker Compose v2 verified: $($composeVerOut | Select-Object -First 1)"

    # Resolve target n8n release version so n8nio/n8n and ghcr.io/n8n-io/runners match
    $resolvedN8nVer = Resolve-N8nReleaseVersion -RequestedTag $ImageTag
    Write-Log -Level "INFO" -Message "Target versions -> n8n: $resolvedN8nVer | Sandbox Service: $SandboxVersion"

    # Step 1: Ensure persistent Docker volumes exist
    Write-Progress -Id 1 -Activity "n8n Docker Sandbox Deployment Pipeline" -Status "[Step 4/8] Creating persistent Docker volumes ('$DataVolumeName' & '${DataVolumeName}_sandbox_tls')..." -PercentComplete 48
    Write-Log -Level "STEP" -Message "Creating persistent Docker volumes '$DataVolumeName' and '${DataVolumeName}_sandbox_tls'..."

    $null = & $dockerCli volume create $DataVolumeName 2>&1
    $null = & $dockerCli volume create "${DataVolumeName}_sandbox_tls" 2>&1
    $volInspect = & $dockerCli volume inspect $DataVolumeName --format "{{.Mountpoint}}" 2>&1
    Write-Log -Level "SUCCESS" -Message "Docker volume '$DataVolumeName' is ready (Mountpoint: $volInspect)."

    # Step 2: Generate compose.yml, .env, and searxng-settings.yml in $DockerPaths.StackDir
    Write-Progress -Id 1 -Activity "n8n Docker Sandbox Deployment Pipeline" -Status "[Step 5/8] Generating Docker Compose Sandbox stack files in '$($DockerPaths.StackDir)'..." -PercentComplete 55
    Write-Log -Level "STEP" -Message "Generating n8n Sandbox stack configuration files in '$($DockerPaths.StackDir)'..."
    Initialize-N8nSandboxStackFiles -DockerPaths $DockerPaths -ResolvedN8nVersion $resolvedN8nVer

    # Step 3: Pull all required Sandbox & n8n images with detailed per-layer progress bars
    Write-Progress -Id 1 -Activity "n8n Docker Sandbox Deployment Pipeline" -Status "[Step 6/8] Pulling n8n & Sandbox Docker images with layer progress..." -PercentComplete 65

    $stackImages = @(
        "ghcr.io/n8n-io/n8n-sandbox-service-api:$SandboxVersion",
        "ghcr.io/n8n-io/n8n-sandbox-service-runner-dind:$SandboxVersion",
        "ghcr.io/n8n-io/n8n-sandbox-service-sandbox:$SandboxVersion",
        "docker.io/n8nio/n8n:$resolvedN8nVer",
        "ghcr.io/n8n-io/runners:$resolvedN8nVer",
        "ghcr.io/searxng/searxng:latest"
    )

    $imgIdx = 0
    foreach ($img in $stackImages) {
        $imgIdx++
        $overallPct = [math]::Min(60 + [int](($imgIdx / $stackImages.Count) * 20), 82)
        Write-Progress -Id 1 -Activity "n8n Docker Sandbox Deployment Pipeline" `
            -Status "[Step 6/8] Pulling stack image [$imgIdx/$($stackImages.Count)]: $img..." -PercentComplete $overallPct
        Invoke-DockerImagePullWithProgress -DockerCli $dockerCli -ImageReference $img -ImageIndex $imgIdx -TotalImages $stackImages.Count
    }

    # Step 4: Remove any standalone container named $ContainerName that is not part of the Compose project
    Write-Progress -Id 1 -Activity "n8n Docker Sandbox Deployment Pipeline" -Status "[Step 7/8] Starting n8n + Sandbox Docker Compose stack..." -PercentComplete 85
    $ErrorActionPreferenceBackup = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $existingStandaloneId = (& $dockerCli ps -a --filter "name=^/${ContainerName}$" --format "{{.ID}}" 2>&1) | Select-Object -First 1
    if (-not [string]::IsNullOrWhiteSpace($existingStandaloneId)) {
        $composeLabel = (& $dockerCli inspect --format "{{ index .Config.Labels `"com.docker.compose.project`" }}" $ContainerName 2>&1) | Select-Object -First 1
        if ([string]::IsNullOrWhiteSpace($composeLabel) -or $composeLabel -ne "n8n-sandbox-stack") {
            Write-Log -Level "INFO" -Message "Stopping and removing standalone container '$ContainerName' ($existingStandaloneId) before starting Sandbox Compose stack (volume '$DataVolumeName' is preserved)..."
            $null = & $dockerCli stop $ContainerName 2>&1
            $null = & $dockerCli rm $ContainerName 2>&1
            Write-Log -Level "SUCCESS" -Message "Transitioned standalone container '$ContainerName' to Docker Compose Sandbox stack."
        }
    }
    $ErrorActionPreference = $ErrorActionPreferenceBackup

    # Step 5: Execute 'docker compose -f compose.yml up -d'
    Write-Log -Level "STEP" -Message "Starting n8n + Sandbox stack via Docker Compose: docker compose -f `"$($DockerPaths.ComposeFile)`" --env-file `"$($DockerPaths.EnvFile)`" up -d --remove-orphans"
    Write-Progress -Id 16 -ParentId 1 -Activity "Starting Docker Compose Sandbox Stack" `
        -Status "Bootstrapping sandbox-certs (mTLS), sandbox-api, sandbox-runner-1, n8n, runners, and searxng..." -PercentComplete 50

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName               = $dockerCli
    $psi.Arguments              = "compose -f `"$($DockerPaths.ComposeFile)`" --env-file `"$($DockerPaths.EnvFile)`" up -d --remove-orphans"
    $psi.WorkingDirectory       = $DockerPaths.StackDir
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError  = $true
    $psi.UseShellExecute        = $false
    $psi.CreateNoWindow         = $true

    $upProc = New-Object System.Diagnostics.Process
    $upProc.StartInfo = $psi
    [void]$upProc.Start()

    $upStart = Get-Date
    while (-not $upProc.HasExited) {
        Start-Sleep -Milliseconds 500
        $elapsed = [int]((Get-Date) - $upStart).TotalSeconds
        $pct     = [math]::Min(50 + ($elapsed * 2), 95)
        Write-Progress -Id 16 -ParentId 1 -Activity "Starting Docker Compose Sandbox Stack" `
            -Status "Waiting for sandbox-certs & sandbox-api healthcheck and container startup (${elapsed}s)..." -PercentComplete $pct
    }
    $upStdOut = $upProc.StandardOutput.ReadToEnd()
    $upStdErr = $upProc.StandardError.ReadToEnd()
    $upProc.WaitForExit()
    Write-Progress -Id 16 -ParentId 1 -Activity "Starting Docker Compose Sandbox Stack" -Completed

    if (-not [string]::IsNullOrWhiteSpace($upStdOut)) {
        foreach ($l in ($upStdOut -split "`r?`n")) {
            if (-not [string]::IsNullOrWhiteSpace($l)) { Write-Log -Level "INFO" -Message "  [compose] $l" }
        }
    }
    if (-not [string]::IsNullOrWhiteSpace($upStdErr)) {
        foreach ($l in ($upStdErr -split "`r?`n")) {
            if (-not [string]::IsNullOrWhiteSpace($l)) { Write-Log -Level "INFO" -Message "  [compose] $l" }
        }
    }

    if ($upProc.ExitCode -ne 0) {
        throw "Docker Compose stack startup failed with exit code $($upProc.ExitCode). Details: $upStdErr"
    }

    Write-Log -Level "SUCCESS" -Message "Started n8n $resolvedN8nVer and Sandbox Services ($SandboxVersion) via Docker Compose."

    # Step 6: Verify n8n HTTP healthz and internal sandbox-api healthz
    Write-Progress -Id 1 -Activity "n8n Docker Sandbox Deployment Pipeline" -Status "[Step 8/8] Verifying n8n & Sandbox API health endpoints..." -PercentComplete 92
    $healthUrl = "http://localhost:$Port/healthz"
    $maxWait   = 120
    $waited    = 0
    $healthy   = $false

    while ($waited -lt $maxWait) {
        $waited += 3
        $hPct = [math]::Min([int](($waited / $maxWait) * 100), 99)
        Write-Progress -Id 17 -ParentId 1 -Activity "Verifying n8n & Sandbox Health" `
            -Status "Polling $healthUrl (${waited}s / ${maxWait}s)..." -PercentComplete $hPct

        try {
            $resp = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
            if ($resp.StatusCode -eq 200) {
                $healthy = $true
                break
            }
        }
        catch {
            Start-Sleep -Seconds 3
        }
    }
    Write-Progress -Id 17 -ParentId 1 -Activity "Verifying n8n & Sandbox Health" -Completed

    if ($healthy) {
        Write-Log -Level "SUCCESS" -Message "n8n Web Editor is online and healthy at http://localhost:$Port"
    }
    else {
        Write-Log -Level "WARN" -Message "n8n stack is running, but HTTP check at $healthUrl is still initializing. Check 'docker compose -f `"$($DockerPaths.ComposeFile)`" logs n8n'."
    }

    # Verify internal sandbox-api connectivity from inside the n8n container
    $ErrorActionPreferenceBackup = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $sandboxHealthOut = (& $dockerCli exec $ContainerName wget -qO- "http://sandbox-api:8080/healthz" 2>&1) | Select-Object -First 1
    $sandboxHealthExit = $LASTEXITCODE
    $ErrorActionPreference = $ErrorActionPreferenceBackup

    if ($sandboxHealthExit -eq 0 -and $sandboxHealthOut -match '"status"\s*:\s*"ok"') {
        Write-Log -Level "SUCCESS" -Message "Sandbox API health verified from inside n8n container (http://sandbox-api:8080/healthz -> $sandboxHealthOut)."
    }
    else {
        Write-Log -Level "INFO" -Message "Sandbox API health check response: $sandboxHealthOut"
    }

    # Step 7: Optional workflow upload with detailed file transfer progress
    if (-not [string]::IsNullOrWhiteSpace($ImportWorkflowsPath)) {
        Copy-WorkflowsToContainerWithProgress -DockerCli $dockerCli -TargetContainer $ContainerName -SourcePath $ImportWorkflowsPath
    }
}

function Deploy-N8nStandaloneContainer {
    <#
      Legacy single-container deployment mode (used only when -SkipSandbox is specified).
    #>
    param (
        [PSCustomObject]$DockerPaths,
        [switch]$IsUpdateMode
    )

    $dockerCli = $DockerPaths.DockerCli
    $imageRef  = "n8nio/n8n:$ImageTag"

    # Step 1: Ensure persistent Docker volume exists (docker volume create n8n_data)
    Write-Progress -Id 1 -Activity "n8n Docker Deployment Pipeline" -Status "[Step 4/7] Creating persistent Docker volume '$DataVolumeName'..." -PercentComplete 55
    Write-Log -Level "STEP" -Message "Creating persistent Docker volume '$DataVolumeName' (docker volume create $DataVolumeName)..."

    $volOut = & $dockerCli volume create $DataVolumeName 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create Docker volume '$DataVolumeName': $volOut"
    }
    $volInspect = & $dockerCli volume inspect $DataVolumeName --format "{{.Mountpoint}}" 2>&1
    Write-Log -Level "SUCCESS" -Message "Docker volume '$DataVolumeName' is ready (Mountpoint: $volInspect)."

    # Step 2: Pull the target n8n Docker image with detailed progress bar
    Write-Progress -Id 1 -Activity "n8n Docker Deployment Pipeline" -Status "[Step 5/7] Pulling Docker image '$imageRef'..." -PercentComplete 70
    Invoke-DockerImagePullWithProgress -DockerCli $dockerCli -ImageReference $imageRef

    # Step 3: Check for existing container with the same name
    Write-Progress -Id 1 -Activity "n8n Docker Deployment Pipeline" -Status "[Step 6/7] Configuring and starting container '$ContainerName'..." -PercentComplete 82
    $existingId = (& $dockerCli ps -a --filter "name=^/${ContainerName}$" --format "{{.ID}}" 2>&1) | Select-Object -First 1

    if (-not [string]::IsNullOrWhiteSpace($existingId)) {
        if ($IsUpdateMode) {
            Write-Log -Level "STEP" -Message "Update mode: Stopping and removing existing container '$ContainerName' ($existingId)..."
        }
        else {
            Write-Log -Level "INFO" -Message "Existing container '$ContainerName' ($existingId) found. Recreating with current parameters..."
        }
        $null = & $dockerCli stop $ContainerName 2>&1
        $null = & $dockerCli rm $ContainerName 2>&1
        Write-Log -Level "SUCCESS" -Message "Removed previous container instance '$ContainerName' (persistent volume '$DataVolumeName' preserved)."
    }

    # Step 4: Build official 'docker run' arguments per https://docs.n8n.io/deploy/host-n8n/install-options/install-with-docker
    $dockerRunArgs = New-Object System.Collections.Generic.List[string]
    $dockerRunArgs.Add("run")

    if ($Interactive) {
        $dockerRunArgs.Add("-it")
        $dockerRunArgs.Add("--rm")
    }
    else {
        $dockerRunArgs.Add("-d")
        $dockerRunArgs.Add("--restart")
        $dockerRunArgs.Add("unless-stopped")
    }

    $dockerRunArgs.Add("--name")
    $dockerRunArgs.Add($ContainerName)
    $dockerRunArgs.Add("-p")
    $dockerRunArgs.Add("${Port}:5678")
    $dockerRunArgs.Add("-e")
    $dockerRunArgs.Add("GENERIC_TIMEZONE=$Timezone")
    $dockerRunArgs.Add("-e")
    $dockerRunArgs.Add("TZ=$Timezone")
    $dockerRunArgs.Add("-e")
    $dockerRunArgs.Add("N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true")

    if ($UsePostgres) {
        $dockerRunArgs.Add("-e")
        $dockerRunArgs.Add("DB_TYPE=postgresdb")
        $dockerRunArgs.Add("-e")
        $dockerRunArgs.Add("DB_POSTGRESDB_DATABASE=$PostgresDatabase")
        $dockerRunArgs.Add("-e")
        $dockerRunArgs.Add("DB_POSTGRESDB_HOST=$PostgresHost")
        $dockerRunArgs.Add("-e")
        $dockerRunArgs.Add("DB_POSTGRESDB_PORT=$PostgresPort")
        $dockerRunArgs.Add("-e")
        $dockerRunArgs.Add("DB_POSTGRESDB_USER=$PostgresUser")
        $dockerRunArgs.Add("-e")
        $dockerRunArgs.Add("DB_POSTGRESDB_SCHEMA=$PostgresSchema")
        if (-not [string]::IsNullOrWhiteSpace($PostgresPassword)) {
            $dockerRunArgs.Add("-e")
            $dockerRunArgs.Add("DB_POSTGRESDB_PASSWORD=$PostgresPassword")
        }
    }

    $dockerRunArgs.Add("-v")
    $dockerRunArgs.Add("${DataVolumeName}:/home/node/.n8n")
    $dockerRunArgs.Add($imageRef)

    $redactedCmd = ($dockerRunArgs | ForEach-Object {
        if ($_ -like "DB_POSTGRESDB_PASSWORD=*") { "DB_POSTGRESDB_PASSWORD=********" } else { $_ }
    }) -join " "
    Write-Log -Level "STEP" -Message "Starting n8n container: docker $redactedCmd"

    if ($Interactive) {
        Write-Log -Level "INFO" -Message "Launching n8n in interactive foreground mode (Press Ctrl+C to stop)..."
        & $dockerCli $dockerRunArgs
        return
    }

    $containerId = (& $dockerCli $dockerRunArgs 2>&1) | Select-Object -Last 1
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to start n8n container '$ContainerName': $containerId"
    }

    Write-Log -Level "SUCCESS" -Message "Container '$ContainerName' started in background (ID: $containerId)."

    # Step 5: Poll HTTP healthz endpoint with progress bar
    Write-Progress -Id 1 -Activity "n8n Docker Deployment Pipeline" -Status "[Step 7/7] Verifying n8n HTTP health endpoint (http://localhost:$Port/healthz)..." -PercentComplete 92
    $healthUrl = "http://localhost:$Port/healthz"
    $maxWait   = 60
    $waited    = 0
    $healthy   = $false

    while ($waited -lt $maxWait) {
        $waited += 2
        $hPct = [math]::Min([int](($waited / $maxWait) * 100), 99)
        Write-Progress -Id 16 -ParentId 1 -Activity "Waiting for n8n Web Editor Readiness" `
            -Status "Checking $healthUrl (${waited}s / ${maxWait}s)..." -PercentComplete $hPct

        try {
            $resp = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
            if ($resp.StatusCode -eq 200) {
                $healthy = $true
                break
            }
        }
        catch {
            Start-Sleep -Seconds 2
        }
    }
    Write-Progress -Id 16 -ParentId 1 -Activity "Waiting for n8n Web Editor Readiness" -Completed

    if ($healthy) {
        Write-Log -Level "SUCCESS" -Message "n8n Web Editor is online and healthy at http://localhost:$Port"
    }
    else {
        Write-Log -Level "WARN" -Message "Container '$ContainerName' is running, but HTTP check at $healthUrl is still initializing. Check 'docker logs $ContainerName'."
    }

    # Step 6: Optional workflow upload with detailed file transfer progress
    if (-not [string]::IsNullOrWhiteSpace($ImportWorkflowsPath)) {
        Copy-WorkflowsToContainerWithProgress -DockerCli $dockerCli -TargetContainer $ContainerName -SourcePath $ImportWorkflowsPath
    }
}

function Show-ToolsAndUsageSummary {
    param (
        [PSCustomObject]$DockerPaths
    )

    $wslExe         = Join-Path -Path $env:SystemRoot -ChildPath "System32\wsl.exe"
    $dockerCli      = if (-not [string]::IsNullOrWhiteSpace($DockerPaths.DockerCli)) { $DockerPaths.DockerCli } else { "$($DockerPaths.CustomInstallDir)\resources\bin\docker.exe" }
    $dockerCompose  = Join-Path -Path (Split-Path -Path $dockerCli -Parent) -ChildPath "docker-compose.exe"
    $desktopGui     = if (-not [string]::IsNullOrWhiteSpace($DockerPaths.DockerDesktopGui)) { $DockerPaths.DockerDesktopGui } else { "$($DockerPaths.CustomInstallDir)\Docker Desktop.exe" }

    $dockerVersion      = "Not running / Not installed"
    $n8nState           = "Not found"
    $sandboxApiState    = "Not found"
    $sandboxRunnerState = "Not found"
    $runnersState       = "Not found"
    $searxngState       = "Not found"
    $volumeMount        = "/var/lib/docker/volumes/$DataVolumeName/_data (inside WSL2)"

    if ([System.IO.File]::Exists($dockerCli)) {
        $ErrorActionPreferenceBackup = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $verOut = (& $dockerCli --version 2>&1) | Select-Object -First 1
        if ($LASTEXITCODE -eq 0 -and $verOut) { $dockerVersion = $verOut }

        $cStatus = (& $dockerCli ps -a --filter "name=^/${ContainerName}$" --format "{{.Status}} ({{.Image}})" 2>&1) | Select-Object -First 1
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($cStatus)) { $n8nState = $cStatus }

        $apiStatus = (& $dockerCli ps -a --filter "name=^/${ContainerName}-sandbox-api$" --format "{{.Status}} ({{.Image}})" 2>&1) | Select-Object -First 1
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($apiStatus)) { $sandboxApiState = $apiStatus }

        $runnerStatus = (& $dockerCli ps -a --filter "name=^/${ContainerName}-sandbox-runner-1$" --format "{{.Status}} ({{.Image}})" 2>&1) | Select-Object -First 1
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($runnerStatus)) { $sandboxRunnerState = $runnerStatus }

        $taskRunnerStatus = (& $dockerCli ps -a --filter "name=^/${ContainerName}-runners$" --format "{{.Status}} ({{.Image}})" 2>&1) | Select-Object -First 1
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($taskRunnerStatus)) { $runnersState = $taskRunnerStatus }

        $searxStatus = (& $dockerCli ps -a --filter "name=^/${ContainerName}-searxng$" --format "{{.Status}} ({{.Image}})" 2>&1) | Select-Object -First 1
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($searxStatus)) { $searxngState = $searxStatus }

        $vMount = (& $dockerCli volume inspect $DataVolumeName --format "{{.Mountpoint}}" 2>&1) | Select-Object -First 1
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($vMount)) {
            $volumeMount = $vMount
        }
        $ErrorActionPreference = $ErrorActionPreferenceBackup
    }

    $summaryBanner = @"

================================================================================
  DEPLOYMENT SUMMARY: TOOL LOCATIONS & QUICK-START GUIDE
================================================================================
  [1] WHERE ALL TOOLS & DATA ARE LOCATED:
      * WSL2 Executable (wsl.exe): $wslExe
      * Docker Root Directory    : $($DockerPaths.CustomInstallDir)
      * Docker Desktop GUI App   : $desktopGui
      * Docker CLI Executable    : $dockerCli
      * Docker Compose CLI       : $dockerCompose
      * Docker Version           : $dockerVersion
      * WSL2 Disk Data Root      : $($DockerPaths.WslDataRoot)
      * Windows Containers Root  : $($DockerPaths.WinDataRoot)
      * Installer Cache Folder   : $($DockerPaths.InstallerDir)
      * Sandbox Stack Directory  : $($DockerPaths.StackDir)
      * Compose Stack File       : $($DockerPaths.ComposeFile)
      * Stack Secrets (.env)     : $($DockerPaths.EnvFile)
      * SearXNG Settings File    : $($DockerPaths.SearxngFile)
      * n8n Persistent Volume    : $DataVolumeName -> /home/node/.n8n
      * Sandbox TLS Volume       : ${DataVolumeName}_sandbox_tls -> /tls
      * Volume WSL2 Mountpoint   : $volumeMount
      * Execution Log File       : $($script:ActiveLogFile)

  [2] N8N & SANDBOX STACK STATUS & ACCESS:
      * n8n Main Container       : $ContainerName -> $n8nState
      * Sandbox Control API      : ${ContainerName}-sandbox-api -> $sandboxApiState
      * Sandbox Runner (DinD)    : ${ContainerName}-sandbox-runner-1 -> $sandboxRunnerState
      * Code Task Runners        : ${ContainerName}-runners -> $runnersState
      * SearXNG Web Search       : ${ContainerName}-searxng -> $searxngState
      * n8n Web Editor URL       : http://localhost:$Port
      * n8n AI Assistant URL     : http://localhost:$Port/assistant
      * n8n Healthcheck URL      : http://localhost:$Port/healthz

  [3] HOW TO USE WSL2, DOCKER, SANDBOX & N8N (ESSENTIAL COMMANDS):
      * Open n8n in Browser      : Start-Process "http://localhost:$Port"
      * Update WSL2 Environment  : wsl.exe --update
      * Check Stack Status       : docker compose -f "$($DockerPaths.ComposeFile)" ps
      * Stop n8n + Sandbox Stack : docker compose -f "$($DockerPaths.ComposeFile)" down
      * Start n8n + Sandbox Stack: docker compose -f "$($DockerPaths.ComposeFile)" up -d
      * Verify Sandbox API Health: docker exec $ContainerName wget -qO- http://sandbox-api:8080/healthz
      * View Live Stack Logs     : docker compose -f "$($DockerPaths.ComposeFile)" logs -f
      * Open Shell in n8n        : docker exec -it $ContainerName /bin/sh
      * Backup n8n Data Locally  : docker cp ${ContainerName}:/home/node/.n8n .\n8n_backup
      * Update Stack via Script  : .\deploy-n8n-on-windows-docker-desktop.ps1 -Update
================================================================================
"@
    Write-Host $summaryBanner -ForegroundColor Green
    Write-Log -Level "INFO" -Message $summaryBanner -NoConsole
}

# ==============================================================================
# MAIN EXECUTION FLOW
# ==============================================================================
try {
    Initialize-Logging -CustomLogPath $LogPath

    $modeLabel = if ($Status) { "Status & Tool Locations Inspection (-Status)" }
                 elseif ($Update -and $SkipSandbox) { "Update Standalone n8n Container (-Update -SkipSandbox)" }
                 elseif ($Update) { "Update n8n + Sandbox Stack (-Update)" }
                 elseif ($SkipSandbox) { "Standalone Deployment (WSL2 + Docker Desktop + Single n8n Container)" }
                 else { "Full Sandbox Deployment (WSL2 + Docker Desktop + n8n Docker Compose Sandbox Stack)" }

    Show-ExecutionParameters -ActionMode $modeLabel

    if ($Status) {
        $paths = Resolve-DockerPaths
        Show-ToolsAndUsageSummary -DockerPaths $paths
        exit 0
    }

    Write-Progress -Id 1 -Activity "n8n Docker Sandbox Deployment Pipeline" -Status "[Step 1/8] Provisioning & Updating WSL2 Environment (wsl.exe --update)..." -PercentComplete 8
    if ($SkipWslUpdate -or $Update) {
        Write-Log -Level "INFO" -Message "Skipping WSL2 update step (-SkipWslUpdate / -Update)."
    }
    else {
        Initialize-WslEnvironment
    }

    Write-Progress -Id 1 -Activity "n8n Docker Sandbox Deployment Pipeline" -Status "[Step 2/8] Checking & Installing Docker Desktop..." -PercentComplete 22

    $dockerPaths = $null
    if ($SkipDockerInstall -or $Update) {
        $dockerPaths = Resolve-DockerPaths
        Write-Log -Level "INFO" -Message "Skipping Docker Desktop installation step (Using CLI: $($dockerPaths.DockerCli))."
    }
    else {
        $dockerPaths = Install-DockerDesktopCustom
    }

    Write-Progress -Id 1 -Activity "n8n Docker Sandbox Deployment Pipeline" -Status "[Step 3/8] Starting Docker Engine Daemon..." -PercentComplete 38
    Start-DockerEngineAndWait -DockerPaths $dockerPaths

    if ($SkipSandbox) {
        Deploy-N8nStandaloneContainer -DockerPaths $dockerPaths -IsUpdateMode:$Update
    }
    else {
        Deploy-N8nSandboxStack -DockerPaths $dockerPaths -IsUpdateMode:$Update
    }

    Write-Progress -Id 1 -Activity "n8n Docker Sandbox Deployment Pipeline" -Completed

    Show-ToolsAndUsageSummary -DockerPaths $dockerPaths

    if ($OpenBrowser) {
        $targetUrl = "http://localhost:$Port"
        Write-Log -Level "STEP" -Message "Opening n8n Web Editor in default browser: $targetUrl"
        Start-Process $targetUrl
    }
}
catch {
    Write-Progress -Id 1 -Activity "n8n Docker Sandbox Deployment Pipeline" -Completed
    Write-Log -Level "ERROR" -Message "Deployment failed: $($_.Exception.Message)"
    if ($_.ScriptStackTrace) {
        Write-Log -Level "ERROR" -Message "Stack Trace: $($_.ScriptStackTrace)" -NoConsole
    }
    exit 1
}
