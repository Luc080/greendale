# 🌿 Greendale – Server-Anleitung

---

## 📁 Ordnerstruktur

```
greendale/
├── server.js           ← Node.js Server (startet das ganze Spiel)
├── package.json        ← Liste der benötigten Libraries
├── ANLEITUNG.md        ← Diese Datei
└── public/             ← Alles was der Browser bekommt
    ├── index.html      ← Hauptseite (nur Struktur)
    ├── css/
    │   └── style.css   ← Alle Styles
    └── js/
        ├── data.js     ← Spielkonstanten (Gebäude, Ketten, etc.)
        ├── state.js    ← Spielzustand und Produktionslogik
        ├── draw.js     ← Alles was gezeichnet wird (Canvas)
        ├── ui.js       ← Sidebar, Tabs, Popups
        ├── network.js  ← WebSocket Verbindung zum Server
        └── game.js     ← Hauptschleife und Mauseingabe
```

**Wichtig:** Die Script-Reihenfolge in index.html ist zwingend!
`data.js` → `state.js` → `draw.js` → `ui.js` → `network.js` → `game.js`

---

## 🖥️ Lokal starten (zum Testen)

### Schritt 1: Node.js installieren
→ https://nodejs.org (Version 18 oder neuer, LTS empfohlen)
Nach der Installation im Terminal prüfen:
```
node --version
npm --version
```

### Schritt 2: Dependencies installieren
Terminal öffnen, in den greendale-Ordner navigieren:
```
cd greendale
npm install
```
Das installiert `express`, `ws` (WebSockets) und `uuid`.

### Schritt 3: Server starten
```
node server.js
```
Ausgabe sollte sein:
```
🌿 Greendale Server läuft!
   Lokal:   http://localhost:3000
   Valley:  http://localhost:3000?valley=meintal
```

### Schritt 4: Im Browser öffnen
→ http://localhost:3000

**Mehrere Spieler lokal testen:**
- Öffne mehrere Browser-Tabs
- Gib verschiedene Namen ein, gleichen Valley-Namen

---

## 🌐 Online stellen (Railway – kostenlos)

Railway ist ein kostenloser Hosting-Dienst. Dein Server läuft 24/7.

### Schritt 1: GitHub Account erstellen
→ https://github.com (falls noch nicht vorhanden)

### Schritt 2: Repository erstellen
1. Auf GitHub: "New repository" → Name: `greendale`
2. Lokal im Terminal:
```
cd greendale
git init
git add .
git commit -m "Greendale Phase 3"
git branch -M main
git remote add origin https://github.com/DEIN-USERNAME/greendale.git
git push -u origin main
```

### Schritt 3: Railway einrichten
1. Gehe zu → https://railway.app
2. "Login with GitHub"
3. "New Project" → "Deploy from GitHub repo"
4. Wähle dein `greendale` Repository
5. Railway erkennt automatisch Node.js

### Schritt 4: Umgebungsvariablen setzen (optional)
In Railway: Variables → Add Variable:
- `PORT` = `3000` (Railway setzt das automatisch)

### Schritt 5: Domain holen
In Railway: Settings → Domains → "Generate Domain"
→ Du bekommst eine URL wie `greendale-production.up.railway.app`

### Schritt 6: Mit Kollegen teilen
Teile einfach diese URL:
```
https://greendale-production.up.railway.app?valley=klasse
```
Alle die diesen Link öffnen, landen im selben Valley!

---

## 🎮 So spielen mehrere Spieler zusammen

### Valley-System:
- Ein **Valley** = ein gemeinsamer Spielraum (bis zu 9 Spieler)
- Jeder Spieler hat sein **eigenes Dorf** (eigene Gebäude, Villager)
- Die **Aufträge** sind geteilt – jeder kann liefern und XP kassieren
- Der **Chat** ist für alle im Valley sichtbar

### Beispiel Klasse:
```
URL: https://deine-url.railway.app?valley=klasse7a
```
Alle tippen denselben Valley-Namen ein → selber Raum.

Oder verschiedene Valleys für verschiedene Gruppen:
```
Valley "gruppe1" → Gruppe 1
Valley "gruppe2" → Gruppe 2
```

---

## 🔄 Code-Änderungen deployen

Nach jeder Änderung am Code:
```
git add .
git commit -m "Beschreibung der Änderung"
git push
```
Railway deployt automatisch innerhalb 1-2 Minuten.

---

## 🐛 Häufige Fehler

| Fehler | Lösung |
|--------|--------|
| `Cannot find module 'express'` | `npm install` ausführen |
| Port bereits in Verwendung | `PORT=3001 node server.js` |
| Weisse Seite im Browser | Browser-Konsole öffnen (F12) → Fehler lesen |
| WebSocket verbindet nicht | Prüfe ob `server.js` läuft |
| Spielstand weg | localStorage gespeichert – anderer Browser = neuer Stand |

---

## 📝 Nächste Schritte (Phase 4)

- [ ] Datenbank (z.B. Supabase) für persistente Spielstände
- [ ] Valley-weite Events und Challenges
- [ ] Casino-Feature mit Coins
- [ ] Electron (.exe) Build

---

## 🗂️ Welche Datei wofür

| Datei | Was anpassen |
|-------|-------------|
| `data.js` | Neue Gebäude, Rezepte, Villager hinzufügen |
| `state.js` | Produktionslogik, Balancing (Hunger, Geschwindigkeit) |
| `draw.js` | Grafik verbessern, neue Gebäude-Designs |
| `ui.js` | Neue Tabs, Sidebar-Inhalte, Popups |
| `network.js` | Multiplayer-Logik erweitern |
| `server.js` | Server-Logik, Valley-Regeln |
| `style.css` | Farben, Schriften, Layout |
