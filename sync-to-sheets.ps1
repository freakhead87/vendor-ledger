# VendorLedger Pro - Google Sheets Sync Script
# Appends new transactions to Google Sheet workbook

param(
    [string]$SpreadsheetId = "1zWKy_Zypr9Uday4VsqrqwSeQwTrAz5_X3Ijo8l9pJxw",
    [string]$BackupJsonFile = ""
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " 🔄 VendorLedger -> Google Sheets Synchronizer" -ForegroundColor Green
Write-Host " Spreadsheet ID: $SpreadsheetId" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

# Test gsheets CLI
try {
    $ver = & gsheets --version
    Write-Host "✓ gsheets CLI available: $ver" -ForegroundColor Green
} catch {
    Write-Error "gsheets CLI not found. Please ensure gsheets is installed and authenticated."
    exit 1
}

# If user passed a JSON backup file exported from the web app
if ($BackupJsonFile -and (Test-Path $BackupJsonFile)) {
    Write-Host "Loading transactions from: $BackupJsonFile" -ForegroundColor Cyan
    $data = Get-Content $BackupJsonFile -Raw | ConvertFrom-Json
    $newTxs = $data.transactions | Where-Object { $_.source -eq "web_entry" }
    
    if (-not $newTxs -or $newTxs.Count -eq 0) {
        Write-Host "No new un-synced transactions found with source 'web_entry'." -ForegroundColor Yellow
        exit 0
    }

    Write-Host "Found $($newTxs.Count) new web-recorded transaction(s) to sync..." -ForegroundColor Green
    foreach ($tx in $newTxs) {
        $sheetName = $tx.vendor
        $dr = if ($tx.billDr) { $tx.billDr } else { "" }
        $cr = if ($tx.paymentCr) { $tx.paymentCr } else { "" }
        $notes = if ($tx.notes) { $tx.notes } else { "" }
        $rowVal = "$($tx.dateBS),$($tx.dateAD),$dr,$cr,$($tx.dueBalance),$notes"
        
        Write-Host "Appending to '$sheetName': $rowVal" -ForegroundColor Gray
        & gsheets mutate append $SpreadsheetId "'$sheetName'!A1" $rowVal
    }
    Write-Host "✓ All transactions synchronized successfully!" -ForegroundColor Green
} else {
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  1. In the Web App, go to 'Sheets & Sync' and click 'Download JSON Backup'"
    Write-Host "  2. Run: .\sync-to-sheets.ps1 -BackupJsonFile path\to\backup.json"
}
