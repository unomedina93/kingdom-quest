# How to Update Kingdom Quest

## When you want to add or change games:

1. Edit files in the `game/` folder (same as before)
2. Open `version.json` and bump the version number (e.g., `1.0.0` → `1.1.0`)
3. Push to GitHub:
   ```
   git add .
   git commit -m "Add new games"
   git push
   ```

That's it! Next time your son opens the app while on WiFi, it will auto-update.

## Version numbering guide:
- New games or big changes: bump the middle number (1.0.0 → 1.1.0)
- Small fixes: bump the last number (1.0.0 → 1.0.1)
- Major overhaul: bump the first number (1.0.0 → 2.0.0)

## To rebuild the app (.dmg / .exe):
Only needed if you change Electron wrapper code (main.js, etc.)
```
npm run build:mac    # Makes the .dmg for Mac
npm run build:win    # Makes the .exe for Windows (run on Windows or with wine)
```
