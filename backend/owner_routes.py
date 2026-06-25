"""Business owner routes for RapidXT Hisaab."""
from __future__ import annotations
import os
import io
import uuid
from datetime import datetime, timezone, date, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from PIL import Image, ImageOps

from models import (
    ProjectCreate, ProjectUpdate, ClientIn, PartyIn, ReferenceIn,
    TransactionIn, ExtraWorkIn, StageMasterIn, StageReorderIn, StageUpdateIn,
    MaterialIn, DocumentIn, ReminderIn, new_id,
)
from utils import now_iso, parse_date, fy_range, current_fy_label, today_iso


UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/app/backend/uploads")


def _strip_id(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc["id"] = doc.pop("_id")
    return doc


def _strip_list(docs: list) -> list:
    return [_strip_id(d) for d in docs]


def build_owner_router(db, get_active_business, require_active_business, require_owner) -> APIRouter:
    r = APIRouter(prefix="/api")

    # ============== UPLOADS ==============
    @r.post("/uploads")
    async def upload_file(
        file: UploadFile = File(...),
        compress: str = Form("true"),
        biz: dict = Depends(require_active_business),
    ):
        ext = os.path.splitext(file.filename or "")[1].lower() or ".bin"
        fname = f"{biz['_id']}_{uuid.uuid4().hex}{ext}"
        fpath = os.path.join(UPLOAD_DIR, fname)

        content = await file.read()
        # Server-side compression as backup, only for images
        if compress.lower() in ("true", "1", "yes") and ext in (".jpg", ".jpeg", ".png", ".webp"):
            try:
                img = Image.open(io.BytesIO(content))
                img = ImageOps.exif_transpose(img)
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                # Cap dimension at 2000px
                max_dim = 2000
                if max(img.size) > max_dim:
                    img.thumbnail((max_dim, max_dim))
                # Save as JPEG with quality 80
                out = io.BytesIO()
                img.save(out, format="JPEG", quality=80, optimize=True)
                content = out.getvalue()
                fname = os.path.splitext(fname)[0] + ".jpg"
                fpath = os.path.join(UPLOAD_DIR, fname)
            except Exception:
                pass  # save original on failure

        with open(fpath, "wb") as f:
            f.write(content)
        url = f"/uploads/{fname}"
        return {"url": url, "size": len(content), "filename": fname}

    # ============== STAGES MASTER ==============
    @r.get("/stages-master")
    async def list_stages(biz: dict = Depends(get_active_business)):
        items = await db.stages_master.find({"business_id": biz["_id"]}).sort("display_order", 1).to_list(500)
        return _strip_list(items)

    @r.post("/stages-master")
    async def create_stage(body: StageMasterIn, biz: dict = Depends(require_active_business)):
        # auto-set display_order to last if 0
        existing_count = await db.stages_master.count_documents({"business_id": biz["_id"]})
        doc = {
            "_id": new_id(),
            "business_id": biz["_id"],
            "name": body.name,
            "display_order": body.display_order or existing_count,
            "active": body.active,
            "created_at": now_iso(),
        }
        await db.stages_master.insert_one(doc)
        return _strip_id(doc)

    @r.put("/stages-master/{sid}")
    async def update_stage(sid: str, body: StageMasterIn, biz: dict = Depends(require_active_business)):
        res = await db.stages_master.update_one(
            {"_id": sid, "business_id": biz["_id"]},
            {"$set": {"name": body.name, "display_order": body.display_order, "active": body.active}}
        )
        if res.matched_count == 0:
            raise HTTPException(404, "Stage not found")
        return {"ok": True}

    @r.delete("/stages-master/{sid}")
    async def delete_stage(sid: str, biz: dict = Depends(require_active_business)):
        # only delete if not used in stage_history
        used = await db.stage_history.count_documents({"business_id": biz["_id"], "stage_id": sid})
        if used:
            raise HTTPException(400, "Stage has history and cannot be deleted")
        await db.stages_master.delete_one({"_id": sid, "business_id": biz["_id"]})
        return {"ok": True}

    @r.post("/stages-master/reorder")
    async def reorder_stages(body: StageReorderIn, biz: dict = Depends(require_active_business)):
        for idx, sid in enumerate(body.ordered_ids):
            await db.stages_master.update_one(
                {"_id": sid, "business_id": biz["_id"]},
                {"$set": {"display_order": idx}}
            )
        return {"ok": True}

    # ============== CLIENTS ==============
    @r.get("/clients")
    async def list_clients(biz: dict = Depends(get_active_business)):
        items = await db.clients.find({"business_id": biz["_id"]}).sort("name", 1).to_list(2000)
        return _strip_list(items)

    @r.post("/clients")
    async def create_client(body: ClientIn, biz: dict = Depends(require_active_business)):
        doc = {"_id": new_id(), "business_id": biz["_id"], "created_at": now_iso(), **body.model_dump()}
        await db.clients.insert_one(doc)
        return _strip_id(doc)

    @r.get("/clients/{cid}")
    async def get_client(cid: str, biz: dict = Depends(get_active_business)):
        c = await db.clients.find_one({"_id": cid, "business_id": biz["_id"]})
        if not c:
            raise HTTPException(404, "Client not found")
        # ledger: projects + lifetime totals
        projects = await db.projects.find({"business_id": biz["_id"], "client_id": cid}).to_list(500)
        proj_ids = [p["_id"] for p in projects]
        total_value = sum((p.get("original_value") or 0) for p in projects)
        # extra approved
        extra_total = 0
        if proj_ids:
            extras = await db.extra_work.find({
                "business_id": biz["_id"], "project_id": {"$in": proj_ids}, "approval_status": "Approved"
            }).to_list(1000)
            extra_total = sum((e.get("amount") or 0) for e in extras)
        received = 0
        if proj_ids:
            agg = await db.transactions.aggregate([
                {"$match": {"business_id": biz["_id"], "project_id": {"$in": proj_ids}, "type": "received"}},
                {"$group": {"_id": None, "sum": {"$sum": "$amount"}}}
            ]).to_list(1)
            received = (agg[0]["sum"] if agg else 0)
        revised = total_value + extra_total
        return {
            **_strip_id(c),
            "lifetime_project_value": total_value,
            "approved_extra_value": extra_total,
            "revised_value": revised,
            "lifetime_received": received,
            "lifetime_pending_receivable": max(0, revised - received),
            "projects_count": len(projects),
            "projects": _strip_list(projects),
        }

    @r.put("/clients/{cid}")
    async def update_client(cid: str, body: ClientIn, biz: dict = Depends(require_active_business)):
        res = await db.clients.update_one(
            {"_id": cid, "business_id": biz["_id"]}, {"$set": body.model_dump()}
        )
        if res.matched_count == 0:
            raise HTTPException(404, "Client not found")
        return {"ok": True}

    @r.delete("/clients/{cid}")
    async def delete_client(cid: str, biz: dict = Depends(require_active_business)):
        await db.clients.delete_one({"_id": cid, "business_id": biz["_id"]})
        return {"ok": True}

    # ============== PARTIES (suppliers/workers) ==============
    @r.get("/parties")
    async def list_parties(type: Optional[str] = None, biz: dict = Depends(get_active_business)):
        q = {"business_id": biz["_id"]}
        if type:
            q["type"] = type
        items = await db.parties.find(q).sort("name", 1).to_list(2000)
        return _strip_list(items)

    @r.post("/parties")
    async def create_party(body: PartyIn, biz: dict = Depends(require_active_business)):
        doc = {"_id": new_id(), "business_id": biz["_id"], "created_at": now_iso(), **body.model_dump()}
        await db.parties.insert_one(doc)
        return _strip_id(doc)

    @r.get("/parties/{pid}")
    async def get_party(pid: str, biz: dict = Depends(get_active_business)):
        p = await db.parties.find_one({"_id": pid, "business_id": biz["_id"]})
        if not p:
            raise HTTPException(404, "Party not found")
        # ledger
        txns = await db.transactions.find({
            "business_id": biz["_id"], "party_id": pid
        }).sort("date", -1).to_list(2000)
        paid = sum(t["amount"] for t in txns if t["type"] == "paid")
        received = sum(t["amount"] for t in txns if t["type"] == "received")
        proj_ids = list({t.get("project_id") for t in txns if t.get("project_id")})
        last_tx = txns[0]["date"] if txns else None
        return {
            **_strip_id(p),
            "lifetime_paid": paid,
            "lifetime_received": received,
            "lifetime_pending": max(0, received - paid) if p.get("type") in (None,) else None,
            "projects_count": len(proj_ids),
            "last_transaction_date": last_tx,
            "transactions": _strip_list(txns),
        }

    @r.put("/parties/{pid}")
    async def update_party(pid: str, body: PartyIn, biz: dict = Depends(require_active_business)):
        res = await db.parties.update_one(
            {"_id": pid, "business_id": biz["_id"]}, {"$set": body.model_dump()}
        )
        if res.matched_count == 0:
            raise HTTPException(404, "Party not found")
        return {"ok": True}

    @r.delete("/parties/{pid}")
    async def delete_party(pid: str, biz: dict = Depends(require_active_business)):
        await db.parties.delete_one({"_id": pid, "business_id": biz["_id"]})
        return {"ok": True}

    # ============== REFERENCES ==============
    @r.get("/references")
    async def list_refs(biz: dict = Depends(get_active_business)):
        items = await db.refs.find({"business_id": biz["_id"]}).sort("name", 1).to_list(2000)
        # attach summary counts
        out = []
        for ref in items:
            projs = await db.projects.find({"business_id": biz["_id"], "reference_id": ref["_id"]}).to_list(500)
            total_value = sum((p.get("original_value") or 0) for p in projs)
            commission_total = 0
            if ref.get("commission_type") == "amount":
                commission_total = (ref.get("commission_value") or 0) * len(projs)
            elif ref.get("commission_type") == "percentage":
                commission_total = total_value * (ref.get("commission_value") or 0) / 100
            commission_paid = 0
            if projs:
                proj_ids = [p["_id"] for p in projs]
                agg = await db.transactions.aggregate([
                    {"$match": {
                        "business_id": biz["_id"], "project_id": {"$in": proj_ids},
                        "type": "paid", "category": "Commission", "party_id": ref["_id"]
                    }},
                    {"$group": {"_id": None, "sum": {"$sum": "$amount"}}}
                ]).to_list(1)
                commission_paid = agg[0]["sum"] if agg else 0
            r_out = _strip_id(ref)
            r_out["projects_count"] = len(projs)
            r_out["total_project_value"] = total_value
            r_out["commission_total"] = commission_total
            r_out["commission_paid"] = commission_paid
            r_out["commission_pending"] = max(0, commission_total - commission_paid)
            out.append(r_out)
        return out

    @r.post("/references")
    async def create_ref(body: ReferenceIn, biz: dict = Depends(require_active_business)):
        doc = {"_id": new_id(), "business_id": biz["_id"], "created_at": now_iso(), **body.model_dump()}
        await db.refs.insert_one(doc)
        return _strip_id(doc)

    @r.put("/references/{rid}")
    async def update_ref(rid: str, body: ReferenceIn, biz: dict = Depends(require_active_business)):
        res = await db.refs.update_one(
            {"_id": rid, "business_id": biz["_id"]}, {"$set": body.model_dump()}
        )
        if res.matched_count == 0:
            raise HTTPException(404, "Reference not found")
        return {"ok": True}

    @r.delete("/references/{rid}")
    async def delete_ref(rid: str, biz: dict = Depends(require_active_business)):
        await db.refs.delete_one({"_id": rid, "business_id": biz["_id"]})
        return {"ok": True}

    # ============== PROJECTS ==============
    async def _project_summary(biz_id: str, project: dict) -> dict:
        pid = project["_id"]
        orig = project.get("original_value") or 0
        # extra approved
        extras = await db.extra_work.find({
            "business_id": biz_id, "project_id": pid, "approval_status": "Approved"
        }).to_list(500)
        extra_total = sum((e.get("amount") or 0) for e in extras)
        revised = orig + extra_total
        # transactions
        txns = await db.transactions.find({"business_id": biz_id, "project_id": pid}).to_list(5000)
        received = sum(t["amount"] for t in txns if t["type"] == "received")
        paid = sum(t["amount"] for t in txns if t["type"] == "paid")
        # material total cost
        mats = await db.materials.find({"business_id": biz_id, "project_id": pid}).to_list(500)
        mat_cost = sum((m.get("total_amount") or 0) for m in mats)
        return {
            "original_value": orig,
            "approved_extra_value": extra_total,
            "revised_value": revised,
            "received": received,
            "pending_receivable": max(0, revised - received),
            "paid": paid,
            "material_cost": mat_cost,
            "actual_cash_profit": received - paid,
            "book_profit": revised - paid,
        }

    @r.get("/projects")
    async def list_projects(status: Optional[str] = None, biz: dict = Depends(get_active_business)):
        q = {"business_id": biz["_id"]}
        if status:
            q["status"] = status
        items = await db.projects.find(q).sort("created_at", -1).to_list(2000)
        # enrich
        out = []
        clients = {c["_id"]: c for c in await db.clients.find({"business_id": biz["_id"]}).to_list(2000)}
        # current stages
        latest_stages = {}
        async for h in db.stage_history.find({"business_id": biz["_id"]}).sort("updated_at", -1):
            pid = h["project_id"]
            if pid not in latest_stages:
                latest_stages[pid] = h
        for p in items:
            pid_local = p["_id"]
            d = _strip_id(p)
            d["client_name"] = clients.get(d.get("client_id"), {}).get("name", "")
            d["current_stage"] = (latest_stages.get(pid_local) or {}).get("stage_name")
            d["current_stage_updated_at"] = (latest_stages.get(pid_local) or {}).get("updated_at")
            summary = await _project_summary(biz["_id"], {**d, "_id": pid_local})
            d["summary"] = summary
            # Also flatten summary keys at top level for convenience
            for k, v in summary.items():
                d.setdefault(k, v)
            out.append(d)
        return out

    @r.post("/projects")
    async def create_project(body: ProjectCreate, biz: dict = Depends(require_active_business)):
        doc = {"_id": new_id(), "business_id": biz["_id"], "created_at": now_iso(), **body.model_dump()}
        await db.projects.insert_one(doc)
        return _strip_id(doc)

    @r.get("/projects/{pid}")
    async def get_project(pid: str, biz: dict = Depends(get_active_business)):
        p = await db.projects.find_one({"_id": pid, "business_id": biz["_id"]})
        if not p:
            raise HTTPException(404, "Project not found")
        client_id = p.get("client_id")
        reference_id = p.get("reference_id")
        summary = await _project_summary(biz["_id"], p)
        d = _strip_id(p)
        if client_id:
            c = await db.clients.find_one({"_id": client_id, "business_id": biz["_id"]})
            d["client"] = _strip_id(c) if c else None
        if reference_id:
            ref = await db.refs.find_one({"_id": reference_id, "business_id": biz["_id"]})
            d["reference"] = _strip_id(ref) if ref else None
        d["summary"] = summary
        latest = await db.stage_history.find_one(
            {"business_id": biz["_id"], "project_id": pid},
            sort=[("updated_at", -1)]
        )
        d["current_stage"] = _strip_id(latest) if latest else None
        return d

    @r.put("/projects/{pid}")
    async def update_project(pid: str, body: ProjectUpdate, biz: dict = Depends(require_active_business)):
        updates = {k: v for k, v in body.model_dump().items() if v is not None}
        if not updates:
            return {"ok": True}
        res = await db.projects.update_one(
            {"_id": pid, "business_id": biz["_id"]}, {"$set": updates}
        )
        if res.matched_count == 0:
            raise HTTPException(404, "Project not found")
        return {"ok": True}

    @r.delete("/projects/{pid}")
    async def delete_project(pid: str, biz: dict = Depends(require_active_business)):
        await db.projects.delete_one({"_id": pid, "business_id": biz["_id"]})
        # cascade soft-only: leave child docs in place but they're orphaned
        return {"ok": True}

    @r.get("/projects/{pid}/summary")
    async def project_summary(pid: str, biz: dict = Depends(get_active_business)):
        p = await db.projects.find_one({"_id": pid, "business_id": biz["_id"]})
        if not p:
            raise HTTPException(404, "Project not found")
        return await _project_summary(biz["_id"], p)

    # --- Project sub-resources ---
    @r.get("/projects/{pid}/transactions")
    async def project_transactions(pid: str, biz: dict = Depends(get_active_business)):
        items = await db.transactions.find({
            "business_id": biz["_id"], "project_id": pid
        }).sort("date", -1).to_list(5000)
        return _strip_list(items)

    @r.get("/projects/{pid}/extra-work")
    async def project_extras(pid: str, biz: dict = Depends(get_active_business)):
        items = await db.extra_work.find({
            "business_id": biz["_id"], "project_id": pid
        }).sort("date", -1).to_list(500)
        return _strip_list(items)

    @r.post("/projects/{pid}/extra-work")
    async def create_extra(pid: str, body: ExtraWorkIn, biz: dict = Depends(require_active_business)):
        doc = {"_id": new_id(), "business_id": biz["_id"], "project_id": pid,
               "created_at": now_iso(), **body.model_dump()}
        await db.extra_work.insert_one(doc)
        return _strip_id(doc)

    @r.put("/projects/{pid}/extra-work/{eid}")
    async def update_extra(pid: str, eid: str, body: ExtraWorkIn, biz: dict = Depends(require_active_business)):
        res = await db.extra_work.update_one(
            {"_id": eid, "business_id": biz["_id"], "project_id": pid},
            {"$set": body.model_dump()}
        )
        if res.matched_count == 0:
            raise HTTPException(404, "Extra work not found")
        return {"ok": True}

    @r.delete("/projects/{pid}/extra-work/{eid}")
    async def delete_extra(pid: str, eid: str, biz: dict = Depends(require_active_business)):
        await db.extra_work.delete_one({"_id": eid, "business_id": biz["_id"], "project_id": pid})
        return {"ok": True}

    @r.get("/projects/{pid}/stage-history")
    async def project_stage_history(pid: str, biz: dict = Depends(get_active_business)):
        items = await db.stage_history.find({
            "business_id": biz["_id"], "project_id": pid
        }).sort("updated_at", -1).to_list(500)
        return _strip_list(items)

    @r.post("/projects/{pid}/stage")
    async def update_project_stage(pid: str, body: StageUpdateIn,
                                   biz: dict = Depends(require_active_business),
                                   user: dict = Depends(require_owner)):
        doc = {
            "_id": new_id(),
            "business_id": biz["_id"],
            "project_id": pid,
            "stage_id": body.stage_id,
            "stage_name": body.stage_name,
            "notes": body.notes or "",
            "photo_url": body.photo_url,
            "updated_by": user.get("name"),
            "updated_at": now_iso(),
        }
        await db.stage_history.insert_one(doc)
        return _strip_id(doc)

    @r.get("/projects/{pid}/materials")
    async def project_materials(pid: str, biz: dict = Depends(get_active_business)):
        items = await db.materials.find({
            "business_id": biz["_id"], "project_id": pid
        }).sort("purchase_date", -1).to_list(500)
        return _strip_list(items)

    @r.post("/projects/{pid}/materials")
    async def create_material(pid: str, body: MaterialIn, biz: dict = Depends(require_active_business)):
        doc = {"_id": new_id(), "business_id": biz["_id"], "project_id": pid,
               "created_at": now_iso(), **body.model_dump()}
        await db.materials.insert_one(doc)
        return _strip_id(doc)

    @r.put("/projects/{pid}/materials/{mid}")
    async def update_material(pid: str, mid: str, body: MaterialIn,
                              biz: dict = Depends(require_active_business)):
        res = await db.materials.update_one(
            {"_id": mid, "business_id": biz["_id"], "project_id": pid},
            {"$set": body.model_dump()}
        )
        if res.matched_count == 0:
            raise HTTPException(404, "Material not found")
        return {"ok": True}

    @r.delete("/projects/{pid}/materials/{mid}")
    async def delete_material(pid: str, mid: str, biz: dict = Depends(require_active_business)):
        await db.materials.delete_one({"_id": mid, "business_id": biz["_id"], "project_id": pid})
        return {"ok": True}

    @r.get("/projects/{pid}/documents")
    async def project_docs(pid: str, category: Optional[str] = None,
                           biz: dict = Depends(get_active_business)):
        q = {"business_id": biz["_id"], "project_id": pid}
        if category:
            q["category"] = category
        items = await db.documents.find(q).sort("uploaded_at", -1).to_list(2000)
        return _strip_list(items)

    @r.post("/projects/{pid}/documents")
    async def create_doc(pid: str, body: DocumentIn,
                         biz: dict = Depends(require_active_business),
                         user: dict = Depends(require_owner)):
        doc = {
            "_id": new_id(), "business_id": biz["_id"], "project_id": pid,
            "uploaded_by": user.get("name"), "uploaded_at": now_iso(),
            **body.model_dump()
        }
        await db.documents.insert_one(doc)
        return _strip_id(doc)

    @r.delete("/projects/{pid}/documents/{did}")
    async def delete_doc(pid: str, did: str, biz: dict = Depends(require_active_business)):
        await db.documents.delete_one({"_id": did, "business_id": biz["_id"], "project_id": pid})
        return {"ok": True}

    # ============== TRANSACTIONS (global list) ==============
    @r.get("/transactions")
    async def list_txns(
        project_id: Optional[str] = None,
        type: Optional[str] = None,
        party_id: Optional[str] = None,
        start: Optional[str] = None,
        end: Optional[str] = None,
        biz: dict = Depends(get_active_business),
    ):
        q = {"business_id": biz["_id"]}
        if project_id:
            q["project_id"] = project_id
        if type:
            q["type"] = type
        if party_id:
            q["party_id"] = party_id
        if start or end:
            dq = {}
            if start:
                dq["$gte"] = start
            if end:
                dq["$lte"] = end
            q["date"] = dq
        items = await db.transactions.find(q).sort("date", -1).to_list(5000)
        return _strip_list(items)

    @r.post("/transactions")
    async def create_txn(body: TransactionIn, biz: dict = Depends(require_active_business)):
        doc = {"_id": new_id(), "business_id": biz["_id"], "created_at": now_iso(), **body.model_dump()}
        await db.transactions.insert_one(doc)
        return _strip_id(doc)

    @r.put("/transactions/{tid}")
    async def update_txn(tid: str, body: TransactionIn, biz: dict = Depends(require_active_business)):
        res = await db.transactions.update_one(
            {"_id": tid, "business_id": biz["_id"]}, {"$set": body.model_dump()}
        )
        if res.matched_count == 0:
            raise HTTPException(404, "Transaction not found")
        return {"ok": True}

    @r.delete("/transactions/{tid}")
    async def delete_txn(tid: str, biz: dict = Depends(require_active_business)):
        await db.transactions.delete_one({"_id": tid, "business_id": biz["_id"]})
        return {"ok": True}

    # ============== REMINDERS ==============
    @r.get("/reminders")
    async def list_reminders(
        filter: Optional[str] = Query(None, description="today|week|month|overdue|completed"),
        biz: dict = Depends(get_active_business),
    ):
        q = {"business_id": biz["_id"]}
        today = date.today().isoformat()
        if filter == "today":
            q["due_date"] = today
            q["status"] = "Pending"
        elif filter == "overdue":
            q["due_date"] = {"$lt": today}
            q["status"] = "Pending"
        elif filter == "week":
            end = (date.today() + timedelta(days=7)).isoformat()
            q["due_date"] = {"$gte": today, "$lte": end}
            q["status"] = "Pending"
        elif filter == "month":
            end = (date.today() + timedelta(days=30)).isoformat()
            q["due_date"] = {"$gte": today, "$lte": end}
            q["status"] = "Pending"
        elif filter == "completed":
            q["status"] = "Completed"
        items = await db.reminders.find(q).sort("due_date", 1).to_list(2000)
        return _strip_list(items)

    @r.post("/reminders")
    async def create_reminder(body: ReminderIn, biz: dict = Depends(require_active_business)):
        doc = {"_id": new_id(), "business_id": biz["_id"], "created_at": now_iso(), **body.model_dump()}
        await db.reminders.insert_one(doc)
        return _strip_id(doc)

    @r.put("/reminders/{rid}")
    async def update_reminder(rid: str, body: ReminderIn, biz: dict = Depends(require_active_business)):
        res = await db.reminders.update_one(
            {"_id": rid, "business_id": biz["_id"]}, {"$set": body.model_dump()}
        )
        if res.matched_count == 0:
            raise HTTPException(404, "Reminder not found")
        return {"ok": True}

    @r.delete("/reminders/{rid}")
    async def delete_reminder(rid: str, biz: dict = Depends(require_active_business)):
        await db.reminders.delete_one({"_id": rid, "business_id": biz["_id"]})
        return {"ok": True}

    @r.post("/reminders/{rid}/complete")
    async def complete_reminder(rid: str, biz: dict = Depends(require_active_business)):
        await db.reminders.update_one(
            {"_id": rid, "business_id": biz["_id"]}, {"$set": {"status": "Completed"}}
        )
        return {"ok": True}

    # ============== DASHBOARD ==============
    @r.get("/dashboard")
    async def dashboard(biz: dict = Depends(get_active_business)):
        bid = biz["_id"]
        today = date.today()
        month_start = today.replace(day=1).isoformat()
        today_iso_str = today.isoformat()

        ongoing = await db.projects.count_documents({"business_id": bid, "status": "Ongoing"})
        completed = await db.projects.count_documents({"business_id": bid, "status": "Completed"})

        # this month received/paid
        agg_recv = await db.transactions.aggregate([
            {"$match": {"business_id": bid, "type": "received", "date": {"$gte": month_start}}},
            {"$group": {"_id": None, "sum": {"$sum": "$amount"}}}
        ]).to_list(1)
        received_month = agg_recv[0]["sum"] if agg_recv else 0
        agg_paid = await db.transactions.aggregate([
            {"$match": {"business_id": bid, "type": "paid", "date": {"$gte": month_start}}},
            {"$group": {"_id": None, "sum": {"$sum": "$amount"}}}
        ]).to_list(1)
        paid_month = agg_paid[0]["sum"] if agg_paid else 0

        # Lifetime / All time pending receivable & payable from project summaries
        all_projects = await db.projects.find({"business_id": bid}).to_list(5000)
        pending_receivable = 0
        total_paid_all = 0
        total_received_all = 0
        for p in all_projects:
            s = await _project_summary(bid, p)
            pending_receivable += s["pending_receivable"]
            total_paid_all += s["paid"]
            total_received_all += s["received"]

        # Payables: pending bills to suppliers/workers/refs not in MVP separate; show overdue commission pending
        refs = await db.refs.find({"business_id": bid}).to_list(2000)
        commission_pending = 0
        for ref in refs:
            projs = await db.projects.find({"business_id": bid, "reference_id": ref["_id"]}).to_list(500)
            total_v = sum((p.get("original_value") or 0) for p in projs)
            ct = 0
            if ref.get("commission_type") == "amount":
                ct = (ref.get("commission_value") or 0) * len(projs)
            elif ref.get("commission_type") == "percentage":
                ct = total_v * (ref.get("commission_value") or 0) / 100
            cp = 0
            if projs:
                proj_ids = [p["_id"] for p in projs]
                agg = await db.transactions.aggregate([
                    {"$match": {
                        "business_id": bid, "project_id": {"$in": proj_ids},
                        "type": "paid", "category": "Commission", "party_id": ref["_id"]
                    }},
                    {"$group": {"_id": None, "sum": {"$sum": "$amount"}}}
                ]).to_list(1)
                cp = agg[0]["sum"] if agg else 0
            commission_pending += max(0, ct - cp)

        # FY profit
        fy_label = current_fy_label()
        fy_s, fy_e = fy_range(fy_label)
        s_iso, e_iso = fy_s.isoformat(), fy_e.isoformat()
        agg_r = await db.transactions.aggregate([
            {"$match": {"business_id": bid, "type": "received", "date": {"$gte": s_iso, "$lte": e_iso}}},
            {"$group": {"_id": None, "sum": {"$sum": "$amount"}}}
        ]).to_list(1)
        agg_p = await db.transactions.aggregate([
            {"$match": {"business_id": bid, "type": "paid", "date": {"$gte": s_iso, "$lte": e_iso}}},
            {"$group": {"_id": None, "sum": {"$sum": "$amount"}}}
        ]).to_list(1)
        fy_recv = agg_r[0]["sum"] if agg_r else 0
        fy_paid = agg_p[0]["sum"] if agg_p else 0
        fy_profit = fy_recv - fy_paid

        # Reminders
        today_reminders = await db.reminders.count_documents({
            "business_id": bid, "status": "Pending", "due_date": today_iso_str
        })
        overdue_reminders = await db.reminders.count_documents({
            "business_id": bid, "status": "Pending", "due_date": {"$lt": today_iso_str}
        })

        # Recent transactions
        recent_tx = await db.transactions.find({"business_id": bid}).sort("date", -1).to_list(8)

        return {
            "ongoing_projects": ongoing,
            "completed_projects": completed,
            "pending_receivable": pending_receivable,
            "pending_payable": commission_pending,
            "received_this_month": received_month,
            "paid_this_month": paid_month,
            "fy_label": fy_label,
            "fy_profit": fy_profit,
            "fy_received": fy_recv,
            "fy_paid": fy_paid,
            "today_reminders": today_reminders,
            "overdue_reminders": overdue_reminders,
            "recent_transactions": _strip_list(recent_tx),
        }

    # ============== REPORTS ==============
    @r.get("/reports/fy-profit")
    async def fy_profit_report(fy: Optional[str] = None, biz: dict = Depends(get_active_business)):
        bid = biz["_id"]
        label = fy or current_fy_label()
        s, e = fy_range(label)
        s_iso, e_iso = s.isoformat(), e.isoformat()

        agg_r = await db.transactions.aggregate([
            {"$match": {"business_id": bid, "type": "received", "date": {"$gte": s_iso, "$lte": e_iso}}},
            {"$group": {"_id": None, "sum": {"$sum": "$amount"}}}
        ]).to_list(1)
        agg_p = await db.transactions.aggregate([
            {"$match": {"business_id": bid, "type": "paid", "date": {"$gte": s_iso, "$lte": e_iso}}},
            {"$group": {"_id": None, "sum": {"$sum": "$amount"}}}
        ]).to_list(1)
        received = agg_r[0]["sum"] if agg_r else 0
        paid = agg_p[0]["sum"] if agg_p else 0

        # Month-wise trend
        month_agg = await db.transactions.aggregate([
            {"$match": {"business_id": bid, "date": {"$gte": s_iso, "$lte": e_iso}}},
            {"$group": {
                "_id": {"month": {"$substr": ["$date", 0, 7]}, "type": "$type"},
                "sum": {"$sum": "$amount"}
            }},
        ]).to_list(500)
        month_map: dict = {}
        for m in month_agg:
            mkey = m["_id"]["month"]
            month_map.setdefault(mkey, {"received": 0, "paid": 0})
            month_map[mkey][m["_id"]["type"]] = m["sum"]
        month_list = [{"month": k, **v, "profit": v["received"] - v["paid"]}
                      for k, v in sorted(month_map.items())]

        # Project-wise profit (within FY by transactions)
        proj_agg = await db.transactions.aggregate([
            {"$match": {"business_id": bid, "date": {"$gte": s_iso, "$lte": e_iso}}},
            {"$group": {
                "_id": {"project_id": "$project_id", "type": "$type"},
                "sum": {"$sum": "$amount"}
            }}
        ]).to_list(2000)
        proj_map: dict = {}
        for p in proj_agg:
            pid = p["_id"].get("project_id") or "unknown"
            proj_map.setdefault(pid, {"received": 0, "paid": 0})
            proj_map[pid][p["_id"]["type"]] = p["sum"]
        # name lookup
        projects = await db.projects.find({"business_id": bid}).to_list(5000)
        proj_names = {p["_id"]: p.get("project_name") for p in projects}
        project_rows = [
            {
                "project_id": pid,
                "project_name": proj_names.get(pid, "Unallocated"),
                "received": v["received"],
                "paid": v["paid"],
                "profit": v["received"] - v["paid"],
            }
            for pid, v in proj_map.items()
        ]

        return {
            "fy": label,
            "from": s_iso, "to": e_iso,
            "received": received,
            "paid": paid,
            "actual_cash_profit": received - paid,
            "month_wise": month_list,
            "project_wise": project_rows,
        }

    @r.get("/reports/receivables")
    async def receivables(biz: dict = Depends(get_active_business)):
        bid = biz["_id"]
        all_projects = await db.projects.find({"business_id": bid}).to_list(5000)
        clients = {c["_id"]: c for c in await db.clients.find({"business_id": bid}).to_list(2000)}
        rows = []
        for p in all_projects:
            s = await _project_summary(bid, p)
            if s["pending_receivable"] > 0:
                rows.append({
                    "project_id": p["_id"],
                    "project_name": p["project_name"],
                    "client_name": clients.get(p.get("client_id"), {}).get("name", ""),
                    "revised_value": s["revised_value"],
                    "received": s["received"],
                    "pending": s["pending_receivable"],
                })
        return rows

    @r.get("/reports/payables")
    async def payables(biz: dict = Depends(get_active_business)):
        bid = biz["_id"]
        refs = await db.refs.find({"business_id": bid}).to_list(2000)
        rows = []
        for ref in refs:
            projs = await db.projects.find({"business_id": bid, "reference_id": ref["_id"]}).to_list(500)
            total_v = sum((p.get("original_value") or 0) for p in projs)
            ct = 0
            if ref.get("commission_type") == "amount":
                ct = (ref.get("commission_value") or 0) * len(projs)
            elif ref.get("commission_type") == "percentage":
                ct = total_v * (ref.get("commission_value") or 0) / 100
            cp = 0
            if projs:
                proj_ids = [p["_id"] for p in projs]
                agg = await db.transactions.aggregate([
                    {"$match": {
                        "business_id": bid, "project_id": {"$in": proj_ids},
                        "type": "paid", "category": "Commission", "party_id": ref["_id"]
                    }},
                    {"$group": {"_id": None, "sum": {"$sum": "$amount"}}}
                ]).to_list(1)
                cp = agg[0]["sum"] if agg else 0
            if ct - cp > 0:
                rows.append({
                    "reference_id": ref["_id"],
                    "name": ref["name"],
                    "type": ref.get("type"),
                    "total_commission": ct,
                    "paid": cp,
                    "pending": ct - cp,
                })
        return rows

    @r.get("/reports/project-pl")
    async def project_pl(biz: dict = Depends(get_active_business)):
        bid = biz["_id"]
        projects = await db.projects.find({"business_id": bid}).to_list(5000)
        clients = {c["_id"]: c for c in await db.clients.find({"business_id": bid}).to_list(2000)}
        rows = []
        for p in projects:
            s = await _project_summary(bid, p)
            rows.append({
                "project_id": p["_id"],
                "project_name": p["project_name"],
                "client_name": clients.get(p.get("client_id"), {}).get("name", ""),
                "status": p.get("status"),
                **s,
            })
        return rows

    return r
