from typing import Any


def audit_invoice(
    expected_quantity: float,
    delivered_quantity: float,
    agreed_unit_price: float,
    charged_unit_price: float,
    expected_item_name: str | None = None,
    extracted_item_name: str | None = None,
) -> dict[str, Any]:

    discrepancies = []

    # ---------------------------------------------------------
    # QUANTITY CHECK
    # ---------------------------------------------------------

    quantity_variance = delivered_quantity - expected_quantity

    if delivered_quantity < expected_quantity:
        discrepancies.append(
            "Delivered quantity is lower than PO quantity."
        )

    # ---------------------------------------------------------
    # PRICE CHECK
    # ---------------------------------------------------------

    price_variance = charged_unit_price - agreed_unit_price

    if charged_unit_price > agreed_unit_price:
        discrepancies.append(
            "Charged unit price exceeds the agreed PO price."
        )

    # ---------------------------------------------------------
    # ITEM CHECK
    # ---------------------------------------------------------

    if (
        expected_item_name
        and extracted_item_name
        and expected_item_name.strip().lower()
        != extracted_item_name.strip().lower()
    ):
        discrepancies.append(
            "Invoice item does not match the PO item."
        )

    # ---------------------------------------------------------
    # FINANCIAL EXPOSURE
    # ---------------------------------------------------------

    shortage_quantity = max(
        expected_quantity - delivered_quantity,
        0,
    )

    shortage_value = (
        shortage_quantity * agreed_unit_price
    )

    overcharge_per_unit = max(
        charged_unit_price - agreed_unit_price,
        0,
    )

    overcharge_value = (
        overcharge_per_unit * delivered_quantity
    )

    financial_exposure = (
        shortage_value + overcharge_value
    )

    # ---------------------------------------------------------
    # AUDIT STATUS
    # ---------------------------------------------------------

    audit_status = (
        "DISCREPANCY"
        if discrepancies
        else "CLEAR"
    )

    discrepancy_reason = (
        " ".join(discrepancies)
        if discrepancies
        else None
    )

    # ---------------------------------------------------------
    # TRANSPARENT RISK SCORE
    # ---------------------------------------------------------
    #
    # This is a deterministic MVP risk indicator,
    # not a statistically calibrated probability.
    #

    risk_score = 0.0

    if delivered_quantity < expected_quantity:
        shortage_ratio = (
            (expected_quantity - delivered_quantity)
            / expected_quantity
        )

        risk_score += min(
            shortage_ratio * 50,
            50,
        )

    if charged_unit_price > agreed_unit_price:
        price_ratio = (
            (charged_unit_price - agreed_unit_price)
            / agreed_unit_price
        )

        risk_score += min(
            price_ratio * 50,
            50,
        )

    if (
        expected_item_name
        and extracted_item_name
        and expected_item_name.strip().lower()
        != extracted_item_name.strip().lower()
    ):
        risk_score += 25

    risk_score = min(round(risk_score, 2), 100)

    return {
        "audit_status": audit_status,
        "discrepancy_reason": discrepancy_reason,

        "expected_quantity": expected_quantity,
        "delivered_quantity": delivered_quantity,
        "quantity_variance": quantity_variance,

        "agreed_unit_price": agreed_unit_price,
        "charged_unit_price": charged_unit_price,
        "price_variance": price_variance,

        "financial_exposure": round(
            financial_exposure,
            2,
        ),

        "risk_score": risk_score,
    }
