<#
.SYNOPSIS
    Scans item folders for Vinted sales and generates structured JSON metadata and an Excel-compatible CSV catalog.

.DESCRIPTION
    Generate-VintedMetadata.ps1 scans a root folder containing directories of items to be sold on Vinted.
    For each folder, it collects image files, infers product attributes (title, brand, size, color, category,
    condition, package size, estimated price, and SEO-optimized description) from folder naming patterns,
    and writes a 'vinted_item.json' inside each folder as well as consolidated 'catalog.json' and 'catalog.csv'.

.PARAMETER SourcePath
    The directory containing item folders. Defaults to 'c:\Dane\rpindela\Drive\Sprzedaż'.

.PARAMETER OutputCatalogPath
    The path where consolidated catalog files will be exported. Defaults to current directory or SourcePath.

.PARAMETER ForceOverwrite
    If set, overwrites existing 'vinted_item.json' files inside item directories.

.PARAMETER EnableLogging
    If set to $true, writes detailed operational logs to C:\Logs\<timestamp>-Generate-VintedMetadata-<computer>-<user>.log.

.PARAMETER Help
    Displays usage instructions and examples.

.EXAMPLE
    .\Generate-VintedMetadata.ps1 -Help
    Displays help information and standards.

.EXAMPLE
    .\Generate-VintedMetadata.ps1 -SourcePath "C:\Dane\rpindela\Drive\Sprzedaż"
    Processes all folders and generates metadata.

.NOTES
    Author: Roman Pindela (roman.pindela@gmail.com)
    GitHub: https://github.com/romanpindela
    Version: 1.0.0
#>

[CmdletBinding()]
param (
    [Parameter(Mandatory = $false)]
    [string]$SourcePath = "c:\Dane\rpindela\Drive\Sprzedaż",

    [Parameter(Mandatory = $false)]
    [string]$OutputCatalogPath = "",

    [Parameter(Mandatory = $false)]
    [switch]$ForceOverwrite,

    [Parameter(Mandatory = $false)]
    [switch]$EnableLogging,

    [Parameter(Mandatory = $false)]
    [Alias("h")]
    [switch]$Help
)

# Show help if requested or if no arguments and SourcePath does not exist
if ($Help) {
    Write-Host @"
================================================================================
 VINTED METADATA GENERATOR - CLI HELP
================================================================================
 Author:  Roman Pindela (roman.pindela@gmail.com)
 GitHub:  https://github.com/romanpindela
 Version: 1.0.0

 Description:
   Scans sales folders, extracts photos, parses product properties, and generates
   structured JSON & CSV metadata for Vinted listing automation.

 Parameters:
   -SourcePath <string>       Directory containing item folders to sell.
                              (Default: c:\Dane\rpindela\Drive\Sprzedaż)
   -OutputCatalogPath <string> Target directory for consolidated catalog.json and catalog.csv.
   -ForceOverwrite            Re-generate metadata even if vinted_item.json exists.
   -EnableLogging             Enable logging to C:\Logs\
   -Help (-h)                 Show this help screen.

 Examples:
   .\Generate-VintedMetadata.ps1 -Help
   .\Generate-VintedMetadata.ps1 -SourcePath "C:\Dane\rpindela\Drive\Sprzedaż"
   .\Generate-VintedMetadata.ps1 -SourcePath "C:\Dane\rpindela\Drive\Sprzedaż" -ForceOverwrite

================================================================================
"@ -ForegroundColor Cyan
    exit 0
}

# Setup logging
$scriptName = "Generate-VintedMetadata"
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

Write-Log "Starting $scriptName v1.0.0..."
Write-Log "Author: Roman Pindela (roman.pindela@gmail.com)"

if (-not (Test-Path -Path $SourcePath)) {
    Write-Log "SourcePath '$SourcePath' does not exist! Please check the folder path." "ERROR"
    exit 1
}

if ([string]::IsNullOrWhiteSpace($OutputCatalogPath)) {
    $OutputCatalogPath = $PSScriptRoot
    if ([string]::IsNullOrWhiteSpace($OutputCatalogPath)) {
        $OutputCatalogPath = $SourcePath
    }
}

# Function to parse folder name into structured attributes
function Infer-ProductAttributes {
    param (
        [string]$FolderName
    )

    $normalized = $FolderName.ToLower()
    
    # Defaults
    $brand = "Inna"
    $size = "Inny"
    $categoryKeywords = @("Ubrania")
    $colors = @()
    $packageSize = "Średnia"
    $condition = "Bardzo dobry"
    $price = 35

    # Brand detection
    if ($normalized -match "adidas") { $brand = "Adidas"; $price = 49 }
    elseif ($normalized -match "medhoodie") { $brand = "Medhoodie"; $price = 45 }
    elseif ($normalized -match "hama") { $brand = "Hama"; $price = 55; $packageSize = "Duża" }
    elseif ($normalized -match "cat\b|caterpillar") { $brand = "CAT"; $price = 60; $packageSize = "Duża" }
    elseif ($normalized -match "vb") { $brand = "Very Bella / VB"; $price = 40 }

    # Color detection
    if ($normalized -match "granatow") { $colors += "Granatowy" }
    if ($normalized -match "czarn") { $colors += "Czarny" }
    if ($normalized -match "różow|rozow|rose") { $colors += "Różowy" }
    if ($normalized -match "czerwon") { $colors += "Czerwony" }
    if ($normalized -match "szar") { $colors += "Szary" }

    # Size detection
    if ($normalized -match "\b34\b") { $size = "34 / XS" }
    elseif ($normalized -match "\b38\b") { $size = "38 / M" }
    elseif ($normalized -match "\b(s|rozmiar s)\b") { $size = "S" }
    elseif ($normalized -match "110") { $size = "110 cm (4-5 lat)" }
    elseif ($normalized -match "152") { $size = "152 cm (11-12 lat)" }
    elseif ($normalized -match "155") { $size = "155 cm" }
    elseif ($normalized -match "7\s?lat") { $size = "122 cm (7 lat)" }
    elseif ($normalized -match "10\s?lat") { $size = "140 cm (10 lat)" }
    elseif ($normalized -match "11\s?lat") { $size = "146 cm (11 lat)" }
    elseif ($normalized -match "12mc") { $size = "80 cm (9-12 miesięcy)" }
    elseif ($normalized -match "98") { $size = "98 cm (2-3 lata)" }

    # Category and Title mapping
    $title = ""
    $descIntro = ""
    
    if ($normalized -match "bluzka medhoodie") {
        $title = "Damska bluza medyczna Medhoodie granatowa rozm. S"
        $categoryKeywords = @("Kobiety", "Ubrania", "Topy i koszulki", "Inne")
        $descIntro = "Stylowa, wygodna damska bluza medyczna renomowanej marki Medhoodie w kolorze granatowym. Idealna do pracy w gabinecie lekarskim, stomatologicznym lub kosmetycznym."
        $packageSize = "Mała"
    }
    elseif ($normalized -match "bluza adidas") {
        $title = "Bluza dziecięca sportowa Adidas rozpinana 7 lat"
        $categoryKeywords = @("Dzieci", "Ubrania dla dziewczynek / chłopców", "Bluzy")
        $descIntro = "Oryginalna bluza sportowa marki Adidas dla dziecka w wieku ok. 7 lat. Miękki, wygodny materiał, zamek działa płynnie."
        $packageSize = "Średnia"
    }
    elseif ($normalized -match "bluza różowa|bluza r.owa") {
        $title = "Dziewczęca ciepła bluza różowa ze ściągaczami"
        $categoryKeywords = @("Dzieci", "Ubrania", "Bluzy")
        $descIntro = "Śliczna, wygodna bluza w kolorze różowym. Zadbana, bez plam ani uszkodzeń."
        $packageSize = "Średnia"
    }
    elseif ($normalized -match "4x spodnie 34") {
        $title = "Zestaw 4 par spodni damskich rozmiar 34 XS komplet"
        $categoryKeywords = @("Kobiety", "Ubrania", "Spodnie")
        $descIntro = "Zestaw 4 par modnych spodni damskich w rozmiarze 34 (XS). Wszystkie pary zadbane, świetnie leżą. Cena za cały 4-pak!"
        $price = 69
        $packageSize = "Średnia"
    }
    elseif ($normalized -match "spodnie ci.owe") {
        $title = "Wygodne spodnie ciążowe z pasem rozm. S / 155 cm"
        $categoryKeywords = @("Kobiety", "Odzież ciążowa", "Spodnie")
        $descIntro = "Bardzo wygodne spodnie ciążowe z elastycznym pasem podtrzymującym brzuch. Rozmiar S, dedykowane na wzrost ok. 155 cm."
        $packageSize = "Średnia"
    }
    elseif ($normalized -match "spodnie damskie 38 czarne garnitur") {
        $title = "Eleganckie spodnie damskie czarne garniturowe rozm. 38 M"
        $categoryKeywords = @("Kobiety", "Ubrania", "Spodnie garniturowe")
        $descIntro = "Klasyczne, eleganckie czarne spodnie damskie w fasonie garniturowym. Idealne do biura, na uroczystości lub formalne spotkania. Rozmiar 38 (M)."
        $price = 45
        $packageSize = "Średnia"
    }
    elseif ($normalized -match "plecak cat") {
        $title = "Solidny plecak miejski / szkolny CAT Caterpillar czarny"
        $categoryKeywords = @("Mężczyźni", "Akcesoria", "Torby i plecaki")
        $descIntro = "Mocny, wytrzymały plecak renomowanej marki CAT (Caterpillar). Posiada pojemne komory, solidne zamki i wygodne szelki. Stan bardzo dobry."
        $packageSize = "Duża"
        $price = 79
    }
    elseif ($normalized -match "plecak hama") {
        $col = if ($normalized -match "rose") { "różowy pastelowy" } else { "szary" }
        $title = "Wygodny plecak szkolny / miejski Hama $col"
        $categoryKeywords = @("Dzieci", "Przybory szkolne", "Plecaki")
        $descIntro = "Wysokiej jakości plecak marki Hama. Ergonomiczne plecy, regulowane szelki, mnóstwo praktycznych przegródek."
        $packageSize = "Duża"
        $price = 59
    }
    elseif ($normalized -match "sukienka") {
        $pattern = "w kratkę"
        if ($normalized -match "kropki") { $pattern = "w kropki" }
        elseif ($normalized -match "kwiaty") { $pattern = "w kwiaty" }
        elseif ($normalized -match "paski") { $pattern = "w paski" }
        elseif ($normalized -match "vb") { $pattern = "elegancka VB" }
        
        $title = "Zwiewna modna sukienka damska/dziewczęca $pattern"
        $categoryKeywords = @("Kobiety", "Ubrania", "Sukienki")
        $descIntro = "Piękna, kobieca sukienka $pattern. Zadbana, bardzo ładnie układa się na sylwetce. Materiał przewiewny i miły w dotyku."
        $packageSize = "Mała"
        $price = 39
    }
    elseif ($normalized -match "etui 14") {
        $title = "Eleganckie ochronne etui / pokrowiec na laptopa 14 cali"
        $categoryKeywords = @("Elektronika", "Komputery i akcesoria", "Torby i etui")
        $descIntro = "Wysokiej jakości pokrowiec / etui dedykowane na laptopa do 14 cali. Miękka wyściółka chroni obudowę przed zarysowaniami i wstrząsami."
        $packageSize = "Średnia"
        $price = 35
    }
    elseif ($normalized -match "torebka sk.rzana") {
        $title = "Elegancka damska torebka skórzana szara na ramię"
        $categoryKeywords = @("Kobiety", "Torebki", "Torby na ramię")
        $descIntro = "Klasyczna, pojemna torebka damska wykonana ze skóry w eleganckim szarym kolorze. Posiada wygodny pasek oraz kieszenie zapinane na zamek."
        $packageSize = "Średnia"
        $price = 75
    }
    elseif ($normalized -match "masażer|masazer") {
        $title = "Wielofunkcyjny masażer relaksacyjny / wibracyjny"
        $categoryKeywords = @("Zdrowie i uroda", "Masażery")
        $descIntro = "Elektryczny masażer do ciała i mięśni. Świetnie sprawdza się do relaksu po pracy i łagodzenia napięcia mięśniowego. W 100% sprawny."
        $packageSize = "Średnia"
        $price = 55
    }
    else {
        # Fallback dynamic title
        $capitalized = (Get-Culture).TextInfo.ToTitleCase($FolderName)
        $title = "$capitalized - Stan bardzo dobry"
        $descIntro = "Przedmiot w bardzo dobrym stanie, zadbany, czysty i w 100% zgodny z załączonymi zdjęciami."
    }

    $description = @"
$descIntro

✔️ Stan: $condition
✔️ Marka: $brand
✔️ Rozmiar: $size
$(if ($colors.Count -gt 0) { "✔️ Kolor: " + ($colors -join ", ") })

Dokładny stan oraz detale widoczne na załączonych zdjęciach.
📦 Szybka i bezpieczna wysyłka paczkomatem (zwykle tego samego lub kolejnego dnia).
Zapraszam do tworzenia zestawów z moich pozostałych ogłoszeń – zniżka na zestawy włączona!
"@.Trim()

    return [PSCustomObject]@{
        Title            = $title
        Brand            = $brand
        Size             = $size
        CategoryKeywords = $categoryKeywords
        Colors           = $colors
        Condition        = $condition
        Price            = $price
        PackageSize      = $packageSize
        Description      = $description
    }
}

# Scan items
$itemDirs = Get-ChildItem -Path $SourcePath -Directory | Where-Object { $_.Name -notmatch "^_Wystawione" -and $_.Name -notmatch "^\." }
Write-Log "Found $($itemDirs.Count) item folders in '$SourcePath'."

$catalog = [System.Collections.Generic.List[PSCustomObject]]::new()
$processedCount = 0

foreach ($dir in $itemDirs) {
    $folderName = $dir.Name
    $folderPath = $dir.FullName
    $metadataFile = Join-Path $folderPath "vinted_item.json"

    # Find photos in folder
    $photos = Get-ChildItem -Path $folderPath -File | Where-Object { $_.Extension -match "\.(jpg|jpeg|png)$" } | Sort-Object Name

    if ($photos.Count -eq 0) {
        Write-Log "Skipping '$folderName' - no photos found." "WARN"
        continue
    }

    $itemData = $null

    if ((Test-Path -Path $metadataFile) -and (-not $ForceOverwrite)) {
        try {
            $rawJson = Get-Content -Path $metadataFile -Raw -Encoding UTF8
            $itemData = $rawJson | ConvertFrom-Json
            Write-Log "Loaded existing metadata for '$folderName'."
        } catch {
            Write-Log "Failed to parse existing metadata for '$folderName'. Re-generating..." "WARN"
            $itemData = $null
        }
    }

    if ($null -eq $itemData) {
        $attrs = Infer-ProductAttributes -FolderName $folderName
        
        $itemData = [PSCustomObject]@{
            id               = ($folderName -replace '[^a-zA-Z0-9]', '-').ToLower()
            folder_name      = $folderName
            folder_path      = $folderPath
            title            = $attrs.Title
            description      = $attrs.Description
            category_keywords= $attrs.CategoryKeywords
            brand            = $attrs.Brand
            size             = $attrs.Size
            condition        = $attrs.Condition
            colors           = $attrs.Colors
            price            = $attrs.Price
            package_size     = $attrs.PackageSize
            photos           = @($photos | ForEach-Object { $_.FullName })
            photo_count      = $photos.Count
            status           = "ready"
            updated_at       = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        }

        # Save to local folder
        $jsonContent = $itemData | ConvertTo-Json -Depth 5
        [System.IO.File]::WriteAllText($metadataFile, $jsonContent, [System.Text.Encoding]::UTF8)
        Write-Log "Generated metadata for '$folderName' ($($photos.Count) photos, $attrs.Price PLN)."
    }

    $catalog.Add($itemData)
    $processedCount++
}

# Export consolidated catalog.json and catalog.csv
$catalogJsonPath = Join-Path $OutputCatalogPath "catalog.json"
$catalogCsvPath = Join-Path $OutputCatalogPath "catalog.csv"

$catalogJson = $catalog | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText($catalogJsonPath, $catalogJson, [System.Text.Encoding]::UTF8)

# Flatten for CSV export
$flatCatalog = $catalog | Select-Object id, folder_name, title, brand, size, condition, price, package_size, photo_count, status, folder_path
$flatCatalog | Export-Csv -Path $catalogCsvPath -NoTypeInformation -Encoding UTF8 -Delimiter ";"

Write-Log "=========================================================="
Write-Log "Processing Complete!"
Write-Log "Items Processed:      $processedCount"
Write-Log "Consolidated Catalog: $catalogJsonPath"
Write-Log "Excel-ready CSV:      $catalogCsvPath"
Write-Log "=========================================================="
