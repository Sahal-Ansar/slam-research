# SLAM research

Static site deployed on Vercel.

| Route | What |
|---|---|
| `/` | SLAM/INDEX — general comparative field index (built bundle in `index.html` + `assets/`) |
| `/drsirisha` | SLAM for drones in GPS-denied environments — field guide prepared for Sirisha |

## Editing `/drsirisha`

Source lives in `drsirisha-src/src/` (plain JS + CSS, no framework). Rebuild the single-file page with:

```bash
cd drsirisha-src && python3 build.py   # writes ../drsirisha/index.html
```

All benchmark numbers are quoted from the original papers (table named next to each chart); simulations and rating bars are editorial.
