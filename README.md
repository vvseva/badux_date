# badux_date

A tiny Svelte + Vite + D3 demo: start at the Unix epoch (1970-01-01 00:00 UTC). The time advances in real-time and renders:
- A subtle grid background (canvas)
- A 1px-wide colorful strip (canvas)
- A D3 SVG background that adds a 2x2 px green square for every elapsed simulated second (removes squares when time goes backwards). Squares fill from top-left in row-major order up to the viewport capacity.

Centered date/time (UTC) with seconds (HH:MM:SS) and controls (left to right): Fast Back, Back, Select Date/Continue selecting, Forward, Fast Forward.

When you press Select Date, the background squares briefly shake and fireworks appear, then the time pauses. Press Continue selecting to resume.

## Run locally

1. Install deps
	npm install
2. Development server
	npm run dev
3. Production build
	npm run build
4. Preview built app
	npm run preview

Then open the URL printed in the terminal (usually http://localhost:5173 for dev or http://localhost:4173 for preview).
