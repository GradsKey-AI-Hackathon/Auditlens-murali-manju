const $ = (id) => document.getElementById(id);
const state = {
  user_id: null,
  role: null,
  user: null,
  audits: [],
  vendorScore: null,
  filter: "all",
  search: "",
  view: "history",
};

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function toast(msg, type = "success") {
  const el = $("toast");
  el.textContent = msg;
  el.className = "toast " + type + " show";
  setTimeout(() => el.classList.remove("show"), 3000);
}
function money(n) { return "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d)) return s;
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function logout() { clearSession(); location.href = "signup.html"; }

function riskColor(score) {
  const s = Number(score || 0);
  if (s <= 25) return "var(--success)";
  if (s <= 60) return "var(--warning)";
  return "var(--error)";
}
function riskWidth(score) { return Math.max(2, Math.min(100, Number(score || 0))) + "%"; }

function requireAuth() {
  const uid = getUserId();
  const rle = getRole();
  if (!uid || !rle) {
    location.href = "signup.html";
    return false;
  }
  state.user_id = uid;
  state.role = String(rle).toUpperCase();
  const badge = $("roleBadge");
  badge.textContent = state.role;
  badge.classList.add(state.role === "BUYER" ? "buyer" : "vendor");
  return true;
}

function renderNav() {
  const isBuyer = state.role === "BUYER";
  $("topNav").innerHTML = isBuyer ? `
    <button onclick="location.href='buyer.html'">Dashboard</button>
    <button class="active">Audit</button>
  ` : `
    <button onclick="location.href='vendor.html'">Orders</button>
    <button onclick="location.href='invoices.html'">Invoices</button>
    <button class="active">Audit</button>
  `;
  const cta = $("topCTA");
  cta.innerHTML = isBuyer ? `
    <button class="btn btn-primary" onclick="location.href='buyer.html'">+ Create PO</button>
  ` : `
    <button class="btn btn-primary" onclick="location.href='invoices.html'">+ Submit Invoice</button>
  `;
  const scoreTab = $("scoreTab");
  scoreTab.style.display = isBuyer ? "none" : "block";
}

// ========== TABS ==========
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const v = tab.dataset.view;
    state.view = v;
    $("view-history").style.display = v === "history" ? "block" : "none";
    $("view-score").style.display  = v === "score"   ? "block" : "none";
    if (v === "score" && !state.vendorScore && state.role === "VENDOR") loadScore();
  });
});

// ========== FILTERS / SEARCH ==========
document.querySelectorAll(".filter-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    state.filter = chip.dataset.status;
    renderHistory();
  });
});
$("searchBox").addEventListener("input", e => {
  state.search = e.target.value.trim().toLowerCase();
  renderHistory();
});

// ========== LOAD DATA ==========
async function loadAll() {
  renderStatsSkeleton();
  $("historyContainer").innerHTML = `<div class="table-wrap" style="padding:12px;">${Array.from({length:5}).map(()=>`<div class="skeleton skeleton-row"></div>`).join("")}</div>`;

  try {
    const isBuyer = state.role === "BUYER";
    const idParam = isBuyer ? `buyer_id=${state.user_id}` : `vendor_id=${state.user_id}`;

    const [audits, me] = await Promise.all([
      apiFetch(`/audits?${idParam}&limit=500`).then(r => r.ok ? r.json() : []),
      isBuyer
        ? Promise.resolve(null)
        : apiFetch(`/vendors/${state.user_id}`).then(r => r.ok ? r.json() : null),
    ]);

    state.audits = Array.isArray(audits) ? audits : [];
    state.user = me || null;
    if (state.user) $("userEmail").textContent =
      state.user.email || state.user.business_name || state.user.name || "—";

    renderStats();
    renderHistory();
  } catch (err) {
    toast(err.message || "Failed to load", "error");
  }
}

async function loadScore() {
  $("scoreContainer").innerHTML = `<div class="skeleton" style="height:300px;"></div>`;
  try {
    const data = await apiFetch(`/vendors/${state.user_id}/score`).then(r => r.ok ? r.json() : null);
    state.vendorScore = data;
    renderScore();
  } catch (err) {
    toast(err.message || "Failed to load score", "error");
    $("scoreContainer").innerHTML = `<div class="state-box"><div class="big-icon">⚠️</div><h3>Could not load</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}

// ========== STATS ==========
function renderStatsSkeleton() {
  $("stats").innerHTML = Array.from({length:5}).map(() => `
    <div class="stat">
      <div class="skeleton" style="height:14px; width:60%; margin-bottom:10px;"></div>
      <div class="skeleton" style="height:32px; width:50%;"></div>
    </div>
  `).join("");
}
function renderStats() {
  const list = state.audits;
  const total = list.length;
  const clear = list.filter(a => a.audit_status === "CLEAR").length;
  const disc  = list.filter(a => a.audit_status === "DISCREPANCY").length;
  const exposure = list.reduce((s, a) => s + (Number(a.financial_exposure) || 0), 0);
  const avgRisk = total ? (list.reduce((s, a) => s + (Number(a.risk_score) || 0), 0) / total) : 0;

  $("stats").innerHTML = `
    <div class="stat">
      <div class="stat-label">Total Audits</div>
      <div class="stat-value blue">${total}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Cleared</div>
      <div class="stat-value green">${clear}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Discrepancies</div>
      <div class="stat-value red">${disc}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Total Exposure</div>
      <div class="stat-value orange">${money(exposure)}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Avg Risk</div>
      <div class="stat-value purple">${avgRisk.toFixed(1)}%</div>
    </div>
  `;
}

// ========== HISTORY TABLE ==========
function renderHistory() {
  let list = state.audits;
  if (state.filter !== "all") list = list.filter(a => a.audit_status === state.filter);
  if (state.search) {
    list = list.filter(a => {
      const po = String(a.po_number || "").toLowerCase();
      const inv = String(a.invoice_number || "").toLowerCase();
      const ven = String(a.vendor_name || "").toLowerCase();
      const buy = String(a.buyer_name || "").toLowerCase();
      const item = String(a.item_name || "").toLowerCase();
      const reason = String(a.discrepancy_reason || "").toLowerCase();
      return [po, inv, ven, buy, item, reason].some(s => s.includes(state.search));
    });
  }

  if (list.length === 0) {
    $("historyContainer").innerHTML = `
      <div class="state-box">
        <div class="big-icon">🔍</div>
        <h3>${state.audits.length === 0 ? "No audits yet" : "No audits match your filters"}</h3>
        <p>${state.audits.length === 0
          ? (state.role === "VENDOR" ? "Submit your first invoice to trigger an audit." : "Once vendors submit invoices against your POs, the audit trail will appear here.")
          : "Try adjusting the filters or search query."}</p>
        ${state.audits.length === 0 && state.role === "VENDOR"
          ? `<button class="btn btn-primary" onclick="location.href='invoices.html'">+ Submit Invoice</button>` : ""}
      </div>`;
    return;
  }

  $("historyContainer").innerHTML = `
    <div class="table-wrap">
      <table class="audits">
        <thead>
          <tr>
            <th>Audit #</th>
            <th>Invoice / PO</th>
            <th>${state.role === "BUYER" ? "Vendor" : "Buyer"}</th>
            <th>Item</th>
            <th>Audit</th>
            <th>Risk</th>
            <th>Date</th>
            <th style="text-align:right;">Exposure</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(a => {
            const counterparty = state.role === "BUYER" ? a.vendor_name : a.buyer_name;
            const score = Number(a.risk_score || 0);
            return `
              <tr onclick="openAuditDetail(${a.id})">
                <td data-label="Audit #"><span class="inv-id">#${a.id}</span></td>
                <td data-label="Invoice / PO">
                  <div style="font-weight:600;">${escapeHtml(a.invoice_number || "—")}</div>
                  <div class="inv-id" style="margin-top:2px;">${escapeHtml(a.po_number || "")}</div>
                </td>
                <td data-label="${state.role === "BUYER" ? "Vendor" : "Buyer"}">${escapeHtml(counterparty || "—")}</td>
                <td data-label="Item">${escapeHtml(a.item_name || "—")}</td>
                <td data-label="Audit"><span class="status ${a.audit_status || "CLEAR"}">${a.audit_status || "—"}</span></td>
                <td data-label="Risk">
                  <span style="display:inline-block; width:30px; font-size:12.5px; font-weight:700; color:${riskColor(score)};">${score.toFixed(0)}%</span>
                  <span class="risk-bar"><div style="width:${riskWidth(score)}; background:${riskColor(score)};"></div></span>
                </td>
                <td data-label="Date"><span style="color:var(--muted); font-size:12.5px;">${fmtDate(a.audited_at)}</span></td>
                <td data-label="Exposure" style="text-align:right;"><span class="inv-amount">${money(a.financial_exposure || 0)}</span></td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>`;
}

// ========== VENDOR SCORE ==========
function renderScore() {
  const d = state.vendorScore;
  if (!d) {
    $("scoreContainer").innerHTML = `<div class="state-box"><div class="big-icon">⚠️</div><h3>No vendor data</h3><p>Could not load vendor score.</p></div>`;
    return;
  }
  const s = d.stats || {};
  const pos = d.total_accepted_pos || {};
  const totalA = Number(s.total_audits || 0);
  const disc = Number(s.discrepancies || 0);
  const avgRisk = Number(s.avg_risk_score || 0);
  const exposure = Number(s.total_exposure || 0);
  const passCount = totalA - disc;
  const passRate = totalA ? (passCount / totalA) * 100 : 0;

  const initials = String(d.business_name || d.owner_name || "V")
    .split(/\s+/).map(w => w[0]).slice(0,2).join("").toUpperCase();

  $("scoreContainer").innerHTML = `
    <div class="vendor-card">
      <div>
        <div class="vendor-avatar">${escapeHtml(initials)}</div>
        <div style="font-size:20px; font-weight:800;">${escapeHtml(d.business_name || "Vendor")}</div>
        <div style="color:var(--muted); font-size:13px; margin-top:2px;">${escapeHtml(d.owner_name || "")}</div>
        <div style="color:var(--muted); font-size:13px; margin-top:2px;">${escapeHtml(d.email || "")}</div>
        <span class="status" style="margin-top:10px; background:rgba(99,102,241,0.15); color:var(--accent);">${escapeHtml(d.status || "pending")}</span>
      </div>
      <div>
        <div style="display:flex; align-items:center; gap:20px; flex-wrap:wrap; padding:16px 18px; background:var(--card-2); border-radius:12px; border:1px solid var(--border);">
          <div>
            <div style="font-size:11.5px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px;">Overall Trust Score</div>
            <div style="display:flex; align-items:center; gap:14px; margin-top:4px;">
              <div style="font-size:44px; font-weight:900; color:${riskColor(avgRisk)};">${avgRisk.toFixed(0)}<span style="font-size:20px; opacity:0.6;">%</span></div>
              <div style="flex:1;">
                <div class="risk-bar" style="width:100%; height:12px;"><div style="width:${riskWidth(avgRisk)}; background:${riskColor(avgRisk)};"></div></div>
                <div style="display:flex; justify-content:space-between; color:var(--muted); font-size:11px; margin-top:4px;">
                  <span>Low Risk</span><span>High Risk</span>
                </div>
              </div>
            </div>
          </div>
          <div style="border-left:1px solid var(--border); padding-left:18px;">
            <div style="font-size:11.5px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px;">Audit Pass Rate</div>
            <div style="font-size:32px; font-weight:800; color:var(--success); margin-top:4px;">${passRate.toFixed(0)}%</div>
            <div style="color:var(--muted); font-size:12.5px;">${passCount} of ${totalA} cleared</div>
          </div>
        </div>

        <div class="vendor-metric-row">
          <div class="vendor-metric">
            <div class="label">Accepted POs</div>
            <div class="value" style="color:var(--vendor);">${Number(pos.total_pos || 0)}</div>
          </div>
          <div class="vendor-metric">
            <div class="label">Total Audits</div>
            <div class="value" style="color:var(--accent);">${totalA}</div>
          </div>
          <div class="vendor-metric">
            <div class="label">Discrepancies</div>
            <div class="value" style="color:var(--error);">${disc}</div>
          </div>
          <div class="vendor-metric">
            <div class="label">Total Exposure</div>
            <div class="value" style="color:var(--warning);">${money(exposure)}</div>
          </div>
        </div>

        <div class="section-title">Notes</div>
        <div style="background:rgba(99,102,241,0.06); border-left:3px solid var(--accent); border-radius:6px; padding:12px 14px; font-size:13.5px; color:var(--text);">
          ${totalA === 0
            ? "Build your track record by submitting invoices that closely match the buyer's purchase order terms. A low risk score and high pass rate will increase buyer trust."
            : avgRisk < 25
              ? "Excellent work! Your invoices consistently match the agreed PO terms. This builds long-term trust with buyers."
              : avgRisk < 60
                ? "Good progress. Review past discrepancies to reduce avoidable quantity or price variances in future invoices."
                : "Multiple discrepancies detected. Please carefully match quantities and unit prices against the PO before submitting invoices."}
        </div>
      </div>
    </div>`;
}

// ========== DETAIL MODAL ==========
async function openAuditDetail(auditId) {
  $("detailModal").classList.add("open");
  $("detailBody").innerHTML = `<div class="skeleton" style="height:300px;"></div>`;
  try {
    const res = await apiFetch(`/audits/${auditId}`);
    if (!res.ok) throw new Error("Audit not found (HTTP " + res.status + ")");
    const a = await res.json();
    $("detailTitle").textContent = `Audit #${a.id}`;
    renderAuditDetail(a);
  } catch (err) {
    $("detailBody").innerHTML = `<p style="color:var(--error)">${escapeHtml(err.message)}</p>`;
  }
}
function closeDetail() { $("detailModal").classList.remove("open"); }

function renderAuditDetail(a) {
  const status = String(a.audit_status || "CLEAR");
  const bannerCls = status === "CLEAR" ? "pass" : "flag";
  const bannerIcon = status === "CLEAR" ? "✅" : "🚨";
  const bannerTitle = status === "CLEAR" ? "Cleared — Invoice Matches PO" : "Discrepancy Detected";
  const score = Number(a.risk_score || 0);
  const items = a.items || [];

  let itemsHtml = items.length === 0
    ? `<p style="color:var(--muted); font-size:13px;">No line items stored for this audit.</p>`
    : `<table class="items-table">
        <thead><tr><th>Item</th><th style="text-align:right;">Qty Delivered</th><th style="text-align:right;">Unit Price</th><th style="text-align:right;">Subtotal</th></tr></thead>
        <tbody>${items.map(it => {
          const sub = Number(it.quantity_delivered || 0) * Number(it.unit_price_charged || 0);
          return `<tr><td>${escapeHtml(it.item_name || "—")}</td><td style="text-align:right;">${Number(it.quantity_delivered || 0).toLocaleString("en-IN")}</td><td style="text-align:right;">${money(it.unit_price_charged || 0)}</td><td style="text-align:right;">${money(sub)}</td></tr>`;
        }).join("")}</tbody>
      </table>`;

  $("detailBody").innerHTML = `
    <div class="verdict-banner ${bannerCls}">
      <div style="font-size:32px;">${bannerIcon}</div>
      <div style="flex:1;">
        <div style="font-weight:800; font-size:17px;">${bannerTitle}</div>
        <div style="font-size:12.5px; opacity:0.7; margin-top:2px;">${escapeHtml(a.invoice_number || "Invoice")} · ${escapeHtml(a.po_number || "")}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:30px; font-weight:900; color:${riskColor(score)};">${score.toFixed(0)}<span style="font-size:14px; opacity:0.6;">%</span></div>
        <div style="font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px;">Risk Score</div>
      </div>
    </div>

    <div class="kv-row"><span class="k">Audit ID</span><span class="v mono">#${a.id}</span></div>
    <div class="kv-row"><span class="k">Audited At</span><span class="v">${fmtDate(a.audited_at)}</span></div>
    <div class="kv-row"><span class="k">Invoice</span><span class="v mono">${escapeHtml(a.invoice_number || "—")}</span></div>
    <div class="kv-row"><span class="k">PO Number</span><span class="v mono">${escapeHtml(a.po_number || "—")}</span></div>
    <div class="kv-row"><span class="k">Vendor</span><span class="v">${escapeHtml(a.vendor_name || "")} · ${escapeHtml(a.vendor_owner || "")}</span></div>
    <div class="kv-row"><span class="k">Buyer</span><span class="v">${escapeHtml(a.buyer_name || "—")}</span></div>

    <div class="section-title">Quantity Check</div>
    <div class="kv-row"><span class="k">Expected (PO)</span><span class="v">${Number(a.expected_quantity ?? a.po_expected_qty ?? 0).toLocaleString("en-IN")}</span></div>
    <div class="kv-row"><span class="k">Delivered (Invoice)</span><span class="v">${Number(a.delivered_quantity ?? 0).toLocaleString("en-IN")}</span></div>
    <div class="kv-row"><span class="k">Variance</span><span class="v" style="color:${Number(a.quantity_variance||0) < 0 ? "var(--error)" : "var(--success)"};">${Number(a.quantity_variance ?? 0).toLocaleString("en-IN")}</span></div>

    <div class="section-title">Price Check</div>
    <div class="kv-row"><span class="k">Agreed Unit Price (PO)</span><span class="v">${money(a.agreed_unit_price ?? a.po_agreed_price ?? 0)}</span></div>
    <div class="kv-row"><span class="k">Charged Unit Price (Invoice)</span><span class="v">${money(a.charged_unit_price ?? 0)}</span></div>
    <div class="kv-row"><span class="k">Variance</span><span class="v" style="color:${Number(a.price_variance||0) > 0 ? "var(--error)" : "var(--success)"};">${money(a.price_variance || 0)}</span></div>

    <div class="section-title">Financial</div>
    <div class="kv-row"><span class="k">Financial Exposure</span><span class="v" style="color:var(--warning); font-weight:800; font-size:15px;">${money(a.financial_exposure || 0)}</span></div>

    ${a.discrepancy_reason ? `
      <div class="section-title">Discrepancy Reasons</div>
      <div style="background:rgba(245,158,11,0.08); border-left:3px solid var(--warning); border-radius:4px; padding:12px 14px; font-size:13.5px; line-height:1.6;">
        ${escapeHtml(a.discrepancy_reason)}
      </div>` : `
      <div class="section-title">Discrepancy Reasons</div>
      <div style="background:rgba(34,197,94,0.08); border-left:3px solid var(--success); border-radius:4px; padding:12px 14px; font-size:13.5px; color:var(--success);">
        All checks passed. No discrepancies detected.
      </div>`}

    <div class="section-title">Invoice Line Items</div>
    ${itemsHtml}

    ${a.raw_text ? `
      <div class="section-title">Raw Invoice Text</div>
      <div class="raw-text-block">${escapeHtml(a.raw_text)}</div>
    ` : ""}
  `;
}

$("detailModal").addEventListener("click", e => { if (e.target.id === "detailModal") closeDetail(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeDetail(); });

// ========== BOOT ==========
if (requireAuth()) {
  renderNav();
  loadAll();
  const params = new URLSearchParams(location.search);
  const preOpenId = params.get("audit_id");
  if (preOpenId) {
    const numeric = Number(preOpenId);
    if (!isNaN(numeric) && numeric > 0) {
      setTimeout(() => openAuditDetail(numeric), 300);
    }
  }
}
