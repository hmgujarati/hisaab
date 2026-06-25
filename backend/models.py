"""Pydantic models for RapidXT Hisaab."""
from __future__ import annotations
from datetime import datetime, date
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict, EmailStr
import uuid


def new_id() -> str:
    return str(uuid.uuid4())


# ---------- Auth / Users ----------
class LoginIn(BaseModel):
    identifier: str  # email OR mobile
    password: str


class ForgotPasswordIn(BaseModel):
    identifier: str


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


# ---------- Businesses ----------
class BusinessCreate(BaseModel):
    business_name: str
    owner_name: str
    mobile: str
    email: EmailStr
    password: str
    plan_start_date: str  # ISO date string YYYY-MM-DD
    plan_expiry_date: str
    status: Literal["active", "suspended"] = "active"


class BusinessUpdate(BaseModel):
    business_name: Optional[str] = None
    owner_name: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[EmailStr] = None
    plan_start_date: Optional[str] = None
    plan_expiry_date: Optional[str] = None
    status: Optional[Literal["active", "suspended", "expired"]] = None


class ExtendExpiryIn(BaseModel):
    new_expiry_date: str


class StatusChangeIn(BaseModel):
    status: Literal["active", "suspended"]


class AdminResetPasswordIn(BaseModel):
    new_password: str


# ---------- SMTP ----------
class SmtpSettingsIn(BaseModel):
    host: str
    port: int = 587
    username: str
    password: str
    encryption: Literal["TLS", "SSL", "NONE"] = "TLS"
    from_email: EmailStr
    from_name: str = "RapidXT Hisaab"


# ---------- Projects ----------
WorkType = Literal["Interior", "Painting", "POP", "Furniture", "Civil", "Colour", "Other"]
ProjectStatus = Literal["Ongoing", "Hold", "Completed", "Cancelled"]


class ProjectCreate(BaseModel):
    project_name: str
    client_id: str
    site_address: Optional[str] = ""
    work_type: WorkType = "Interior"
    reference_id: Optional[str] = None
    start_date: Optional[str] = None
    expected_completion_date: Optional[str] = None
    status: ProjectStatus = "Ongoing"
    original_value: float = 0.0
    notes: Optional[str] = ""


class ProjectUpdate(BaseModel):
    project_name: Optional[str] = None
    client_id: Optional[str] = None
    site_address: Optional[str] = None
    work_type: Optional[WorkType] = None
    reference_id: Optional[str] = None
    start_date: Optional[str] = None
    expected_completion_date: Optional[str] = None
    status: Optional[ProjectStatus] = None
    original_value: Optional[float] = None
    notes: Optional[str] = None


# ---------- Clients ----------
class ClientIn(BaseModel):
    name: str
    mobile: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    gst: Optional[str] = ""
    notes: Optional[str] = ""


# ---------- Parties (Supplier / Worker etc) ----------
PartyType = Literal[
    "Supplier", "Worker", "Labour Contractor", "Carpenter", "Painter",
    "Electrician", "Plumber", "Designer", "Contractor", "Other"
]


class PartyIn(BaseModel):
    name: str
    mobile: Optional[str] = ""
    email: Optional[str] = ""
    type: PartyType = "Supplier"
    address: Optional[str] = ""
    notes: Optional[str] = ""


# ---------- References ----------
RefType = Literal["Architect", "Builder", "Broker", "Old Client", "Direct", "Other"]


class ReferenceIn(BaseModel):
    name: str
    mobile: Optional[str] = ""
    type: RefType = "Direct"
    commission_type: Literal["amount", "percentage", "none"] = "none"
    commission_value: float = 0.0
    notes: Optional[str] = ""


# ---------- Transactions ----------
TxType = Literal["received", "paid"]
PartyKind = Literal["client", "supplier", "worker", "reference", "other"]
TxCategory = Literal[
    "Labour", "Material", "Commission", "Transport",
    "Advance", "Final Payment", "Other"
]
PaymentMode = Literal["Cash", "UPI", "Bank", "Cheque", "Other"]


class TransactionIn(BaseModel):
    project_id: Optional[str] = None
    party_kind: PartyKind = "other"
    party_id: Optional[str] = None
    type: TxType
    category: TxCategory = "Other"
    amount: float
    payment_mode: PaymentMode = "Cash"
    date: str  # ISO date
    notes: Optional[str] = ""
    bill_url: Optional[str] = None


# ---------- Extra Work ----------
class ExtraWorkIn(BaseModel):
    title: str
    description: Optional[str] = ""
    amount: float = 0.0
    date: str
    approval_status: Literal["Pending", "Approved", "Rejected"] = "Pending"
    payment_status: Literal["Pending", "Partially Paid", "Paid"] = "Pending"
    attachment_url: Optional[str] = None
    notes: Optional[str] = ""


# ---------- Stages ----------
class StageMasterIn(BaseModel):
    name: str
    display_order: int = 0
    active: bool = True


class StageReorderIn(BaseModel):
    ordered_ids: List[str]


class StageUpdateIn(BaseModel):
    stage_id: str
    stage_name: str
    notes: Optional[str] = ""
    photo_url: Optional[str] = None


# ---------- Materials ----------
class MaterialIn(BaseModel):
    name: str
    category: Optional[str] = ""
    supplier_id: Optional[str] = None
    quantity_purchased: float = 0.0
    unit: str = "piece"
    rate: float = 0.0
    total_amount: float = 0.0
    bill_url: Optional[str] = None
    purchase_date: str
    quantity_used: float = 0.0
    notes: Optional[str] = ""


# ---------- Documents ----------
DocCategory = Literal[
    "Quotation", "Final Bill", "Payment Receipts", "Bill Photos",
    "Site Photos", "Client Approvals", "Extra Work Approvals",
    "Drawings", "Measurement Sheets", "Handover Photos", "Other"
]


class DocumentIn(BaseModel):
    title: str
    category: DocCategory = "Other"
    file_url: str
    file_type: Optional[str] = ""
    notes: Optional[str] = ""


# ---------- Reminders ----------
ReminderType = Literal[
    "Client Payment", "Supplier Payment", "Worker Payment",
    "Commission", "Extra Work Payment", "Project Deadline", "Final Payment"
]
ReminderStatus = Literal["Pending", "Completed", "Cancelled"]


class ReminderIn(BaseModel):
    title: str
    project_id: Optional[str] = None
    party_kind: Optional[PartyKind] = None
    party_id: Optional[str] = None
    amount: Optional[float] = 0.0
    due_date: str
    type: ReminderType = "Client Payment"
    status: ReminderStatus = "Pending"
    notes: Optional[str] = ""
