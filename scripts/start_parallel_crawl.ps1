param(
    [int]$WeiboMaxNotes = 30,
    [int]$XhsMaxNotes = 45,
    [int]$MaxCommentsPerPost = 50,
    [int]$MaxConcurrency = 3,
    [double]$SleepSec = 1.5,
    [string]$LoginType = "qrcode"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$Root = Split-Path -Parent $PSScriptRoot
$MediaCrawler = Join-Path $Root "tools\MediaCrawler"
$OutDir = Join-Path $Root "data\raw\mediacrawler"
$LogDir = Join-Path $Root "reports\crawl_logs"
$Stamp = Get-Date -Format "yyyyMMdd_HHmmss"

New-Item -ItemType Directory -Force -Path $OutDir, $LogDir | Out-Null

$WeiboKeywords = Get-Content -LiteralPath (Join-Path $Root "config\mediacrawler_keywords\weibo_p0_comma.txt") -Raw -Encoding UTF8
$XhsKeywords = Get-Content -LiteralPath (Join-Path $Root "config\mediacrawler_keywords\xhs_p1_comma.txt") -Raw -Encoding UTF8

function Start-CrawlJob {
    param(
        [string]$Platform,
        [string]$Keywords,
        [int]$MaxNotes
    )

    $LogPath = Join-Path $LogDir "$Platform`_$Stamp.log"
    $ErrPath = Join-Path $LogDir "$Platform`_$Stamp.err.log"
    $Command = @"
`$env:NO_PROXY='localhost,127.0.0.1'
`$env:no_proxy='localhost,127.0.0.1'
`$env:PYTHONUTF8='1'
`$env:PYTHONIOENCODING='utf-8'
Remove-Item Env:SSL_CERT_DIR -ErrorAction SilentlyContinue
Set-Location -LiteralPath '$MediaCrawler'
uv run main.py --platform $Platform --lt $LoginType --type search --keywords '$($Keywords.Trim().Replace("'", "''"))' --crawler_max_notes_count $MaxNotes --save_data_option csv --save_data_path '..\..\data\raw\mediacrawler' --get_comment true --max_comments_count_singlenotes $MaxCommentsPerPost --max_concurrency_num $MaxConcurrency --crawler_max_sleep_sec $SleepSec --headless false
"@

    $Process = Start-Process powershell `
        -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $Command) `
        -WorkingDirectory $Root `
        -RedirectStandardOutput $LogPath `
        -RedirectStandardError $ErrPath `
        -WindowStyle Hidden `
        -PassThru

    [pscustomobject]@{
        Platform = $Platform
        Pid = $Process.Id
        Log = $LogPath
        ErrorLog = $ErrPath
    }
}

$Jobs = @(
    Start-CrawlJob -Platform "wb" -Keywords $WeiboKeywords -MaxNotes $WeiboMaxNotes
    Start-CrawlJob -Platform "xhs" -Keywords $XhsKeywords -MaxNotes $XhsMaxNotes
)

$Jobs | Format-Table -AutoSize
