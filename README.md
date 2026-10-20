# Artem Sydorenko — portfolio

Static site (GitHub Pages) with the HookahPOS case study and the CV.

- `index.html` — the site; `assets/` — fonts, screenshots, demo video
- `cv/cv.html` → `cv/Artem-Sydorenko-CV.pdf`

## Rebuilding

```bash
cd tools && npm install                  # ffmpeg for the video
node tools/build-cv.mjs                  # CV → PDF (headless Edge)
node tools/record.mjs                    # demo video; needs HookahPOS Demo running on :5090
node tools/capture-mobile.mjs            # phone screenshots
```

Desktop screenshots come from `Documentation/presentation/capture.mjs en http://localhost:5090` in the HookahPOS repo.
