# Richa Care — setup guide

A two-phone pregnancy diet + medicine app. Same web app serves both people:

- **Richa's phone** → `index.html` (her daily plan, ticking, photos, protein, medicine reminders)
- **Your phone (admin)** → `index.html?mode=admin` (live view of what she marked, photos, protein total, medicine adherence, breach alert)

It works exactly like your AC diagnostic tool: a static site on **GitHub Pages** + a **Google Apps Script / Sheets** backend for the live two-phone sync.

---

## What's in this folder
| File | Purpose |
|---|---|
| `index.html` | The whole app (Richa view + admin view) |
| `manifest.json` | Lets it install to the home screen like a real app |
| `service-worker.js` | Offline shell + installability |
| `icon-180/192/512.png` | App icons |
| `Code.gs` | The Google Apps Script backend (paste into script.google.com) |

---

## Step 1 — Backend (Google Sheet + Apps Script)  ~5 min
1. Create a new Google Sheet, name it **Richa Care Data**.
2. **Extensions ▸ Apps Script**. Delete the sample, paste the contents of **`Code.gs`**, Save.
3. **Deploy ▸ New deployment ▸ Web app**
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
4. Authorise when prompted (it needs Sheets + Drive to store marks and photos).
5. Copy the **Web app URL** (ends in `/exec`).

The `State`, `Log`, `Meds` tabs and the **"Richa Care Photos"** Drive folder are created automatically the first time data comes in.

## Step 2 — Wire the URL into the app
Open `index.html`, find the `CONFIG` block near the top of the script:
```js
const CONFIG = {
  BACKEND_URL: "",   // <-- paste your /exec URL here
```
Paste the `/exec` URL between the quotes. Save.

> Leave it blank and the app still works fully on a **single device** (saved locally) — handy for testing before you deploy the backend.

## Step 3 — Publish on GitHub Pages
1. New GitHub repo (e.g. `richa-care`), upload all files in this folder to the root.
2. **Settings ▸ Pages ▸** Source = `main` branch, `/root`. Save.
3. After a minute you get a URL like `https://<you>.github.io/richa-care/`.

## Step 4 — Install on both phones (iPhone)
- **Richa:** open the URL in **Safari ▸ Share ▸ Add to Home Screen.** Open it from the new icon.
- **You:** open `https://<you>.github.io/richa-care/?mode=admin` in Safari ▸ Add to Home Screen.
- On first open on Richa's phone, allow **Notifications** when asked.

Done. When Richa ticks a meal, takes a photo, or marks a medicine, it lands in the Sheet, and your admin view picks it up within ~20 seconds.

---

## What works, and the one honest limit

**Works:** daily plan, ticking items, live protein ring (absorbed, vs 56 g target), "ate something else" with auto protein, finished-plate photos, medicine checklist from her prescription, **10-minute re-nudges**, partner live feed + photos + breach alert.

**The limit — background reminders when the app is fully closed.** iOS only fires web-app notifications reliably while the app is open (or recently backgrounded). The 10-minute re-nudge works whenever the app is open. For true alarms that fire on a closed phone, you'd add a scheduled push — the cleanest next step is a **time-driven trigger in the same Apps Script** that sends a Web Push at each meal/medicine time. Say the word and I'll add that (it needs VAPID keys + a push subscription saved per device).

---

## Medicines pre-loaded (from the 20-Jun prescription)
| Medicine | When | Frequency |
|---|---|---|
| Shelcal HD | After breakfast (09:30) | Daily |
| Softeron Z (iron) | 1 hr after lunch (14:30) | Daily |
| Ecosprin 150 (aspirin) | Bedtime (21:30) | Daily |
| Lumia 60K (Vit D3) | Sunday 10:00 | Weekly × 4, then fortnightly |

Whey protein is counted inside breakfast (the protein shake), so it isn't double-listed.
Times are editable — add or change reminders from the **admin view ▸ "Add a medicine reminder."**
The handwritten *"Arginine sachet once daily(?)"* line is **not** pre-loaded — confirm it, then add it the same way.

Always run plan/medicine changes past Dr. Preety Aggarwal.
