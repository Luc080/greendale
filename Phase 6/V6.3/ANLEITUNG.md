# 🌿 Greendale – Phase 8 Anleitung

## 🆕 Was ist neu in Phase 8?

| Feature | Status |
|---------|--------|
| 🧍 Echte 3D-Figuren mit Körperteilen (Ober-/Unterarm, Ober-/Unterschenkel) | ✅ |
| 🚶 Lauf-Animation: Beine wechseln, Arme gegenphasig | ✅ |
| 🔨 Arbeits-Animation: Arme heben sich rhythmisch, Werkzeug sichtbar | ✅ |
| 😴 Idle-Animation: sanftes Wippen, zufällige Emotes (😴🎵⭐…) | ✅ |
| 😊 Mimik: Lächeln beim Laufen, konzentriert beim Arbeiten | ✅ |
| 💬 Fortschritts-Sprechblase über Arbeitenden | ✅ |
| ✨ Partikel-System: Funken beim Produzieren | ✅ |
| 🪙 +XP / +Coin Partikel beim Auftrag erfüllen | ✅ |
| 👁️ Augen mit Glanzpunkt, Iris, Blickrichtung | ✅ |

## 🎮 Die neuen Animationen

**Laufen**: Beine wechseln sich ab, Arme schwingen gegenphasig (natürliches Gehen).

**Arbeiten**: Beide Arme heben sich rhythmisch auf und ab, ein Werkzeug (Hammer) dreht sich mit. Funken fliegen beim Abschluss.

**Idle**: Figur wippt sanft. Alle ~3 Sekunden erscheint zufällig ein Emote (😴, 🎵, ⭐, 💭…) der nach oben schwebt.

**Mimik**: Lächeln beim Laufen, neutraler Ausdruck im Idle, zusammengebissene Lippen bei der Arbeit.

## 🚀 Lokal starten

```bash
cd greendale_v8
npm install
node server.js
```
→ http://localhost:3000

## 📁 Geänderte Dateien

| Datei | Was geändert |
|-------|-------------|
| `js/draw.js` | Komplette Villager-Neuentwicklung + Partikel-System |
| `js/state.js` | Partikel-Trigger bei Produktion + Auftrag |
