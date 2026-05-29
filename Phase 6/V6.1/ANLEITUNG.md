# 🌿 Greendale – Phase 6.1 Anleitung

---

## 🆕 Was ist neu in Phase 6.1?

### ✅ Umgesetzte Features
| Feature | Status |
|---------|--------|
| ⛰️ 3D-Terrain mit Höhenkarte (Hügel, Berge, Täler) | ✅ |
| 🧱 Seitenflächen auf erhöhten Kacheln (echte 3D-Optik) | ✅ |
| 🏔️ Berggipfel: Bäume mit Schnee, nicht bebaubar | ✅ |
| 🗺️ Minimap (rechts unten, zeigt Terrain + Gebäude) | ✅ |
| 🎥 WASD / Pfeiltasten Kamera-Schwenk | ✅ |
| 🔍 Weiche Zoom-Interpolation (kein ruckeliges Springen) | ✅ |
| 📸 Kamera-Grenzen (kein Scroll ins Leere) | ✅ |
| 🏗️ Gebäude-Sockel auf erhöhtem Terrain sichtbar | ✅ |
| 🎮 3D-Picking: Gebäude-Klick auch auf Hügeln korrekt | ✅ |

---

## 🏔️ Das neue Terrain-System

### Höhenstufen
| Stufe | Farbe | Bebaubar? | Begehbar? |
|-------|-------|-----------|-----------|
| 0 – Ebene | Grün | ✅ Ja | ✅ Ja |
| 1 – Kleiner Hügel | Dunkelgrün | ✅ Ja | ✅ Ja |
| 2 – Hügel | Dunkelgrün/Erde | ✅ Ja | ✅ Ja |
| 3 – Berggipfel | Hellgrün (Fels) | ❌ Nein | ❌ Nein |

### Was sieht man neu?
- **Seitenwände** der Kacheln: Je höher ein Tile, desto tiefer die sichtbaren Steinwände
- **Gebäude-Sockel**: Auf erhöhtem Terrain sieht man ein Stein-Fundament
- **Schnee-Bäume**: Bäume auf Berggipfeln (Stufe 3) haben Schnee auf der Spitze
- **Terrain ist zufällig** aber deterministisch pro Session (Neustart = neue Karte)

---

## 🎥 Kamera-Steuerung

| Eingabe | Aktion |
|---------|--------|
| **WASD** oder **Pfeiltasten** | Karte schwenken |
| **Mausrad** | Zoom rein/raus (weich interpoliert) |
| **Mausklick + ziehen** | Karte verschieben |
| **Pinch-Zoom** (Touch) | Zoom auf Mobile |
| **Escape** | Bauen-Modus abbrechen |

---

## 🗺️ Minimap

Rechts unten wird eine kleine Übersichtskarte angezeigt:
- **Grüntöne** = Terrain-Höhen (dunkler = höher)
- **Blau** = Wasser
- **Rote Punkte** = Gebäude
- **Weisse Punkte** = Villager
- **Weisser Rahmen** = aktueller Kamera-Ausschnitt

---

## 🚀 Lokal starten

```bash
cd greendale_v6.1
npm install
node server.js
```
→ http://localhost:3000

---

## 🐛 Häufige Fragen

| Problem | Lösung |
|---------|--------|
| Gebäude auf Hügel nicht anklickbar | Kamera etwas zoomen – 3D-Picking verbessert in 6.2 |
| Berggipfel bebaubar? | Nein – absichtlich: "⛰️ Zu steil!" Meldung erscheint |
| Karte sieht jedes Mal anders aus | Terrain ist per Session zufällig generiert – gewollt! |
| Villager stecken auf Hügeln fest | Berggipfel (Stufe 3) automatisch gemieden |

---

## 📁 Geänderte Dateien in Phase 6.1

| Datei | Was geändert |
|-------|-------------|
| `js/draw.js` | Komplett neu: 3D-Terrain, HMAP, Seitenflächen, Minimap |
| `js/game.js` | 3D-Picking für Gebäude-Klick auf Hügeln |
| `js/state.js` | `isTileWalkable` + `placeBuilding` berücksichtigen HMAP |

---

## 🔄 Deployen

```bash
git add .
git commit -m "Phase 6.1: 3D-Terrain, Höhenkarte, Minimap"
git push
```
