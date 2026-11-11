<#
.SYNOPSIS
    Automated installer and environment configurator for Google Gemini CLI in PowerShell.

.DESCRIPTION
    This script automates the complete setup of the runtime environment for the official
    Google Gemini CLI tool (@google/gemini-cli). It performs the following stages:
    1. Verifies environment architecture and administrative privileges (automatic UAC elevation).
    2. Verifies and silently installs Node.js LTS (OpenJS.NodeJS.LTS via WinGet or direct MSI fallback).
    3. Dynamically refreshes the session PATH variable so tools are immediately available.
    4. Globally installs the @google/gemini-cli package via npm.
    5. Initializes secure key storage (%USERPROFILE%\.gemini\api_key.txt) and configures $PROFILE.

.PARAMETER ForceReinstall
    Forces reinstallation of Node.js and the @google/gemini-cli package even if already detected.

.PARAMETER ApiKey
    Optional Google Gemini API key (e.g., from Google AI Studio).
    If provided, it is automatically written to %USERPROFILE%\.gemini\api_key.txt.

.PARAMETER LogDirectory
    Target directory for execution log files. Default: 'C:\Logs'.

.PARAMETER Quiet
    Quiet mode. Disables automatic launch of Notepad with api_key.txt upon completion.

.EXAMPLE
    .\Install-GeminiCliEnvironment.ps1
    Runs standard verification and environment deployment.

.EXAMPLE
    .\Install-GeminiCliEnvironment.ps1 -ApiKey "AIzaSyD-SampleKey..." -Quiet
    Installs the environment in quiet mode, configuring the provided API key immediately.

.EXAMPLE
    .\Install-GeminiCliEnvironment.ps1 -ForceReinstall -LogDirectory "D:\Logs"
    Forces reinstallation of Node.js and Gemini CLI, writing logs to a custom directory.

.NOTES
    Author: Rafal Pindela / PowerShell Automation
    Repository: C:\GitHub\Automation\Gemini\Install-GeminiCliEnvironment
    Compatibility: Windows PowerShell 5.1 and PowerShell 7+
#>

[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param (
    [Parameter(Mandatory = $false)]
    [switch]$ForceReinstall,

    [Parameter(Mandatory = $false)]
    [string]$ApiKey,

    [Parameter(Mandatory = $false)]
    [string]$LogDirectory = 'C:\Logs',

    [Parameter(Mandatory = $false)]
    [switch]$Quiet
)

Set-StrictMode -Off
$ErrorActionPreference = 'Stop'

# ==============================================================================
# 1. ADMINISTRATOR PRIVILEGE VERIFICATION & UAC AUTO-ELEVATION
# ==============================================================================
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Warning "Administrator privileges required. Attempting automatic UAC elevation..."
    
    $psExecutable = if ($PSVersionTable.PSEdition -eq 'Core' -or $PSVersionTable.PSVersion.Major -ge 6) {
        (Get-Process -Id $PID).Path
    } else {
        "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
    }

    # Reconstruct invocation arguments preserving parameters
    $scriptPath = $MyInvocation.MyCommand.Path
    if ([string]::IsNullOrWhiteSpace($scriptPath)) {
        $scriptPath = $PSCommandPath
    }

    $argList = @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", "`"$scriptPath`""
    )

    if ($ForceReinstall) { $argList += "-ForceReinstall" }
    if ($Quiet) { $argList += "-Quiet" }
    if ($PSBoundParameters.ContainsKey('ApiKey')) { $argList += @("-ApiKey", "`"$ApiKey`"") }
    if ($PSBoundParameters.ContainsKey('LogDirectory')) { $argList += @("-LogDirectory", "`"$LogDirectory`"") }

    $allArguments = $argList -join ' '

    try {
        if ($PSCmdlet.ShouldProcess("PowerShell Process (RunAs Administrator)", "Automatic UAC Elevation")) {
            Start-Process -FilePath $psExecutable -ArgumentList $allArguments -Verb RunAs -Wait
        }
        exit 0
    }
    catch {
        Write-Error "Failed to launch elevated process: $_"
        exit 2
    }
}

# ==============================================================================
# 2. LOGGING MODULE INITIALIZATION
# ==============================================================================
try {
    if (-not (Test-Path -Path $LogDirectory -PathType Container)) {
        New-Item -Path $LogDirectory -ItemType Directory -Force | Out-Null
    }
}
catch {
    Write-Warning "Failed to create specified log directory '$LogDirectory'. Falling back to '$env:TEMP\Logs'."
    $LogDirectory = Join-Path -Path $env:TEMP -ChildPath "Logs"
    if (-not (Test-Path -Path $LogDirectory)) {
        New-Item -Path $LogDirectory -ItemType Directory -Force | Out-Null
    }
}

$dateStamp = (Get-Date).ToString("yyyy-MM-dd")
$logFileName = "Install-GeminiCliEnvironment_$dateStamp.log"
$global:ScriptLogPath = Join-Path -Path $LogDirectory -ChildPath $logFileName

function Write-Log {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true, Position = 0)]
        [string]$Message,

        [Parameter(Mandatory = $false)]
        [ValidateSet('INFO', 'WARN', 'ERROR', 'DEBUG')]
        [string]$Level = 'INFO',

        [Parameter(Mandatory = $false)]
        [string]$Component = 'Core'
    )

    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $formattedLog = "[$timestamp] [$Level] [$Component] $Message"

    # Write to file
    try {
        Add-Content -Path $global:ScriptLogPath -Value $formattedLog -Encoding UTF8 -ErrorAction SilentlyContinue
    }
    catch {
        # Ignore intermittent file locking
    }

    # Colorized console output
    $consoleColor = switch ($Level) {
        'INFO'  { 'Cyan' }
        'WARN'  { 'Yellow' }
        'ERROR' { 'Red' }
        'DEBUG' { 'DarkGray' }
        Default { 'White' }
    }

    Write-Host "[$timestamp] " -NoNewline -ForegroundColor DarkGray
    Write-Host "[$Level] " -NoNewline -ForegroundColor $consoleColor
    Write-Host "[$Component] " -NoNewline -ForegroundColor Magenta
    Write-Host $Message -ForegroundColor White
}

# ==============================================================================
# 3. HELPER FUNCTIONS
# ==============================================================================

function Update-SessionPath {
    [CmdletBinding()]
    param()

    Write-Log -Message "Refreshing PATH environment variable in current session..." -Level 'DEBUG' -Component 'Environment'

    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath    = [Environment]::GetEnvironmentVariable('Path', 'User')

    $combinedPath = @(
        $machinePath -split ';'
        $userPath -split ';'
        'C:\Program Files\nodejs'
        (Join-Path -Path $env:APPDATA -ChildPath 'npm')
    ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique

    $env:PATH = ($combinedPath -join ';')
    Write-Log -Message "PATH environment variable refreshed successfully." -Level 'DEBUG' -Component 'Environment'
}

function Test-CommandAvailable {
    param([string]$CommandName)

    $found = Get-Command -Name $CommandName -ErrorAction SilentlyContinue
    return ($null -ne $found)
}

# ==============================================================================
# 4. MAIN EXECUTION PIPELINE (5 PROGRESS STAGES)
# ==============================================================================

$activity = "Deploying Google Gemini CLI Environment"

try {
    Write-Log -Message "Starting Google Gemini CLI environment deployment pipeline." -Level 'INFO' -Component 'Main'
    Write-Log -Message "Platform: $([System.Environment]::OSVersion.VersionString) | PowerShell: $($PSVersionTable.PSVersion)" -Level 'INFO' -Component 'Main'

    # --------------------------------------------------------------------------
    # STEP 1/5: Environment and privilege verification
    # --------------------------------------------------------------------------
    Write-Progress -Activity $activity -Status "Step 1/5: Verifying environment and administrative privileges..." -PercentComplete 20
    Write-Log -Message "Step 1/5: Checking system platform and elevation status." -Level 'INFO' -Component 'Step1'

    if (-not [Environment]::Is64BitOperatingSystem) {
        Write-Log -Message "A 64-bit Windows operating system is required." -Level 'ERROR' -Component 'Step1'
        exit 1
    }

    Write-Log -Message "Administrative privilege verification: OK (Administrator)." -Level 'INFO' -Component 'Step1'

    # --------------------------------------------------------------------------
    # STEP 2/5: Node.js LTS verification and installation
    # --------------------------------------------------------------------------
    Write-Progress -Activity $activity -Status "Step 2/5: Verifying and installing Node.js LTS..." -PercentComplete 40
    Write-Log -Message "Step 2/5: Checking Node.js LTS availability." -Level 'INFO' -Component 'Step2'

    Update-SessionPath
    $nodePresent = Test-CommandAvailable -CommandName 'node'

    if ($nodePresent -and (-not $ForceReinstall)) {
        $nodeVer = (& node -v 2>&1).ToString().Trim()
        Write-Log -Message "Detected installed Node.js runtime: $nodeVer. Skipping installation." -Level 'INFO' -Component 'Step2'
    }
    else {
        if ($ForceReinstall -and $nodePresent) {
            Write-Log -Message "Parameter -ForceReinstall specified. Forcing Node.js LTS reinstallation." -Level 'WARN' -Component 'Step2'
        } else {
            Write-Log -Message "Node.js was not detected on this system. Commencing Node.js LTS installation..." -Level 'INFO' -Component 'Step2'
        }

        $nodeInstalled = $false

        # Attempt 1: winget
        if (Test-CommandAvailable -CommandName 'winget') {
            Write-Log -Message "Attempting Node.js LTS installation via winget package manager (OpenJS.NodeJS.LTS)..." -Level 'INFO' -Component 'Step2'
            try {
                $wingetArgs = @(
                    "install",
                    "--id", "OpenJS.NodeJS.LTS",
                    "--exact",
                    "--silent",
                    "--accept-source-agreements",
                    "--accept-package-agreements",
                    "--disable-interactivity"
                )

                if ($ForceReinstall) {
                    $wingetArgs += "--force"
                }

                $p = Start-Process -FilePath "winget" -ArgumentList $wingetArgs -Wait -NoNewWindow -PassThru
                if ($p.ExitCode -eq 0 -or $p.ExitCode -eq -1978335189) {
                    Write-Log -Message "Node.js LTS installation via winget completed successfully (ExitCode: $($p.ExitCode))." -Level 'INFO' -Component 'Step2'
                    $nodeInstalled = $true
                } else {
                    Write-Log -Message "winget returned exit code: $($p.ExitCode). Switching to direct MSI installer fallback..." -Level 'WARN' -Component 'Step2'
                }
            }
            catch {
                Write-Log -Message "Error during winget execution: $_. Switching to MSI fallback..." -Level 'WARN' -Component 'Step2'
            }
        }
        else {
            Write-Log -Message "winget is not available on this system. Proceeding with direct MSI installer." -Level 'INFO' -Component 'Step2'
        }

        # Attempt 2: Direct MSI Fallback
        if (-not $nodeInstalled) {
            Write-Log -Message "Downloading Node.js LTS MSI installer from official server..." -Level 'INFO' -Component 'Step2'

            $tempMsiPath = Join-Path -Path $env:TEMP -ChildPath "nodejs_lts_installer.msi"
            $msiUrl = $null

            try {
                [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
                $distIndex = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json" -TimeoutSec 10 -ErrorAction Stop
                $latestLts = $distIndex | Where-Object { $_.lts -ne $false } | Select-Object -First 1
                if ($latestLts -and $latestLts.version) {
                    $versionStr = $latestLts.version
                    $msiUrl = "https://nodejs.org/dist/$versionStr/node-$versionStr-x64.msi"
                    Write-Log -Message "Identified latest Node.js LTS release: $versionStr" -Level 'INFO' -Component 'Step2'
                }
            }
            catch {
                Write-Log -Message "Failed to query nodejs.org index: $_. Using stable default LTS release." -Level 'WARN' -Component 'Step2'
            }

            if ([string]::IsNullOrWhiteSpace($msiUrl)) {
                $msiUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi"
            }

            Write-Log -Message "Downloading MSI installer from: $msiUrl -> $tempMsiPath" -Level 'INFO' -Component 'Step2'
            Invoke-WebRequest -Uri $msiUrl -OutFile $tempMsiPath -UseBasicParsing

            Write-Log -Message "Launching silent MSI installation (msiexec)..." -Level 'INFO' -Component 'Step2'
            $msiProc = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$tempMsiPath`" /qn /norestart" -Wait -NoNewWindow -PassThru

            if ($msiProc.ExitCode -eq 0 -or $msiProc.ExitCode -eq 3010) {
                Write-Log -Message "Node.js MSI installation completed successfully (ExitCode: $($msiProc.ExitCode))." -Level 'INFO' -Component 'Step2'
                $nodeInstalled = $true
            } else {
                Write-Log -Message "Node.js MSI installation failed (ExitCode: $($msiProc.ExitCode))." -Level 'ERROR' -Component 'Step2'
                exit 1
            }

            if (Test-Path -Path $tempMsiPath) {
                Remove-Item -Path $tempMsiPath -Force -ErrorAction SilentlyContinue
            }
        }
    }

    # --------------------------------------------------------------------------
    # STEP 3/5: Dynamic PATH refresh and NPM verification
    # --------------------------------------------------------------------------
    Write-Progress -Activity $activity -Status "Step 3/5: Refreshing PATH and verifying NPM..." -PercentComplete 60
    Write-Log -Message "Step 3/5: Dynamic PATH environment variable refresh in current session." -Level 'INFO' -Component 'Step3'

    Update-SessionPath

    if (-not (Test-CommandAvailable -CommandName 'node')) {
        Write-Log -Message "The 'node' command is still not recognized in PATH following installation." -Level 'ERROR' -Component 'Step3'
        exit 1
    }

    if (-not (Test-CommandAvailable -CommandName 'npm')) {
        Write-Log -Message "The 'npm' command is not recognized in PATH." -Level 'ERROR' -Component 'Step3'
        exit 1
    }

    $verifiedNode = (& node -v 2>&1).ToString().Trim()
    $verifiedNpm  = (& npm -v 2>&1).ToString().Trim()
    Write-Log -Message "Environment verified successfully: Node.js = $verifiedNode, NPM = $verifiedNpm" -Level 'INFO' -Component 'Step3'

    # --------------------------------------------------------------------------
    # STEP 4/5: Google Gemini CLI installation (@google/gemini-cli)
    # --------------------------------------------------------------------------
    Write-Progress -Activity $activity -Status "Step 4/5: Installing Google Gemini CLI..." -PercentComplete 80
    Write-Log -Message "Step 4/5: Verifying and installing @google/gemini-cli package via npm." -Level 'INFO' -Component 'Step4'

    $geminiPresent = Test-CommandAvailable -CommandName 'gemini'

    if ($geminiPresent -and (-not $ForceReinstall)) {
        Write-Log -Message "Gemini CLI tool ('gemini') is already installed. Skipping package installation." -Level 'INFO' -Component 'Step4'
    }
    else {
        Write-Log -Message "Executing: npm install -g @google/gemini-cli..." -Level 'INFO' -Component 'Step4'
        
        $npmInstallProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm install -g @google/gemini-cli" -Wait -NoNewWindow -PassThru

        if ($npmInstallProcess.ExitCode -ne 0) {
            Write-Log -Message "Failed to install @google/gemini-cli via npm (ExitCode: $($npmInstallProcess.ExitCode))." -Level 'ERROR' -Component 'Step4'
            exit 1
        }

        Update-SessionPath
        Write-Log -Message "Package @google/gemini-cli installed successfully." -Level 'INFO' -Component 'Step4'
    }

    Update-SessionPath
    if (Test-CommandAvailable -CommandName 'gemini') {
        Write-Log -Message "Command 'gemini' is fully available and ready for execution." -Level 'INFO' -Component 'Step4'
    } else {
        Write-Log -Message "Warning: Command 'gemini' was not immediately detected in PATH. Check directory: $env:APPDATA\npm" -Level 'WARN' -Component 'Step4'
    }

    # --------------------------------------------------------------------------
    # STEP 5/5: API key configuration and PowerShell profile integration
    # --------------------------------------------------------------------------
    Write-Progress -Activity $activity -Status "Step 5/5: Initializing API key configuration and PowerShell profile..." -PercentComplete 100
    Write-Log -Message "Step 5/5: Configuring credentials directory structure and PowerShell profile integration." -Level 'INFO' -Component 'Step5'

    $geminiConfigDir = Join-Path -Path $env:USERPROFILE -ChildPath ".gemini"
    $geminiKeyFile   = Join-Path -Path $geminiConfigDir -ChildPath "api_key.txt"

    if (-not (Test-Path -Path $geminiConfigDir -PathType Container)) {
        Write-Log -Message "Creating configuration directory: $geminiConfigDir" -Level 'INFO' -Component 'Step5'
        New-Item -Path $geminiConfigDir -ItemType Directory -Force | Out-Null
    }

    $isKeyFileNew = -not (Test-Path -Path $geminiKeyFile)

    if ($PSBoundParameters.ContainsKey('ApiKey') -and (-not [string]::IsNullOrWhiteSpace($ApiKey))) {
        Write-Log -Message "Writing provided API key to: $geminiKeyFile" -Level 'INFO' -Component 'Step5'
        $keyContent = @(
            "# Google Gemini API Key",
            $ApiKey.Trim()
        ) -join [Environment]::NewLine
        Set-Content -Path $geminiKeyFile -Value $keyContent -Encoding UTF8 -Force
        $env:GEMINI_API_KEY = $ApiKey.Trim()
    }
    elseif ($isKeyFileNew) {
        Write-Log -Message "Generating API key template file: $geminiKeyFile" -Level 'INFO' -Component 'Step5'
        $templateContent = @(
            "# Paste your Google Gemini API key below (from Google AI Studio)",
            "# Replace the sample line below with your actual key:",
            "AIzaSy..."
        ) -join [Environment]::NewLine
        Set-Content -Path $geminiKeyFile -Value $templateContent -Encoding UTF8 -Force
    }

    # Integration with PowerShell profile ($PROFILE)
    try {
        $profileDir = Split-Path -Path $PROFILE -Parent
        if (-not (Test-Path -Path $profileDir)) {
            Write-Log -Message "Creating PowerShell profile directory: $profileDir" -Level 'DEBUG' -Component 'Step5'
            New-Item -Path $profileDir -ItemType Directory -Force | Out-Null
        }

        if (-not (Test-Path -Path $PROFILE)) {
            Write-Log -Message "Creating new PowerShell profile file: $PROFILE" -Level 'INFO' -Component 'Step5'
            New-Item -Path $PROFILE -ItemType File -Force | Out-Null
        }

        $profileContent = Get-Content -Path $PROFILE -Raw -ErrorAction SilentlyContinue
        if ($null -eq $profileContent) { $profileContent = "" }

        $startMarker = "# >>> GEMINI-CLI-INIT >>>"
        $endMarker   = "# <<< GEMINI-CLI-INIT <<<"

        if ($profileContent -notmatch [regex]::Escape($startMarker)) {
            Write-Log -Message "Appending idempotent API key loader block to profile: $PROFILE" -Level 'INFO' -Component 'Step5'

            $profileLines = @(
                "",
                $startMarker,
                '$geminiKeyFile = "$env:USERPROFILE\.gemini\api_key.txt"',
                'if (Test-Path -Path $geminiKeyFile) {',
                '    $rawKey = (Get-Content -Path $geminiKeyFile | Where-Object { $_ -notmatch ''^\s*#'' -and $_.Trim() -ne '''' } | Select-Object -First 1)',
                '    if ($rawKey) {',
                '        $env:GEMINI_API_KEY = $rawKey.Trim()',
                '    }',
                '}',
                $endMarker,
                ""
            )
            $profileBlock = $profileLines -join [Environment]::NewLine
            Add-Content -Path $PROFILE -Value $profileBlock -Encoding UTF8
            Write-Log -Message "PowerShell profile updated successfully." -Level 'INFO' -Component 'Step5'
        } else {
            Write-Log -Message "PowerShell profile already contains GEMINI-CLI-INIT block. Skipping modification." -Level 'INFO' -Component 'Step5'
        }

        # Initialize variable in current session if key already exists in file
        if (Test-Path -Path $geminiKeyFile) {
            $rawKey = (Get-Content -Path $geminiKeyFile | Where-Object { $_ -notmatch '^\s*#' -and $_.Trim() -ne '' } | Select-Object -First 1)
            if ($rawKey -and $rawKey -notlike "AIzaSy...") {
                $env:GEMINI_API_KEY = $rawKey.Trim()
                Write-Log -Message "Environment variable GEMINI_API_KEY initialized in current session." -Level 'INFO' -Component 'Step5'
            }
        }
    }
    catch {
        Write-Log -Message "Failed to configure PowerShell profile: $_" -Level 'ERROR' -Component 'Step5'
        exit 2
    }

    # Open key file in Notepad if not quiet and key needs input
    if ((-not $Quiet) -and ($isKeyFileNew -or (-not $PSBoundParameters.ContainsKey('ApiKey')))) {
        Write-Log -Message "Opening API key file in Notepad for user configuration..." -Level 'INFO' -Component 'Step5'
        Start-Process -FilePath "notepad.exe" -ArgumentList "`"$geminiKeyFile`""
    }

    Write-Progress -Activity $activity -Completed
    Write-Log -Message "Google Gemini CLI environment installation and configuration completed successfully!" -Level 'INFO' -Component 'Main'
    Write-Host "`n[SUCCESS] Google Gemini CLI environment is ready!" -ForegroundColor Green
    Write-Host "API Key file: $geminiKeyFile" -ForegroundColor Cyan
    Write-Host "Launch CLI: Type 'gemini' in a new console window.`n" -ForegroundColor Yellow

    exit 0
}
catch {
    Write-Log -Message "An unexpected fatal error occurred: $_" -Level 'ERROR' -Component 'Fatal'
    Write-Progress -Activity $activity -Completed
    exit 1
}