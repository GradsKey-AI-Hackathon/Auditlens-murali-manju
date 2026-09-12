from decimal import Decimal
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from backend.schemas import (
    BuyerSignupRequest,
    VendorSignupRequest,
    LoginRequest,
    PurchaseOrderCreate,
    InvoiceSubmitRequest,
)

from backend.auth import (
    signup_buyer,
    signup_vendor,
    login,
)

from backend.po_service import (
    create_purchase_order,
    get_buyer_purchase_orders,
    get_purchase_order,
    get_vendor_purchase_orders,
    accept_purchase_order,
)

from backend.invoice_service import submit_invoice

from backend.database import get_db


# =========================================================
# APPLICATION
# =========================================================

app = FastAPI(
    title="AI Vendor Invoice Audit Platform",
    description="AI-powered B2B vendor invoice auditing system",
    version="1.0.0",
)


class StripApiPrefixMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        scope = request.scope
        path = scope.get("path", "")
        if path.startswith("/api/") or path == "/api":
            new_path = path[4:] if path != "/api" else "/"
            scope["path"] = new_path
            raw = scope.get("raw_path", b"")
            if raw:
                scope["raw_path"] = raw[:4] + raw[8:] if raw.startswith(b"/api/") else b""
        return await call_next(request)


app.add_middleware(StripApiPrefixMiddleware)


# =========================================================
# SYSTEM
# =========================================================

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "AI Vendor Invoice Audit Platform",
        "version": "1.0.0",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
    }


# =========================================================
# AUTHENTICATION
#
# Hackathon MVP authentication:
# frontend stores user_id + role in localStorage.
#
# JWT code may still exist inside auth.py, but these
# business routes do not require JWT.
# =========================================================


@app.post("/auth/signup/buyer")
def buyer_signup(data: BuyerSignupRequest):
    return signup_buyer(data)


@app.post("/auth/signup/vendor")
def vendor_signup(data: VendorSignupRequest):
    return signup_vendor(data)


@app.post("/auth/login")
def user_login(data: LoginRequest):
    """
    Login for the hackathon MVP.

    Returns:
        user_id
        role

    The frontend stores these values in localStorage.
    """

    result = login(data)

    return {
        "message": "Login successful",
        "user_id": result["user_id"],
        "role": result["role"],
    }


# =========================================================
# VENDORS
# =========================================================

@app.get("/vendors")
def list_approved_vendors():
    """
    Return approved vendors for buyer-side PO creation.

    The buyer should NOT have to manually enter a
    database vendor_id.

    Frontend displays:
        business_name
        owner_name
        email

    Frontend internally sends:
        vendor_id
    """

    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:

        cursor.execute(
            """
            SELECT
                id,
                business_name,
                owner_name,
                email,
                phone,
                address,
                status,
                created_at
            FROM vendors
            WHERE status = 'approved'
            ORDER BY business_name ASC
            """
        )

        vendors = cursor.fetchall()

        return vendors

    except Exception:
        db.rollback()
        raise

    finally:
        cursor.close()
        db.close()


# =========================================================
# OPTIONAL — SINGLE VENDOR
# =========================================================

@app.get("/vendors/{vendor_id}")
def get_vendor(vendor_id: int):
    """
    Get details of one approved vendor.

    Useful for buyer PO details and future vendor
    profile pages.
    """

    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:

        cursor.execute(
            """
            SELECT
                id,
                business_name,
                owner_name,
                email,
                phone,
                address,
                status,
                created_at
            FROM vendors
            WHERE id = %s
            """,
            (vendor_id,),
        )

        vendor = cursor.fetchone()

        if not vendor:
            raise HTTPException(
                status_code=404,
                detail="Vendor not found",
            )

        return vendor

    finally:
        cursor.close()
        db.close()


# =========================================================
# BUYER — PURCHASE ORDERS
# =========================================================


@app.post("/purchase-orders")
def create_po(
    data: PurchaseOrderCreate,
    buyer_id: int,
):
    """
    Buyer creates a purchase order.

    Frontend sends:

        POST /purchase-orders?buyer_id=4

    Request body:

        {
            "vendor_id": 2,
            "item_name": "Wireless Mouse Pro",
            "expected_quantity": 50,
            "agreed_unit_price": 450
        }

    vendor_id is an internal identifier selected from
    the approved-vendor dropdown.
    """

    if buyer_id <= 0:
        raise HTTPException(
            status_code=400,
            detail="Invalid buyer ID",
        )

    return create_purchase_order(
        buyer_id=buyer_id,
        vendor_id=data.vendor_id,
        item_name=data.item_name,
        expected_quantity=data.expected_quantity,
        agreed_unit_price=data.agreed_unit_price,
    )


@app.get("/purchase-orders")
def list_buyer_pos(
    buyer_id: int,
):
    """
    Return purchase orders belonging to a buyer.
    """

    if buyer_id <= 0:
        raise HTTPException(
            status_code=400,
            detail="Invalid buyer ID",
        )

    return get_buyer_purchase_orders(
        buyer_id
    )


@app.get("/purchase-orders/{po_id}")
def get_po(
    po_id: str,
    user_id: int,
    role: str,
):
    """
    Get a purchase order for either:

        BUYER
        VENDOR
    """

    if not po_id.strip():
        raise HTTPException(
            status_code=400,
            detail="Purchase order ID is required",
        )

    role = role.upper()

    if role not in [
        "BUYER",
        "VENDOR",
    ]:
        raise HTTPException(
            status_code=400,
            detail="Role must be BUYER or VENDOR",
        )

    return get_purchase_order(
        po_number=po_id,
        user_id=user_id,
        role=role,
    )


# =========================================================
# VENDOR — PURCHASE ORDERS
# =========================================================


@app.get("/vendor/purchase-orders")
def list_vendor_pos(
    vendor_id: int,
):
    """
    Return purchase orders assigned to a vendor.
    """

    if vendor_id <= 0:
        raise HTTPException(
            status_code=400,
            detail="Invalid vendor ID",
        )

    return get_vendor_purchase_orders(
        vendor_id
    )


@app.post("/purchase-orders/{po_id}/accept")
def accept_po(
    po_id: str,
    vendor_id: int,
):
    """
    Vendor accepts a purchase order.
    """

    if not po_id.strip():
        raise HTTPException(
            status_code=400,
            detail="Purchase order ID is required",
        )

    if vendor_id <= 0:
        raise HTTPException(
            status_code=400,
            detail="Invalid vendor ID",
        )

    return accept_purchase_order(
        po_number=po_id,
        vendor_id=vendor_id,
    )


# =========================================================
# VENDOR — INVOICES
# =========================================================


@app.post("/invoices")
def create_invoice(
    data: InvoiceSubmitRequest,
    vendor_id: int,
):
    """
    Vendor submits raw invoice text.

    The backend:

        1. Finds the PO
        2. Sends raw invoice text to AI
        3. Extracts structured invoice fields
        4. Compares invoice against PO
        5. Detects discrepancies
        6. Calculates financial exposure
        7. Calculates risk score
        8. Stores invoice
        9. Stores invoice items
        10. Stores audit ledger entry
    """

    if vendor_id <= 0:
        raise HTTPException(
            status_code=400,
            detail="Invalid vendor ID",
        )

    result = submit_invoice(
        vendor_id=vendor_id,
        po_number=data.po_id,
        raw_text=data.raw_text,
    )
    return _rows_to_json(result)


def _to_json_safe(v):
    if isinstance(v, Decimal):
        return float(v)
    return v


def _rows_to_json(rows):
    if rows is None:
        return None
    if isinstance(rows, (list, tuple)):
        return [_rows_to_json(r) for r in rows]
    if isinstance(rows, dict):
        return {k: _to_json_safe(v) for k, v in rows.items()}
    return rows


def _row_to_json(row):
    if row is None:
        return None
    return {k: _to_json_safe(v) for k, v in row.items()}


# =========================================================
# FUTURE / AUDIT ENDPOINTS
# =========================================================


@app.get("/invoices")
def list_invoices(
    vendor_id: int = None,
    buyer_id: int = None,
):
    """
    List invoices — by vendor OR by buyer (through PO).

    Query params (exactly ONE required):
        vendor_id — show invoices submitted by this vendor
        buyer_id  — show invoices for POs issued by this buyer
    """

    if not (vendor_id or buyer_id):
        raise HTTPException(
            status_code=400,
            detail="vendor_id or buyer_id query parameter is required",
        )

    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        if vendor_id:
            cursor.execute(
                """
                SELECT
                    inv.id,
                    inv.invoice_number,
                    inv.po_id,
                    inv.vendor_id,
                    inv.status,
                    inv.submitted_at,
                    po.po_number,
                    po.item_name,
                    po.buyer_id,
                    b.name AS buyer_name,
                    v.business_name AS vendor_name,
                    al.audit_status,
                    al.financial_exposure,
                    al.risk_score
                FROM invoices inv
                INNER JOIN purchase_orders po ON inv.po_id = po.id
                INNER JOIN buyers b ON po.buyer_id = b.id
                INNER JOIN vendors v ON inv.vendor_id = v.id
                LEFT JOIN audit_logs al ON al.id = (
                    SELECT MAX(id) FROM audit_logs WHERE invoice_id = inv.id
                )
                WHERE inv.vendor_id = %s
                ORDER BY inv.submitted_at DESC
                """,
                (vendor_id,),
            )
        else:
            cursor.execute(
                """
                SELECT
                    inv.id,
                    inv.invoice_number,
                    inv.po_id,
                    inv.vendor_id,
                    inv.status,
                    inv.submitted_at,
                    po.po_number,
                    po.item_name,
                    po.buyer_id,
                    b.name AS buyer_name,
                    v.business_name AS vendor_name,
                    al.audit_status,
                    al.financial_exposure,
                    al.risk_score
                FROM invoices inv
                INNER JOIN purchase_orders po ON inv.po_id = po.id
                INNER JOIN buyers b ON po.buyer_id = b.id
                INNER JOIN vendors v ON inv.vendor_id = v.id
                LEFT JOIN audit_logs al ON al.id = (
                    SELECT MAX(id) FROM audit_logs WHERE invoice_id = inv.id
                )
                WHERE po.buyer_id = %s
                ORDER BY inv.submitted_at DESC
                """,
                (buyer_id,),
            )

        rows = cursor.fetchall()
        return _rows_to_json(rows)

    except Exception:
        db.rollback()
        raise
    finally:
        cursor.close()
        db.close()


@app.get("/invoices/{invoice_id}")
def get_invoice(invoice_id: int):
    """
    Full invoice detail with items + audit.
    """

    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT
                inv.id,
                inv.invoice_number,
                inv.po_id,
                inv.vendor_id,
                inv.status,
                inv.submitted_at,
                inv.raw_text,
                po.po_number,
                po.item_name,
                po.expected_quantity,
                po.agreed_unit_price,
                po.status AS po_status,
                po.buyer_id,
                po.vendor_id AS po_vendor_id,
                b.name AS buyer_name,
                v.business_name AS vendor_name
            FROM invoices inv
            INNER JOIN purchase_orders po ON inv.po_id = po.id
            INNER JOIN buyers b ON po.buyer_id = b.id
            INNER JOIN vendors v ON inv.vendor_id = v.id
            WHERE inv.id = %s
            """,
            (invoice_id,),
        )

        inv = cursor.fetchone()
        if not inv:
            raise HTTPException(status_code=404, detail="Invoice not found")

        cursor.execute(
            """
            SELECT id, item_name, quantity_delivered, unit_price_charged, created_at
            FROM invoice_items
            WHERE invoice_id = %s
            ORDER BY id ASC
            """,
            (invoice_id,),
        )
        items = cursor.fetchall()

        cursor.execute(
            """
            SELECT
                id,
                audit_status,
                discrepancy_reason,
                expected_quantity,
                delivered_quantity,
                quantity_variance,
                agreed_unit_price,
                charged_unit_price,
                price_variance,
                financial_exposure,
                risk_score,
                audited_at
            FROM audit_logs
            WHERE invoice_id = %s
            ORDER BY id DESC
            LIMIT 1
            """,
            (invoice_id,),
        )
        audit = cursor.fetchone()

        return {
            **_row_to_json(inv),
            "items": _rows_to_json(items),
            "audit": _row_to_json(audit) if audit else None,
        }

    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise
    finally:
        cursor.close()
        db.close()


@app.get("/audits")
def list_audits(
    vendor_id: int = None,
    buyer_id: int = None,
    limit: int = 100,
):
    """
    List audit log entries by vendor OR by buyer.

    Query params (exactly ONE required):
        vendor_id — audits for this vendor's invoices
        buyer_id  — audits for this buyer's POs
    """

    if not (vendor_id or buyer_id):
        raise HTTPException(
            status_code=400,
            detail="vendor_id or buyer_id query parameter is required",
        )

    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        if vendor_id:
            cursor.execute(
                """
                SELECT
                    al.id,
                    al.invoice_id,
                    al.po_id,
                    al.vendor_id,
                    al.audit_status,
                    al.discrepancy_reason,
                    al.expected_quantity,
                    al.delivered_quantity,
                    al.quantity_variance,
                    al.agreed_unit_price,
                    al.charged_unit_price,
                    al.price_variance,
                    al.financial_exposure,
                    al.risk_score,
                    al.audited_at,
                    inv.invoice_number,
                    po.po_number,
                    po.item_name,
                    b.name AS buyer_name,
                    v.business_name AS vendor_name
                FROM audit_logs al
                INNER JOIN invoices inv ON al.invoice_id = inv.id
                INNER JOIN purchase_orders po ON al.po_id = po.id
                INNER JOIN buyers b ON po.buyer_id = b.id
                INNER JOIN vendors v ON al.vendor_id = v.id
                WHERE al.vendor_id = %s
                ORDER BY al.audited_at DESC
                LIMIT %s
                """,
                (vendor_id, limit),
            )
        else:
            cursor.execute(
                """
                SELECT
                    al.id,
                    al.invoice_id,
                    al.po_id,
                    al.vendor_id,
                    al.audit_status,
                    al.discrepancy_reason,
                    al.expected_quantity,
                    al.delivered_quantity,
                    al.quantity_variance,
                    al.agreed_unit_price,
                    al.charged_unit_price,
                    al.price_variance,
                    al.financial_exposure,
                    al.risk_score,
                    al.audited_at,
                    inv.invoice_number,
                    po.po_number,
                    po.item_name,
                    b.name AS buyer_name,
                    v.business_name AS vendor_name
                FROM audit_logs al
                INNER JOIN invoices inv ON al.invoice_id = inv.id
                INNER JOIN purchase_orders po ON al.po_id = po.id
                INNER JOIN buyers b ON po.buyer_id = b.id
                INNER JOIN vendors v ON al.vendor_id = v.id
                WHERE po.buyer_id = %s
                ORDER BY al.audited_at DESC
                LIMIT %s
                """,
                (buyer_id, limit),
            )

        rows = cursor.fetchall()
        return _rows_to_json(rows)

    except Exception:
        db.rollback()
        raise
    finally:
        cursor.close()
        db.close()


@app.get("/audits/{audit_id}")
def get_audit(audit_id: int):
    """
    Full audit detail — one row from audit_logs with the
    invoice + PO + items hydrated.
    """

    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT
                al.id,
                al.invoice_id,
                al.po_id,
                al.vendor_id,
                al.audit_status,
                al.discrepancy_reason,
                al.expected_quantity,
                al.delivered_quantity,
                al.quantity_variance,
                al.agreed_unit_price,
                al.charged_unit_price,
                al.price_variance,
                al.financial_exposure,
                al.risk_score,
                al.audited_at,
                inv.invoice_number,
                inv.status AS invoice_status,
                inv.raw_text,
                inv.submitted_at,
                po.po_number,
                po.item_name,
                po.expected_quantity AS po_expected_qty,
                po.agreed_unit_price AS po_agreed_price,
                po.status AS po_status,
                po.buyer_id,
                b.name AS buyer_name,
                b.email AS buyer_email,
                v.business_name AS vendor_name,
                v.owner_name AS vendor_owner,
                v.email AS vendor_email
            FROM audit_logs al
            INNER JOIN invoices inv ON al.invoice_id = inv.id
            INNER JOIN purchase_orders po ON al.po_id = po.id
            INNER JOIN buyers b ON po.buyer_id = b.id
            INNER JOIN vendors v ON al.vendor_id = v.id
            WHERE al.id = %s
            """,
            (audit_id,),
        )

        audit = cursor.fetchone()
        if not audit:
            raise HTTPException(status_code=404, detail="Audit entry not found")

        cursor.execute(
            """
            SELECT id, item_name, quantity_delivered, unit_price_charged, created_at
            FROM invoice_items
            WHERE invoice_id = %s
            ORDER BY id ASC
            """,
            (audit["invoice_id"],),
        )
        items = cursor.fetchall()

        return {
            **_row_to_json(audit),
            "items": _rows_to_json(items),
        }

    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise
    finally:
        cursor.close()
        db.close()


@app.get("/vendors/{vendor_id}/score")
def vendor_risk_score(vendor_id: int):
    """
    Aggregate vendor risk stats (count, discrepancies, avg risk score, exposure).
    """

    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT
                id,
                business_name,
                owner_name,
                email,
                phone,
                address,
                status,
                created_at
            FROM vendors
            WHERE id = %s
            """,
            (vendor_id,),
        )
        vendor = cursor.fetchone()
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")

        cursor.execute(
            """
            SELECT
                COUNT(*) AS total_audits,
                SUM(CASE WHEN audit_status = 'DISCREPANCY' THEN 1 ELSE 0 END) AS discrepancies,
                AVG(risk_score) AS avg_risk_score,
                SUM(financial_exposure) AS total_exposure
            FROM audit_logs
            WHERE vendor_id = %s
            """,
            (vendor_id,),
        )
        stats = cursor.fetchone() or {}

        cursor.execute(
            """
            SELECT COUNT(*) AS total_pos
            FROM purchase_orders
            WHERE vendor_id = %s
            """,
            (vendor_id,),
        )
        pos = cursor.fetchone() or {"total_pos": 0}

        cleaned_stats = {
            "total_audits": int(stats.get("total_audits") or 0),
            "discrepancies": int(stats.get("discrepancies") or 0),
            "avg_risk_score": float(stats.get("avg_risk_score") or 0),
            "total_exposure": float(stats.get("total_exposure") or 0),
        }
        cleaned_pos = {"total_pos": int(pos.get("total_pos") or 0)}
        return {
            **_row_to_json(vendor),
            "stats": cleaned_stats,
            "total_accepted_pos": cleaned_pos,
        }

    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise
    finally:
        cursor.close()
        db.close()


# =========================================================
# STATIC FILES (frontend pages)
# =========================================================
from pathlib import Path

_FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
if _FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(_FRONTEND_DIR), html=True), name="frontend")
