# server/payments.py
import os
import base64
import httpx
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

# Import your database session dependency & models
# from database import get_db
# from models import Student, PaymentTransaction, StudentFeeStatement

router = APIRouter(prefix="/api/v1/payments", tags=["payments"])

# --- Environment Configurations ---
MPESA_ENV = os.getenv("MPESA_ENV", "sandbox")  # "sandbox" or "production"
CONSUMER_KEY = os.getenv("MPESA_CONSUMER_KEY", "your_consumer_key")
CONSUMER_SECRET = os.getenv("MPESA_CONSUMER_SECRET", "your_consumer_secret")
BUSINESS_SHORTCODE = os.getenv("MPESA_SHORTCODE", "174379")
PASSKEY = os.getenv("MPESA_PASSKEY", "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919")
CALLBACK_URL = os.getenv("MPESA_CALLBACK_URL", "https://yourdomain.com/api/v1/payments/mpesa/callback")

BASE_URL = (
    "https://sandbox.safaricom.co.ke"
    if MPESA_ENV == "sandbox"
    else "https://api.safaricom.co.ke"
)

# --- In-Memory Status Cache (Use Redis or DB in production) ---
TRANSACTION_CACHE: Dict[str, Dict[str, Any]] = {}

# --- Pydantic Schemas ---
class STKPushRequestSchema(BaseModel):
    studentId: str
    phoneNumber: str = Field(..., example="254712345678")
    amount: float = Field(..., gt=0)

class STKPushResponseSchema(BaseModel):
    checkoutRequestId: str
    merchantRequestId: str
    responseDescription: str

class PaymentStatusResponseSchema(BaseModel):
    checkoutRequestId: str
    status: str
    receiptNumber: Optional[str] = None
    failureReason: Optional[str] = None


# --- Helper Utilities ---
async def get_mpesa_access_token() -> str:
    """Generates an OAuth 2.0 access token from Daraja API."""
    auth_string = f"{CONSUMER_KEY}:{CONSUMER_SECRET}"
    encoded_auth = base64.b64encode(auth_string.encode()).decode("utf-8")
    
    headers = {"Authorization": f"Basic {encoded_auth}"}
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{BASE_URL}/oauth/v1/generate?grant_type=client_credentials", 
            headers=headers
        )
        if res.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY, 
                detail="Failed to authenticate with M-Pesa Daraja service"
            )
        return res.json().get("access_token")

def format_phone_number(phone: str) -> str:
    """Normalizes phone numbers to Kenya 254XXXXXXXXX format."""
    cleaned = "".join(filter(str.isdigit, phone))
    if cleaned.startswith("0"):
        return f"254{cleaned[1:]}"
    elif cleaned.startswith("7") or cleaned.startswith("1"):
        return f"254{cleaned}"
    elif cleaned.startswith("254") and len(cleaned) == 12:
        return cleaned
    raise HTTPException(status_code=400, detail="Invalid Kenyan phone number format")


# --- Endpoints ---

@router.get("/students/{student_id}/statement")
async def get_student_fee_statement(student_id: str):
    """
    Returns the student's fee summary and itemized breakdown.
    (Replace mock data with SQLAlchemy queries as needed).
    """
    return {
        "studentId": student_id,
        "studentName": "John Doe",
        "admissionNumber": "ADM-2024-0042",
        "totalInvoiced": 45000,
        "totalPaid": 30000,
        "outstandingBalance": 15000,
        "dueDate": "2026-09-15",
        "breakdown": [
            {"id": "1", "category": "Tuition", "title": "Term 3 Tuition Fee", "amountDue": 25000, "amountPaid": 25000},
            {"id": "2", "category": "Boarding", "title": "Term 3 Boarding & Meals", "amountDue": 15000, "amountPaid": 5000},
            {"id": "3", "category": "Transport", "title": "Route B Bus Service", "amountDue": 5000, "amountPaid": 0},
        ]
    }


@router.get("/students/{student_id}/history")
async def get_payment_history(student_id: str, query: Optional[str] = None):
    """Returns paginated payment transactions for a given student."""
    history = [
        {"id": "tx-101", "receiptNumber": "REC-99482", "date": "2026-08-10", "amount": 20000, "paymentMethod": "M-PESA", "reference": "QK78XX91A", "status": "COMPLETED"},
        {"id": "tx-102", "receiptNumber": "REC-99105", "date": "2026-08-01", "amount": 10000, "paymentMethod": "M-PESA", "reference": "QK12YY82B", "status": "COMPLETED"},
    ]
    if query:
        history = [tx for tx in history if query.lower() in tx["reference"].lower() or query.lower() in tx["receiptNumber"].lower()]
    return history


@router.post("/mpesa/stk-push", response_model=STKPushResponseSchema)
async def initiate_stk_push(payload: STKPushRequestSchema):
    """Initiates Lipa Na M-Pesa STK Push to the user's phone."""
    token = await get_mpesa_access_token()
    formatted_phone = format_phone_number(payload.phoneNumber)
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    
    raw_password = f"{BUSINESS_SHORTCODE}{PASSKEY}{timestamp}"
    password = base64.b64encode(raw_password.encode()).decode("utf-8")

    stk_payload = {
        "BusinessShortCode": BUSINESS_SHORTCODE,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": int(payload.amount),
        "PartyA": formatted_phone,
        "PartyB": BUSINESS_SHORTCODE,
        "PhoneNumber": formatted_phone,
        "CallBackURL": CALLBACK_URL,
        "AccountReference": f"FEES-{payload.studentId}",
        "TransactionDesc": f"Fee Payment for Student {payload.studentId}",
    }

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    async with httpx.AsyncClient() as client:
        res = await client.post(f"{BASE_URL}/mpesa/stkpush/v1/processrequest", json=stk_payload, headers=headers)
        res_data = res.json()

        if res.status_code != 200 or res_data.get("ResponseCode") != "0":
            raise HTTPException(status_code=400, detail=res_data.get("ResponseDescription", "STK Push failed"))

        checkout_id = res_data["CheckoutRequestID"]
        
        # Initialize transaction status in cache
        TRANSACTION_CACHE[checkout_id] = {
            "status": "PENDING",
            "studentId": payload.studentId,
            "amount": payload.amount,
        }

        return {
            "checkoutRequestId": checkout_id,
            "merchantRequestId": res_data["MerchantRequestID"],
            "responseDescription": res_data["ResponseDescription"],
        }


@router.post("/mpesa/callback")
async def mpesa_callback(request: Request, background_tasks: BackgroundTasks):
    """
    Asynchronous Webhook called by Safaricom once user completes or cancels the prompt.
    """
    body = await request.json()
    stk_callback = body.get("Body", {}).get("stkCallback", {})
    
    checkout_id = stk_callback.get("CheckoutRequestID")
    result_code = stk_callback.get("ResultCode")
    result_desc = stk_callback.get("ResultDesc")

    if checkout_id in TRANSACTION_CACHE:
        if result_code == 0:
            # Payment Successful
            metadata = stk_callback.get("CallbackMetadata", {}).get("Item", [])
            receipt_number = next((item["Value"] for item in metadata if item["Name"] == "MpesaReceiptNumber"), None)
            
            TRANSACTION_CACHE[checkout_id].update({
                "status": "COMPLETED",
                "receiptNumber": receipt_number,
            })
            # Background task to persist transaction in DB & update student balance
            # background_tasks.add_task(persist_transaction, checkout_id, TRANSACTION_CACHE[checkout_id])
        else:
            # Payment Cancelled/Failed (ResultCode 1032 = User Cancelled, etc.)
            TRANSACTION_CACHE[checkout_id].update({
                "status": "FAILED",
                "failureReason": result_desc,
            })

    return {"ResultCode": 0, "ResultDesc": "Accepted"}


@router.get("/mpesa/status/{checkout_request_id}", response_model=PaymentStatusResponseSchema)
async def check_payment_status(checkout_request_id: str):
    """Polled by the frontend (`usePaymentStatus` hook) to verify payment completion."""
    tx = TRANSACTION_CACHE.get(checkout_request_id)
    if not tx:
        return {
            "checkoutRequestId": checkout_request_id,
            "status": "PENDING",
        }
    
    return {
        "checkoutRequestId": checkout_request_id,
        "status": tx.get("status", "PENDING"),
        "receiptNumber": tx.get("receiptNumber"),
        "failureReason": tx.get("failureReason"),
    }