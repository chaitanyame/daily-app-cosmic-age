# Cosmic Age 🌌

Your age across the Solar System. Enter your birthday and see how old you are on the Moon and all eight planets plus Pluto — where a "year" ranges from 88 Earth days (Mercury) to 248 Earth years (Pluto).

## Features

- Exact Earth age in years / months / days
- Age on 10 celestial bodies, scaled by each world's sidereal orbital period
- Next-birthday countdown and a fun "heartbeats lived" stat
- Animated starfield, CSS-drawn planets (Saturn has a ring!)
- Birthdate saved in `localStorage` — restored on reload
- Fully self-contained: no external dependencies, no CDN

## How to run

```bash
python3 -m http.server 8765 --directory .
# open http://localhost:8765
```

## Run the tests

```bash
npm install          # installs Playwright locally (or use global install)
npm run test         # runs ./test.js against http://localhost:8765
```

Test script launches headless Chromium, drives the UI (set birth date, calculate, reset, reload persistence), asserts computed ages against independently re-derived values for every planet, and screenshots each milestone.