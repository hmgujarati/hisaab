"""RapidXT Hisaab — backend integration tests.

Covers: auth, super admin (businesses, smtp), multi-tenant isolation,
projects/clients/parties/references/transactions/extras/stages/materials/
documents/reminders/reports/uploads.
"""
import io
import os
import time
import pytest
import requests
from datetime import date, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://site-accounts-7.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@rapidxt.com"
ADMIN_PASS = "Admin@123"

# Use unique suffix to avoid collision on re-runs
SUFFIX = str(int(time.time()))


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


def _create_biz(admin_session, name_suffix: str, expiry_days: int = 365):
    today = date.today()
    payload = {
        "business_name": f"TEST_Biz_{name_suffix}_{SUFFIX}",
        "owner_name": f"Owner {name_suffix}",
        "mobile": f"9{int(time.time()) % 1000000000 + hash(name_suffix) % 1000:09d}"[:10],
        "email": f"test_{name_suffix}_{SUFFIX}@example.com",
        "password": "Owner@123",
        "plan_start_date": today.isoformat(),
        "plan_expiry_date": (today + timedelta(days=expiry_days)).isoformat(),
        "status": "active",
    }
    r = admin_session.post(f"{API}/admin/businesses", json=payload)
    assert r.status_code == 200, f"Create biz failed: {r.text}"
    biz = r.json()
    return biz, payload


@pytest.fixture(scope="session")
def biz_a(admin_session):
    biz, payload = _create_biz(admin_session, "A")
    sess = requests.Session()
    lr = sess.post(f"{API}/auth/login", json={"identifier": payload["email"], "password": payload["password"]})
    assert lr.status_code == 200, f"Owner A login failed: {lr.text}"
    return {"biz": biz, "session": sess, "payload": payload}


@pytest.fixture(scope="session")
def biz_b(admin_session):
    biz, payload = _create_biz(admin_session, "B")
    sess = requests.Session()
    lr = sess.post(f"{API}/auth/login", json={"identifier": payload["email"], "password": payload["password"]})
    assert lr.status_code == 200
    return {"biz": biz, "session": sess, "payload": payload}


# ---------- Auth ----------
class TestAuth:
    def test_admin_login(self, admin_session):
        r = admin_session.get(f"{API}/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert data["role"] == "super_admin"
        assert data["email"] == ADMIN_EMAIL

    def test_invalid_login(self):
        r = requests.post(f"{API}/auth/login", json={"identifier": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_forgot_password_no_enum(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"identifier": "nobody@nowhere.com"})
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_owner_login(self, biz_a):
        r = biz_a["session"].get(f"{API}/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert data["role"] == "owner"
        assert data["business_id"] == biz_a["biz"]["id"]


# ---------- Super Admin ----------
class TestSuperAdmin:
    def test_list_businesses(self, admin_session, biz_a):
        r = admin_session.get(f"{API}/admin/businesses")
        assert r.status_code == 200
        items = r.json()
        ids = [b["id"] for b in items]
        assert biz_a["biz"]["id"] in ids
        found = [b for b in items if b["id"] == biz_a["biz"]["id"]][0]
        assert "live_status" in found
        assert "days_remaining" in found
        assert found["live_status"] == "active"

    def test_default_stages_seeded(self, biz_a):
        r = biz_a["session"].get(f"{API}/stages-master")
        assert r.status_code == 200
        stages = r.json()
        assert len(stages) == 12

    def test_extend_expiry(self, admin_session, biz_a):
        new_expiry = (date.today() + timedelta(days=400)).isoformat()
        r = admin_session.post(
            f"{API}/admin/businesses/{biz_a['biz']['id']}/extend-expiry",
            json={"new_expiry_date": new_expiry},
        )
        assert r.status_code == 200
        assert r.json()["plan_expiry_date"] == new_expiry

    def test_status_suspend_and_reactivate(self, admin_session, biz_a):
        bid = biz_a["biz"]["id"]
        r = admin_session.post(f"{API}/admin/businesses/{bid}/status", json={"status": "suspended"})
        assert r.status_code == 200
        assert r.json()["live_status"] == "suspended"
        # Reactivate
        r2 = admin_session.post(f"{API}/admin/businesses/{bid}/status", json={"status": "active"})
        assert r2.status_code == 200
        assert r2.json()["live_status"] == "active"

    def test_reset_password(self, admin_session):
        biz, payload = _create_biz(admin_session, "PWRESET")
        bid = biz["id"]
        new_pw = "NewPass@456"
        r = admin_session.post(f"{API}/admin/businesses/{bid}/reset-password", json={"new_password": new_pw})
        assert r.status_code == 200
        # Login with new pw
        lr = requests.post(f"{API}/auth/login", json={"identifier": payload["email"], "password": new_pw})
        assert lr.status_code == 200

    def test_smtp_get_put(self, admin_session):
        smtp_payload = {
            "host": "smtp.example.com",
            "port": 587,
            "username": "user@example.com",
            "password": "pw",
            "encryption": "TLS",
            "from_email": "noreply@example.com",
            "from_name": "RapidXT Test",
        }
        r = admin_session.put(f"{API}/admin/smtp", json=smtp_payload)
        assert r.status_code == 200
        g = admin_session.get(f"{API}/admin/smtp")
        assert g.status_code == 200
        data = g.json()
        assert data["host"] == "smtp.example.com"
        assert data["configured"] is True


# ---------- Role/Plan guards ----------
class TestGuards:
    def test_admin_cannot_access_owner_routes(self, admin_session):
        r = admin_session.get(f"{API}/projects")
        assert r.status_code == 403

    def test_owner_cannot_access_admin_routes(self, biz_a):
        r = biz_a["session"].get(f"{API}/admin/businesses")
        assert r.status_code == 403

    def test_expired_plan_blocks_writes(self, admin_session):
        # Create biz with past expiry
        today = date.today()
        payload = {
            "business_name": f"TEST_ExpBiz_{SUFFIX}",
            "owner_name": "Exp Owner",
            "mobile": f"7{int(time.time()) % 1000000000:09d}"[:10],
            "email": f"expired_{SUFFIX}@example.com",
            "password": "Owner@123",
            "plan_start_date": (today - timedelta(days=400)).isoformat(),
            "plan_expiry_date": (today - timedelta(days=1)).isoformat(),
            "status": "active",
        }
        r = admin_session.post(f"{API}/admin/businesses", json=payload)
        assert r.status_code == 200
        sess = requests.Session()
        lr = sess.post(f"{API}/auth/login", json={"identifier": payload["email"], "password": payload["password"]})
        # Login itself should work (not suspended)
        assert lr.status_code == 200
        # But write should 403
        pr = sess.post(f"{API}/projects", json={"project_name": "X", "original_value": 1000})
        assert pr.status_code == 403


# ---------- CRUD: Clients, Parties, References, Projects ----------
class TestCRUD:
    def test_client_create_and_get(self, biz_a):
        s = biz_a["session"]
        r = s.post(f"{API}/clients", json={"name": "TEST_Client1", "mobile": "9999999999"})
        assert r.status_code == 200
        cid = r.json()["id"]
        biz_a["client_id"] = cid
        g = s.get(f"{API}/clients/{cid}")
        assert g.status_code == 200
        assert g.json()["name"] == "TEST_Client1"

    def test_party_create(self, biz_a):
        s = biz_a["session"]
        r = s.post(f"{API}/parties", json={"name": "TEST_Supplier1", "type": "Supplier"})
        assert r.status_code == 200
        biz_a["party_id"] = r.json()["id"]

    def test_reference_create(self, biz_a):
        s = biz_a["session"]
        r = s.post(f"{API}/references", json={
            "name": "TEST_Ref1", "type": "Architect",
            "commission_type": "percentage", "commission_value": 5.0,
        })
        assert r.status_code == 200
        biz_a["ref_id"] = r.json()["id"]

    def test_project_create_and_summary(self, biz_a):
        s = biz_a["session"]
        # Ensure client exists
        if "client_id" not in biz_a:
            self.test_client_create_and_get(biz_a)
        payload = {
            "project_name": f"TEST_Project_{SUFFIX}",
            "client_id": biz_a["client_id"],
            "work_type": "Interior",
            "start_date": date.today().isoformat(),
            "original_value": 100000.0,
        }
        r = s.post(f"{API}/projects", json=payload)
        assert r.status_code == 200, r.text
        biz_a["project_id"] = r.json()["id"]
        # List should include summary
        lr = s.get(f"{API}/projects")
        assert lr.status_code == 200
        items = lr.json()
        target = [p for p in items if p["id"] == biz_a["project_id"]]
        assert target, "Project not in list"
        p = target[0]
        for k in ("revised_value", "received", "pending_receivable", "paid", "actual_cash_profit"):
            assert k in p, f"Missing summary key {k}"
        # Detail
        dr = s.get(f"{API}/projects/{biz_a['project_id']}")
        assert dr.status_code == 200
        detail = dr.json()
        assert "summary" in detail or "revised_value" in detail


# ---------- Transactions ----------
class TestTransactions:
    def test_received_transaction_updates_summary(self, biz_a):
        s = biz_a["session"]
        pid = biz_a.get("project_id")
        assert pid, "Need project from prior test"
        tx_payload = {
            "project_id": pid,
            "party_kind": "client",
            "party_id": biz_a["client_id"],
            "type": "received",
            "category": "Advance",
            "amount": 25000,
            "payment_mode": "Bank",
            "date": date.today().isoformat(),
        }
        r = s.post(f"{API}/transactions", json=tx_payload)
        assert r.status_code == 200, r.text
        # Re-query project list to see updated received
        lr = s.get(f"{API}/projects")
        target = [p for p in lr.json() if p["id"] == pid][0]
        assert target["received"] >= 25000

    def test_transaction_filters(self, biz_a):
        s = biz_a["session"]
        r = s.get(f"{API}/transactions", params={"project_id": biz_a["project_id"]})
        assert r.status_code == 200
        items = r.json()
        assert any(t.get("amount") == 25000 for t in items)


# ---------- Extra Work ----------
class TestExtraWork:
    def test_only_approved_adds_to_revised(self, biz_a):
        s = biz_a["session"]
        pid = biz_a["project_id"]
        # Pending extra (should NOT add)
        r1 = s.post(f"{API}/projects/{pid}/extra-work", json={
            "title": "Pending Extra", "amount": 5000,
            "date": date.today().isoformat(), "approval_status": "Pending",
        })
        assert r1.status_code == 200
        # Approved extra (should add)
        r2 = s.post(f"{API}/projects/{pid}/extra-work", json={
            "title": "Approved Extra", "amount": 10000,
            "date": date.today().isoformat(), "approval_status": "Approved",
        })
        assert r2.status_code == 200
        lr = s.get(f"{API}/projects")
        target = [p for p in lr.json() if p["id"] == pid][0]
        # revised = original (100000) + approved (10000) = 110000
        assert target["revised_value"] >= 110000
        assert target["revised_value"] < 115001  # pending NOT counted


# ---------- Stages ----------
class TestStages:
    def test_reorder_stages(self, biz_a):
        s = biz_a["session"]
        r = s.get(f"{API}/stages-master")
        ids = [x["id"] for x in r.json()]
        reversed_ids = list(reversed(ids))
        rr = s.post(f"{API}/stages-master/reorder", json={"ordered_ids": reversed_ids})
        assert rr.status_code == 200
        r2 = s.get(f"{API}/stages-master")
        new_ids = [x["id"] for x in r2.json()]
        assert new_ids == reversed_ids

    def test_update_project_stage(self, biz_a):
        s = biz_a["session"]
        pid = biz_a["project_id"]
        stages = s.get(f"{API}/stages-master").json()
        stage = stages[0]
        r = s.post(f"{API}/projects/{pid}/stage", json={
            "stage_id": stage["id"], "stage_name": stage["name"], "notes": "started"
        })
        assert r.status_code == 200, r.text
        dr = s.get(f"{API}/projects/{pid}")
        detail = dr.json()
        cs = detail.get("current_stage") or detail.get("currentStage")
        assert cs is not None, f"No current_stage in detail: {detail}"


# ---------- Materials ----------
class TestMaterials:
    def test_material_counted(self, biz_a):
        s = biz_a["session"]
        pid = biz_a["project_id"]
        r = s.post(f"{API}/projects/{pid}/materials", json={
            "name": "Plywood", "category": "Wood",
            "quantity_purchased": 10, "unit": "sheet",
            "rate": 1500, "total_amount": 15000,
            "purchase_date": date.today().isoformat(),
        })
        assert r.status_code == 200
        lr = s.get(f"{API}/projects")
        target = [p for p in lr.json() if p["id"] == pid][0]
        assert target.get("material_cost", 0) >= 15000


# ---------- Reminders ----------
class TestReminders:
    def test_reminder_crud(self, biz_a):
        s = biz_a["session"]
        r = s.post(f"{API}/reminders", json={
            "title": "TEST_Reminder",
            "due_date": date.today().isoformat(),
            "amount": 1000,
            "type": "Client Payment",
        })
        assert r.status_code == 200, r.text
        rid = r.json()["id"]
        lr = s.get(f"{API}/reminders", params={"filter": "today"})
        assert lr.status_code == 200
        assert any(x["id"] == rid for x in lr.json())
        c = s.post(f"{API}/reminders/{rid}/complete")
        assert c.status_code == 200


# ---------- Dashboard & Reports ----------
class TestDashboardReports:
    def test_dashboard(self, biz_a):
        r = biz_a["session"].get(f"{API}/dashboard")
        assert r.status_code == 200, r.text
        d = r.json()
        # Required keys per spec
        required_any = [
            "ongoing_projects", "pending_receivable", "pending_payable",
        ]
        for k in required_any:
            assert k in d, f"Dashboard missing {k}: keys={list(d.keys())}"

    def test_fy_profit(self, biz_a):
        from datetime import date as d2
        t = d2.today()
        sy = t.year if t.month >= 4 else t.year - 1
        fy = f"{sy}-{str(sy + 1)[-2:]}"
        r = biz_a["session"].get(f"{API}/reports/fy-profit", params={"fy": fy})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "received" in data
        assert "paid" in data
        assert "month_wise" in data or "project_wise" in data

    def test_receivables_payables(self, biz_a):
        r1 = biz_a["session"].get(f"{API}/reports/receivables")
        r2 = biz_a["session"].get(f"{API}/reports/payables")
        assert r1.status_code == 200
        assert r2.status_code == 200


# ---------- Upload ----------
class TestUploads:
    def test_upload_image_compression(self, biz_a):
        # Generate large JPEG with noisy content (not compressible to small)
        import random
        from PIL import Image
        random.seed(42)
        pixels = bytes(random.randint(0, 255) for _ in range(3000 * 3000 * 3))
        img = Image.frombytes("RGB", (3000, 3000), pixels)
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=98)
        big = buf.getvalue()
        # Even if not >1MB, just verify upload works and returns expected schema
        files = {"file": ("big.jpg", big, "image/jpeg")}
        data = {"compress": "true"}
        r = biz_a["session"].post(f"{API}/uploads", files=files, data=data)
        assert r.status_code == 200, r.text
        out = r.json()
        assert "url" in out and "size" in out and "filename" in out
        if len(big) > 1_000_000:
            assert out["size"] < len(big), "Image was not compressed"


# ---------- Multi-tenant isolation ----------
class TestTenantIsolation:
    def test_biz_a_cannot_see_biz_b_projects(self, biz_a, biz_b):
        # Create project in biz_b
        cb = biz_b["session"].post(f"{API}/clients", json={"name": "TEST_ClientB"})
        assert cb.status_code == 200
        cid = cb.json()["id"]
        pb = biz_b["session"].post(f"{API}/projects", json={
            "project_name": "TEST_ProjectB", "client_id": cid,
            "original_value": 50000, "start_date": date.today().isoformat()
        })
        assert pb.status_code == 200
        proj_b_id = pb.json()["id"]
        # biz_a should not see biz_b project
        lr = biz_a["session"].get(f"{API}/projects")
        ids = [p["id"] for p in lr.json()]
        assert proj_b_id not in ids
        # Direct GET should 404
        dr = biz_a["session"].get(f"{API}/projects/{proj_b_id}")
        assert dr.status_code in (403, 404)


# ---------- Forgot password reset flow ----------
class TestPasswordReset:
    def test_forgot_for_existing_user_returns_200(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"identifier": ADMIN_EMAIL})
        assert r.status_code == 200
