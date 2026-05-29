# 🌿 Greendale – Phase 7 Anleitung

---

## 🆕 Was ist neu in Phase 7?

### ✅ Umgesetzte Features
| Feature | Status |
|---------|--------|
| 🏠 Echte isometrische 3D-Gebäude (Box-Rendering) | ✅ |
| 🧱 Vorderwand + Seitenwand + Dachfläche getrennt | ✅ |
| ⬆️ Level-2-Unterschiede visuell klar sichtbar | ✅ |
| 🏠 Giebeldach mit Firstlinie (alle Gebäude) | ✅ |
| 🪟 3D-Fenster auf Seitenwand positioniert | ✅ |
| 🚪 3D-Tür auf Vorderwand | ✅ |
| 🏗️ Level-2: Zusatzstockwerk / Laterne / Balkon | ✅ |
| 🌾 Farm: Erntereihen + Traktor bei Level 2 | ✅ |
| 🏭 Typ-spezifische 3D-Extras (Holzstapel, Steine…) | ✅ |
| 🔔 Rathaus: Fahne + Glocke bei Level 2 | ✅ |
| 💨 Schornstein mit Rauch (Schmiede, Küche, Bäckerei) | ✅ |

---

## 🏠 Das neue 3D-Gebäude-System

Jedes Gebäude wird jetzt als echte isometrische Box gezeichnet:

```
         [Dach-Top]
        /          \
  [West-Seite]  [Süd-Fassade]
```

- **West-Seite** (linke Wand): etwas dunkler, zeigt Tiefe
- **Süd-Fassade** (rechte Wand): Hauptseite mit Fenstern und Tür
- **Dachfläche**: Giebeldach mit Firstlinie (oder Flachdach bei Farm/Lager)

### Level-2-Unterschiede
| Gebäude | Level 1 | Level 2 |
|---------|---------|---------|
| Alle | Normalhöhe | +30% höher, +10% breiter |
| Dach | Einfacher Giebel | Giebel + Laterne / Aufsatz |
| Farm | Erntereihen | + Traktor 🚜 |
| Rathaus | Fahne | + Glocke 🔔 |
| Alle Prod. | - | Seitlicher Anbau sichtbar |
| Holzfäller | 2 Holzstapel | 4 Holzstapel |

---

## 🚀 Lokal starten

```bash
cd greendale_v7
npm install
node server.js
```
→ http://localhost:3000

---

## 📁 Geänderte Dateien

| Datei | Was geändert |
|-------|-------------|
| `js/draw.js` | Neues 3D-Box-Rendering für alle Gebäude |
| `js/state.js` | Save-Key v10 |

---

## 🔄 Deployen

```bash
git add .
git commit -m "Phase 7: 3D Gebäude + Level-2-Unterschiede"
git push
```
