# Bedside Smart Dashboard

Client-side, zero-backend bedside clock dashboard (pure HTML/CSS/JS) for a Samsung Galaxy Tab running Fully Kiosk Browser.

Features: oversized clock, alarm (Web Audio chime, snooze/dismiss), night mode with auto-schedule, weather (Open-Meteo, Bountiful UT), Audiobookshelf player, Spotify (PKCE), sun times + quotes, voice commands.

## Deploy (GitHub Pages)
1. Push `index.html`, `style.css`, `quotes.js`, `app.js` to `main`.
2. Settings > Pages > Deploy from a branch > `main` / `(root)`.
3. Open `https://<username>.github.io/<repo>/`.

No secrets are stored in the repo. Audiobookshelf URL/token and Spotify Client ID are entered in the in-app Setup (gear) modal and saved in localStorage.

## Notes
- Audiobookshelf must be reachable over https:// from a GitHub Pages site (mixed-content blocking), or host this dashboard locally over http://.
- Spotify: add the exact URL shown in the Setup modal as a Redirect URI in the Spotify Developer Dashboard.
- Fully Kiosk: set Start URL, enable Web Autoplay, Keep Screen On, Landscape, Launch on Boot; allow Microphone.
