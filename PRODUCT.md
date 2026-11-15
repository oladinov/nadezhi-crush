# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Nadezhi's streaming community and viewers playing casual or competitive Match-3 puzzle sessions on mobile and desktop browsers (including installed PWA).

## Product Purpose

Deliver a responsive, deterministic Match-3 puzzle game themed around Nadezhi's fantasy realms and community, where players progress through curated and infinite procedural levels, chase high scores and 3-star records, and stay connected to Nadezhi's live streams and social channels.

## Positioning

A deterministic Three.js Match-3 engine (`CoreEngine`) paired with Nadezhi's custom emote set, fantasy biomes, live Twitch stream detection, and installable PWA experience—built so identical seeds and move sequences always produce identical board states and scores.

## Operating Context

- Played in mobile and desktop web browsers or as an installed standalone PWA (`manifest.webmanifest`, `sw.js`), in portrait or landscape orientation.
- Runs as a client-side Vite + TypeScript + Three.js + GSAP web application with Web Audio API procedural sound effects and fantasy background music tracks.
- Integrates live stream status checks against `https://decapi.me` for Nadezhi's Twitch channel (`twitch.tv/nadezhi`).

## Capabilities and Constraints

- **UI Language:** Spanish-first interface (`lang="es"`).
- **Architecture:** Strict separation between the synchronous, deterministic `CoreEngine` (`src/core/`) with zero DOM/Three dependencies and the `TimelinePlayer` / Three.js view layer (`src/view/`).
- **Gameplay:** Curated tutorial levels (1–20), calibrated infinite procedural levels (21+) with greedy-bot par scores, cascade multipliers, special gems (Tier 1 3×3 bomb, Tier 2 5×5 bomb, Rainbow gem, and 4 fusion combinations), and a Hall of Fame / per-level score record system (`src/core/scores.ts`).
- **PWA & Mobile Support:** Must preserve PWA installability (`manifest.webmanifest`, service worker, iOS/Android install banner), mobile viewport/safe-area handling, and both drag and tap-tap pointer input.
- **Content Security Policy:** `index.html` enforces a strict CSP (`default-src 'self'`, `connect-src 'self' https://decapi.me`, etc.).

## Brand Commitments

- **Name:** Nadezhi Match-3 • Tierras de Fantasía (`Nadezhi`).
- **Community Links (must preserve):**
  - Twitch (`https://www.twitch.tv/nadezhi`) + in-game live stream alert banner
  - Discord (`https://discord.gg/ADGgEaksR`)
  - TikTok (`https://www.tiktok.com/@nadezhi`)
  - Instagram (`https://www.instagram.com/nadezhi_/`)
  - Kick (`https://kick.com/nadezhi`)
  - Threads (`https://www.threads.com/@nadezhi_`)
- **Visual Assets & Themes:** Dual gem appearance toggle (Nadezhi community emotes in `public/emotes/` vs. vector gems) and fantasy biome backgrounds (`public/fantasy_*.jpg`).

## Evidence on Hand

- `README.md` — architecture, deterministic rules, special gem fusion matrix, and Vitest invariant suite documentation.
- `index.html`, `src/main.ts`, `src/game.ts` — full HUD, modals (win, lose, settings, level select, leaderboard/Hall of Fame, help/credits), PWA install prompt, and Twitch live banner.
- `public/emotes/` (32 `.webp` emote assets), `public/fantasy_*.jpg` (11 biome backgrounds), `public/fantasy_bgm.mp3`, `public/music_*.mp3`, and `public/manifest.webmanifest`.
- No external backend leaderboard or user accounts are present; score records and player name are stored client-side (`src/core/scores.ts`).

## Product Principles

1. **Deterministic Core First:** Gameplay rules, RNG streams, and scoring live purely in `src/core/` and must never be coupled to UI or rendering state.
2. **Community-Rooted Experience:** Nadezhi's emotes, live stream alerts, and community links are first-class parts of the game, not afterthoughts.
3. **Playable Anywhere:** Mobile touch, desktop pointer, and installed PWA standalone mode are equally supported.
4. **Clarity Under Motion:** HUD, goals, and modals remain readable and unobtrusive over animated 3D gameplay and biome backdrops.
