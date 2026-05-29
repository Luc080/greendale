# 🌿 Greendale – Phase 9 Anleitung

## 🆕 Was ist neu in Phase 9?

| Feature | Status |
|---------|--------|
| ☀️ 6 Wetter-Zustände: Sonnig, Bewölkt, Regen, Gewitter, Schnee, Nebel | ✅ |
| 🌧️ Dynamische Wetter-Partikel (Regen/Schnee fallen animiert) | ✅ |
| ⛈️ Blitz-System mit Zickzack + Screen-Flash bei Gewitter | ✅ |
| 🌫️ Nebel-Puffs die sich langsam über den Bildschirm bewegen | ✅ |
| ❄️ Schnee-Overlay: Tiles werden weiss, Boden schneebedeckt | ✅ |
| 🌤️ Dynamische Wolken die sich über den Himmel bewegen | ✅ |
| 🌅 Sonnenuntergangs-Beleuchtung (orange Overlay) | ✅ |
| 🪟 Fenster leuchten nachts (Licht-Halo um Gebäude) | ✅ |
| 🌧️ Regen-Pfützen-Wellen auf Wasser-Tiles | ✅ |
| ⛰️ Verbesserte Berge: Fels-Tiles (6) + Schnee-Tiles (7) gemischt | ✅ |
| 🌦️ Wetter-Chip (☀️ Sonnig) links unten auf dem Canvas | ✅ |
| 🔄 Automatischer Wetter-Wechsel mit Übergangs-Animation | ✅ |

## 🌦️ Das Wetter-System

Das Wetter wechselt automatisch alle 30–120 Sekunden mit sanftem Übergang. Es gibt plausible Übergänge (kein Sprung von Sonnenschein direkt zu Gewitter).

| Wetter | Effekte |
|--------|---------|
| ☀️ Sonnig | Statische Wolken, heller Himmel |
| ⛅ Bewölkt | Dynamische graue Wolken, leicht gedämpft |
| 🌧️ Regen | Fallende Regentropfen, dunklerer Boden |
| ⛈️ Gewitter | Regen + Blitze + Dunkel-Overlay + Pfützen |
| ❄️ Schnee | Schneeflocken, weisse Tiles, Schnee-Boden |
| 🌫️ Nebel | Nebelpuffs bewegen sich über die Szene |

## 💡 Beleuchtung

- **Morgen-/Abenddämmerung**: Warmes oranges Overlay
- **Nacht**: Gebäude-Fenster leuchten gelb (Halo-Effekt)
- **Gewitter**: Kühles blau-graues Licht

## 🚀 Lokal starten

```bash
cd greendale_v9
npm install
node server.js
```
→ http://localhost:3000

## 📁 Geänderte Dateien

| Datei | Was geändert |
|-------|-------------|
| `js/draw.js` | Wetter-System, Beleuchtung, verbesserte Berge |
