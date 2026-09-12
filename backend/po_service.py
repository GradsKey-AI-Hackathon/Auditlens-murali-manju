from fastapi import HTTPException

from backend.database import get_db


def generate_po_number(cursor):
    cursor.execute(
        """
        SELECT po_number
        FROM purchase_orders
        ORDER BY id DESC
        LIMIT 1
        """
    )

    row = cursor.fetchone()

    if not row:
        return "PO-20260912-0001"

    last_number = row["po_number"].split("-")[-1]

    try:
        next_number = int(last_number) + 1
    except ValueError:
        next_number = 1

    return f"PO-20260912-{next_number:04d}"


def create_purchase_order(
    buyer_id: int,
    vendor_id: int,
    item_name: str,
    expected_quantity: float,
    agreed_unit_price: float,
):
    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        # Verify vendor exists
        cursor.execute(
            """
            SELECT id, business_name, status
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

        if vendor["status"] != "approved":
            raise HTTPException(
                status_code=400,
                detail="Vendor is not approved",
            )

        po_number = generate_po_number(cursor)

        cursor.execute(
            """
            INSERT INTO purchase_orders (
                po_number,
                buyer_id,
                vendor_id,
                item_name,
                expected_quantity,
                agreed_unit_price,
                status
            )
            VALUES (%s, %s, %s, %s, %s, %s, 'pending')
            """,
            (
                po_number,
                buyer_id,
                vendor_id,
                item_name,
                expected_quantity,
                agreed_unit_price,
            ),
        )

        db.commit()

        po_id = cursor.lastrowid

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
            WHERE id = %s
            """,
            (po_id,),
        )

        return cursor.fetchone()

    finally:
        cursor.close()
        db.close()


def get_buyer_purchase_orders(buyer_id: int):
    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT
                po.id,
                po.po_number,
                po.buyer_id,
                po.vendor_id,
                v.business_name AS vendor_name,
                po.item_name,
                po.expected_quantity,
                po.agreed_unit_price,
                po.status,
                po.created_at,
                po.updated_at
            FROM purchase_orders po
            JOIN vendors v
                ON po.vendor_id = v.id
            WHERE po.buyer_id = %s
            ORDER BY po.created_at DESC
            """,
            (buyer_id,),
        )

        return cursor.fetchall()

    finally:
        cursor.close()
        db.close()


def get_purchase_order(po_number: str, user_id: int, role: str):
    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT
                po.id,
                po.po_number,
                po.buyer_id,
                po.vendor_id,
                v.business_name AS vendor_name,
                po.item_name,
                po.expected_quantity,
                po.agreed_unit_price,
                po.status,
                po.created_at,
                po.updated_at
            FROM purchase_orders po
            JOIN vendors v
                ON po.vendor_id = v.id
            WHERE po.po_number = %s
            """,
            (po_number,),
        )

        po = cursor.fetchone()

        if not po:
            raise HTTPException(
                status_code=404,
                detail="Purchase order not found",
            )

        if role == "BUYER" and po["buyer_id"] != user_id:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this purchase order",
            )

        if role == "VENDOR" and po["vendor_id"] != user_id:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this purchase order",
            )

        return po

    finally:
        cursor.close()
        db.close()


def get_vendor_purchase_orders(vendor_id: int):
    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT
                po.id,
                po.po_number,
                po.buyer_id,
                b.name AS buyer_name,
                po.vendor_id,
                po.item_name,
                po.expected_quantity,
                po.agreed_unit_price,
                po.status,
                po.created_at,
                po.updated_at
            FROM purchase_orders po
            JOIN buyers b
                ON po.buyer_id = b.id
            WHERE po.vendor_id = %s
            ORDER BY po.created_at DESC
            """,
            (vendor_id,),
        )

        return cursor.fetchall()

    finally:
        cursor.close()
        db.close()


def accept_purchase_order(po_number: str, vendor_id: int):
    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
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

        if po["status"] != "pending":
            raise HTTPException(
                status_code=400,
                detail=f"Purchase order is already {po['status']}",
            )

        cursor.execute(
            """
            UPDATE purchase_orders
            SET status = 'accepted'
            WHERE id = %s
            """,
            (po["id"],),
        )

        db.commit()

        po["status"] = "accepted"

        return po

    finally:
        cursor.close()
        db.close()
