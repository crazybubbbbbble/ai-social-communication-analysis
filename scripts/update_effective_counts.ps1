param(
    [int]$WeiboTarget = 0,
    [int]$XhsTarget = 0,
    [int]$TotalTarget = 2400
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$Root = Split-Path -Parent $PSScriptRoot
$DateTag = Get-Date -Format "yyyy-MM-dd"

Push-Location $Root
try {
    $WeiboContent = "data\raw\mediacrawler\weibo\csv\search_contents_$DateTag.csv"
    $WeiboComments = "data\raw\mediacrawler\weibo\csv\search_comments_$DateTag.csv"
    $XhsContent = "data\raw\mediacrawler\xhs\csv\search_contents_$DateTag.csv"
    $XhsComments = "data\raw\mediacrawler\xhs\csv\search_comments_$DateTag.csv"

    if (Test-Path -LiteralPath $WeiboContent) {
        python scripts\import_mediacrawler_csv.py --input $WeiboContent --platform wb
    }
    if (Test-Path -LiteralPath $WeiboComments) {
        python scripts\import_mediacrawler_comments.py --input $WeiboComments --platform wb
    }
    if (Test-Path -LiteralPath $XhsContent) {
        python scripts\import_mediacrawler_csv.py --input $XhsContent --platform xhs
    }
    if (Test-Path -LiteralPath $XhsComments) {
        python scripts\import_mediacrawler_comments.py --input $XhsComments --platform xhs
    }

    python scripts\clean_text.py
    python scripts\label_rules.py
    python scripts\clean_comments.py
    python scripts\label_comments.py
    python scripts\make_stats.py
    python scripts\validate_schema.py

    $env:WEIBO_TARGET = [string]$WeiboTarget
    $env:XHS_TARGET = [string]$XhsTarget
    $env:TOTAL_TARGET = [string]$TotalTarget
    @'
import csv
import os
from collections import Counter
from pathlib import Path

weibo_target = int(os.environ["WEIBO_TARGET"])
xhs_target = int(os.environ["XHS_TARGET"])
total_target = int(os.environ["TOTAL_TARGET"])

post_path = Path("data/clean/labeled_all_platforms.csv")
comment_path = Path("data/clean/labeled_comments_all_platforms.csv")

with post_path.open("r", encoding="utf-8-sig", newline="") as f:
    posts = list(csv.DictReader(f))
post_kept = [r for r in posts if not (r.get("delete_reason") or "").strip()]
post_counts = Counter(r.get("platform", "") for r in post_kept)

with comment_path.open("r", encoding="utf-8-sig", newline="") as f:
    comments = list(csv.DictReader(f))
comment_kept = [r for r in comments if not (r.get("delete_reason") or "").strip()]
comment_counts = Counter(r.get("platform", "") for r in comment_kept)

wb = post_counts.get("wb", 0)
xhs = post_counts.get("xhs", 0)

print("=== effective snapshot ===")
print(f"posts_total_kept={len(post_kept)}")
print(f"posts_total_target={total_target} gap={max(0, total_target - len(post_kept))}")
print(f"wb_posts_kept={wb} target={weibo_target} gap={max(0, weibo_target - wb)}")
print(f"xhs_posts_kept={xhs} target={xhs_target} gap={max(0, xhs_target - xhs)}")
print(f"comments_total_kept={len(comment_kept)}")
print(f"wb_comments_kept={comment_counts.get('wb', 0)}")
print(f"xhs_comments_kept={comment_counts.get('xhs', 0)}")
print(f"target_reached={len(post_kept) >= total_target}")
'@ | python -
}
finally {
    Pop-Location
}
