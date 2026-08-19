#
# Telecharge les photos des joueurs Kings League Espagne (source officielle
# kingsleague.pro) et les place au bon endroit dans le repo kings-manager,
# puis (optionnel) commit + push.
#
# Utilisation :
#   1. Place ce script et "espagne_manifest.csv" a la racine de ton clone
#      local du repo kings-manager (le dossier qui contient index.html).
#   2. Dans le terminal PowerShell, lance :
#        powershell -ExecutionPolicy Bypass -File .\download_and_push.ps1
#      (ou clique droit sur le fichier > "Executer avec PowerShell")
#

$ErrorActionPreference = "Stop"

$Manifest  = "espagne_manifest.csv"
$TargetDir = "images/players/espagne"
$UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

if (-not (Test-Path $Manifest)) {
    Write-Host "Erreur : $Manifest introuvable. Lance ce script depuis le dossier ou tu l'as copie." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $TargetDir)) {
    Write-Host "Erreur : le dossier $TargetDir n'existe pas ici." -ForegroundColor Red
    Write-Host "Lance ce script depuis la racine de ton clone local du repo kings-manager (a cote de index.html)." -ForegroundColor Red
    exit 1
}

$rows = Import-Csv -Path $Manifest
$okCount = 0
$failList = @()

foreach ($row in $rows) {
    $file = $row.file
    $url  = $row.url
    if ([string]::IsNullOrWhiteSpace($file)) { continue }

    $outPath = Join-Path $TargetDir $file
    $outDir  = Split-Path $outPath -Parent
    if (-not (Test-Path $outDir)) {
        New-Item -ItemType Directory -Path $outDir -Force | Out-Null
    }

    Write-Host -NoNewline "Telechargement : $file ... "

    $tmpPath = "$outPath.tmp"
    $success = $false
    try {
        curl.exe -sSL -A $UA --retry 2 --retry-delay 1 -o $tmpPath $url
        if ((Test-Path $tmpPath) -and (Get-Item $tmpPath).Length -gt 0) {
            # verifie que c'est bien une image PNG/JPEG (signature de fichier)
            $bytes = [System.IO.File]::ReadAllBytes($tmpPath)
            $isPng  = $bytes.Length -ge 4 -and $bytes[0] -eq 0x89 -and $bytes[1] -eq 0x50
            $isJpeg = $bytes.Length -ge 3 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xD8
            if ($isPng -or $isJpeg) {
                Move-Item -Path $tmpPath -Destination $outPath -Force
                $success = $true
            }
        }
    } catch {
        $success = $false
    }

    if ($success) {
        Write-Host "OK" -ForegroundColor Green
        $okCount++
    } else {
        if (Test-Path $tmpPath) { Remove-Item $tmpPath -Force }
        Write-Host "ECHEC" -ForegroundColor Red
        $failList += $file
    }
}

Write-Host ""
Write-Host "Termine : $okCount photos telechargees, $($failList.Count) echecs."
if ($failList.Count -gt 0) {
    Write-Host "Fichiers en echec (reseau/URL invalide) :"
    $failList | ForEach-Object { Write-Host " - $_" }
}
Write-Host ""
Write-Host "Les joueurs sans photo officielle disponible (39) sont listes dans espagne_not_found.txt"
Write-Host "(le jeu affiche automatiquement leurs initiales, rien a faire de plus pour eux)."
Write-Host ""

$reply = Read-Host "Committer et pousser ces changements sur GitHub maintenant ? [y/N]"
if ($reply -match '^[Yy]$') {
    git add $TargetDir
    git commit -m "Ajout des photos des joueurs Espagne (Kings League, source officielle kingsleague.pro)"
    git push
    Write-Host "Pousse sur GitHub."
} else {
    Write-Host "Pas de commit automatique. Les fichiers sont prets dans $TargetDir, tu peux commit/push toi-meme."
}
