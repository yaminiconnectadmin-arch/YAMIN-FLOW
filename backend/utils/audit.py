"""Centralized Audit Trail Logging System for Yamini Flow — SRD v2.0.2 Gold Master.
Records all system entity mutations (Orders, Inventory, Users, Invoices, Sync) with actor, action, state diff, timestamp, request_id.
"""

from typing import Optional, Dict, Any
from db import db, now_iso

async def log_audit_event(
    actor_id: Optional[str] = "system",
    actor_name: Optional[str] = "System Process",
    role: Optional[str] = "system",
    action: str = "MUTATION",
    entity_type: str = "order",
    entity_id: Optional[str] = None,
    before_state: Optional[Dict[str, Any]] = None,
    after_state: Optional[Dict[str, Any]] = None,
    reason: Optional[str] = "",
    request_id: Optional[str] = None
) -> Dict[str, Any]:
    """Persist structured audit event into db.audit_events collection."""
    audit_doc = {
        "timestamp": now_iso(),
        "actor_id": str(actor_id or "system"),
        "actor_name": str(actor_name or "System"),
        "role": str(role or "system"),
        "action": action.upper(),
        "entity_type": entity_type.lower(),
        "entity_id": str(entity_id or ""),
        "before_state": before_state or {},
        "after_state": after_state or {},
        "reason": reason or "",
        "request_id": request_id or "",
    }
    try:
        await db.audit_events.insert_one(audit_doc)
    except Exception:
        pass
    return audit_doc
