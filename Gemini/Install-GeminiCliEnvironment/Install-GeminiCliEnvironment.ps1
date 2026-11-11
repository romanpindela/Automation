<#
.SYNOPSIS
    Automatyczny instalator i konfigurator srodowiska Google Gemini CLI dla PowerShell.

.DESCRIPTION
    Skrypt przygotowuje pelne srodowisko wykonawcze dla oficjalnego narzedzia Google Gemini CLI.
    Realizuje nastepujace etapy:
    1. Weryfikacje srodowiska, architektury i uprawnien administracyjnych (autopodniesienie UAC).
    2. Sprawdzenie oraz cicha instalacje srodowiska Node.js LTS (OpenJS.NodeJS.LTS przez winget lub fallback MSI).
    3. Dynamiczne odswiezenie zmiennych srodowiskowych PATH w biezacej sesji konsoli.
    4. Globalna instalacje pakietu @google/gemini-cli za posrednictwem npm.
    5. Inicjalizacje chronionego magazynu kluczy (%USERPROFILE%\.gemini\api_key.txt) oraz integracje z $PROFILE.

.PARAMETER ForceReinstall
    Wymusza ponowna instalacje Node.js oraz pakietu @google/gemini-cli, nawet jesli sa juz wykryte w systemie.

.PARAMETER ApiKey
    Opcjonalny klucz API Google Gemini (np. uzyskany z Google AI Studio).
    Jesli podany, zostaje automatycznie zapisany do pliku %USERPROFILE%\.gemini\api_key.txt.

.PARAMETER LogDirectory
    Sciezka do katalogu, w ktorym zapisywane sa dzienniki zdarzen. Domyslnie: 'C:\Logs'.

.PARAMETER Quiet
    Tryb cichy. Wylacza automatyczne otwarcie edytora Notatnik z plikiem api_key.txt po zakonczeniu instalacji.

.EXAMPLE
    .\Install-GeminiCliEnvironment.ps1
    Uruchamia standardowy proces weryfikacji i instalacji srodowiska.

.EXAMPLE
    .\Install-GeminiCliEnvironment.ps1 -ApiKey "AIzaSyD-PrzykladowyKlucz..." -Quiet
    Instaluje srodowisko w trybie cichym, konfigurujac od razu podany klucz API.

.EXAMPLE
    .\Install-GeminiCliEnvironment.ps1 -ForceReinstall -LogDirectory "D:\Logs"
    Wymusza reinstalacje Node.js i Gemini CLI z zapisem logow do dedykowanego katalogu.

.NOTES
    Autor: Rafal Pindela / Automatyzacja PowerShell
    Repozytorium: C:\GitHub\Automation\Gemini\Install-GeminiCliEnvironment
    Kompatybilnosc: Windows PowerShell 5.1 oraz PowerShell 7+
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
# 1. WERYFIKACJA UPRAWNIEN ADMINISTRATORA I AUTOPODNIESIENIE UAC
# ==============================================================================
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Warning "Skrypt wymaga uprawnien administratora. Nastepuje proba autopodniesienia UAC..."
    
    $psExecutable = if ($PSVersionTable.PSEdition -eq 'Core' -or $PSVersionTable.PSVersion.Major -ge 6) {
        (Get-Process -Id $PID).Path
    } else {
        "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
    }

    # Budowanie argumentow wywolania z zachowaniem parametrow
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
        if ($PSCmdlet.ShouldProcess("Proces PowerShell (RunAs Administrator)", "Autopodniesienie uprawnien UAC")) {
            Start-Process -FilePath $psExecutable -ArgumentList $allArguments -Verb RunAs -Wait
        }
        exit 0
    }
    catch {
        Write-Error "Nie udalo sie uruchomic procesu z podniesionymi uprawnieniami: $_"
        exit 2
    }
}

# ==============================================================================
# 2. INICJALIZACJA MODULU LOGOWANIA
# ==============================================================================
try {
    if (-not (Test-Path -Path $LogDirectory -PathType Container)) {
        New-Item -Path $LogDirectory -ItemType Directory -Force | Out-Null
    }
}
catch {
    Write-Warning "Nie udalo sie utworzyc wskazanego katalogu logow '$LogDirectory'. Uzywanie domyslnego '$env:TEMP\Logs'."
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

    # Zapis do pliku
    try {
        Add-Content -Path $global:ScriptLogPath -Value $formattedLog -Encoding UTF8 -ErrorAction SilentlyContinue
    }
    catch {
        # Ignoruj ewentualna blokade pliku logu
    }

    # Wyjscie na konsole z kolorowaniem
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
# 3. FUNKCJE POMOCNICZE
# ==============================================================================

function Update-SessionPath {
    [CmdletBinding()]
    param()

    Write-Log -Message "Aktualizacja zmiennej srodowiskowej PATH w biezacej sesji..." -Level 'DEBUG' -Component 'Environment'

    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath    = [Environment]::GetEnvironmentVariable('Path', 'User')

    $combinedPath = @(
        $machinePath -split ';'
        $userPath -split ';'
        'C:\Program Files\nodejs'
        (Join-Path -Path $env:APPDATA -ChildPath 'npm')
    ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique

    $env:PATH = ($combinedPath -join ';')
    Write-Log -Message "Zmienna PATH zaktualizowana pomyslnie." -Level 'DEBUG' -Component 'Environment'
}

function Test-CommandAvailable {
    param([string]$CommandName)

    $found = Get-Command -Name $CommandName -ErrorAction SilentlyContinue
    return ($null -ne $found)
}

# ==============================================================================
# 4. GLOWNA LOGIKA WYKONAWCZA (5 KROKOW WRITE-PROGRESS)
# ==============================================================================

$activity = "Wdrazanie srodowiska Google Gemini CLI"

try {
    Write-Log -Message "Rozpoczecie procedury instalacji srodowiska Google Gemini CLI." -Level 'INFO' -Component 'Main'
    Write-Log -Message "System: $([System.Environment]::OSVersion.VersionString) | PowerShell: $($PSVersionTable.PSVersion)" -Level 'INFO' -Component 'Main'

    # --------------------------------------------------------------------------
    # KROK 1/5: Weryfikacja srodowiska i uprawnien
    # --------------------------------------------------------------------------
    Write-Progress -Activity $activity -Status "Krok 1/5: Weryfikacja srodowiska i uprawnien..." -PercentComplete 20
    Write-Log -Message "Krok 1/5: Sprawdzanie uprawnien i platformy systemowej." -Level 'INFO' -Component 'Step1'

    if (-not [Environment]::Is64BitOperatingSystem) {
        Write-Log -Message "Wymagany jest 64-bitowy system operacyjny Windows." -Level 'ERROR' -Component 'Step1'
        exit 1
    }

    Write-Log -Message "Weryfikacja uprawnien administracyjnych: OK (Administrator)." -Level 'INFO' -Component 'Step1'

    # --------------------------------------------------------------------------
    # KROK 2/5: Weryfikacja i instalacja Node.js LTS
    # --------------------------------------------------------------------------
    Write-Progress -Activity $activity -Status "Krok 2/5: Weryfikacja i instalacja Node.js LTS..." -PercentComplete 40
    Write-Log -Message "Krok 2/5: Weryfikacja obecnosci Node.js LTS." -Level 'INFO' -Component 'Step2'

    Update-SessionPath
    $nodePresent = Test-CommandAvailable -CommandName 'node'

    if ($nodePresent -and (-not $ForceReinstall)) {
        $nodeVer = (& node -v 2>&1).ToString().Trim()
        Write-Log -Message "Wykryto zainstalowane srodowisko Node.js: $nodeVer. Pomijanie instalacji." -Level 'INFO' -Component 'Step2'
    }
    else {
        if ($ForceReinstall -and $nodePresent) {
            Write-Log -Message "Wykryto parametr -ForceReinstall. Wymuszanie ponownej instalacji Node.js LTS." -Level 'WARN' -Component 'Step2'
        } else {
            Write-Log -Message "Nie wykryto srodowiska Node.js w systemie. Rozpoczynanie instalacji Node.js LTS..." -Level 'INFO' -Component 'Step2'
        }

        $nodeInstalled = $false

        # Proba 1: winget
        if (Test-CommandAvailable -CommandName 'winget') {
            Write-Log -Message "Proba instalacji Node.js LTS przy uzyciu menedzera pakietow winget (OpenJS.NodeJS.LTS)..." -Level 'INFO' -Component 'Step2'
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
                    Write-Log -Message "Instalacja Node.js LTS przez winget zakonczona sukcesem (ExitCode: $($p.ExitCode))." -Level 'INFO' -Component 'Step2'
                    $nodeInstalled = $true
                } else {
                    Write-Log -Message "winget zwrocil kod wyjscia: $($p.ExitCode). Przelaczanie na fallback instalatora MSI..." -Level 'WARN' -Component 'Step2'
                }
            }
            catch {
                Write-Log -Message "Wystapil blad podczas wywolania winget: $_. Przelaczanie na fallback MSI..." -Level 'WARN' -Component 'Step2'
            }
        }
        else {
            Write-Log -Message "Menedzer winget nie jest dostepny w systemie. Uzycie bezposredniego instalatora MSI." -Level 'INFO' -Component 'Step2'
        }

        # Proba 2: Fallback MSI
        if (-not $nodeInstalled) {
            Write-Log -Message "Pobieranie instalatora Node.js LTS MSI z oficjalnego serwera..." -Level 'INFO' -Component 'Step2'

            $tempMsiPath = Join-Path -Path $env:TEMP -ChildPath "nodejs_lts_installer.msi"
            $msiUrl = $null

            try {
                [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
                $distIndex = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json" -TimeoutSec 10 -ErrorAction Stop
                $latestLts = $distIndex | Where-Object { $_.lts -ne $false } | Select-Object -First 1
                if ($latestLts -and $latestLts.version) {
                    $versionStr = $latestLts.version
                    $msiUrl = "https://nodejs.org/dist/$versionStr/node-$versionStr-x64.msi"
                    Write-Log -Message "Zidentyfikowano najnowsza wersje Node.js LTS: $versionStr" -Level 'INFO' -Component 'Step2'
                }
            }
            catch {
                Write-Log -Message "Nie udalo sie odpytac indeksu nodejs.org: $_. Zastosowanie domyslnego linku LTS." -Level 'WARN' -Component 'Step2'
            }

            if ([string]::IsNullOrWhiteSpace($msiUrl)) {
                $msiUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi"
            }

            Write-Log -Message "Pobieranie pliku MSI z adresu: $msiUrl -> $tempMsiPath" -Level 'INFO' -Component 'Step2'
            Invoke-WebRequest -Uri $msiUrl -OutFile $tempMsiPath -UseBasicParsing

            Write-Log -Message "Uruchamianie cichej instalacji MSI (msiexec)..." -Level 'INFO' -Component 'Step2'
            $msiProc = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$tempMsiPath`" /qn /norestart" -Wait -NoNewWindow -PassThru

            if ($msiProc.ExitCode -eq 0 -or $msiProc.ExitCode -eq 3010) {
                Write-Log -Message "Instalacja Node.js MSI zakonczona sukcesem (ExitCode: $($msiProc.ExitCode))." -Level 'INFO' -Component 'Step2'
                $nodeInstalled = $true
            } else {
                Write-Log -Message "Blad instalacji Node.js MSI (ExitCode: $($msiProc.ExitCode))." -Level 'ERROR' -Component 'Step2'
                exit 1
            }

            if (Test-Path -Path $tempMsiPath) {
                Remove-Item -Path $tempMsiPath -Force -ErrorAction SilentlyContinue
            }
        }
    }

    # --------------------------------------------------------------------------
    # KROK 3/5: Odswiezenie zmiennych srodowiskowych i weryfikacja NPM
    # --------------------------------------------------------------------------
    Write-Progress -Activity $activity -Status "Krok 3/5: Odswiezenie PATH i weryfikacja NPM..." -PercentComplete 60
    Write-Log -Message "Krok 3/5: Dynamiczne odswiezenie zmiennych srodowiskowych PATH w sesji." -Level 'INFO' -Component 'Step3'

    Update-SessionPath

    if (-not (Test-CommandAvailable -CommandName 'node')) {
        Write-Log -Message "Polecenie 'node' nadal nie jest rozpoznawane w zmiennej PATH po instalacji." -Level 'ERROR' -Component 'Step3'
        exit 1
    }

    if (-not (Test-CommandAvailable -CommandName 'npm')) {
        Write-Log -Message "Polecenie 'npm' nie jest rozpoznawane w zmiennej PATH." -Level 'ERROR' -Component 'Step3'
        exit 1
    }

    $verifiedNode = (& node -v 2>&1).ToString().Trim()
    $verifiedNpm  = (& npm -v 2>&1).ToString().Trim()
    Write-Log -Message "Srodowisko zweryfikowane: Node.js = $verifiedNode, NPM = $verifiedNpm" -Level 'INFO' -Component 'Step3'

    # --------------------------------------------------------------------------
    # KROK 4/5: Instalacja Gemini CLI (@google/gemini-cli)
    # --------------------------------------------------------------------------
    Write-Progress -Activity $activity -Status "Krok 4/5: Instalacja Google Gemini CLI..." -PercentComplete 80
    Write-Log -Message "Krok 4/5: Weryfikacja i instalacja pakietu @google/gemini-cli przez npm." -Level 'INFO' -Component 'Step4'

    $geminiPresent = Test-CommandAvailable -CommandName 'gemini'

    if ($geminiPresent -and (-not $ForceReinstall)) {
        Write-Log -Message "Narzedzie Gemini CLI ('gemini') jest juz zainstalowane w systemie. Pomijanie instalacji." -Level 'INFO' -Component 'Step4'
    }
    else {
        Write-Log -Message "Wykonywanie: npm install -g @google/gemini-cli..." -Level 'INFO' -Component 'Step4'
        
        $npmInstallProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm install -g @google/gemini-cli" -Wait -NoNewWindow -PassThru

        if ($npmInstallProcess.ExitCode -ne 0) {
            Write-Log -Message "Instalacja pakietu @google/gemini-cli przez npm nie powiodla sie (ExitCode: $($npmInstallProcess.ExitCode))." -Level 'ERROR' -Component 'Step4'
            exit 1
        }

        Update-SessionPath
        Write-Log -Message "Pakiet @google/gemini-cli zainstalowany pomyslnie." -Level 'INFO' -Component 'Step4'
    }

    Update-SessionPath
    if (Test-CommandAvailable -CommandName 'gemini') {
        Write-Log -Message "Polecenie 'gemini' jest w pelni gotowe do uzycia w powloce." -Level 'INFO' -Component 'Step4'
    } else {
        Write-Log -Message "Ostrzezenie: Polecenie 'gemini' nie zostalo natychmiast wykryte w biezacej sesji PATH. Sprawdz sciezke: $env:APPDATA\npm" -Level 'WARN' -Component 'Step4'
    }

    # --------------------------------------------------------------------------
    # KROK 5/5: Inicjalizacja konfiguracji klucza API i profilu PowerShell
    # --------------------------------------------------------------------------
    Write-Progress -Activity $activity -Status "Krok 5/5: Inicjalizacja konfiguracji klucza API i profilu..." -PercentComplete 100
    Write-Log -Message "Krok 5/5: Konfiguracja struktury katalogow kluczy i integracja z profilem PowerShell." -Level 'INFO' -Component 'Step5'

    $geminiConfigDir = Join-Path -Path $env:USERPROFILE -ChildPath ".gemini"
    $geminiKeyFile   = Join-Path -Path $geminiConfigDir -ChildPath "api_key.txt"

    if (-not (Test-Path -Path $geminiConfigDir -PathType Container)) {
        Write-Log -Message "Tworzenie katalogu konfiguracyjnego: $geminiConfigDir" -Level 'INFO' -Component 'Step5'
        New-Item -Path $geminiConfigDir -ItemType Directory -Force | Out-Null
    }

    $isKeyFileNew = -not (Test-Path -Path $geminiKeyFile)

    if ($PSBoundParameters.ContainsKey('ApiKey') -and (-not [string]::IsNullOrWhiteSpace($ApiKey))) {
        Write-Log -Message "Zapisywanie przekazanego klucza API do pliku: $geminiKeyFile" -Level 'INFO' -Component 'Step5'
        $keyContent = @(
            "# Google Gemini API Key",
            $ApiKey.Trim()
        ) -join [Environment]::NewLine
        Set-Content -Path $geminiKeyFile -Value $keyContent -Encoding UTF8 -Force
        $env:GEMINI_API_KEY = $ApiKey.Trim()
    }
    elseif ($isKeyFileNew) {
        Write-Log -Message "Generowanie szablonu pliku klucza API: $geminiKeyFile" -Level 'INFO' -Component 'Step5'
        $templateContent = @(
            "# Wklej ponizej swoj klucz Google Gemini API (z Google AI Studio)",
            "# Usun ponizsza linie przykladowa i wklej swoj klucz:",
            "AIzaSy..."
        ) -join [Environment]::NewLine
        Set-Content -Path $geminiKeyFile -Value $templateContent -Encoding UTF8 -Force
    }

    # Integracja z profilem PowerShell ($PROFILE)
    try {
        $profileDir = Split-Path -Path $PROFILE -Parent
        if (-not (Test-Path -Path $profileDir)) {
            Write-Log -Message "Tworzenie katalogu profilu PowerShell: $profileDir" -Level 'DEBUG' -Component 'Step5'
            New-Item -Path $profileDir -ItemType Directory -Force | Out-Null
        }

        if (-not (Test-Path -Path $PROFILE)) {
            Write-Log -Message "Tworzenie nowego pliku profilu: $PROFILE" -Level 'INFO' -Component 'Step5'
            New-Item -Path $PROFILE -ItemType File -Force | Out-Null
        }

        $profileContent = Get-Content -Path $PROFILE -Raw -ErrorAction SilentlyContinue
        if ($null -eq $profileContent) { $profileContent = "" }

        $startMarker = "# >>> GEMINI-CLI-INIT >>>"
        $endMarker   = "# <<< GEMINI-CLI-INIT <<<"

        if ($profileContent -notmatch [regex]::Escape($startMarker)) {
            Write-Log -Message "Dodawanie idempotentnego bloku ladowania klucza API do profilu: $PROFILE" -Level 'INFO' -Component 'Step5'

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
            Write-Log -Message "Profil PowerShell zaktualizowany pomyslnie." -Level 'INFO' -Component 'Step5'
        } else {
            Write-Log -Message "Profil PowerShell zawiera juz blok inicjalizacyjny GEMINI-CLI-INIT. Pomijanie modyfikacji." -Level 'INFO' -Component 'Step5'
        }

        # Ustawienie zmiennej w biezacej sesji jesli klucz juz istnieje w pliku
        if (Test-Path -Path $geminiKeyFile) {
            $rawKey = (Get-Content -Path $geminiKeyFile | Where-Object { $_ -notmatch '^\s*#' -and $_.Trim() -ne '' } | Select-Object -First 1)
            if ($rawKey -and $rawKey -notlike "AIzaSy...") {
                $env:GEMINI_API_KEY = $rawKey.Trim()
                Write-Log -Message "Zmienna srodowiskowa GEMINI_API_KEY zostala zainicjalizowana w biezacej sesji." -Level 'INFO' -Component 'Step5'
            }
        }
    }
    catch {
        Write-Log -Message "Nie udalo sie skonfigurowac profilu PowerShell: $_" -Level 'ERROR' -Component 'Step5'
        exit 2
    }

    # Otwarcie pliku klucza w edytorze (jesli nie przekazano -Quiet ani nie podano gotowego klucza)
    if ((-not $Quiet) -and ($isKeyFileNew -or (-not $PSBoundParameters.ContainsKey('ApiKey')))) {
        Write-Log -Message "Otwieranie pliku klucza API w Notatniku w celu uzupelnienia klucza..." -Level 'INFO' -Component 'Step5'
        Start-Process -FilePath "notepad.exe" -ArgumentList "`"$geminiKeyFile`""
    }

    Write-Progress -Activity $activity -Completed
    Write-Log -Message "Instalacja i konfiguracja srodowiska Google Gemini CLI zakonczona pelnym sukcesem!" -Level 'INFO' -Component 'Main'
    Write-Host "`n[SUKCES] Srodowisko Google Gemini CLI jest gotowe!" -ForegroundColor Green
    Write-Host "Klucz API: $geminiKeyFile" -ForegroundColor Cyan
    Write-Host "Uruchomienie CLI: wpisz 'gemini' w nowym oknie konsoli.`n" -ForegroundColor Yellow

    exit 0
}
catch {
    Write-Log -Message "Wystapil nieoczekiwany blad krytyczny: $_" -Level 'ERROR' -Component 'Fatal'
    Write-Progress -Activity $activity -Completed
    exit 1
}