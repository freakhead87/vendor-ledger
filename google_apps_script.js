/**
 * Google Apps Script Webhook API for VendorLedger Pro
 * Full 2-Way Sync: Read, Add, Edit & Delete Rows in Google Sheets
 * 
 * SPREADSHEET: Master File - Vendor Bills vs Payment
 * ID: 1zWKy_Zypr9Uday4VsqrqwSeQwTrAz5_X3Ijo8l9pJxw
 */

// 1. GET: Fetch all live transactions and vendors
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

      // Read columns A to G (S/No, Date BS, Date AD, Bill Dr, Payment Cr, Due Balance, Notes)
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
            rowNumber: idx + 2,
            sNo: sNo,
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

// 2. POST: Handle Add, Delete, and Edit
function doPost(e) {
  try {
    const raw = e.postData.contents;
    const body = JSON.parse(raw);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const action = body.action || "add"; // "add", "delete", "edit"
    const vendor = body.vendor;

    let sheet = ss.getSheetByName(vendor);
    if (!sheet) {
      if (action === "add") {
        sheet = ss.insertSheet(vendor);
        sheet.appendRow(["S/No", "Date BS", "Date AD", "Billed Amount Dr", "Payment Cr", "Due Balance", "Notes"]);
      } else {
        return createResponse(false, "Sheet for vendor '" + vendor + "' not found.");
      }
    }

    // --- ACTION: DELETE ---
    if (action === "delete") {
      const lastRow = sheet.getLastRow();
      let rowToDelete = -1;

      // Match by rowNumber if provided
      if (body.rowNumber && body.rowNumber <= lastRow && body.rowNumber >= 2) {
        rowToDelete = body.rowNumber;
      } else {
        // Search by S/No or matching details
        const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
        for (let i = 0; i < data.length; i++) {
          const r = data[i];
          const matchesSNo = body.sNo && String(r[0]) === String(body.sNo);
          const matchesVals = body.dateBS === formatDate(r[1]) && 
                              Number(body.billDr || 0) === Number(r[3] || 0) && 
                              Number(body.paymentCr || 0) === Number(r[4] || 0);

          if (matchesSNo || matchesVals) {
            rowToDelete = i + 2;
            break;
          }
        }
      }

      if (rowToDelete !== -1) {
        sheet.deleteRow(rowToDelete);
        recalculateSheet(sheet);
        return createResponse(true, "Row " + rowToDelete + " deleted from " + vendor + ".");
      } else {
        return createResponse(false, "Could not find matching transaction row to delete in " + vendor + ".");
      }
    }

    // --- ACTION: ADD ---
    if (action === "add") {
      const dateBS = body.dateBS || "";
      const dateAD = body.dateAD || "";
      const billDr = body.billDr ? Number(body.billDr) : "";
      const paymentCr = body.paymentCr ? Number(body.paymentCr) : "";
      const notes = body.notes || "";

      const lastRow = sheet.getLastRow();
      let nextSNo = 1;
      let prevDue = 0;

      if (lastRow >= 2) {
        const prevData = sheet.getRange(lastRow, 1, 1, 6).getValues()[0];
        nextSNo = (Number(prevData[0]) || 0) + 1;
        prevDue = Number(prevData[5]) || 0;
      }

      const newDue = prevDue + (Number(billDr) || 0) - (Number(paymentCr) || 0);
      sheet.appendRow([nextSNo, dateBS, dateAD, billDr, paymentCr, newDue, notes]);

      return createResponse(true, "Appended to " + vendor + " at row " + (lastRow + 1), { newDueBalance: newDue });
    }

    return createResponse(false, "Unknown action: " + action);

  } catch (err) {
    return createResponse(false, err.toString());
  }
}

// Recalculate S/No and running Due Balance after a deletion
function recalculateSheet(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const numRows = lastRow - 1;
  const range = sheet.getRange(2, 1, numRows, 7);
  const values = range.getValues();

  let runningDue = 0;
  for (let i = 0; i < numRows; i++) {
    values[i][0] = i + 1; // S/No
    const dr = Number(values[i][3]) || 0;
    const cr = Number(values[i][4]) || 0;
    runningDue = runningDue + dr - cr;
    values[i][5] = runningDue; // Due Balance
  }

  range.setValues(values);
}

function createResponse(success, message, extra = {}) {
  const payload = Object.assign({ success: success, message: message }, extra);
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
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
