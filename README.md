# PhotoCompare

Statická webová aplikace pro porovnání čtyř JPEG fotografií. Fotky se berou ze složky `data` a v každém panelu jde vybrat objektiv, clonu a lokální kompenzaci expozice. Zoom kolečkem a posun tažením se synchronizují mezi všemi čtyřmi panely.

## Názvy souborů

Aplikace očekává JPEGy ve tvaru:

```text
Název objektivu - f2.8.jpg
Název objektivu - f5.6.jpeg
```

Část před ` - f` se použije jako objektiv, číslo za `f` jako clona.

## Obnova seznamu fotek

Po přidání nebo smazání fotek ve složce `data` spusť:

```bash
node scripts/generate-manifest.mjs
```

Na Windows můžeš použít i:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/generate-manifest.ps1
```

Tím se obnoví `data/manifest.json`, který je potřeba hlavně při hostování webu.

## Lokální spuštění

Na Windows můžeš spustit:

```text
start-photocompare.bat
```

Nebo z kořenové složky projektu spusť jednoduchý statický server:

```bash
python -m http.server 4173
```

Potom otevři:

```text
http://localhost:4173/index.html
```

Samotný porovnávač je na:

```text
http://localhost:4173/compare.html
```

Clona se běžně přepíná ve všech čtyřech panelech. Pokud při výběru clony držíš `Ctrl`, změní se jen aktuální panel. Kompenzace expozice je vždy lokální pro konkrétní panel.

Pokud vidíš stránku `Directory listing for /` s obsahem jiné složky, server byl spuštěný ze špatného adresáře. Zavři ho klávesami `Ctrl+C` a spusť ho znovu buď přes `start-photocompare.bat`, nebo příkazem:

```powershell
python -m http.server 4173 --directory "C:\Users\pk\Projekty\photocompare"
```

## Hostování zdarma

Nejjednodušší cesta je GitHub Pages:

1. Vytvoř repozitář na GitHubu.
2. Nahraj do něj `index.html`, `styles.css`, `app.js`, `README.md`, složku `scripts` a složku `data` včetně `manifest.json`.
3. V nastavení repozitáře otevři `Pages`.
4. Jako zdroj zvol větev `main` a složku `/root`.
5. GitHub po chvíli ukáže veřejnou URL.

Pozor na velikost JPEGů: GitHub běžně dovoluje jednotlivé soubory do 100 MB, ale pro pohodlné načítání a sdílení je lepší držet fotky rozumně komprimované.
