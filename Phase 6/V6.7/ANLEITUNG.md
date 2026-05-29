# 🌿 Greendale – Anleitung v6.5

## Deployment

```bash
npm install
node server.js
```

Alle Dateien liegen **flach im Hauptordner** (kein js/ Unterordner).

---

## Was ist neu in v6.5?

### Visuell
- **Isometrischer 3D-Look** (Canvas 2D mit 3D-Tiefeneffekten)
- Alle Gebäude haben **4 Wände** inkl. Süd-Wand
- **5 verschiedene Frisuren** für Villager
- **Tageszyklus** in 4 Phasen (Morgen → Mittag → Abend → Nacht), je ~4.5 Min
- Sanfte Lichtübergänge, kein harter Kontrast bei Nacht

### Gameplay-Fixes
- **Zoom-Fix**: kein Auseinanderziehen beim Hereinzoomen
- **Deterministisches Terrain**: gleiche Karte für alle Spieler (Seed 42)
- **Verlangsamte Animationen**: Villager laufen langsamer, pausieren zwischen Wegen
- **Visueller Timer** über Gebäuden statt Prozentanzeige
- **Unterschiedliche Produktionszeiten**: Farm 15s, Brunnen 12s, Sägewerk 20s, Steinbruch 28s, Küche 40s, Bäckerei 35s, Ziegelei 50s, Zimmerei 60s, Schmiede 90s

### UI
- **Ketten-Tab entfernt** (kommt später als Tutorial)
- Timer auch in Sidebar und Villager-Tab sichtbar
- Produktionszeit beim Hover auf Gebäude-Karten

---

## Geplant (spätere Phase)
- Casino-Feature (Slot Machine + Blackjack, ab Level 5)
- Tutorial für Produktionsketten
