# VNportal 💿

> Your personal vinyl universe — collect, design, mix, and play.

A music-game web app built around the aesthetic and culture of vinyl records. No frameworks, no build tools — pure HTML, CSS, and vanilla JS.

---

## Features (Phase 1)

| Feature | Status |
|---|---|
| 🖼️ Vinyl Exhibit | ✅ Live |
| 💿 Build a Vinyl | ✅ Live |
| 🎨 DIY Cover Studio | ✅ Live |
| 🐍 Groove Snake | ✅ Live |
| 🎚️ DJ Mix | 🔜 Phase 3 |
| 📈 Popularity Charts | 🔜 Phase 5 |
| 🧩 Sleeve Puzzle | 🔜 Phase 4 |

---

## Getting Started

No install needed — just open `index.html` in your browser.

```bash
git clone https://github.com/huangd-816/VNportal.git
cd VNportal
open index.html   # or just double-click it
```

For local dev with live reload:
```bash
npx serve .
```

---

## Project Structure

```
VNportal/
├── index.html
├── public/
│   ├── css/
│   │   └── main.css          # All styles
│   └── js/
│       ├── store.js          # localStorage data layer
│       ├── exhibit.js        # Vinyl gallery page
│       ├── build.js          # Press a vinyl page
│       ├── cover.js          # DIY cover canvas studio
│       ├── snake.js          # Groove Snake mini game
│       └── app.js            # Router & init
└── README.md
```

---

## Roadmap

### Phase 2 — BGM System
- Auto-play tracks from your active vinyl as background music
- Web Audio API integration
- Volume controls in sidebar

### Phase 3 — DJ Mix
- Drag tracks onto two decks
- Tone.js for pitch/speed control
- Crossfader

### Phase 4 — More Games
- Sleeve Puzzle (reassemble your cover art)
- Track Match (memory card game)
- BPM Tap (tap to find the tempo)

### Phase 5 — Social / AI
- Share your exhibit publicly
- Popularity charts
- AI cover art generation
- AI DJ mix suggestions (Claude/OpenAI)

---

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS
- **Storage:** localStorage (Supabase planned for Phase 5)
- **Audio:** Web Audio API → Tone.js
- **AI:** Claude API / OpenAI API (Phase 5)
- **Fonts:** Bebas Neue, DM Mono, Playfair Display

---

Built with ♫ by huangd-816
