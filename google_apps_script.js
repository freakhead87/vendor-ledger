/**
 * Google Apps Script Webhook API for VendorLedger Pro
 * 
 * SPREADSHEET: Master File - Vendor Bills vs Payment
 * ID: 1zWKy_Zypr9Uday4VsqrqwSeQwTrAz5_X3Ijo8l9pJxw
 * 
 * HOW TO DEPLOY:
 * 1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1zWKy_Zypr9Uday4VsqrqwSeQwTrAz5_X3Ijo8l9pJxw/edit
 * 2. Click Extensions > Apps Script in the top menu.
 * 3. Delete any default code in Code.gs, paste this entire file, and click Save (disk icon).
 * 4. Click Deploy > New deployment (top right).
 * 5. Select type: "Web app".
 * 6. Set Description: "VendorLedger Cloud API".
 * 7. Set "Execute as": "Me (freakhead87@gmail.com)".
 * 8. Set "Who has access": "Anyone" (allows your web app on Cloudflare Pages to send entries).
 * 9. Click Deploy, Authorize access, and COPY the Web App URL (ends in /exec).
 * 10. Paste that URL into your VendorLedger Pro Web App under "Sheets & Sync".
 */

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    const allTransactions = [];
    const vendors = [];

    sheets.forEach(sheet => {
      const title = sheet.getName();
      if (title === "Dashboard" || title === "BS Calendar Reference") return;

      vendors.push({ name: title });

      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return;

      // Read A2:G{lastRow}
      const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
      data.forEach((row, idx) => {
        const sNo = row[0];
        const dateBS = row[1];
        const dateAD = row[2];
        const billDr = Number(row[3]) || 0;
        const paymentCr = Number(row[4]) || 0;
        const dueBalance = Number(row[5]) || 0;
        const notes = row[6] || "";

        if (sNo !== "" && (billDr > 0 || paymentCr > 0 || dateBS !== "")) {
          allTransactions.push({
            id: title + "-row-" + (idx + 2),
            vendor: title,
            dateBS: formatDate(dateBS),
            dateAD: formatDate(dateAD),
            billDr: billDr,
            paymentCr: paymentCr,
            dueBalance: dueBalance,
            notes: notes.toString()
          });
        }
      });
    });

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      vendors: vendors,
      transactions: allTransactions
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const raw = e.postData.contents;
    const body = JSON.parse(raw);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const vendor = body.vendor;
    const dateBS = body.dateBS || "";
    const dateAD = body.dateAD || "";
    const billDr = body.billDr ? Number(body.billDr) : "";
    const paymentCr = body.paymentCr ? Number(body.paymentCr) : "";
    const notes = body.notes || "";

    let sheet = ss.getSheetByName(vendor);
    if (!sheet) {
      sheet = ss.insertSheet(vendor);
      sheet.appendRow(["S/No", "Date BS", "Date AD", "Billed Amount Dr", "Payment Cr", "Due Balance", "Notes"]);
    }

    // Determine next serial number & previous due balance
    const lastRow = sheet.getLastRow();
    let nextSNo = 1;
    let prevDue = 0;

    if (lastRow >= 2) {
      const prevData = sheet.getRange(lastRow, 1, 1, 6).getValues()[0];
      nextSNo = (Number(prevData[0]) || 0) + 1;
      prevDue = Number(prevData[5]) || 0;
    }

    const newDue = prevDue + (Number(billDr) || 0) - (Number(paymentCr) || 0);

    // Append transaction row
    sheet.appendRow([nextSNo, dateBS, dateAD, billDr, paymentCr, newDue, notes]);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "Recorded in " + vendor + " at row " + (lastRow + 1),
      newDueBalance: newDue
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function formatDate(val) {
  if (!val) return "";
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return val.toString();
}
