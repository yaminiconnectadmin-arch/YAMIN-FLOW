"""MongoDB connection and base models with proper ObjectId handling."""
import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

from datetime import datetime, timezone
from typing import Annotated, Any, Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field


def _validate_object_id(v: Any) -> str:
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, str) and ObjectId.is_valid(v):
        return v
    if v is None:
        return v
    raise ValueError(f"Invalid ObjectId: {v}")


PyObjectId = Annotated[str, BeforeValidator(_validate_object_id)]


DEFAULT_MONGO_URL = "mongodb+srv://yaminiconnectadmin_db_user:yaminiconnect111@cluster0.1ri5dnj.mongodb.net/yamini_flow?appName=Cluster0"
mongo_url = os.environ.get("MONGO_URL", DEFAULT_MONGO_URL)
db_name = os.environ.get("DB_NAME", "yamini_flow")

MONGO_KWARGS = {
    "serverSelectionTimeoutMS": 3000,
    "connectTimeoutMS": 3000,
    "maxPoolSize": 50,
    "minPoolSize": 5,
    "maxIdleTimeMS": 30000,
    "retryWrites": True,
}

try:
    import certifi
    ca = certifi.where()
    _client = AsyncIOMotorClient(mongo_url, tlsCAFile=ca, **MONGO_KWARGS)
except Exception:
    try:
        _client = AsyncIOMotorClient(mongo_url, tlsAllowInvalidCertificates=True, **MONGO_KWARGS)
    except Exception:
        _client = AsyncIOMotorClient(mongo_url, **MONGO_KWARGS)

db = _client[db_name]




def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now_utc().isoformat()


async def create_db_indexes():
    """Ensure database indexes are present for high-speed queries."""
    try:
        await db.orders.create_index([("created_at", -1)])
        await db.orders.create_index([("status", 1), ("created_at", -1)])
        await db.orders.create_index([("dealer_id", 1), ("created_at", -1)])
        await db.orders.create_index([("order_no", 1)])
        await db.products.create_index([("sku", 1)])
        await db.products.create_index([("category", 1)])
        await db.inventory.create_index([("warehouse_id", 1), ("product_id", 1)], unique=True)
        await db.users.create_index([("email", 1)])
        await db.users.create_index([("login_id", 1)])
        await db.users.create_index([("user_code", 1)])
        await db.tally_webhook_events.create_index([("voucher_no", 1), ("guid", 1)])
    except Exception:
        pass


class BaseDocument(BaseModel):
    """Base for all Mongo documents. Maps _id -> id and helpers for round-trip."""
    model_config = ConfigDict(populate_by_name=True, extra="ignore", arbitrary_types_allowed=True)

    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)

    def to_mongo(self) -> dict:
        d = self.model_dump(by_alias=True, exclude_none=True)
        if "_id" in d and d["_id"] is None:
            d.pop("_id")
        if "_id" in d and isinstance(d["_id"], str):
            d["_id"] = ObjectId(d["_id"])
        return d

    @classmethod
    def from_mongo(cls, doc: dict):
        if doc is None:
            return None
        if "_id" in doc:
            doc["_id"] = str(doc["_id"])
        return cls(**doc)


def serialize_doc(doc: dict) -> dict:
    """Convert a raw Mongo doc to JSON-safe dict."""
    if doc is None:
        return None
    out = {}
    for k, v in doc.items():
        if k == "_id":
            out["id"] = str(v)
        elif isinstance(v, ObjectId):
            out[k] = str(v)
        elif isinstance(v, datetime):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out


def serialize_docs(docs: list) -> list:
    return [serialize_doc(d) for d in docs]
