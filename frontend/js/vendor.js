/* ============================================================
   STATE
   ============================================================ */

const state = {

    userId: null,

    role: null,

    orders: [],

    audits: []

};


/* ============================================================
   HELPERS
   ============================================================ */

function $(id) {

    return document.getElementById(id);

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


function money(value) {

    return "₹" +
        Number(value || 0).toLocaleString(
            "en-IN",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );

}


function toast(
    message,
    type = "success"
) {

    const element =
        $("toast");

    element.textContent =
        message;

    element.className =
        `toast ${type} show`;

    setTimeout(
        () => {
            element.classList.remove(
                "show"
            );
        },
        3000
    );

}


async function getApiError(response) {

    try {

        const data =
            await response.json();

        if (
            typeof data.detail ===
            "string"
        ) {

            return data.detail;

        }

        if (
            Array.isArray(data.detail)
        ) {

            return data.detail
                .map(
                    error =>
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
   AUTH
   ============================================================ */

function requireVendor() {

    const userId =
        getUserId();

    const role =
        String(
            getRole() || ""
        ).toUpperCase();


    if (!userId || !role) {

        window.location.href =
            "/signup.html?role=vendor";

        return false;

    }


    if (role !== "VENDOR") {

        if (role === "BUYER") {

            window.location.href =
                "/buyer.html";

        }

        else {

            clearSession();

            window.location.href =
                "/signup.html?role=vendor";

        }

        return false;

    }


    state.userId =
        Number(userId);

    state.role =
        role;


    $("userLabel").textContent =
        `Vendor #${userId}`;


    return true;

}


function logout() {

    clearSession();

    window.location.href =
        "/signup.html";

}


/* ============================================================
   NAVIGATION
   ============================================================ */

function showView(view) {

    document
        .querySelectorAll(".view")
        .forEach(
            section =>
                section.classList.remove(
                    "active"
                )
        );


    const target =
        $("view-" + view);


    if (target) {

        target.classList.add(
            "active"
        );

    }


    document
        .querySelectorAll(".nav button")
        .forEach(
            button =>
                button.classList.remove(
                    "active"
                )
        );


    if (view === "dashboard") {

        $("navDashboard")
            ?.classList
            .add("active");

    }


    if (view === "orders") {

        $("navOrders")
            ?.classList
            .add("active");

    }


    if (view === "orders") {

        renderOrders();

    }

}


function goInvoices() {

    window.location.href =
        "/invoices.html";

}


function goAudits() {

    window.location.href =
        "/audit.html";

}


/* ============================================================
   PURCHASE ORDERS API
   ============================================================ */

async function fetchOrders() {

    const container =
        $("ordersContainer");

    container.innerHTML = `
        <div class="loading">
            Loading purchase orders...
        </div>
    `;


    try {

        const response =
            await apiFetch(
                `/vendor/purchase-orders?vendor_id=${encodeURIComponent(
                    state.userId
                )}`
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


        updateStats();

        renderOrders();

        renderRecentOrders();

    }

    catch (error) {

        console.error(
            "Purchase order error:",
            error
        );


        state.orders = [];


        container.innerHTML = `

            <div class="state-box">

                <div class="big-icon">
                    ⚠️
                </div>

                <h3>
                    Unable to load purchase orders
                </h3>

                <p>
                    ${escapeHtml(
                        error.message
                    )}
                </p>

                <button
                    class="btn btn-primary"
                    onclick="fetchOrders()"
                >
                    Retry
                </button>

            </div>
        `;


        toast(
            error.message ||
            "Failed to load purchase orders",
            "error"
        );

    }

}


/* ============================================================
   ORDER RENDERING
   ============================================================ */

function renderOrders() {

    const container =
        $("ordersContainer");


    if (!state.orders.length) {

        container.innerHTML = `

            <div class="state-box">

                <div class="big-icon">
                    📦
                </div>

                <h3>
                    No purchase orders yet
                </h3>

                <p>
                    Buyer organizations will send purchase orders here.
                </p>

            </div>
        `;

        return;

    }


    container.innerHTML = `

        <div class="orders-grid">

            ${
                state.orders
                    .map(
                        orderCardHtml
                    )
                    .join("")
            }

        </div>

    `;


    container
        .querySelectorAll(
            ".order-card"
        )
        .forEach(card => {

            card.addEventListener(
                "click",
                event => {

                    if (
                        event.target.closest(
                            "button"
                        )
                    ) {
                        return;
                    }


                    openDetailModal(
                        card.dataset.id
                    );

                }
            );

        });


    container
        .querySelectorAll(
            "[data-accept-po]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    acceptPO(
                        button.dataset.acceptPo,
                        button
                    );

                }
            );

        });

}


function orderCardHtml(order) {

    const poNumber =
        order.po_number ||
        order.po_id ||
        order.id ||
        "—";


    const buyer =
        order.buyer_name ||
        order.buyer ||
        (
            order.buyer_id
                ? `Buyer #${order.buyer_id}`
                : "Buyer"
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


    const total =
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


    const acceptButton =
        status === "pending"
            ? `
                <button
                    class="btn btn-success"
                    data-accept-po="${escapeHtml(
                        poNumber
                    )}"
                >
                    Accept PO
                </button>
            `
            : status === "accepted"
                ? `
                    <button
                        class="btn btn-primary"
                        onclick="goInvoices(); event.stopPropagation();"
                    >
                        Submit Invoice
                    </button>
                `
                : "";


    return `

        <div
            class="order-card"
            data-id="${escapeHtml(poNumber)}"
        >


            <div class="order-head">


                <div>

                    <div class="order-id">
                        #${escapeHtml(poNumber)}
                    </div>

                    <div class="order-title">
                        ${money(total)}
                    </div>

                    <div class="order-item">
                        ${escapeHtml(item)}
                    </div>

                </div>


                <span
                    class="status ${escapeHtml(status)}"
                >
                    ${escapeHtml(status)}
                </span>


            </div>


            <div class="order-info">


                <div class="info-box">

                    <div class="info-label">
                        Buyer
                    </div>

                    <div class="info-value">
                        ${escapeHtml(buyer)}
                    </div>

                </div>


                <div class="info-box">

                    <div class="info-label">
                        Quantity
                    </div>

                    <div class="info-value">
                        ${quantity}
                    </div>

                </div>


                <div class="info-box">

                    <div class="info-label">
                        Agreed Price
                    </div>

                    <div class="info-value">
                        ${money(price)}
                    </div>

                </div>


                <div class="info-box">

                    <div class="info-label">
                        PO Value
                    </div>

                    <div class="info-value">
                        ${money(total)}
                    </div>

                </div>


            </div>


            <div class="order-footer">

                <div class="order-date">
                    ${escapeHtml(created)}
                </div>

                <div>
                    ${acceptButton}
                </div>

            </div>


        </div>

    `;

}


/* ============================================================
   RECENT ORDERS
   ============================================================ */

function renderRecentOrders() {

    const container =
        $("recentOrders");


    const orders =
        state.orders
            .slice(0, 4);


    if (!orders.length) {

        container.innerHTML = `

            <div class="state-box">

                <div class="big-icon">
                    📦
                </div>

                <h3>
                    No purchase orders
                </h3>

                <p>
                    Buyer purchase orders will appear here.
                </p>

            </div>

        `;

        return;

    }


    container.innerHTML = `

        <div class="orders-grid">

            ${
                orders
                    .map(
                        orderCardHtml
                    )
                    .join("")
            }

        </div>

    `;


    container
        .querySelectorAll(
            "[data-accept-po]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    acceptPO(
                        button.dataset.acceptPo,
                        button
                    );

                }
            );

        });


    container
        .querySelectorAll(
            ".order-card"
        )
        .forEach(card => {

            card.addEventListener(
                "click",
                event => {

                    if (
                        event.target.closest(
                            "button"
                        )
                    ) {
                        return;
                    }

                    openDetailModal(
                        card.dataset.id
                    );

                }
            );

        });

}


/* ============================================================
   STATS
   ============================================================ */

function updateStats() {

    const orders =
        state.orders || [];


    $("statTotal").textContent =
        orders.length;


    $("statPending").textContent =
        orders.filter(
            order =>
                String(
                    order.status || ""
                ).toLowerCase() ===
                "pending"
        ).length;


    $("statAccepted").textContent =
        orders.filter(
            order =>
                String(
                    order.status || ""
                ).toLowerCase() ===
                "accepted"
        ).length;


    $("statCompleted").textContent =
        orders.filter(
            order =>
                String(
                    order.status || ""
                ).toLowerCase() ===
                "completed"
        ).length;


    loadAuditCount();

}


/* ============================================================
   ACCEPT PO
   ============================================================ */

async function acceptPO(
    poNumber,
    button
) {

    if (!poNumber) {
        return;
    }


    if (
        !confirm(
            `Accept purchase order ${poNumber}?`
        )
    ) {
        return;
    }


    button.disabled =
        true;

    button.textContent =
        "Accepting...";


    try {

        const response =
            await apiFetch(
                `/purchase-orders/${encodeURIComponent(
                    poNumber
                )}/accept?vendor_id=${encodeURIComponent(
                    state.userId
                )}`,
                {
                    method:
                        "POST"
                }
            );


        if (!response.ok) {

            throw new Error(
                await getApiError(response)
            );

        }


        await response.json();


        toast(
            `PO ${poNumber} accepted successfully.`,
            "success"
        );


        await fetchOrders();

    }

    catch (error) {

        console.error(
            "Accept PO error:",
            error
        );


        toast(
            error.message ||
            "Failed to accept purchase order",
            "error"
        );


        button.disabled =
            false;

        button.textContent =
            "Accept PO";

    }

}


/* ============================================================
   PO DETAIL
   ============================================================ */

async function openDetailModal(
    poNumber
) {

    $("detailTitle").textContent =
        `Purchase Order ${poNumber}`;


    $("detailBody").innerHTML = `
        <div class="loading">
            Loading purchase order...
        </div>
    `;


    $("detailModal")
        .classList
        .add("open");


    try {

        const response =
            await apiFetch(
                `/purchase-orders/${encodeURIComponent(
                    poNumber
                )}` +
                `?user_id=${encodeURIComponent(
                    state.userId
                )}` +
                `&role=VENDOR`
            );


        if (!response.ok) {

            throw new Error(
                await getApiError(response)
            );

        }


        const order =
            await response.json();


        renderOrderDetail(
            order
        );

    }

    catch (error) {

        $("detailBody").innerHTML = `

            <div
                style="
                    color:var(--danger);
                    padding:15px 0;
                "
            >
                ${escapeHtml(
                    error.message
                )}
            </div>

        `;

    }

}


function renderOrderDetail(
    order
) {

    const poNumber =
        order.po_number ||
        order.po_id ||
        "—";


    const buyer =
        order.buyer_name ||
        (
            order.buyer_id
                ? `Buyer #${order.buyer_id}`
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

                    <span
                        class="status ${escapeHtml(status)}"
                    >
                        ${escapeHtml(status)}
                    </span>

                </div>

            </div>


            <div class="detail-item">

                <div class="detail-label">
                    Buyer
                </div>

                <div class="detail-value">
                    ${escapeHtml(buyer)}
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


        <div class="authority-box">

            <div class="authority-label">
                Authoritative Purchase Order Value
            </div>

            <div class="authority-value">
                ${money(quantity * price)}
            </div>

            <div
                style="
                    color:var(--muted);
                    font-size:12px;
                    margin-top:4px;
                "
            >
                ${quantity}
                units ×
                ${money(price)}
                agreed unit price
            </div>

        </div>


        ${
            status === "accepted"
                ? `
                    <div
                        style="
                            margin-top:15px;
                            padding:14px;
                            background:rgba(34,197,94,.08);
                            border:1px solid rgba(34,197,94,.18);
                            border-radius:10px;
                            color:#bbf7d0;
                            font-size:13px;
                        "
                    >
                        ✓ This PO is accepted.
                        You can now submit an invoice for this order.
                    </div>
                `
                : status === "pending"
                    ? `
                        <div
                            style="
                                margin-top:15px;
                                padding:14px;
                                background:rgba(245,158,11,.08);
                                border:1px solid rgba(245,158,11,.18);
                                border-radius:10px;
                                color:#fde68a;
                                font-size:13px;
                            "
                        >
                            This PO is waiting for vendor acceptance.
                        </div>
                    `
                    : ""
        }

    `;

}


function closeDetailModal() {

    $("detailModal")
        .classList
        .remove("open");

}


/* ============================================================
   AUDIT COUNT
   ============================================================ */

async function loadAuditCount() {

    try {

        const response =
            await apiFetch(
                `/audits?vendor_id=${encodeURIComponent(
                    state.userId
                )}`
            );


        if (!response.ok) {

            $("statAudits").textContent =
                "—";

            return;

        }


        const data =
            await response.json();


        const audits =
            Array.isArray(data)
                ? data
                : (
                    data.audits ||
                    []
                );


        state.audits =
            audits;


        $("statAudits").textContent =
            audits.length;

    }

    catch (error) {

        console.error(
            "Audit count error:",
            error
        );

        $("statAudits").textContent =
            "—";

    }

}


/* ============================================================
   MODAL BACKDROP
   ============================================================ */

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


/* ============================================================
   INITIALIZE
   ============================================================ */

async function init() {

    if (!requireVendor()) {
        return;
    }


    await fetchOrders();

}


init();
