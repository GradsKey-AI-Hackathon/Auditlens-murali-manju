import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv

from backend.database import get_db
from backend.schemas import (
    BuyerSignupRequest,
    VendorSignupRequest,
    LoginRequest,
)

load_dotenv("/home/hackathon/.env")


# =========================================================
# CONFIGURATION
# =========================================================

JWT_SECRET = os.getenv("JWT_SECRET")

if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET is not configured in .env")

JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 12

security = HTTPBearer()


# =========================================================
# PASSWORD FUNCTIONS
# =========================================================

def hash_password(password: str) -> str:
    """
    Hash a plaintext password using bcrypt.
    """

    password_bytes = password.encode("utf-8")

    hashed = bcrypt.hashpw(
        password_bytes,
        bcrypt.gensalt()
    )

    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """
    Verify a plaintext password against a bcrypt hash.
    """

    return bcrypt.checkpw(
        password.encode("utf-8"),
        password_hash.encode("utf-8")
    )


# =========================================================
# JWT FUNCTIONS
# =========================================================

def create_access_token(user_id: int, role: str) -> str:
    """
    Create JWT containing user ID and role.
    """

    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc)
        + timedelta(hours=JWT_EXPIRATION_HOURS),
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> dict:
    """
    Decode and validate JWT.
    """

    try:

        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
        )

        return payload

    except jwt.ExpiredSignatureError:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired",
        )

    except jwt.InvalidTokenError:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )


# =========================================================
# GET CURRENT USER
# =========================================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Extract and validate the current user from
    Authorization: Bearer <token>
    """

    token = credentials.credentials

    payload = decode_access_token(token)

    user_id = payload.get("user_id")
    role = payload.get("role")

    if not user_id or not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    return {
        "user_id": user_id,
        "role": role,
    }


# =========================================================
# BUYER SIGNUP
# =========================================================

def signup_buyer(data: BuyerSignupRequest):

    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:

        # Check whether email already exists
        cursor.execute(
            """
            SELECT id
            FROM buyers
            WHERE email = %s
            """,
            (data.email,),
        )

        existing_buyer = cursor.fetchone()

        if existing_buyer:

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Buyer email is already registered",
            )

        password_hash = hash_password(data.password)

        cursor.execute(
            """
            INSERT INTO buyers
            (
                name,
                email,
                phone,
                password_hash
            )
            VALUES (%s, %s, %s, %s)
            """,
            (
                data.name,
                data.email,
                data.phone,
                password_hash,
            ),
        )

        db.commit()

        buyer_id = cursor.lastrowid

        token = create_access_token(
            buyer_id,
            "BUYER",
        )

        return {
            "message": "Buyer account created successfully",
            "user_id": buyer_id,
            "role": "BUYER",
            "token": token,
        }

    finally:

        cursor.close()
        db.close()


# =========================================================
# VENDOR SIGNUP
# =========================================================

def signup_vendor(data: VendorSignupRequest):

    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:

        # Check whether email already exists
        cursor.execute(
            """
            SELECT id
            FROM vendors
            WHERE email = %s
            """,
            (data.email,),
        )

        existing_vendor = cursor.fetchone()

        if existing_vendor:

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Vendor email is already registered",
            )

        password_hash = hash_password(data.password)

        cursor.execute(
            """
            INSERT INTO vendors
            (
                business_name,
                owner_name,
                email,
                phone,
                address,
                password_hash
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                data.business_name,
                data.owner_name,
                data.email,
                data.phone,
                data.address,
                password_hash,
            ),
        )

        db.commit()

        vendor_id = cursor.lastrowid

        token = create_access_token(
            vendor_id,
            "VENDOR",
        )

        return {
            "message": "Vendor account created successfully",
            "user_id": vendor_id,
            "role": "VENDOR",
            "token": token,
        }

    finally:

        cursor.close()
        db.close()


# =========================================================
# LOGIN
# =========================================================

def login(data: LoginRequest):

    role = data.role.upper()

    if role not in ("BUYER", "VENDOR"):

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be BUYER or VENDOR",
        )

    table = "buyers" if role == "BUYER" else "vendors"

    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:

        cursor.execute(
            f"""
            SELECT *
            FROM {table}
            WHERE email = %s
            """,
            (data.email,),
        )

        user = cursor.fetchone()

        if not user:

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        if not verify_password(
            data.password,
            user["password_hash"],
        ):

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        # Check account status
        if user["status"] == "blocked":

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is blocked",
            )

        # Vendor accounts require approval
        if role == "VENDOR" and user["status"] != "approved":

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Vendor account is awaiting approval",
            )

        token = create_access_token(
            user["id"],
            role,
        )

        return {
            "message": "Login successful",
            "user_id": user["id"],
            "role": role,
            "token": token,
        }

    finally:

        cursor.close()
        db.close()


# =========================================================
# CURRENT USER DETAILS
# =========================================================

def get_me(current_user: dict):

    user_id = current_user["user_id"]
    role = current_user["role"]

    table = "buyers" if role == "BUYER" else "vendors"

    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:

        cursor.execute(
            f"""
            SELECT *
            FROM {table}
            WHERE id = %s
            """,
            (user_id,),
        )

        user = cursor.fetchone()

        if not user:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        # Never return password hash
        user.pop("password_hash", None)

        return {
            "user": user,
            "role": role,
        }

    finally:

        cursor.close()
        db.close()
