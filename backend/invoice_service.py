from fastapi import HTTPException

from backend.database import get_db
from backend.ai_extractor import extract_invoice
from backend.audit_engine import audit_invoice


def submit_invoice(
    vendor_id: int,
    po_number: str,
    raw_text: str,
):
    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        # -----------------------------------------------------
        # 1. Get PO and verify vendor ownership
        # -----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                po_number,
                buyer_id,
                vendor_id,
                item_name,
                expected_quantity,
                agreed_unit_price,
                status
            FROM purchase_orders
            WHERE po_number = %s
            """,
            (po_number,),
        )

        po = cursor.fetchone()

        if not po:
            raise HTTPException(
                status_code=404,
                detail="Purchase order not found",
            )

        if po["vendor_id"] != vendor_id:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this purchase order",
            )

        if po["status"] != "accepted":
            raise HTTPException(
                status_code=400,
                detail="Purchase order must be accepted before invoice submission",
            )

        # -----------------------------------------------------
        # 2. AI extraction
        # -----------------------------------------------------

        extracted = extract_invoice(raw_text)

        if not extracted.get("po_id"):
            raise HTTPException(
                status_code=422,
                detail="AI could not extract PO ID from invoice",
            )

        if extracted["po_id"] != po_number:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Invoice PO ID {extracted['po_id']} "
                    f"does not match submitted PO {po_number}"
                ),
            )

        if extracted.get("item_name") is None:
            raise HTTPException(
                status_code=422,
                detail="AI could not extract item name",
            )

        if extracted.get("quantity_delivered") is None:
            raise HTTPException(
                status_code=422,
                detail="AI could not extract delivered quantity",
            )

        if extracted.get("unit_price_charged") is None:
            raise HTTPException(
                status_code=422,
                detail="AI could not extract charged unit price",
            )

        # -----------------------------------------------------
        # 3. Deterministic audit
        # -----------------------------------------------------

        audit = audit_invoice(
            expected_quantity=float(po["expected_quantity"]),
            delivered_quantity=float(
                extracted["quantity_delivered"]
            ),
            agreed_unit_price=float(po["agreed_unit_price"]),
            charged_unit_price=float(
                extracted["unit_price_charged"]
            ),
            expected_item_name=po["item_name"],
            extracted_item_name=extracted["item_name"],
        )

        # -----------------------------------------------------
        # 4. Generate invoice number
        # -----------------------------------------------------

        invoice_number = extracted.get("invoice_number")

        if not invoice_number:
            invoice_number = f"INV-{po_number}"

        # -----------------------------------------------------
        # 5. Store invoice
        # -----------------------------------------------------

        cursor.execute(
            """
            INSERT INTO invoices (
                invoice_number,
                po_id,
                vendor_id,
                raw_text,
                status
            )
            VALUES (%s, %s, %s, %s, 'submitted')
            """,
            (
                invoice_number,
                po["id"],
                vendor_id,
                raw_text,
            ),
        )

        invoice_id = cursor.lastrowid

        # -----------------------------------------------------
        # 6. Store AI-extracted invoice item
        # -----------------------------------------------------

        cursor.execute(
            """
            INSERT INTO invoice_items (
                invoice_id,
                item_name,
                quantity_delivered,
                unit_price_charged
            )
            VALUES (%s, %s, %s, %s)
            """,
            (
                invoice_id,
                extracted["item_name"],
                extracted["quantity_delivered"],
                extracted["unit_price_charged"],
            ),
        )

        # -----------------------------------------------------
        # 7. Store audit ledger
        # -----------------------------------------------------

        cursor.execute(
            """
            INSERT INTO audit_logs (
                invoice_id,
                po_id,
                vendor_id,
                audit_status,
                discrepancy_reason,
                expected_quantity,
                delivered_quantity,
                quantity_variance,
                agreed_unit_price,
                charged_unit_price,
                price_variance,
                financial_exposure,
                risk_score
            )
            VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s
            )
            """,
            (
                invoice_id,
                po["id"],
                vendor_id,
                audit["audit_status"],
                audit["discrepancy_reason"],
                audit["expected_quantity"],
                audit["delivered_quantity"],
                audit["quantity_variance"],
                audit["agreed_unit_price"],
                audit["charged_unit_price"],
                audit["price_variance"],
                audit["financial_exposure"],
                audit["risk_score"],
            ),
        )

        audit_id = cursor.lastrowid

        # -----------------------------------------------------
        # 8. Mark invoice audited
        # -----------------------------------------------------

        cursor.execute(
            """
            UPDATE invoices
            SET status = 'audited'
            WHERE id = %s
            """,
            (invoice_id,),
        )

        # -----------------------------------------------------
        # 9. Commit entire transaction
        # -----------------------------------------------------

        db.commit()

        # -----------------------------------------------------
        # 10. Return complete result for frontend
        # -----------------------------------------------------

        return {
            "invoice": {
                "id": invoice_id,
                "invoice_number": invoice_number,
                "po_id": po_number,
                "vendor_id": vendor_id,
                "status": "audited",
            },

            "extracted": {
                "po_id": extracted["po_id"],
                "item_name": extracted["item_name"],
                "quantity_delivered": extracted[
                    "quantity_delivered"
                ],
                "unit_price_charged": extracted[
                    "unit_price_charged"
                ],
            },

            "po": {
                "po_id": po["po_number"],
                "item_name": po["item_name"],
                "expected_quantity": float(
                    po["expected_quantity"]
                ),
                "agreed_unit_price": float(
                    po["agreed_unit_price"]
                ),
            },

            "audit": {
                "audit_id": audit_id,
                **audit,
            },
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise

    finally:
        cursor.close()
        db.close()
