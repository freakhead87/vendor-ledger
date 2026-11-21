# 📊 VendorLedger Pro • Web Application

A dedicated, fast, offline-ready web application designed for managing **Vendor Bills, Purchase Invoices, and Payment Settlements** with built-in Nepalese Bikram Sambat (BS) and Gregorian (AD) calendar support.

---

## ☁️ Online Deployment (GitHub + Cloudflare Pages)

To host this web application online with global access and zero data loss:

### 1. Push to Your GitHub Account
Open PowerShell in this directory:
```powershell
cd "C:\Users\Freakillaz Inc\.gemini\antigravity\scratch\vendor-bills-app"

# 1. Create a new empty repository on GitHub: https://github.com/new (e.g. named "vendor-ledger")
# 2. Link your local repo to GitHub:
git remote add origin https://github.com/<your-github-username>/vendor-ledger.git

# 3. Push to main:
git push -u origin main
```

### 2. Deploy on Cloudflare Pages (Free & Automatic)
1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. In the sidebar, navigate to **Compute (Workers) & Pages** → **Create application** → **Pages** → **Connect to Git**.
3. Select your `vendor-ledger` GitHub repository.
4. Set **Build command**: *(leave blank)*
5. Set **Build output directory**: `/` (or leave default root).
6. Click **Save and Deploy**. Cloudflare gives you a live HTTPS domain (e.g. `https://vendor-ledger.pages.dev`).
7. Every time you make a git commit, Cloudflare Pages automatically updates the live site in seconds!

### 3. Connect Live Google Sheets Cloud Sync (Zero Data Loss)
1. Open your Google Spreadsheet: [Master File - Vendor Bills vs Payment](https://docs.google.com/spreadsheets/d/1zWKy_Zypr9Uday4VsqrqwSeQwTrAz5_X3Ijo8l9pJxw/edit).
2. Click **Extensions > Apps Script** in the top menu.
3. Open `google_apps_script.js` from this folder, copy all code, and paste it into `Code.gs`.
4. Click **Deploy > New deployment** → Select type **Web app**.
   * Execute as: **Me**
   * Who has access: **Anyone**
5. Copy the generated Web App URL (`https://script.google.com/macros/s/.../exec`).
6. In your online web app, go to **Sheets & Sync** and paste your Web App URL.
7. Any bill or payment recorded in the web app will now instantly save straight to your Google Sheet in Google Drive!

---

## 🚀 Local Quick Start (Two Ways to Open Locally)

### Option 1: Instant Direct Launch (No Terminal Needed)
Simply double-click **`index.html`** or right-click → **Open with Chrome / Brave / Edge**.
* Works 100% offline.
* All data is auto-saved locally in your browser (`localStorage`).
* No servers, no Node.js, and no installations required.

### Option 2: Local HTTP Server Mode
Open PowerShell in this directory and run:
```powershell
.\start-server.ps1
```
* Spawns a lightweight local HTTP server at `http://localhost:8080/`.
* Automatically launches your default web browser.

---

## 🌟 Key Features

1. **Pre-Seeded with Your Master Google Sheet Data:**
   * Loaded with all **69 historical transactions** across `STC A79`, `Sujan Readymade`, `Pashupati Plaza`, `RK Readymade`, and `Chaudhary Brothers`.
   * Reconciled totals: **Billed: NPR 1,074,926** | **Paid: NPR 742,066** | **Due: NPR 332,860**.

2. **Ultra-Fast Data Recording (Bills & Payments):**
   * Click **`Record Data`** (or press keyboard shortcut **`Ctrl + N`** anywhere in the app).
   * **Transaction Types:**
     * **Bill / Invoice (Dr):** Records incoming vendor purchase bills.
     * **Payment (Cr):** Records settlement installments or bank transfers.
     * **Bill + Token Paid:** Records a bill and an immediate cash token/advance in a single entry.
   * **Live Balance Impact Preview:** Shows the vendor's current balance and recalculates the new due balance in real time before you submit.

3. **Bikram Sambat (BS) ↔ Gregorian (AD) Dual Calendar Engine:**
   * Fully integrated with the official BS Calendar Reference (BS 2075 – 2090).
   * Typing or selecting a **BS Date** (e.g. `2083/08/04`) instantly calculates the equivalent **AD Date** (`2026-11-20`), and vice versa.

4. **Executive Dashboard & Monthly Analytics:**
   * Hero KPI cards for Total Billed, Total Paid, Outstanding Due, and Fulfillment %.
   * Interactive BS monthly bar chart (Magh 2082 to Mangsir 2083) with hover amount tooltips.
   * Vendor portfolio ranking cards with progress bars and due status badges. Click any vendor card to isolate dashboard metrics to that vendor.

5. **Searchable Master Ledger Explorer:**
   * Filter transactions by vendor, transaction type (bills vs payments), or date range.
   * Real-time search across notes, invoice numbers, and dates.
   * Inline Edit (`✏️`) and Delete (`🗑️`) controls.
   * One-click **Export to CSV** for Excel / accounting reports.

6. **Backup, Portability & Google Sheets Sync:**
   * One-click **JSON Backup** and **Restore**.
   * Run `.\sync-to-sheets.ps1 -BackupJsonFile backup.json` to push newly recorded web entries straight into your Google Sheets workbook.

---

## 📁 File Structure

```text
vendor-bills-app/
├── index.html             # Main single-page web app (Tailwind CSS, responsive layout)
├── app.js                 # State store, BS-AD calendar engine, UI renderers, live calculators
├── data.js                # Initial master data seed (69 historical txns + BS reference)
├── google_apps_script.js  # Google Sheets Webhook API code for real-time cloud persistence
├── start-server.ps1       # Native Windows PowerShell HTTP server script
├── sync-to-sheets.ps1     # Google Sheets synchronization script
├── initial_data.json      # Structured snapshot extracted from Google Sheets
├── bs_calendar.json       # Extracted BS calendar conversion lookup
├── .gitignore             # Standard git ignore file
└── README.md              # Documentation & online deployment guide
```
