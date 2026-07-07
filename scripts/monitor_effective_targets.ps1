param(
    [int]$WeiboTarget = 0,
    [int]$XhsTarget = 0,
    [int]$TotalTarget = 2400,
    [int]$IntervalMinutes = 10,
    [int]$MaxRounds = 72
)

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$Root = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $Root "reports\crawl_logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

Push-Location $Root
try {
    for ($Round = 1; $Round -le $MaxRounds; $Round++) {
        $Stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Write-Host "=== monitor round=$Round time=$Stamp ==="

        powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\update_effective_counts.ps1") `
            -WeiboTarget $WeiboTarget `
            -XhsTarget $XhsTarget `
            -TotalTarget $TotalTarget

        $env:WEIBO_TARGET = [string]$WeiboTarget
        $env:XHS_TARGET = [string]$XhsTarget
        $env:TOTAL_TARGET = [string]$TotalTarget
        $Reached = @'
import csv
import os
from pathlib import Path
rows = list(csv.DictReader(Path("data/clean/labeled_all_platforms.csv").open("r", encoding="utf-8-sig", newline="")))
kept = [r for r in rows if not (r.get("delete_reason") or "").strip()]
print("1" if len(kept) >= int(os.environ["TOTAL_TARGET"]) else "0")
'@ | python -

        if ($Reached.Trim() -eq "1") {
            Write-Host "TARGET_REACHED"
            break
        }

        Start-Sleep -Seconds ($IntervalMinutes * 60)
    }
}
finally {
    Pop-Location
}
