const $ = (id) => document.getElementById(id);
const state = {
  vendor_id: null,
  vendor: null,
  invoices: [],
  pos: [],
  filter: "all",
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

function requireAuth() {
  const uid = getUserId();
  const rle = getRole();
  if (!uid || String(rle).toUpperCase() !== "VENDOR") {
    location.href = "signup.html";
    return false;
  }
  state.vendor_id = uid;
  state.role = String(rle).toUpperCase();
  $("roleBadge").textContent = state.role;
  return true;
}
function riskColor(score) {
  const s = Number(score || 0);
  if (s <= 25) return "var(--success)";
  if (s <= 60) return "var(--warning)";
  return "var(--error)";
}

// ============= FETCH DATA =============
async function loadAll() {
  $("invoicesContainer").innerHTML = `<div class="table-wrap" style="padding:12px;">${Array.from({length:4}).map(()=>`<div class="skeleton skeleton-row"></div>`).join("")}</div>`;

  try {
    const [me, posData, invData] = await Promise.all([
      apiFetch("/vendors/" + state.vendor_id).then(r => r.ok ? r.json() : null),
      apiFetch("/vendor/purchase-orders?vendor_id=" + state.vendor_id).then(r => r.ok ? r.json() : []),
      apiFetch("/invoices?vendor_id=" + state.vendor_id).then(r => r.ok ? r.json() : []),
    ]);
    state.vendor = me;
    state.pos = Array.isArray(posData) ? posData : [];
    state.invoices = Array.isArray(invData) ? invData : [];
    if (me) $("userEmail").textContent = me.email || me.business_name || "—";
    populatePOSelect();
    render();
    renderStats();
  } catch (err) {
    toast(err.message || "Failed to load data", "error");
    $("invoicesContainer").innerHTML = `<div class="state-box"><div class="big-icon">⚠️</div><h3>Load failed</h3><p>${escapeHtml(err.message || "Unknown error")}</p></div>`;
  }
}

// ============= STATS =============
function renderStats() {
  const invs = state.invoices;
  $("statTotal").textContent = invs.length;
  $("statPassed").textContent = invs.filter(i => i.audit_status === "CLEAR").length;
  $("statFlags").textContent = invs.filter(i => i.audit_status === "DISCREPANCY").length;
  const exposure = invs.reduce((s, i) => s + (Number(i.financial_exposure) || 0), 0);
  $("statExposure").textContent = money(exposure);
}

// ============= TABLE =============
function render() {
  let filtered = state.invoices;
  if (state.filter !== "all") {
    filtered = filtered.filter(i => {
      if (["CLEAR", "DISCREPANCY"].includes(state.filter)) return i.audit_status === state.filter;
      return (i.status || "").toLowerCase() === state.filter.toLowerCase();
    });
  }
  if (filtered.length === 0) {
    $("invoicesContainer").innerHTML = `
      <div class="state-box">
        <div class="big-icon">🧾</div>
        <h3>${state.filter === "all" ? "No invoices yet" : "No invoices match this filter"}</h3>
        <p>${state.filter === "all" ? "Submit your first invoice against an accepted PO." : "Try switching the filter or submit a new invoice."}</p>
        ${state.filter === "all" ? `<button class="btn btn-primary" onclick="openSubmitModal()">+ Submit Invoice</button>` : ""}
      </div>`;
    return;
  }
  $("invoicesContainer").innerHTML = `
    <div class="table-wrap">
      <table class="invoices">
        <thead>
          <tr>
            <th>Invoice #</th>
            <th>PO Number</th>
            <th>Item</th>
            <th>Buyer</th>
            <th>Audit Status</th>
            <th>Risk</th>
            <th>Submitted</th>
            <th style="text-align:right;">Exposure</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(inv => `
            <tr data-id="${inv.id}" onclick="openDetail(${inv.id})">
              <td data-label="Invoice #"><span class="inv-id">${escapeHtml(inv.invoice_number || "#" + inv.id)}</span></td>
              <td data-label="PO Number"><span class="inv-id">${escapeHtml(inv.po_number || "—")}</span></td>
              <td data-label="Item">${escapeHtml(inv.item_name || "—")}</td>
              <td data-label="Buyer">${escapeHtml(inv.buyer_name || "—")}</td>
              <td data-label="Audit">
                ${inv.audit_status ? `<span class="status ${inv.audit_status}">${inv.audit_status}</span>` : `<span class="status submitted">${inv.status || "submitted"}</span>`}
                </td>
              <td data-label="Risk">${inv.risk_score != null ? Number(inv.risk_score).toFixed(0) + "%" : "—"}</td>
              <td data-label="Submitted"><span style="color:var(--muted); font-size:12.5px;">${fmtDate(inv.submitted_at)}</span></td>
              <td data-label="Exposure" style="text-align:right;"><span class="inv-amount">${money(inv.financial_exposure || 0)}</span></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>`;
}

document.querySelectorAll(".filter-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    state.filter = chip.dataset.status;
    render();
  });
});

// ============= SUBMIT MODAL =============
function populatePOSelect() {
  const accepted = state.pos.filter(p => (p.status || "").toLowerCase() === "accepted");
  const sel = $("poSelect");
  sel.innerHTML = `<option value="">— Select an accepted PO —</option>` + accepted.map(p => {
    const item = p.item_name || "";
    const qty = p.expected_quantity ?? "?";
    const price = p.agreed_unit_price ?? "?";
    const label = `${p.po_number} · ${item} × ${qty} @ ₹${price}`;
    return `<option value="${encodeURIComponent(p.po_number)}">${escapeHtml(label)}</option>`;
  }).join("");
  sel.onchange = () => {
    const val = decodeURIComponent(sel.value);
    if (!val) { $("poSummaryBox").style.display = "none"; return; }
    const po = state.pos.find(p => p.po_number === val);
    if (!po) { $("poSummaryBox").style.display = "none"; return; }
    $("poSummaryBox").style.display = "block";
    $("sPoNum").textContent = po.po_number;
    $("sPoItem").textContent = po.item_name || "—";
    $("sPoQty").textContent = Number(po.expected_quantity || 0).toLocaleString("en-IN");
    $("sPoPrice").textContent = money(po.agreed_unit_price || 0);
    $("sPoTotal").textContent = money(Number(po.expected_quantity || 0) * Number(po.agreed_unit_price || 0));
    $("sBuyer").textContent = po.buyer_name || po.buyer_id || "—";
  };
}

function openSubmitModal() {
  $("submitModal").classList.add("open");
  $("poSelect").value = "";
  $("poSummaryBox").style.display = "none";
  $("rawText").value = "";
  $("resultBox").innerHTML = `
    <div class="state-box" style="border:none; background:transparent; padding:60px 20px;">
      <div class="big-icon">🤖</div>
      <h3>Waiting for submission</h3>
      <p>Fill in the form and hit Submit to see the AI audit result here.</p>
    </div>`;
}
function closeSubmitModal() { $("submitModal").classList.remove("open"); }
function clearSubmitForm() {
  $("rawText").value = "";
  $("resultBox").innerHTML = `
    <div class="state-box" style="border:none; background:transparent; padding:60px 20px;">
      <div class="big-icon">🤖</div>
      <h3>Waiting for submission</h3>
      <p>Fill in the form and hit Submit to see the AI audit result here.</p>
    </div>`;
}

async function submitInvoice() {
  const poNum = decodeURIComponent($("poSelect").value || "");
  const rawText = $("rawText").value.trim();
  if (!poNum) return toast("Please select a purchase order", "error");
  if (rawText.length < 10) return toast("Invoice text is too short", "error");

  const btn = $("submitBtn");
  btn.disabled = true; btn.textContent = "⏳ AI extracting & auditing...";

  $("resultBox").innerHTML = `
    <div style="padding:60px 20px; text-align:center;">
      <div style="font-size:42px; margin-bottom:14px;">🤖</div>
      <div style="font-weight:700; font-size:15px;">Analyzing invoice...</div>
      <div style="color:var(--muted); font-size:13px; margin-top:6px;">Parsing fields · Matching PO · Running audit</div>
    </div>`;

  try {
    const res = await apiFetch(`/invoices?vendor_id=${state.vendor_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ po_id: poNum, raw_text: rawText }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.detail || data.error || data.message || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    renderAuditResult(data);
    toast("Invoice submitted & audited!", "success");
    setTimeout(loadAll, 600);
  } catch (err) {
    $("resultBox").innerHTML = `
      <div style="padding:50px 20px; text-align:center;">
        <div style="font-size:40px; margin-bottom:12px;">⚠️</div>
        <div style="color:var(--error); font-weight:700; margin-bottom:6px;">Submission Failed</div>
        <div style="color:var(--muted); font-size:13px;">${escapeHtml(err.message)}</div>
      </div>`;
    toast(err.message, "error");
  } finally {
    btn.disabled = false; btn.textContent = "🔍 Submit & Audit";
  }
}

function renderAuditResult(data) {
  const invoice = data.invoice || data;
  const extracted = data.extracted || data.invoice_extracted || {};
  const audit = data.audit || {};
  const po = data.purchase_order || data.po || {};

  const status = (audit.audit_status || "FLAG").toUpperCase();
  const bannerCls = status === "CLEAR" ? "pass" : "flag";
  const bannerIcon = status === "CLEAR" ? "✓" : "!";
  const bannerTitle = status === "CLEAR" ? "Audit Cleared" : "Discrepancy Detected";
  const bannerSub = status === "CLEAR"
    ? "Invoice matches the purchase order on every field."
    : "Variances detected between invoice and purchase order.";

  const reasons = (audit.discrepancy_reason || "").trim();
  const risk = Number(audit.risk_score || 0);
  const qtyVar = Number(audit.quantity_variance || 0);
  const priceVar = Number(audit.price_variance || 0);
  const exposure = Number(audit.financial_exposure || 0);
  const delivered = Number(audit.delivered_quantity ?? extracted.quantity_delivered ?? 0);
  const charged = Number(audit.charged_unit_price ?? extracted.unit_price_charged ?? 0);
  const expected = Number(audit.expected_quantity ?? po.expected_quantity ?? 0);
  const agreed = Number(audit.agreed_unit_price ?? po.agreed_unit_price ?? 0);

  const qtyCls = qtyVar === 0 ? "variance-good" : "variance-bad";
  const priceCls = priceVar === 0 ? "variance-good" : "variance-bad";
  const qtySym = qtyVar > 0 ? "+" : "";
  const priceSym = priceVar > 0 ? "+" : "";

  $("resultBox").innerHTML = `
    <div class="verdict-banner ${bannerCls}">
      <div>${bannerIcon}</div>
      <div style="flex:1;">
        <div style="font-weight:800; font-size:17px; letter-spacing:-0.2px;">${bannerTitle}</div>
        <div style="font-size:12.5px; opacity:0.75; margin-top:2px;">${bannerSub} · Invoice ${escapeHtml(invoice.invoice_number || "#" + (invoice.id||""))}</div>
      </div>
      <div style="text-align:right; min-width:92px;">
        <div style="font-size:12px; font-weight:700; letter-spacing:0.6px; text-transform:uppercase; opacity:0.7; margin-bottom:2px;">Risk</div>
        <div style="font-size:26px; font-weight:900; letter-spacing:-0.5px;">${risk.toFixed(0)}%</div>
        <div class="risk-meter" style="margin-top:6px;"><div class="risk-meter-fill" style="width:${Math.max(2, Math.min(100, risk))}%;"></div></div>
      </div>
    </div>

    <div class="audit-grid-3">
      <div class="audit-card audit-card-ai">
        <div class="audit-card-title">AI Extracted</div>
        <div class="kv-row"><span class="k">PO ID</span><span class="v mono">${escapeHtml(extracted.po_id || po.po_number || data.po_number || "—")}</span></div>
        <div class="kv-row"><span class="k">Item</span><span class="v">${escapeHtml(extracted.item_name || po.item_name || data.item_name || "—")}</span></div>
        <div class="kv-row"><span class="k">Quantity Delivered</span><span class="v">${delivered.toLocaleString("en-IN")}</span></div>
        <div class="kv-row"><span class="k">Unit Price Charged</span><span class="v">${money(charged)}</span></div>
        <div class="kv-row"><span class="k">Line Total</span><span class="v" style="color:#67e8f9;">${money(delivered * charged)}</span></div>
      </div>

      <div class="audit-card audit-card-po">
        <div class="audit-card-title">PO Truth</div>
        <div class="kv-row"><span class="k">PO Number</span><span class="v mono">${escapeHtml(po.po_number || extracted.po_id || "—")}</span></div>
        <div class="kv-row"><span class="k">Item</span><span class="v">${escapeHtml(po.item_name || extracted.item_name || "—")}</span></div>
        <div class="kv-row"><span class="k">Expected Quantity</span><span class="v">${expected.toLocaleString("en-IN")}</span></div>
        <div class="kv-row"><span class="k">Agreed Unit Price</span><span class="v">${money(agreed)}</span></div>
        <div class="kv-row"><span class="k">PO Line Total</span><span class="v" style="color:#c4b5fd;">${money(expected * agreed)}</span></div>
      </div>

      <div class="audit-card audit-card-audit">
        <div class="audit-card-title">Audit Result</div>
        <div class="kv-row"><span class="k">Status</span><span class="v ${status === "CLEAR" ? "variance-good" : "variance-bad"}" style="font-size:14.5px;">● ${status}</span></div>
        <div class="kv-row"><span class="k">Quantity Variance</span><span class="v ${qtyCls}">${qtySym}${qtyVar.toLocaleString("en-IN")}</span></div>
        <div class="kv-row"><span class="k">Price Variance</span><span class="v ${priceCls}">${priceSym}${money(priceVar)}</span></div>
        <div class="kv-row"><span class="k">Financial Exposure</span><span class="v" style="color:#fcd34d; font-weight:900;">${money(exposure)}</span></div>
        <div class="kv-row"><span class="k">Risk Score</span><span class="v" style="font-weight:900; color:${riskColor(risk)};">${audit.risk_score != null ? risk.toFixed(1) + "%" : "—"}</span></div>
      </div>
    </div>

    <div class="section-title">${reasons ? "Discrepancy Reason" : "All Checks Passed"}</div>
    ${reasons
      ? `<div style="background:linear-gradient(180deg, rgba(239,68,68,0.10), rgba(239,68,68,0.04)); border:1px solid rgba(239,68,68,0.35); border-left:4px solid var(--error); border-radius:12px; padding:14px 18px; font-size:14px; line-height:1.75; color:#fecaca;">
         ${escapeHtml(reasons)}
       </div>`
      : `<div style="background:linear-gradient(180deg, rgba(16,185,129,0.10), rgba(16,185,129,0.04)); border:1px solid rgba(16,185,129,0.35); border-left:4px solid var(--success); border-radius:12px; padding:14px 18px; font-size:14px; line-height:1.75; color:#6ee7b7;">
         Invoice matches purchase order on all checks — no variances detected.
       </div>`}

    ${data.invoice_raw ? `
      <div class="section-title">Raw Invoice</div>
      <div class="raw-text-block">${escapeHtml(data.invoice_raw)}</div>` : ""}

    <div style="margin-top:22px; display:flex; gap:12px; flex-wrap:wrap;">
      <button class="btn btn-success" onclick="closeSubmitModal(); location.href='audit.html';">View Full Audit →</button>
      <button class="btn btn-ghost" onclick="clearSubmitForm()">Submit Another</button>
    </div>`;
}

// ============= DETAIL MODAL =============
async function openDetail(invoiceId) {
  $("detailModal").classList.add("open");
  $("detailTitle").textContent = "Invoice Details";
  $("detailBody").innerHTML = `<div class="skeleton" style="height:160px;"></div>`;
  try {
    const res = await apiFetch("/invoices/" + invoiceId);
    if (!res.ok) throw new Error("Invoice not found (HTTP " + res.status + ")");
    const inv = await res.json();
    $("detailTitle").textContent = "Invoice " + (inv.invoice_number || "#" + inv.id);
    renderDetail(inv);
  } catch (err) {
    $("detailBody").innerHTML = `<p style="color:var(--error)">${escapeHtml(err.message)}</p>`;
  }
}
function closeDetailModal() { $("detailModal").classList.remove("open"); }

function renderDetail(inv) {
  const audit = inv.audit || {};
  const items = inv.items || [];
  let itemsHtml = items.length === 0 ? `<p style="color:var(--muted); font-size:13px;">No line items stored.</p>` : `
    <table class="items-table">
      <thead><tr><th>Item</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Unit Price</th><th style="text-align:right;">Subtotal</th></tr></thead>
      <tbody>${items.map(it => {
        const sub = Number(it.quantity_delivered||0) * Number(it.unit_price_charged||0);
        return `<tr><td>${escapeHtml(it.item_name||"—")}</td><td style="text-align:right;">${Number(it.quantity_delivered||0).toLocaleString("en-IN")}</td><td style="text-align:right;">${money(it.unit_price_charged||0)}</td><td style="text-align:right;">${money(sub)}</td></tr>`;
      }).join("")}</tbody>
    </table>`;

  $("detailBody").innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:18px; flex-wrap:wrap;">
      <div>
        <div class="inv-id" style="margin-bottom:6px;">${escapeHtml(inv.invoice_number || "#"+inv.id)}</div>
        <div style="font-size:26px; font-weight:800; letter-spacing:-0.5px;">${escapeHtml(inv.invoice_number || "Invoice")}</div>
        <div style="color:var(--muted); font-size:13px; margin-top:4px;">${fmtDate(inv.submitted_at)}</div>
      </div>
      <div style="display:flex; gap:10px; align-items:center;">
        ${audit.audit_status ? `<span class="status ${audit.audit_status}" style="padding:6px 12px; font-size:12px;">${audit.audit_status}</span>` : `<span class="status submitted" style="padding:6px 12px; font-size:12px;">${inv.status || "submitted"}</span>`}
        ${audit.risk_score != null ? `<span style="font-weight:800; font-size:18px; ${Number(audit.risk_score) > 50 ? "color:var(--error)" : "color:var(--success)"};">${Number(audit.risk_score).toFixed(0)}% Risk</span>` : ""}
      </div>
    </div>

    <div class="section-title">Overview</div>
    <div class="kv-row"><span class="k">PO Number</span><span class="v mono">${escapeHtml(inv.po_number || "—")}</span></div>
    <div class="kv-row"><span class="k">PO Item</span><span class="v">${escapeHtml(inv.item_name || "—")}</span></div>
    <div class="kv-row"><span class="k">Buyer</span><span class="v">${escapeHtml(inv.buyer_name || "—")}</span></div>
    <div class="kv-row"><span class="k">Vendor</span><span class="v">${escapeHtml(inv.vendor_name || "—")}</span></div>

    <div class="section-title">Line Items (as extracted)</div>
    ${itemsHtml}

    ${audit.audit_status ? `
      <div class="section-title">Audit Result</div>
      <div class="kv-row"><span class="k">Expected Qty</span><span class="v">${Number(audit.expected_quantity ?? 0).toLocaleString("en-IN")}</span></div>
      <div class="kv-row"><span class="k">Delivered Qty</span><span class="v">${Number(audit.delivered_quantity ?? 0).toLocaleString("en-IN")}</span></div>
      <div class="kv-row"><span class="k">Quantity Variance</span><span class="v">${Number(audit.quantity_variance ?? 0).toLocaleString("en-IN")}</span></div>
      <div class="kv-row"><span class="k">Agreed Unit Price</span><span class="v">${money(audit.agreed_unit_price ?? 0)}</span></div>
      <div class="kv-row"><span class="k">Charged Unit Price</span><span class="v">${money(audit.charged_unit_price ?? 0)}</span></div>
      <div class="kv-row"><span class="k">Price Variance</span><span class="v">${money(audit.price_variance || 0)}</span></div>
      <div class="kv-row"><span class="k">Financial Exposure</span><span class="v" style="color:var(--warning); font-weight:800;">${money(audit.financial_exposure || 0)}</span></div>
      <div class="kv-row"><span class="k">Risk Score</span><span class="v">${audit.risk_score != null ? Number(audit.risk_score).toFixed(2) + "%" : "—"}</span></div>
      ${audit.discrepancy_reason ? `
        <div style="margin-top:12px; background:rgba(245,158,11,0.08); border-left:3px solid var(--warning); border-radius:4px; padding:10px 12px; font-size:13px;">
          ${escapeHtml(audit.discrepancy_reason)}
        </div>` : ""}
    ` : ""}

    ${inv.raw_text ? `
      <div class="section-title">Raw Invoice Text</div>
      <div class="raw-text-block">${escapeHtml(inv.raw_text)}</div>` : ""}
  `;
}

$("submitModal").addEventListener("click", e => { if (e.target.id === "submitModal") closeSubmitModal(); });
$("detailModal").addEventListener("click", e => { if (e.target.id === "detailModal") closeDetailModal(); });
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { closeSubmitModal(); closeDetailModal(); }
});

if (requireAuth()) loadAll();
