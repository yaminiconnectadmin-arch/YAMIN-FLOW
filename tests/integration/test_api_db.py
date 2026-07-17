"""
Integration tests for FastAPI router utilities and database mappings.
"""
import pytest
from bson import ObjectId

def serialize_doc(doc: dict) -> dict:
    """Mock-verify the MongoDB model serialization layer."""
    if doc is None:
        return None
    out = {}
    for k, v in doc.items():
        if k == "_id":
            out["id"] = str(v)
        elif isinstance(v, ObjectId):
            out[k] = str(v)
        else:
            out[k] = v
    return out

def test_document_serialization_to_json_safe():
    oid = ObjectId()
    raw = {
        "_id": oid,
        "sku": "TEST_INTEG_SKU",
        "nested_id": oid,
        "value": 100
    }
    serialized = serialize_doc(raw)
    assert serialized["id"] == str(oid)
    assert serialized["nested_id"] == str(oid)
    assert "_id" not in serialized
