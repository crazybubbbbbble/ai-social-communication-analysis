param(
    [int]$StartIndex = 2,
    [int]$EndIndex = 34,
    [int]$TargetKept = 800,
    [int]$TotalTarget = 0,
    [int]$MaxNotes = 40,
    [int]$MaxCommentsPerPost = 40,
    [double]$SleepSec = 4
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$Root = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $Root "reports\crawl_logs"
$DateTag = Get-Date -Format "yyyy-MM-dd"
$KeywordFile = Join-Path $Root "config\mediacrawler_keywords\xhs_p1.txt"
$Keywords = @(Get-Content -LiteralPath $KeywordFile -Encoding UTF8 | Where-Object { $_.Trim() })

function Get-XhsCrawlerProcess {
    Get-CimInstance Win32_Process |
        Where-Object { $_.CommandLine -like "*main.py*" -and $_.CommandLine -like "*--platform xhs*" }
}

function Wait-XhsIdle {
    while (Get-XhsCrawlerProcess) {
        Start-Sleep -Seconds 15
    }
}

function Get-XhsKeptCount {
    $Path = Join-Path $Root "data\clean\labeled_all_platforms.csv"
    if (-not (Test-Path -LiteralPath $Path)) {
        return 0
    }
    $Rows = Import-Csv -LiteralPath $Path -Encoding UTF8
    @($Rows | Where-Object { $_.platform -eq "xhs" -and [string]::IsNullOrWhiteSpace($_.delete_reason) }).Count
}

function Get-TotalKeptCount {
    $Path = Join-Path $Root "data\clean\labeled_all_platforms.csv"
    if (-not (Test-Path -LiteralPath $Path)) {
        return 0
    }
    $Rows = Import-Csv -LiteralPath $Path -Encoding UTF8
    @($Rows | Where-Object { [string]::IsNullOrWhiteSpace($_.delete_reason) }).Count
}

Push-Location $Root
try {
    for ($Index = $StartIndex; $Index -le $EndIndex; $Index++) {
        $CurrentKept = Get-XhsKeptCount
        $CurrentTotalKept = Get-TotalKeptCount
        if ($TotalTarget -gt 0 -and $CurrentTotalKept -ge $TotalTarget) {
            Write-Host "total target reached: kept=$CurrentTotalKept"
            break
        }
        if ($TotalTarget -le 0 -and $CurrentKept -ge $TargetKept) {
            Write-Host "xhs target reached: kept=$CurrentKept"
            break
        }
        if ($Index -ge $Keywords.Count) {
            Write-Host "xhs keyword list exhausted at index=$Index"
            break
        }

        Wait-XhsIdle
        $Keyword = $Keywords[$Index]
        $Stamp = Get-Date -Format "yyyyMMdd_HHmmss"
        Write-Host "=== xhs queue index=$Index xhs_kept=$CurrentKept total_kept=$CurrentTotalKept keyword=$Keyword ==="

        $PreviousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\run_mediacrawler_batch.ps1") `
            -Platform xhs `
            -StartIndex $Index `
            -Limit 1 `
            -MaxNotes $MaxNotes `
            -GetComment `
            -MaxCommentsPerPost $MaxCommentsPerPost `
            -MaxConcurrency 1 `
            -SleepSec $SleepSec `
            -LoginType qrcode `
            *> (Join-Path $LogDir "xhs_queue_$Index`_$Stamp.log")
        $ErrorActionPreference = $PreviousErrorActionPreference

        $ContentCsv = Join-Path $Root "data\raw\mediacrawler\xhs\csv\search_contents_$DateTag.csv"
        $CommentCsv = Join-Path $Root "data\raw\mediacrawler\xhs\csv\search_comments_$DateTag.csv"
        if (Test-Path -LiteralPath $ContentCsv) {
            python scripts\import_mediacrawler_csv.py --input $ContentCsv --platform xhs
        }
        if (Test-Path -LiteralPath $CommentCsv) {
            python scripts\import_mediacrawler_comments.py --input $CommentCsv --platform xhs
        }
        python scripts\clean_text.py
        python scripts\label_rules.py
        python scripts\clean_comments.py
        python scripts\label_comments.py
        python scripts\make_stats.py
        python scripts\validate_schema.py
    }
}
finally {
    Pop-Location
}
