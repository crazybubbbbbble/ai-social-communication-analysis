# AI Social Communication Lens

An interactive data visualization website for exploring how young people discuss and use generative AI in everyday interpersonal communication, including messaging, relationship advice, apology and refusal scripts, privacy concerns, and AI-assisted chatting.

## Live Site

GitHub Pages will publish the dashboard at:

`https://crazybubbbbbble.github.io/ai-social-communication-lens/`

## What This Project Shows

- Platform-level overview for Weibo and Xiaohongshu data.
- Trends, category comparisons, keyword bubbles, risk boundaries, and high-interaction cases.
- Comment analysis linked to public attitudes such as support, concern, questioning, jokes, and practical suggestions.
- An interactive visual dashboard built for a production internship project on AI application scenarios.

## Repository Structure

```text
config/              Keyword lists and label dictionaries
scripts/             Crawling, import, cleaning, labeling, statistics, and export scripts
data/raw/            Aggregated raw CSV tables exported from crawler results
data/clean/          Cleaned and labeled post/comment tables
data/stats/          Analysis-ready summary tables
figures/             Static analysis figures generated during exploration
docs/                Supporting notes and data dictionaries
reports/             Progress notes and reviewed case outputs
visualization_app/   React + Vite interactive dashboard
```

The crawler pipeline uses MediaCrawler as the main collector, but the third-party checkout, local browser profile, virtual environments, and crawler cache snapshots are intentionally excluded from this repository.

## Current Dataset Snapshot

- Effective posts after cleaning: 2,069
- Effective comments after cleaning: 7,254
- Dashboard records after source filtering: 2,052 posts and 6,354 comments
- Platforms used in the dashboard: Weibo and Xiaohongshu

The public dashboard uses the processed visualization dataset in `visualization_app/public/data/dashboard.json`.

## Tech Stack

- React
- Vite
- ECharts
- D3
- Three.js / 3D Force Graph
- GSAP
- GitHub Pages

## Local Development

```bash
cd visualization_app
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Build

```bash
cd visualization_app
npm run build
```

The static build output is generated in `visualization_app/dist`.

## Notes

This repository publishes the crawler configuration, reproducible processing scripts, aggregated raw CSV tables, cleaned data, statistics, and the interactive dashboard. It does not publish browser login state, local crawler caches, third-party dependency folders, or virtual environments.
