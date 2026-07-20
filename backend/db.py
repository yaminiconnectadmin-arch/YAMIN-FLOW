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


mongo_url = os.environ["MONGO_URL"]
_client = AsyncIOMotorClient(mongo_url)
db = _client[os.environ["DB_NAME"]]


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now_utc().isoformat()


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
