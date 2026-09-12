/* ============================================================
   STATE
   ============================================================ */

const state = {

    user: null,

    orders: [],

    vendors: [],

    audits: [],

    filter: "all",

    selectedAuditId: null,

    loadingOrders: true,

    loadingAudits: true

};


/* ============================================================
   HELPERS
   ============================================================ */

const $ = id =>
    document.getElementById(id);


function money(value) {

    return "₹" + Number(value || 0).toLocaleString(
        "en-IN",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    );

}


function escapeHtml(value) {

    return String(value ?? "")
        .replace(
            /[&<>"']/g,
            character => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[character])
        );

}


function toast(message, type = "success") {

    const el = $("toast");

    el.textContent = message;

    el.className =
        "toast " +
        type +
        " show";

    setTimeout(
        () => {
            el.classList.remove("show");
        },
        3000
    );

}


/* ============================================================
   AUTH
   ============================================================ */

function requireBuyer() {

    const userId = getUserId();

    const role =
        String(getRole() || "").toUpperCase();

    if (!userId || !role) {

        window.location.href =
            "/signup.html?role=buyer";

        return false;

    }

    if (role !== "BUYER") {

        if (role === "VENDOR") {

            window.location.href =
                "/vendor.html";

        } else {

            clearSession();

            window.location.href =
                "/signup.html?role=buyer";

        }

        return false;

    }

    state.user = {
        user_id: Number(userId),
        role: role
    };

    $("userLabel").textContent =
        "Buyer #" + userId;

    return true;

}


function logout() {

    clearSession();

    window.location.href =
        "/signup.html";

}


/* ============================================================
   VIEW NAVIGATION
   ============================================================ */

function showView(view) {

    document
        .querySelectorAll(".view")
        .forEach(section => {
            section.classList.remove("active");
        });

    const target =
        $("view-" + view);

    if (target) {
        target.classList.add("active");
    }

    document
        .querySelectorAll(".nav button")
        .forEach(button => {
            button.classList.remove("active");
        });

    const navMap = {
        dashboard: "navDashboard",
        orders: "navOrders",
        audits: "navAudits"
    };

    if (navMap[view]) {
        $(navMap[view])
            .classList.add("active");
    }

    if (view === "audits") {
        fetchAudits();
    }

}


/* ============================================================
   API ERROR
   ============================================================ */

async function getApiError(response) {

    try {

        const data =
            await response.json();

        if (typeof data.detail === "string") {
            return data.detail;
        }

        if (Array.isArray(data.detail)) {

            return data.detail
                .map(error =>
                    error.msg ||
                    "Validation error"
                )
                .join(", ");

        }

        return (
            data.message ||
            data.error ||
            `Request failed (${response.status})`
        );

    }

    catch {

        return `Request failed (${response.status})`;

    }

}


/* ============================================================
   VENDORS
   ============================================================ */

async function fetchVendors() {

    const select =
        $("poVendorId");

    select.innerHTML =
        `<option value="">Loading vendors...</option>`;

    try {

        const response =
            await apiFetch("/vendors");

        if (!response.ok) {

            throw new Error(
                await getApiError(response)
            );

        }

        const data =
            await response.json();

        state.vendors =
            Array.isArray(data)
                ? data
                : (
                    data.vendors ||
                    []
                );

        if (!state.vendors.length) {

            select.innerHTML =
                `<option value="">
                    No approved vendors available
                </option>`;

            $("vendorInfo").textContent =
                "No approved vendors are currently available.";

            return;

        }

        select.innerHTML =
            `<option value="">
                Select a vendor...
            </option>` +
            state.vendors
                .map(vendor => `
                    <option value="${vendor.id}">
                        ${escapeHtml(vendor.business_name)}
                        — ${escapeHtml(vendor.owner_name)}
                    </option>
                `)
                .join("");

    }

    catch (error) {

        console.error(
            "Vendor loading error:",
            error
        );

        select.innerHTML =
            `<option value="">
                Unable to load vendors
            </option>`;

        $("vendorInfo").textContent =
            error.message ||
            "Failed to load vendors.";

        toast(
            "Could not load approved vendors",
            "error"
        );

    }

}


$("poVendorId")
    .addEventListener(
        "change",
        () => {

            const vendorId =
                Number(
                    $("poVendorId").value
                );

            const vendor =
                state.vendors.find(
                    item =>
                        Number(item.id) ===
                        vendorId
                );

            if (!vendor) {

                $("vendorInfo").textContent =
                    "Select an approved vendor.";

                return;

            }

            $("vendorInfo").innerHTML = `
                <strong>
                    ${escapeHtml(vendor.business_name)}
                </strong>
                · Owner:
                ${escapeHtml(vendor.owner_name)}
                · ${escapeHtml(vendor.email)}
            `;

        }
    );


/* ============================================================
   PURCHASE ORDERS
   ============================================================ */

async function fetchOrders() {

    state.loadingOrders = true;

    renderOrders();

    try {

        const userId =
            getUserId();

        const response =
            await apiFetch(
                `/purchase-orders?buyer_id=${encodeURIComponent(userId)}`
            );

        if (!response.ok) {

            throw new Error(
                await getApiError(response)
            );

        }

        const data =
            await response.json();

        state.orders =
            Array.isArray(data)
                ? data
                : (
                    data.orders ||
                    data.purchase_orders ||
                    []
                );

    }

    catch (error) {

        console.error(
            "PO loading error:",
            error
        );

        state.orders = [];

        toast(
            error.message ||
            "Failed to load purchase orders",
            "error"
        );

    }

    finally {

        state.loadingOrders = false;

        renderOrders();

        updatePOStats();

    }

}


async function fetchOrder(poNumber) {

    const userId =
        getUserId();

    const role =
        getRole();

    const response =
        await apiFetch(
            `/purchase-orders/${encodeURIComponent(poNumber)}` +
            `?user_id=${encodeURIComponent(userId)}` +
            `&role=${encodeURIComponent(role)}`
        );

    if (!response.ok) {

        throw new Error(
            await getApiError(response)
        );

    }

    return await response.json();

}


/* ============================================================
   RENDER PO
   ============================================================ */

function renderOrders() {

    const container =
        $("ordersContainer");

    if (state.loadingOrders) {

        container.innerHTML = `
            <div class="loading">
                Loading purchase orders...
            </div>
        `;

        return;

    }

    const filtered =
        state.filter === "all"
            ? state.orders
            : state.orders.filter(
                order =>
                    String(
                        order.status || ""
                    ).toLowerCase()
                    === state.filter
            );

    if (!filtered.length) {

        container.innerHTML = `
            <div class="state-box">

                <div class="big-icon">
                    📦
                </div>

                <h3>
                    No purchase orders found
                </h3>

                <p>
                    ${
                        state.filter === "all"
                            ? "Create your first purchase order to begin the procurement workflow."
                            : `No orders with status "${escapeHtml(state.filter)}".`
                    }
                </p>

                ${
                    state.filter === "all"
                        ? `
                            <button
                                class="btn btn-primary"
                                onclick="openCreateModal()"
                            >
                                + New Purchase Order
                            </button>
                        `
                        : ""
                }

            </div>
        `;

        return;

    }

    container.innerHTML = `
        <div class="orders-grid">

            ${
                filtered
                    .map(orderCardHtml)
                    .join("")
            }

        </div>
    `;

    container
        .querySelectorAll(".order-card")
        .forEach(card => {

            card.addEventListener(
                "click",
                () => {

                    openDetailModal(
                        card.dataset.id
                    );

                }
            );

        });

}


function orderCardHtml(order) {

    const id =
        order.po_number ??
        order.po_id ??
        order.id ??
        "—";

    const vendor =
        order.vendor_name ||
        order.vendor ||
        (
            order.vendor_id
                ? `Vendor #${order.vendor_id}`
                : "Unknown vendor"
        );

    const item =
        order.item_name ||
        order.item ||
        "—";

    const quantity =
        Number(
            order.expected_quantity ??
            order.quantity ??
            0
        );

    const price =
        Number(
            order.agreed_unit_price ??
            order.unit_price ??
            0
        );

    const amount =
        Number(
            order.total ??
            order.total_value ??
            quantity * price
        );

    const status =
        String(
            order.status ||
            "pending"
        ).toLowerCase();

    const created =
        order.created_at
            ? new Date(
                order.created_at
            ).toLocaleDateString(
                "en-IN"
            )
            : "";

    return `
        <div
            class="order-card"
            data-id="${escapeHtml(id)}"
        >

            <div class="order-head">

                <div>

                    <div class="order-id">
                        #${escapeHtml(id)}
                    </div>

                    <div class="order-amount">
                        ${money(amount)}
                    </div>

                    <div class="order-vendor">
                        ${escapeHtml(vendor)}
                    </div>

                </div>

                <span
                    class="status ${escapeHtml(status)}"
                >
                    ${escapeHtml(status)}
                </span>

            </div>

            <div class="order-meta">

                <span>
                    ${escapeHtml(item)}
                    ×
                    ${quantity}
                </span>

                <span>
                    ${escapeHtml(created)}
                </span>

            </div>

        </div>
    `;

}


/* ============================================================
   PO STATS
   ============================================================ */

function updatePOStats() {

    const orders =
        state.orders || [];

    $("statTotalPO").textContent =
        orders.length;

    $("statPending").textContent =
        orders.filter(
            x =>
                String(x.status || "")
                    .toLowerCase() ===
                "pending"
        ).length;

    $("statAccepted").textContent =
        orders.filter(
            x =>
                String(x.status || "")
                    .toLowerCase() ===
                "accepted"
        ).length;

}


/* ============================================================
   FILTERS
   ============================================================ */

document
    .querySelectorAll(".filter-chip")
    .forEach(chip => {

        chip.addEventListener(
            "click",
            () => {

                document
                    .querySelectorAll(".filter-chip")
                    .forEach(item =>
                        item.classList.remove(
                            "active"
                        )
                    );

                chip.classList.add("active");

                state.filter =
                    chip.dataset.status;

                renderOrders();

            }
        );

    });


/* ============================================================
   CREATE PO MODAL
   ============================================================ */

function openCreateModal() {

    $("poItemName").value = "";

    $("poQuantity").value = "";

    $("poUnitPrice").value = "";

    $("poVendorId").value = "";

    $("vendorInfo").textContent =
        "Select an approved vendor.";

    updateEstimatedTotal();

    if (!state.vendors.length) {
        fetchVendors();
    }

    $("createModal")
        .classList
        .add("open");

}


function closeCreateModal() {

    $("createModal")
        .classList
        .remove("open");

}


function updateEstimatedTotal() {

    const quantity =
        Number(
            $("poQuantity").value
        ) || 0;

    const price =
        Number(
            $("poUnitPrice").value
        ) || 0;

    $("poEstimatedTotal")
        .textContent =
        money(quantity * price);

}


$("poQuantity")
    .addEventListener(
        "input",
        updateEstimatedTotal
    );


$("poUnitPrice")
    .addEventListener(
        "input",
        updateEstimatedTotal
    );


async function submitCreate() {

    const vendorId =
        Number(
            $("poVendorId").value
        );

    const itemName =
        $("poItemName")
            .value
            .trim();

    const quantity =
        Number(
            $("poQuantity").value
        );

    const unitPrice =
        Number(
            $("poUnitPrice").value
        );

    if (!vendorId) {

        toast(
            "Please select a vendor",
            "error"
        );

        return;

    }

    if (!itemName) {

        toast(
            "Item name is required",
            "error"
        );

        return;

    }

    if (!quantity || quantity <= 0) {

        toast(
            "Quantity must be greater than zero",
            "error"
        );

        return;

    }

    if (!unitPrice || unitPrice <= 0) {

        toast(
            "Unit price must be greater than zero",
            "error"
        );

        return;

    }

    const button =
        $("createSubmitBtn");

    button.disabled = true;

    button.textContent =
        "Creating...";

    try {

        const userId =
            getUserId();

        const response =
            await apiFetch(
                `/purchase-orders?buyer_id=${encodeURIComponent(userId)}`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        vendor_id:
                            vendorId,

                        item_name:
                            itemName,

                        expected_quantity:
                            quantity,

                        agreed_unit_price:
                            unitPrice

                    })
                }
            );

        if (!response.ok) {

            throw new Error(
                await getApiError(response)
            );

        }

        await response.json();

        toast(
            "Purchase order created successfully!",
            "success"
        );

        closeCreateModal();

        await fetchOrders();

        showView("orders");

    }

    catch (error) {

        console.error(
            "Create PO error:",
            error
        );

        toast(
            error.message ||
            "Failed to create purchase order",
            "error"
        );

    }

    finally {

        button.disabled = false;

        button.textContent =
            "Create Order";

    }

}


/* ============================================================
   PO DETAIL
   ============================================================ */

async function openDetailModal(id) {

    $("detailTitle").textContent =
        `Purchase Order #${id}`;

    $("detailBody").innerHTML = `
        <div class="loading">
            Loading purchase order...
        </div>
    `;

    $("detailModal")
        .classList
        .add("open");

    try {

        const order =
            await fetchOrder(id);

        renderOrderDetail(order);

    }

    catch (error) {

        $("detailBody").innerHTML = `
            <div
                style="
                    color:var(--danger);
                    padding:15px 0;
                "
            >
                ${escapeHtml(error.message)}
            </div>
        `;

    }

}


function renderOrderDetail(order) {

    const poNumber =
        order.po_number ||
        order.po_id ||
        "—";

    const vendor =
        order.vendor_name ||
        order.vendor ||
        (
            order.vendor_id
                ? `Vendor #${order.vendor_id}`
                : "—"
        );

    const item =
        order.item_name ||
        "—";

    const quantity =
        Number(
            order.expected_quantity ||
            order.quantity ||
            0
        );

    const price =
        Number(
            order.agreed_unit_price ||
            order.unit_price ||
            0
        );

    const status =
        String(
            order.status ||
            "pending"
        ).toLowerCase();

    $("detailTitle").textContent =
        `PO ${poNumber}`;

    $("detailBody").innerHTML = `

        <div class="detail-grid">

            <div class="detail-item">

                <div class="detail-label">
                    Purchase Order
                </div>

                <div class="detail-value">
                    ${escapeHtml(poNumber)}
                </div>

            </div>


            <div class="detail-item">

                <div class="detail-label">
                    Status
                </div>

                <div class="detail-value">
                    <span class="status ${escapeHtml(status)}">
                        ${escapeHtml(status)}
                    </span>
                </div>

            </div>


            <div class="detail-item">

                <div class="detail-label">
                    Vendor
                </div>

                <div class="detail-value">
                    ${escapeHtml(vendor)}
                </div>

            </div>


            <div class="detail-item">

                <div class="detail-label">
                    Item
                </div>

                <div class="detail-value">
                    ${escapeHtml(item)}
                </div>

            </div>


            <div class="detail-item">

                <div class="detail-label">
                    Expected Quantity
                </div>

                <div class="detail-value">
                    ${quantity}
                </div>

            </div>


            <div class="detail-item">

                <div class="detail-label">
                    Agreed Unit Price
                </div>

                <div class="detail-value">
                    ${money(price)}
                </div>

            </div>

        </div>


        <div
            style="
                margin-top:20px;
                padding:15px;
                background:rgba(99,102,241,.08);
                border:1px solid rgba(99,102,241,.15);
                border-radius:10px;
            "
        >

            <div
                style="
                    color:var(--muted);
                    font-size:11px;
                "
            >
                AUTHORITATIVE PO VALUE
            </div>

            <div
                style="
                    font-size:24px;
                    font-weight:800;
                    margin-top:3px;
                "
            >
                ${money(quantity * price)}
            </div>

            <div
                style="
                    color:var(--muted);
                    font-size:12px;
                    margin-top:3px;
                "
            >
                ${quantity} units × ${money(price)} per unit
            </div>

        </div>

    `;

}


function closeDetailModal() {

    $("detailModal")
        .classList
        .remove("open");

}


/* ============================================================
   AUDITS
   ============================================================ */

async function fetchAudits() {

    state.loadingAudits = true;

    renderAudits();

    try {

        const userId =
            getUserId();

        const response =
            await apiFetch(
                `/audits?buyer_id=${encodeURIComponent(userId)}`
            );

        if (!response.ok) {

            throw new Error(
                await getApiError(response)
            );

        }

        const data =
            await response.json();

        state.audits =
            Array.isArray(data)
                ? data
                : (
                    data.audits ||
                    []
                );

    }

    catch (error) {

        console.error(
            "Audit loading error:",
            error
        );

        state.audits = [];

        $("auditsContainer").innerHTML = `
            <div class="state-box">
                <div class="big-icon">
                    ⚠️
                </div>

                <h3>
                    Audit history unavailable
                </h3>

                <p>
                    ${escapeHtml(error.message)}
                </p>
            </div>
        `;

        return;

    }

    finally {

        state.loadingAudits = false;

        renderAudits();

        updateAuditStats();

        renderRecentAudits();

    }

}


function renderAudits() {

    const container =
        $("auditsContainer");

    if (state.loadingAudits) {

        container.innerHTML = `
            <div class="loading">
                Loading audits...
            </div>
        `;

        return;

    }

    if (!state.audits.length) {

        container.innerHTML = `
            <div class="state-box">
                <div class="big-icon">
                    🔍
                </div>

                <h3>
                    No invoice audits yet
                </h3>

                <p>
                    Vendor invoices will appear here after they are submitted and audited.
                </p>
            </div>
        `;

        return;

    }

    container.innerHTML = `

        <table>

            <thead>

                <tr>

                    <th>
                        Audit
                    </th>

                    <th>
                        PO
                    </th>

                    <th>
                        Vendor
                    </th>

                    <th>
                        Status
                    </th>

                    <th>
                        Exposure
                    </th>

                    <th>
                        Risk
                    </th>

                    <th>
                        Audited
                    </th>

                </tr>

            </thead>

            <tbody>

                ${
                    state.audits
                        .map(auditRowHtml)
                        .join("")
                }

            </tbody>

        </table>
    `;

    container
        .querySelectorAll("tbody tr")
        .forEach(row => {

            row.addEventListener(
                "click",
                () => {

                    openAuditModal(
                        row.dataset.id
                    );

                }
            );

        });

}


function auditRowHtml(audit) {

    const id =
        audit.audit_id ??
        audit.id ??
        "—";

    const po =
        audit.po_number ||
        audit.po_id ||
        "—";

    const vendor =
        audit.vendor_name ||
        "—";

    const status =
        String(
            audit.audit_status ||
            audit.status ||
            ""
        ).toUpperCase();

    const exposure =
        Number(
            audit.financial_exposure ||
            0
        );

    const risk =
        Number(
            audit.risk_score ||
            0
        );

    const audited =
        audit.audited_at
            ? new Date(
                audit.audited_at
            ).toLocaleString("en-IN")
            : "—";

    const statusClass =
        status === "CLEAR"
            ? "audit-clear"
            : "audit-discrepancy";

    const riskClass =
        risk >= 70
            ? "risk-high"
            : risk >= 30
                ? "risk-medium"
                : "risk-low";

    return `

        <tr data-id="${escapeHtml(id)}">

            <td>
                <strong>
                    #${escapeHtml(id)}
                </strong>
            </td>

            <td>
                ${escapeHtml(po)}
            </td>

            <td>
                ${escapeHtml(vendor)}
            </td>

            <td class="${statusClass}">
                ${escapeHtml(status)}
            </td>

            <td>
                ${money(exposure)}
            </td>

            <td class="${riskClass}">
                ${risk.toFixed(1)}/100
            </td>

            <td>
                ${escapeHtml(audited)}
            </td>

        </tr>
    `;

}


/* ============================================================
   AUDIT STATS
   ============================================================ */

function updateAuditStats() {

    const audits =
        state.audits || [];

    const discrepancies =
        audits.filter(
            audit =>
                String(
                    audit.audit_status ||
                    audit.status ||
                    ""
                ).toUpperCase()
                === "DISCREPANCY"
        );

    const exposure =
        audits.reduce(
            (total, audit) =>
                total +
                Number(
                    audit.financial_exposure ||
                    0
                ),
            0
        );

    $("statAudits").textContent =
        audits.length;

    $("statExposure").textContent =
        money(exposure);

}


/* ============================================================
   RECENT AUDITS
   ============================================================ */

function renderRecentAudits() {

    const container =
        $("recentAudits");

    const audits =
        (state.audits || [])
            .slice(0, 5);

    if (!audits.length) {

        container.innerHTML = `
            <div class="state-box">
                <div class="big-icon">
                    🧾
                </div>

                <h3>
                    No audits yet
                </h3>

                <p>
                    Vendor invoice audits will appear here.
                </p>
            </div>
        `;

        return;

    }

    container.innerHTML = `

        <table>

            <thead>

                <tr>

                    <th>
                        Audit
                    </th>

                    <th>
                        PO
                    </th>

                    <th>
                        Vendor
                    </th>

                    <th>
                        Status
                    </th>

                    <th>
                        Exposure
                    </th>

                    <th>
                        Risk
                    </th>

                </tr>

            </thead>

            <tbody>

                ${
                    audits
                        .map(audit => {

                            const id =
                                audit.audit_id ??
                                audit.id;

                            const status =
                                String(
                                    audit.audit_status ||
                                    audit.status ||
                                    ""
                                ).toUpperCase();

                            const statusClass =
                                status === "CLEAR"
                                    ? "audit-clear"
                                    : "audit-discrepancy";

                            const risk =
                                Number(
                                    audit.risk_score ||
                                    0
                                );

                            return `

                                <tr
                                    data-id="${escapeHtml(id)}"
                                >

                                    <td>
                                        #${escapeHtml(id)}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            audit.po_number ||
                                            audit.po_id ||
                                            "—"
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            audit.vendor_name ||
                                            "—"
                                        )}
                                    </td>

                                    <td
                                        class="${statusClass}"
                                    >
                                        ${escapeHtml(status)}
                                    </td>

                                    <td>
                                        ${money(
                                            audit.financial_exposure
                                        )}
                                    </td>

                                    <td>
                                        ${risk.toFixed(1)}/100
                                    </td>

                                </tr>
                            `;

                        })
                        .join("")
                }

            </tbody>

        </table>

    `;

    container
        .querySelectorAll("tbody tr")
        .forEach(row => {

            row.addEventListener(
                "click",
                () => {

                    openAuditModal(
                        row.dataset.id
                    );

                }
            );

        });

}


/* ============================================================
   FULL AUDIT DETAIL
   ============================================================ */

async function fetchAudit(auditId) {

    const response =
        await apiFetch(
            `/audits/${encodeURIComponent(auditId)}`
        );

    if (!response.ok) {

        throw new Error(
            await getApiError(response)
        );

    }

    return await response.json();

}


async function openAuditModal(auditId) {

    state.selectedAuditId =
        auditId;

    $("auditTitle").textContent =
        `Audit #${auditId}`;

    $("auditBody").innerHTML = `
        <div class="loading">
            Loading audit details...
        </div>
    `;

    $("auditModal")
        .classList
        .add("open");

    try {

        const audit =
            await fetchAudit(auditId);

        renderAuditDetail(audit);

    }

    catch (error) {

        $("auditBody").innerHTML = `
            <div
                style="
                    color:var(--danger);
                    padding:15px 0;
                "
            >
                ${escapeHtml(error.message)}
            </div>
        `;

    }

}


function renderAuditDetail(audit) {

    const status =
        String(
            audit.audit_status ||
            audit.status ||
            ""
        ).toUpperCase();

    const expectedItem =
        audit.po_item_name ||
        audit.expected_item_name ||
        "—";

    const extractedItem =
        audit.extracted_item_name ||
        audit.item_name ||
        "—";

    const expectedQty =
        Number(
            audit.expected_quantity ||
            0
        );

    const deliveredQty =
        Number(
            audit.delivered_quantity ??
            audit.quantity_delivered ??
            0
        );

    const agreedPrice =
        Number(
            audit.agreed_unit_price ||
            0
        );

    const chargedPrice =
        Number(
            audit.charged_unit_price ??
            audit.unit_price_charged ??
            0
        );

    const quantityVariance =
        Number(
            audit.quantity_variance ||
            0
        );

    const priceVariance =
        Number(
            audit.price_variance ||
            0
        );

    const exposure =
        Number(
            audit.financial_exposure ||
            0
        );

    const risk =
        Number(
            audit.risk_score ||
            0
        );

    const invoiceNumber =
        audit.invoice_number ||
        "—";

    const poNumber =
        audit.po_number ||
        audit.po_id ||
        "—";

    $("auditTitle").textContent =
        `Audit #${audit.audit_id || ""} · ${poNumber}`;

    const verdictHtml =
        status === "CLEAR"
            ? `
                <div class="clear-box">
                    <strong>✓ CLEAR</strong>
                    <br>
                    Invoice complies with the purchase order terms.
                </div>
            `
            : `
                <div class="reason-box">
                    <strong>⚠ DISCREPANCY DETECTED</strong>
                    <br><br>
                    ${escapeHtml(
                        audit.discrepancy_reason ||
                        "One or more invoice values violate the PO terms."
                    )}
                </div>
            `;

    $("auditBody").innerHTML = `

        ${verdictHtml}


        <div class="exposure-card">

            <div class="exposure-item">

                <div class="exposure-label">
                    FINANCIAL EXPOSURE
                </div>

                <div
                    class="exposure-value"
                    style="
                        color:${
                            exposure > 0
                                ? "var(--danger)"
                                : "var(--success)"
                        };
                    "
                >
                    ${money(exposure)}
                </div>

            </div>


            <div class="exposure-item">

                <div class="exposure-label">
                    RISK SCORE
                </div>

                <div class="exposure-value">
                    ${risk.toFixed(1)}
                    <span
                        style="
                            font-size:12px;
                            color:var(--muted);
                        "
                    >
                        / 100
                    </span>
                </div>

            </div>


            <div class="exposure-item">

                <div class="exposure-label">
                    INVOICE
                </div>

                <div class="exposure-value">
                    ${escapeHtml(invoiceNumber)}
                </div>

            </div>

        </div>


        <div class="detail-section">

            <h3>
                Vendor & Purchase Order
            </h3>

            <div class="detail-grid">

                <div class="detail-item">

                    <div class="detail-label">
                        Vendor
                    </div>

                    <div class="detail-value">
                        ${escapeHtml(
                            audit.vendor_name ||
                            "—"
                        )}
                    </div>

                </div>


                <div class="detail-item">

                    <div class="detail-label">
                        Purchase Order
                    </div>

                    <div class="detail-value">
                        ${escapeHtml(poNumber)}
                    </div>

                </div>

            </div>

        </div>


        <div class="detail-section">

            <h3>
                PO vs Vendor Invoice
            </h3>

            <div class="table-wrap">

                <table class="comparison">

                    <thead>

                        <tr>

                            <th>
                                Field
                            </th>

                            <th>
                                PO — Authoritative
                            </th>

                            <th>
                                Invoice — AI Extracted
                            </th>

                            <th>
                                Variance
                            </th>

                        </tr>

                    </thead>

                    <tbody>

                        <tr>

                            <td>
                                Item
                            </td>

                            <td>
                                ${escapeHtml(expectedItem)}
                            </td>

                            <td>
                                ${escapeHtml(extractedItem)}
                            </td>

                            <td>
                                ${
                                    expectedItem
                                        .trim()
                                        .toLowerCase() ===
                                    extractedItem
                                        .trim()
                                        .toLowerCase()
                                        ? `<span class="variance-good">MATCH</span>`
                                        : `<span class="variance-bad">MISMATCH</span>`
                                }
                            </td>

                        </tr>


                        <tr>

                            <td>
                                Quantity
                            </td>

                            <td>
                                ${expectedQty}
                            </td>

                            <td>
                                ${deliveredQty}
                            </td>

                            <td
                                class="${
                                    quantityVariance < 0
                                        ? "variance-bad"
                                        : "variance-good"
                                }"
                            >
                                ${
                                    quantityVariance > 0
                                        ? "+"
                                        : ""
                                }${quantityVariance}
                            </td>

                        </tr>


                        <tr>

                            <td>
                                Unit Price
                            </td>

                            <td>
                                ${money(agreedPrice)}
                            </td>

                            <td>
                                ${money(chargedPrice)}
                            </td>

                            <td
                                class="${
                                    priceVariance > 0
                                        ? "variance-bad"
                                        : "variance-good"
                                }"
                            >
                                ${
                                    priceVariance > 0
                                        ? "+"
                                        : ""
                                }${money(priceVariance)}
                            </td>

                        </tr>

                    </tbody>

                </table>

            </div>

        </div>


        <div class="detail-section">

            <h3>
                Audit Logic
            </h3>

            <div
                style="
                    background:var(--card-2);
                    border-radius:10px;
                    padding:15px;
                    color:var(--muted);
                    font-size:12px;
                "
            >

                <div>
                    <strong style="color:var(--text);">
                        Quantity rule:
                    </strong>

                    Invoice quantity must not be lower than the PO quantity.
                </div>

                <div style="margin-top:8px;">

                    <strong style="color:var(--text);">
                        Price rule:
                    </strong>

                    Vendor charged price must not exceed the agreed PO price.
                </div>

                <div style="margin-top:8px;">

                    <strong style="color:var(--text);">
                        Exposure:
                    </strong>

                    Quantifies the monetary impact of shortages and overcharges.
                </div>

            </div>

        </div>


        <div class="detail-section">

            <h3>
                Raw Vendor Invoice
            </h3>

            <div class="raw-invoice">
                ${escapeHtml(
                    audit.raw_text ||
                    "Raw invoice text unavailable."
                )}
            </div>

        </div>


        <div
            style="
                color:var(--muted);
                font-size:11px;
                margin-top:20px;
            "
        >
            Audited:
            ${escapeHtml(
                audit.audited_at
                    ? new Date(
                        audit.audited_at
                    ).toLocaleString("en-IN")
                    : "—"
            )}
        </div>

    `;

}


function closeAuditModal() {

    $("auditModal")
        .classList
        .remove("open");

}


function openFullAuditPage() {

    if (!state.selectedAuditId) {
        return;
    }

    window.location.href =
        `/audit.html?audit_id=${encodeURIComponent(
            state.selectedAuditId
        )}`;

}


/* ============================================================
   CLOSE MODALS ON BACKDROP
   ============================================================ */

$("createModal")
    .addEventListener(
        "click",
        event => {

            if (
                event.target ===
                $("createModal")
            ) {
                closeCreateModal();
            }

        }
    );


$("detailModal")
    .addEventListener(
        "click",
        event => {

            if (
                event.target ===
                $("detailModal")
            ) {
                closeDetailModal();
            }

        }
    );


$("auditModal")
    .addEventListener(
        "click",
        event => {

            if (
                event.target ===
                $("auditModal")
            ) {
                closeAuditModal();
            }

        }
    );


/* ============================================================
   INITIALIZE
   ============================================================ */

async function init() {

    if (!requireBuyer()) {
        return;
    }

    
    await Promise.all([
        fetchVendors(),
        fetchOrders(),
        fetchAudits()
    ]);

    renderRecentAudits();

}

init();
