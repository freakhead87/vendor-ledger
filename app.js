// VendorLedger Pro - Core Application Logic & BS Calendar Engine

// --- STATE MANAGEMENT ---
const STORAGE_KEY = 'vendor_ledger_pro_v1';

let state = {
  vendors: [],
  transactions: [],
  activeTab: 'dashboard',
  selectedVendor: 'all',
  searchQuery: '',
  typeFilter: 'all',
  dateSort: 'desc', // 'desc' or 'asc'
  editingTxId: null
};

// Initialize State
function initData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state.vendors = parsed.vendors || [];
      state.transactions = parsed.transactions || [];
    } catch (e) {
      console.error('Failed to parse saved state, loading initial seed data', e);
      loadInitialSeed();
    }
  } else {
    loadInitialSeed();
  }
}

function loadInitialSeed() {
  if (typeof INITIAL_DATA !== 'undefined') {
    state.vendors = JSON.parse(JSON.stringify(INITIAL_DATA.vendors || []));
    state.transactions = JSON.parse(JSON.stringify(INITIAL_DATA.transactions || []));
    saveState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    vendors: state.vendors,
    transactions: state.transactions
  }));
  updateSyncBadge();
}

function resetToDefault() {
  if (confirm("Are you sure you want to reset all data back to the original Google Sheet values? Any locally added transactions will be lost unless exported.")) {
    loadInitialSeed();
    renderAll();
    showToast("Data restored to Google Sheet initial values.", "info");
  }
}

// --- NEPALI BS CALENDAR ENGINE ---
// Month names in order
const BS_MONTH_NAMES = [
  "Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"
];

// Parse BS Calendar lookup table
const bsTable = {};
if (typeof BS_CALENDAR_RAW !== 'undefined') {
  BS_CALENDAR_RAW.slice(1).forEach(row => {
    const val = row.value || row;
    const year = parseInt(val[0]);
    if (year) {
      bsTable[year] = {
        adStart: val[1], // YYYY-MM-DD
        days: val.slice(2, 14).map(d => parseInt(d))
      };
    }
  });
}

function bsToAd(bsYear, bsMonth, bsDay) {
  bsYear = parseInt(bsYear);
  bsMonth = parseInt(bsMonth);
  bsDay = parseInt(bsDay);

  const entry = bsTable[bsYear];
  if (!entry) return null;
  if (bsMonth < 1 || bsMonth > 12) return null;
  if (bsDay < 1 || bsDay > entry.days[bsMonth - 1]) return null;

  let totalDays = 0;
  for (let m = 0; m < bsMonth - 1; m++) {
    totalDays += entry.days[m];
  }
  totalDays += (bsDay - 1);

  const [y, m, d] = entry.adStart.split('-').map(Number);
  const adDate = new Date(Date.UTC(y, m - 1, d));
  adDate.setUTCDate(adDate.getUTCDate() + totalDays);

  const year = adDate.getUTCFullYear();
  const month = String(adDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(adDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function adToBs(adDateStr) {
  if (!adDateStr) return null;
  const targetDate = new Date(adDateStr + 'T00:00:00Z');

  // Search in BS years
  const years = Object.keys(bsTable).map(Number).sort((a, b) => a - b);
  for (let i = 0; i < years.length; i++) {
    const year = years[i];
    const entry = bsTable[year];
    const startDate = new Date(entry.adStart + 'T00:00:00Z');

    let totalYearDays = entry.days.reduce((a, b) => a + b, 0);
    let endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + totalYearDays);

    if (targetDate >= startDate && targetDate < endDate) {
      let diffDays = Math.round((targetDate - startDate) / (1000 * 60 * 60 * 24));
      let curMonth = 0;
      while (curMonth < 12 && diffDays >= entry.days[curMonth]) {
        diffDays -= entry.days[curMonth];
        curMonth++;
      }
      const bsMonth = curMonth + 1;
      const bsDay = diffDays + 1;
      return `${year}/${String(bsMonth).padStart(2, '0')}/${String(bsDay).padStart(2, '0')}`;
    }
  }
  return null;
}

// --- FINANCIAL COMPUTATIONS ---
function getTotals(vendorName = 'all') {
  let txs = state.transactions;
  if (vendorName !== 'all') {
    txs = txs.filter(t => t.vendor.toLowerCase() === vendorName.toLowerCase());
  }

  let billed = 0;
  let paid = 0;
  txs.forEach(t => {
    billed += (Number(t.billDr) || 0);
    paid += (Number(t.paymentCr) || 0);
  });

  const due = billed - paid;
  const rate = billed > 0 ? (paid / billed) * 100 : (paid > 0 ? 100 : 0);

  return { billed, paid, due, rate, count: txs.length };
}

function getMonthlyTimeline(vendorName = 'all') {
  let txs = state.transactions;
  if (vendorName !== 'all') {
    txs = txs.filter(t => t.vendor.toLowerCase() === vendorName.toLowerCase());
  }

  const map = {};
  txs.forEach(t => {
    if (!t.dateBS) return;
    const key = t.dateBS.substring(0, 7); // YYYY/MM
    if (!map[key]) {
      const parts = key.split('/');
      const y = parts[0];
      const mIdx = parseInt(parts[1]) - 1;
      const mName = BS_MONTH_NAMES[mIdx] || parts[1];
      map[key] = {
        key,
        name: `${mName} ${y}`,
        billed: 0,
        paid: 0,
        txCount: 0
      };
    }
    map[key].billed += (Number(t.billDr) || 0);
    map[key].paid += (Number(t.paymentCr) || 0);
    map[key].txCount++;
  });

  const sortedKeys = Object.keys(map).sort();
  let runningDue = 0;
  return sortedKeys.map(k => {
    const item = map[k];
    const net = item.billed - item.paid;
    runningDue += net;
    return {
      ...item,
      net,
      runningDue
    };
  });
}

function calculateVendorBalances() {
  const result = {};
  state.vendors.forEach(v => {
    result[v.name] = { billed: 0, paid: 0, due: 0, count: 0, lastDate: '-' };
  });

  // Sort txs ascending by date to compute running balance accurately
  const sorted = [...state.transactions].sort((a, b) => (a.dateBS || '').localeCompare(b.dateBS || ''));

  sorted.forEach(t => {
    if (!result[t.vendor]) {
      result[t.vendor] = { billed: 0, paid: 0, due: 0, count: 0, lastDate: '-' };
    }
    const b = Number(t.billDr) || 0;
    const p = Number(t.paymentCr) || 0;
    result[t.vendor].billed += b;
    result[t.vendor].paid += p;
    result[t.vendor].due = result[t.vendor].billed - result[t.vendor].paid;
    result[t.vendor].count++;
    if (t.dateAD) result[t.vendor].lastDate = t.dateAD;
  });

  return result;
}

// --- UI RENDERING ---
function formatNPR(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-US');
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg shadow-xl font-medium text-xs text-white transition-all transform duration-300 ${
    type === 'error' ? 'bg-rose-600' : (type === 'info' ? 'bg-indigo-600' : 'bg-emerald-600')
  }`;
  toast.style.display = 'block';
  toast.style.opacity = '1';
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => { toast.style.display = 'none'; }, 300);
  }, 2800);
}

function updateSyncBadge() {
  const badge = document.getElementById('syncStatusBadge');
  if (badge) {
    badge.textContent = `${state.transactions.length} Records Saved`;
  }
}

// Render Dashboard View
function renderDashboard() {
  const v = getTotals(state.selectedVendor);

  document.getElementById('dashBilled').textContent = 'NPR ' + formatNPR(v.billed);
  document.getElementById('dashPaid').textContent = 'NPR ' + formatNPR(v.paid);
  document.getElementById('dashDue').textContent = 'NPR ' + formatNPR(v.due);
  document.getElementById('dashRate').textContent = v.rate.toFixed(1) + '%';
  document.getElementById('dashRateBar').style.width = Math.min(100, v.rate) + '%';
  document.getElementById('dashTxCount').textContent = `${v.count} Transactions`;

  // Subtitles
  const selName = state.selectedVendor === 'all' ? 'All 5 Vendor Accounts' : state.selectedVendor;
  document.getElementById('dashBilledSub').textContent = `Invoiced for ${selName}`;
  document.getElementById('dashPaidSub').textContent = `Settlements released`;
  document.getElementById('dashDueSub').textContent = v.due > 0 ? 'Pending Payment Balance' : 'Account Settled';

  // Render Chart
  renderChart();

  // Render Vendor Ranking Cards
  renderVendorCards();

  // Render Recent Activity
  renderRecentActivity();
}

function renderChart() {
  const timeline = getMonthlyTimeline(state.selectedVendor);
  const container = document.getElementById('chartBars');
  const labels = document.getElementById('chartLabels');
  if (!container || !labels) return;

  container.innerHTML = '';
  labels.innerHTML = '';

  if (timeline.length === 0) {
    container.innerHTML = '<div class="w-full h-full flex items-center justify-center text-slate-400 text-xs">No monthly transactions found.</div>';
    return;
  }

  const maxVal = Math.max(...timeline.map(t => Math.max(t.billed, t.paid)), 1000);

  timeline.forEach(t => {
    const bHeight = Math.max(4, Math.round((t.billed / maxVal) * 100));
    const pHeight = Math.max(4, Math.round((t.paid / maxVal) * 100));

    const group = document.createElement('div');
    group.className = 'flex-1 flex items-end justify-center gap-1 group relative h-full';
    group.innerHTML = `
      <div class="w-3 rounded-t bg-indigo-500 transition-all hover:bg-indigo-400" style="height: ${t.billed > 0 ? bHeight : 0}%"></div>
      <div class="w-3 rounded-t bg-emerald-500 transition-all hover:bg-emerald-400" style="height: ${t.paid > 0 ? pHeight : 0}%"></div>
      <div class="absolute bottom-full mb-1 hidden group-hover:flex flex-col bg-slate-900 text-white border border-slate-700 rounded px-2 py-1 text-[10px] shadow-2xl z-20 whitespace-nowrap pointer-events-none">
        <span class="font-bold">${t.name}</span>
        <span class="text-indigo-300">Billed: NPR ${formatNPR(t.billed)}</span>
        <span class="text-emerald-300">Paid: NPR ${formatNPR(t.paid)}</span>
        <span class="text-rose-300">Net Due: NPR ${formatNPR(t.runningDue)}</span>
      </div>
    `;
    container.appendChild(group);

    const lbl = document.createElement('span');
    lbl.className = 'flex-1 text-center truncate text-[9px] text-slate-400 font-mono';
    lbl.textContent = t.key.substring(2);
    labels.appendChild(lbl);
  });
}

function renderVendorCards() {
  const container = document.getElementById('vendorCardsContainer');
  if (!container) return;
  container.innerHTML = '';

  const balances = calculateVendorBalances();

  state.vendors.forEach(v => {
    const stat = balances[v.name] || { billed: 0, paid: 0, due: 0, count: 0, lastDate: '-' };
    const pct = stat.billed > 0 ? (stat.paid / stat.billed) * 100 : (stat.paid > 0 ? 100 : 0);
    const isSelected = state.selectedVendor.toLowerCase() === v.name.toLowerCase();

    const card = document.createElement('div');
    card.className = `p-3 rounded-xl border transition-all cursor-pointer ${
      isSelected
        ? 'bg-indigo-50 border-indigo-400 dark:bg-indigo-950/40 dark:border-indigo-500 shadow-sm'
        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
    }`;
    card.onclick = () => {
      setVendorFilter(isSelected ? 'all' : v.name);
    };

    const statusBadge = stat.due === 0 && stat.billed > 0
      ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Settled</span>'
      : (stat.billed === 0
        ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">Template</span>'
        : '<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Due Pending</span>');

    card.innerHTML = `
      <div class="flex items-center justify-between mb-1.5">
        <span class="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate">${v.name}</span>
        ${statusBadge}
      </div>
      <div class="grid grid-cols-2 gap-1 text-[11px] mb-2">
        <div>
          <span class="text-slate-400 text-[10px]">Billed:</span>
          <div class="font-medium text-slate-700 dark:text-slate-200">NPR ${formatNPR(stat.billed)}</div>
        </div>
        <div>
          <span class="text-slate-400 text-[10px]">Balance Due:</span>
          <div class="font-bold ${stat.due > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}">NPR ${formatNPR(stat.due)}</div>
        </div>
      </div>
      <div class="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mb-1">
        <div class="bg-indigo-500 h-full rounded-full transition-all" style="width: ${Math.min(100, pct)}%"></div>
      </div>
      <div class="flex items-center justify-between text-[10px] text-slate-400">
        <span>${stat.count} txns</span>
        <span>${pct.toFixed(0)}% paid</span>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderRecentActivity() {
  const container = document.getElementById('recentActivityList');
  if (!container) return;
  container.innerHTML = '';

  const recent = [...state.transactions].reverse().slice(0, 6);
  if (recent.length === 0) {
    container.innerHTML = '<div class="text-slate-400 text-xs py-3 text-center">No recent transactions recorded.</div>';
    return;
  }

  recent.forEach(t => {
    const isBill = (Number(t.billDr) || 0) > 0;
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800/80 last:border-0';
    item.innerHTML = `
      <div class="flex items-center gap-2.5">
        <span class="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
          isBill ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300'
        }">
          ${isBill ? 'Dr' : 'Cr'}
        </span>
        <div>
          <div class="font-medium text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <span>${t.vendor}</span>
            <span class="text-[10px] text-slate-400 font-mono">${t.dateBS}</span>
          </div>
          <div class="text-[10px] text-slate-400 truncate max-w-[200px]">${t.notes || (isBill ? 'Invoice Bill' : 'Settlement Payment')}</div>
        </div>
      </div>
      <div class="text-right">
        <div class="font-bold text-xs font-mono ${isBill ? 'text-indigo-600 dark:text-indigo-400' : 'text-emerald-600 dark:text-emerald-400'}">
          NPR ${formatNPR(isBill ? t.billDr : t.paymentCr)}
        </div>
        <div class="text-[9px] text-slate-400">Bal: NPR ${formatNPR(t.dueBalance)}</div>
      </div>
    `;
    container.appendChild(item);
  });
}

// Render Ledger View
function renderLedger() {
  const tbody = document.getElementById('ledgerTbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  let filtered = [...state.transactions];

  // Vendor filter
  if (state.selectedVendor !== 'all') {
    filtered = filtered.filter(t => t.vendor.toLowerCase() === state.selectedVendor.toLowerCase());
  }

  // Type filter
  if (state.typeFilter === 'bills') {
    filtered = filtered.filter(t => (Number(t.billDr) || 0) > 0);
  } else if (state.typeFilter === 'payments') {
    filtered = filtered.filter(t => (Number(t.paymentCr) || 0) > 0);
  }

  // Search query
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(t =>
      (t.vendor || '').toLowerCase().includes(q) ||
      (t.notes || '').toLowerCase().includes(q) ||
      (t.dateBS || '').includes(q) ||
      (t.dateAD || '').includes(q)
    );
  }

  // Sort
  if (state.dateSort === 'asc') {
    filtered.sort((a, b) => (a.dateBS || '').localeCompare(b.dateBS || ''));
  } else {
    filtered.sort((a, b) => (b.dateBS || '').localeCompare(a.dateBS || ''));
  }

  document.getElementById('ledgerCount').textContent = `${filtered.length} entries shown`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400 text-xs">No transactions match your search or filter criteria.</td></tr>`;
    return;
  }

  filtered.forEach((t, idx) => {
    const b = Number(t.billDr) || 0;
    const p = Number(t.paymentCr) || 0;
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-xs transition';
    tr.innerHTML = `
      <td class="py-2.5 px-3 text-slate-400 font-mono text-[11px]">${idx + 1}</td>
      <td class="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-100">${t.vendor}</td>
      <td class="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">${t.dateBS || '-'}</td>
      <td class="py-2.5 px-3 font-mono text-[11px] text-slate-400">${t.dateAD || '-'}</td>
      <td class="py-2.5 px-3 text-right font-mono font-medium ${b > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-600'}">
        ${b > 0 ? formatNPR(b) : '-'}
      </td>
      <td class="py-2.5 px-3 text-right font-mono font-medium ${p > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-600'}">
        ${p > 0 ? formatNPR(p) : '-'}
      </td>
      <td class="py-2.5 px-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-200">
        ${formatNPR(t.dueBalance)}
      </td>
      <td class="py-2.5 px-3 text-slate-500 text-[11px] max-w-xs truncate">${t.notes || '-'}</td>
      <td class="py-2.5 px-3 text-right whitespace-nowrap">
        <button onclick="editTransaction('${t.id}')" class="text-indigo-500 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950 mr-1" title="Edit">
          ✏️
        </button>
        <button onclick="deleteTransaction('${t.id}')" class="text-rose-500 hover:text-rose-600 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950" title="Delete">
          🗑️
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAll() {
  renderVendorSelectors();
  renderDashboard();
  renderLedger();
}

function renderVendorSelectors() {
  const selects = ['dashVendorSelect', 'ledgerVendorSelect', 'formVendorSelect'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const curVal = el.value || 'all';
    el.innerHTML = '';

    if (id !== 'formVendorSelect') {
      const allOpt = document.createElement('option');
      allOpt.value = 'all';
      allOpt.textContent = 'All Vendors (Consolidated)';
      el.appendChild(allOpt);
    }

    state.vendors.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.name;
      opt.textContent = v.name;
      el.appendChild(opt);
    });

    if (id === 'formVendorSelect') {
      const newOpt = document.createElement('option');
      newOpt.value = '__new__';
      newOpt.textContent = '+ Add New Vendor...';
      el.appendChild(newOpt);
    }

    el.value = curVal;
  });
}

function setVendorFilter(v) {
  state.selectedVendor = v;
  const dashSel = document.getElementById('dashVendorSelect');
  const ledgSel = document.getElementById('ledgerVendorSelect');
  if (dashSel) dashSel.value = v;
  if (ledgSel) ledgSel.value = v;
  renderAll();
}

// --- RECORD DATA / MODAL HANDLERS ---
function openRecordModal(vendorDefault = null, isEdit = false) {
  state.editingTxId = null;
  const modal = document.getElementById('recordModal');
  const title = document.getElementById('modalTitle');
  if (!modal) return;

  // Defaults
  title.textContent = isEdit ? 'Edit Transaction' : 'Record Bill / Payment';

  const vendorSelect = document.getElementById('formVendorSelect');
  if (vendorDefault && vendorDefault !== 'all') {
    vendorSelect.value = vendorDefault;
  } else if (!isEdit && state.selectedVendor !== 'all') {
    vendorSelect.value = state.selectedVendor;
  }

  // Default dates to today
  if (!isEdit) {
    const today = new Date();
    const adStr = today.toISOString().split('T')[0];
    document.getElementById('formDateAD').value = adStr;
    const bsStr = adToBs(adStr);
    document.getElementById('formDateBS').value = bsStr || '2083/08/04';

    document.getElementById('formAmount').value = '';
    document.getElementById('formPartialPaid').value = '';
    document.getElementById('formNotes').value = '';
    setFormType('BILL');
  }

  updateLiveBalancePreview();
  modal.classList.remove('hidden');
}

function closeRecordModal() {
  const modal = document.getElementById('recordModal');
  if (modal) modal.classList.add('hidden');
}

function setFormType(type) {
  const btnBill = document.getElementById('typeBtnBill');
  const btnPay = document.getElementById('typeBtnPay');
  const btnBoth = document.getElementById('typeBtnBoth');
  const partialRow = document.getElementById('partialPaidRow');

  [btnBill, btnPay, btnBoth].forEach(b => {
    b.className = 'flex-1 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300';
  });

  if (type === 'BILL') {
    btnBill.className = 'flex-1 py-2 text-xs font-semibold rounded-lg border border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 shadow-sm';
    partialRow.classList.add('hidden');
  } else if (type === 'PAYMENT') {
    btnPay.className = 'flex-1 py-2 text-xs font-semibold rounded-lg border border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300 shadow-sm';
    partialRow.classList.add('hidden');
  } else if (type === 'BOTH') {
    btnBoth.className = 'flex-1 py-2 text-xs font-semibold rounded-lg border border-purple-500 bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 shadow-sm';
    partialRow.classList.remove('hidden');
  }

  document.getElementById('formActiveType').value = type;
  updateLiveBalancePreview();
}

function updateLiveBalancePreview() {
  const vendorName = document.getElementById('formVendorSelect').value;
  if (!vendorName || vendorName === '__new__') return;

  const balances = calculateVendorBalances();
  const curDue = (balances[vendorName] ? balances[vendorName].due : 0);

  const type = document.getElementById('formActiveType').value;
  const amt = parseFloat(document.getElementById('formAmount').value) || 0;
  const partialPaid = parseFloat(document.getElementById('formPartialPaid').value) || 0;

  let newDue = curDue;
  if (type === 'BILL') {
    newDue = curDue + amt;
  } else if (type === 'PAYMENT') {
    newDue = curDue - amt;
  } else if (type === 'BOTH') {
    newDue = curDue + amt - partialPaid;
  }

  document.getElementById('previewCurDue').textContent = 'NPR ' + formatNPR(curDue);
  document.getElementById('previewNewDue').textContent = 'NPR ' + formatNPR(newDue);
}

// Save transaction from form
function handleSaveTransaction(e) {
  if (e) e.preventDefault();

  const vendorName = document.getElementById('formVendorSelect').value;
  if (!vendorName || vendorName === '__new__') {
    alert("Please select or create a valid vendor.");
    return;
  }

  const type = document.getElementById('formActiveType').value;
  const dateBS = document.getElementById('formDateBS').value.trim();
  const dateAD = document.getElementById('formDateAD').value.trim();
  const amt = parseFloat(document.getElementById('formAmount').value) || 0;
  const partialPaid = parseFloat(document.getElementById('formPartialPaid').value) || 0;
  const notes = document.getElementById('formNotes').value.trim();

  if (amt <= 0) {
    alert("Please enter a valid transaction amount greater than 0.");
    return;
  }

  let billDr = 0;
  let paymentCr = 0;
  if (type === 'BILL') {
    billDr = amt;
  } else if (type === 'PAYMENT') {
    paymentCr = amt;
  } else if (type === 'BOTH') {
    billDr = amt;
    paymentCr = partialPaid;
  }

  // Recalculate balance for this vendor
  const balances = calculateVendorBalances();
  const curDue = (balances[vendorName] ? balances[vendorName].due : 0);
  const newDue = curDue + billDr - paymentCr;

  if (state.editingTxId) {
    // Edit existing
    const idx = state.transactions.findIndex(t => t.id === state.editingTxId);
    if (idx !== -1) {
      state.transactions[idx] = {
        ...state.transactions[idx],
        vendor: vendorName,
        dateBS,
        dateAD,
        billDr,
        paymentCr,
        amount: amt,
        dueBalance: newDue,
        notes
      };
      showToast("Transaction updated successfully!");
    }
  } else {
    // Add new
    const newTx = {
      id: 'tx-' + Date.now(),
      vendor: vendorName,
      dateBS,
      dateAD,
      type: type,
      billDr,
      paymentCr,
      amount: amt,
      dueBalance: newDue,
      notes,
      source: 'web_entry'
    };
    state.transactions.push(newTx);
    showToast(`Recorded ${type === 'BILL' ? 'Bill' : 'Payment'} for ${vendorName}!`);
  }

  saveState();
  closeRecordModal();
  renderAll();
}

function editTransaction(id) {
  const t = state.transactions.find(x => x.id === id);
  if (!t) return;

  state.editingTxId = id;
  openRecordModal(t.vendor, true);

  document.getElementById('formVendorSelect').value = t.vendor;
  document.getElementById('formDateBS').value = t.dateBS || '';
  document.getElementById('formDateAD').value = t.dateAD || '';
  document.getElementById('formNotes').value = t.notes || '';

  const b = Number(t.billDr) || 0;
  const p = Number(t.paymentCr) || 0;

  if (b > 0 && p > 0) {
    setFormType('BOTH');
    document.getElementById('formAmount').value = b;
    document.getElementById('formPartialPaid').value = p;
  } else if (b > 0) {
    setFormType('BILL');
    document.getElementById('formAmount').value = b;
  } else {
    setFormType('PAYMENT');
    document.getElementById('formAmount').value = p;
  }

  updateLiveBalancePreview();
}

function deleteTransaction(id) {
  if (confirm("Are you sure you want to delete this transaction record?")) {
    state.transactions = state.transactions.filter(t => t.id !== id);
    saveState();
    renderAll();
    showToast("Transaction deleted.", "info");
  }
}

function openAddVendorModal() {
  const name = prompt("Enter new Vendor / Supplier Account Name:");
  if (name && name.trim()) {
    const trimmed = name.trim();
    if (state.vendors.some(v => v.name.toLowerCase() === trimmed.toLowerCase())) {
      alert("Vendor already exists!");
      return;
    }
    state.vendors.push({
      name: trimmed,
      notes: "Created via web app"
    });
    saveState();
    renderAll();
    showToast(`Vendor '${trimmed}' created!`);
  }
}

// --- EXPORT & BACKUP HANDLERS ---
function exportCSV() {
  let csv = "ID,Vendor,Date BS,Date AD,Billed Amount Dr,Payment Cr,Due Balance,Notes\n";
  state.transactions.forEach(t => {
    const cleanNotes = (t.notes || '').replace(/"/g, '""');
    csv += `"${t.id}","${t.vendor}","${t.dateBS || ''}","${t.dateAD || ''}",${t.billDr || 0},${t.paymentCr || 0},${t.dueBalance || 0},"${cleanNotes}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Vendor_Bills_Ledger_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast("Ledger CSV downloaded!");
}

function exportJSON() {
  const data = JSON.stringify({
    version: '1.0',
    exportDate: new Date().toISOString(),
    vendors: state.vendors,
    transactions: state.transactions
  }, null, 2);

  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Vendor_Ledger_Backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  showToast("JSON backup downloaded!");
}

function importJSON(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.vendors && data.transactions) {
        state.vendors = data.vendors;
        state.transactions = data.transactions;
        saveState();
        renderAll();
        showToast("Backup restored successfully!");
      } else {
        alert("Invalid JSON format. Expected 'vendors' and 'transactions' arrays.");
      }
    } catch (err) {
      alert("Error parsing backup file: " + err.message);
    }
  };
  reader.readAsText(file);
}

// Switch View Tabs
function switchTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll('.view-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.className = 'nav-tab px-3 py-1.5 rounded-lg font-medium text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition';
  });

  const targetPanel = document.getElementById(`panel-${tabName}`);
  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetPanel) targetPanel.classList.remove('hidden');
  if (targetTab) {
    targetTab.className = 'nav-tab px-3 py-1.5 rounded-lg font-semibold text-xs bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 transition';
  }

  if (tabName === 'ledger') renderLedger();
  if (tabName === 'dashboard') renderDashboard();
}

// Setup Event Listeners on load
window.addEventListener('DOMContentLoaded', () => {
  initData();
  renderAll();

  // Date Auto-Sync Listeners
  const bsInput = document.getElementById('formDateBS');
  const adInput = document.getElementById('formDateAD');

  if (bsInput && adInput) {
    bsInput.addEventListener('input', () => {
      const val = bsInput.value.trim();
      const parts = val.split(/[\/\-]/);
      if (parts.length === 3 && parts[0].length === 4) {
        const ad = bsToAd(parts[0], parts[1], parts[2]);
        if (ad) adInput.value = ad;
      }
    });

    adInput.addEventListener('change', () => {
      const val = adInput.value;
      if (val) {
        const bs = adToBs(val);
        if (bs) bsInput.value = bs;
      }
    });
  }

  // Live preview listeners
  const formAmt = document.getElementById('formAmount');
  const formPart = document.getElementById('formPartialPaid');
  const formVend = document.getElementById('formVendorSelect');

  if (formAmt) formAmt.addEventListener('input', updateLiveBalancePreview);
  if (formPart) formPart.addEventListener('input', updateLiveBalancePreview);
  if (formVend) {
    formVend.addEventListener('change', () => {
      if (formVend.value === '__new__') {
        openAddVendorModal();
      } else {
        updateLiveBalancePreview();
      }
    });
  }

  // Filter listeners
  const searchInput = document.getElementById('ledgerSearch');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      state.searchQuery = e.target.value;
      renderLedger();
    });
  }

  const typeSel = document.getElementById('ledgerTypeFilter');
  if (typeSel) {
    typeSel.addEventListener('change', e => {
      state.typeFilter = e.target.value;
      renderLedger();
    });
  }

  // Keyboard shortcut: Ctrl + N for quick record
  window.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      openRecordModal();
    }
  });
});
