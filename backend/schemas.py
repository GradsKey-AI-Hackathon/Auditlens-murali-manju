from pydantic import BaseModel, EmailStr, Field


# ---------------------------------------------------------
# AUTH
# ---------------------------------------------------------

class BuyerSignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    phone: str | None = None
    password: str = Field(min_length=6, max_length=128)


class VendorSignupRequest(BaseModel):
    business_name: str = Field(min_length=2, max_length=150)
    owner_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(min_length=5, max_length=20)
    address: str | None = None
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    role: str


# ---------------------------------------------------------
# PURCHASE ORDERS
# ---------------------------------------------------------

class PurchaseOrderCreate(BaseModel):
    vendor_id: int
    item_name: str = Field(min_length=1, max_length=255)
    expected_quantity: float = Field(gt=0)
    agreed_unit_price: float = Field(gt=0)


class PurchaseOrderResponse(BaseModel):
    id: int
    po_number: str
    buyer_id: int
    vendor_id: int
    item_name: str
    expected_quantity: float
    agreed_unit_price: float
    status: str


# ---------------------------------------------------------
# INVOICES
# ---------------------------------------------------------

class InvoiceSubmitRequest(BaseModel):
    po_id: str
    raw_text: str = Field(min_length=10)


class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    po_id: str
    vendor_id: int
    status: str


# ---------------------------------------------------------
# AI EXTRACTION
# ---------------------------------------------------------

class InvoiceExtraction(BaseModel):
    po_id: str | None = None
    item_name: str | None = None
    quantity_delivered: float | None = None
    unit_price_charged: float | None = None


# ---------------------------------------------------------
# AUDIT RESULT
# ---------------------------------------------------------

class AuditResult(BaseModel):
    audit_id: int
    invoice_id: int
    po_id: str
    audit_status: str
    discrepancy_reason: str | None = None

    expected_quantity: float
    delivered_quantity: float
    quantity_variance: float

    agreed_unit_price: float
    charged_unit_price: float
    price_variance: float

    financial_exposure: float
    risk_score: float | None = None
