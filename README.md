# 📊 VendorLedger Pro • Web Application

A dedicated, fast, offline-ready web application designed for managing **Vendor Bills, Purchase Invoices, and Payment Settlements** with built-in Nepalese Bikram Sambat (BS) and Gregorian (AD) calendar support.

---

## 🚀 Quick Start (Two Ways to Open)

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
   * Run `.\sync-to-sheets.ps1 -BackupJsonFile backup.json` to push newly recorded web entries straight into your Google Sheets workbook!

---

## 📁 File Structure

```text
vendor-bills-app/
├── index.html             # Main single-page web app (Tailwind CSS, responsive layout)
├── app.js                 # State store, BS-AD calendar engine, UI renderers, live calculators
├── data.js                # Initial master data seed (69 historical txns + BS reference)
├── start-server.ps1       # Native Windows PowerShell HTTP server script
├── sync-to-sheets.ps1     # Google Sheets synchronization script
├── initial_data.json      # Structured snapshot extracted from Google Sheets
├── bs_calendar.json       # Extracted BS calendar conversion lookup
└── README.md              # Documentation & user guide
```
