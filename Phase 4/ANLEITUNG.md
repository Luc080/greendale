# 🌿 Greendale – Phase 4 Anleitung

---

## 🆕 Was ist neu in Phase 4?

### ✅ Umgesetzte Features
| Feature | Status |
|---------|--------|
| 🪙 Coins-Währung (durch Aufträge verdienen) | ✅ |
| 🎰 Slot Machine im Casino | ✅ |
| 🃏 Blackjack-Tisch im Casino | ✅ |
| 🏅 Level-Anzeige mit Fortschrittsbalken | ✅ |
| ⚒️ Schmiede (Stein + Holz → Werkzeug) | ✅ |
| 🎉 Valley-Events (gemeinsame Herausforderungen) | ✅ |
| 🤝 Handelssystem (Ressourcen mit Mitspielern tauschen) | ✅ |
| ☁️ Supabase-Persistenz (optional) | ✅ |
| 🐛 Popup/Gebäude-Bug behoben | ✅ |
| 🪙 Coins-Anzeige in Topbar | ✅ |
| 📦 Ressource "Werkzeug" hinzugefügt | ✅ |

---

## 🐛 Der Popup-Bug (Phase 2 → 3 Split)

### Was war das Problem?
In Phase 2 hatten alle Gebäude `name` und `emoji` direkt im Building-Objekt gespeichert:
```js
// Phase 2 (funktionierte)
{ id: 0, type: 'townhall', col: 5, row: 4, name: 'Rathaus', emoji: '🏛' }
```

Nach dem Split in Phase 3 wurden diese Felder **aus den Building-Objekten entfernt** – sie existieren jetzt nur noch in `BUILDING_TYPES`. Der Popup-Code versuchte aber immer noch auf `b.name` und `b.emoji` zuzugreifen (direkt am Building-Objekt), was `undefined` ergab.

**Zusätzlich** hatte das `#info-popup` die CSS-Eigenschaft `pointer-events: none`, was alle Buttons im Popup unklickbar machte.

### Was wurde gefixt?
1. `showBuildingPopup()` in `ui.js` liest jetzt korrekt aus `BUILDING_TYPES[b.type]`:
   ```js
   var bt = BUILDING_TYPES[b.type];  // ← so ist es richtig
   document.getElementById('popup-title').textContent = bt.emoji + ' ' + bt.name;
   ```
2. CSS: `#info-popup { pointer-events: all; }` → Buttons sind jetzt klickbar.

---

## 🚀 Lokal starten

### Schritt 1: Dependencies installieren
```bash
cd greendale
npm install
```

### Schritt 2: Server starten
```bash
node server.js
```

### Schritt 3: Browser öffnen
→ http://localhost:3000

---

## ☁️ Supabase einrichten (optional, für Persistenz)

Ohne Supabase läuft das Spiel normal – Spielstände werden in `localStorage` gespeichert (browserspezifisch). Mit Supabase sind Spielstände geräteübergreifend abrufbar.

### Schritt 1: Supabase-Projekt erstellen
1. → https://supabase.com → "New Project"
2. Merke dir `Project URL` und `anon/public key`

### Schritt 2: Tabelle anlegen
In Supabase → SQL Editor:
```sql
CREATE TABLE players (
  name TEXT PRIMARY KEY,
  state JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lesezugriff für alle (anon key)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON players FOR ALL USING (true) WITH CHECK (true);
```

### Schritt 3: Umgebungsvariablen setzen

**Lokal** – Terminal:
```bash
SUPABASE_URL=https://xxxxx.supabase.co SUPABASE_KEY=eyJhbGci... node server.js
```

**Railway** – Variables Tab:
```
SUPABASE_URL = https://xxxxx.supabase.co
SUPABASE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

### Was passiert dann?
- Beim Betreten: Server lädt Spielstand aus Supabase → kein Datenverlust bei neuem Browser
- Beim manuellen Speichern (💾): Spielstand geht automatisch an Supabase
- Autosave alle 60 Sekunden ebenfalls

---

## 🎰 Casino spielen

1. **Level 5 erreichen** (braucht ~950 XP)
2. **Casino bauen** (🪵20, 🪨20) – im Bauen-Tab
3. **Casino anklicken** → Tab öffnet sich, oder direkt "🎰 Casino" Tab unten

### Coins verdienen
- Jeder erfüllte Auftrag gibt zusätzlich Coins (5–25🪙 je nach Auftrag)
- Valley-Events geben Bonus-Coins wenn abgeschlossen

### Slot Machine
- Einsatz: 5, 10 oder 25 Coins
- 3 gleiche Symbole = Jackpot (Einsatz × Payout des Symbols)
- 2 gleiche = kleiner Gewinn (Einsatz × 1.5)
- Kein Match = Verlust

### Blackjack
- Standard-Regeln: Ziel ist 21 ohne zu überziehen
- Dealer zieht bis 17
- Einsatz: 5, 10 oder 20 Coins
- Gewinn: doppelter Einsatz; Unentschieden: Einsatz zurück

---

## 🎉 Valley-Events

Alle 5 Minuten (wenn Spieler online sind) startet ein Valley-Event automatisch:
- **🌾 Ernte-Festival**: Gemeinsam 20x Weizen liefern in 10 Minuten
- **🔨 Bau-Wettbewerb**: Gemeinsam 15x Holz + 10x Stein liefern
- **🍲 Dorffest**: Gemeinsam 10x Suppe + 5x Brot liefern

**Belohnung bei Erfolg**: XP + Coins für **alle** Spieler im Valley!

Events werden im goldenen Banner oben im Canvas angezeigt.

---

## 🤝 Handelssystem

1. "🤝 Handel" Tab öffnen
2. Mitspieler aus Dropdown wählen
3. "Ich biete" (was du gibst) und "Ich möchte" (was du erhalten willst) eingeben
4. "Angebot senden" klicken

Der andere Spieler sieht ein Popup und kann annehmen oder ablehnen. Bei Annahme werden Ressourcen sofort getauscht.

---

## ⚒️ Schmiede

- Freischaltbar ab **320 XP** (Level 4)
- Kostet: 🪵15, 🪨18
- Produziert: **Werkzeug** aus 2x Stein + 1x Holz
- Werkzeug wird für Aufträge benötigt (lukrativste Aufträge!)

---

## 📁 Ordnerstruktur

```
greendale/
├── server.js           ← Node.js Server
├── package.json
├── ANLEITUNG.md
└── public/
    ├── index.html      ← Komplettes Spiel-UI
    └── js/
        ├── data.js     ← Gebäude, Ketten, Casino-Daten
        ├── state.js    ← Spielzustand, Produktion, Save/Load
        ├── draw.js     ← Canvas-Rendering
        ├── ui.js       ← Sidebar, Tabs, Casino-UI, Popups
        ├── network.js  ← WebSocket, Events, Handel
        └── game.js     ← Hauptschleife, Input
```

---

## 🔄 Code deployen (Railway)

```bash
git add .
git commit -m "Phase 4: Casino, Events, Handel, Supabase"
git push
```
Railway deployt automatisch.

---

## 🐛 Häufige Fehler

| Fehler | Lösung |
|--------|--------|
| `Cannot find module '@supabase/supabase-js'` | `npm install` ausführen |
| Casino-Tab grau/gesperrt | Level 5 erreichen (950 XP) |
| Popup-Buttons nicht klickbar | War der Phase-3-Bug – in Phase 4 gefixt |
| Spielstand weg | localStorage pro Browser – mit Supabase persistent |
| Werkzeug-Auftrag kann nicht erfüllt werden | Schmiede bauen und Villager zuweisen |

---

## 📝 Nächste Schritte (Phase 5 Ideen)

- [ ] Gebäude upgraden (Level 2 produziert schneller)
- [ ] Tages-/Nacht-Zyklus auf dem Canvas
- [ ] Sound-Effekte
- [ ] Animierte Levelup-Sequenz
- [ ] Electron-Build (.exe für Windows/Mac)
- [ ] Valley-Rangliste / Leaderboard
