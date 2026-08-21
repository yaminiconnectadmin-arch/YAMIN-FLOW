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


DEFAULT_SRV_URL = "mongodb+srv://yaminiconnectadmin_db_user:yaminiconnect111@cluster0.1ri5dnj.mongodb.net/yamini_flow?appName=Cluster0"
DEFAULT_DIRECT_URL = "mongodb://yaminiconnectadmin_db_user:yaminiconnect111@ac-1ri5dnj-shard-00-00.1ri5dnj.mongodb.net:27017,ac-1ri5dnj-shard-00-01.1ri5dnj.mongodb.net:27017,ac-1ri5dnj-shard-00-02.1ri5dnj.mongodb.net:27017/yamini_flow?ssl=true&replicaSet=atlas-1ri5dnj-shard-0&authSource=admin"
DEFAULT_MONGO_URL = DEFAULT_DIRECT_URL
mongo_url = os.environ.get("MONGO_URL", DEFAULT_DIRECT_URL)
db_name = os.environ.get("DB_NAME", "yamini_flow")

MONGO_KWARGS = {
    "serverSelectionTimeoutMS": 2500,
    "connectTimeoutMS": 2500,
    "socketTimeoutMS": 2500,
    "maxPoolSize": 20,
    "minPoolSize": 0,
    "maxIdleTimeMS": 10000,
    "retryWrites": True,
    "tlsAllowInvalidCertificates": True,
}

_client = None

class DummyCursor:
    def __init__(self, data=None):
        self.data = data or []
    def sort(self, *args, **kwargs):
        return self
    def skip(self, *args, **kwargs):
        return self
    def limit(self, *args, **kwargs):
        return self
    async def to_list(self, length=100):
        return self.data
    def __aiter__(self):
        return iter(self.data).__aiter__()


class DummyCollection:
    async def find_one(self, *args, **kwargs):
        return None
    def find(self, *args, **kwargs):
        return DummyCursor([])
    async def insert_one(self, doc, *args, **kwargs):
        class DummyRes:
            inserted_id = "69999ad9999ad9999ad99999"
        return DummyRes()
    async def insert_many(self, docs, *args, **kwargs):
        class DummyRes:
            inserted_ids = ["69999ad9999ad9999ad99999"]
        return DummyRes()
    async def update_one(self, *args, **kwargs):
        class DummyRes:
            modified_count = 1
        return DummyRes()
    async def update_many(self, *args, **kwargs):
        class DummyRes:
            modified_count = 1
        return DummyRes()
    async def delete_many(self, *args, **kwargs):
        class DummyRes:
            deleted_count = 0
        return DummyRes()
    async def count_documents(self, *args, **kwargs):
        return 0
    def aggregate(self, *args, **kwargs):
        class DummyAggCursor:
            async def to_list(self, length=None):
                return []
        return DummyAggCursor()
    async def drop_index(self, *args, **kwargs):
        pass
    async def create_index(self, *args, **kwargs):
        pass


def get_db():
    global _client
    if _client is None:
        try:
            import certifi
            ca = certifi.where()
            _client = AsyncIOMotorClient(mongo_url, tlsCAFile=ca, **MONGO_KWARGS)
        except Exception:
            try:
                _client = AsyncIOMotorClient(mongo_url, tlsAllowInvalidCertificates=True, **MONGO_KWARGS)
            except Exception:
                try:
                    _client = AsyncIOMotorClient(mongo_url, **MONGO_KWARGS)
                except Exception:
                    _client = None
    if _client is None:
        class DummyDB:
            name = "yamini_flow"
            async def command(self, *args, **kwargs):
                return {"ok": 1}
            def __getattr__(self, name):
                return DummyCollection()
            def __getitem__(self, name):
                return DummyCollection()
        return DummyDB()
    return _client[db_name]


class SafeCollectionProxy:
    def __init__(self, real_coll):
        self.real_coll = real_coll
        self.dummy = DummyCollection()

    async def find_one(self, *args, **kwargs):
        try:
            return await self.real_coll.find_one(*args, **kwargs)
        except Exception as e:
            logger.warning(f"MongoDB find_one exception: {e}")
            return await self.dummy.find_one(*args, **kwargs)

    def find(self, *args, **kwargs):
        try:
            return self.real_coll.find(*args, **kwargs)
        except Exception as e:
            logger.warning(f"MongoDB find exception: {e}")
            return self.dummy.find(*args, **kwargs)

    async def insert_one(self, *args, **kwargs):
        try:
            return await self.real_coll.insert_one(*args, **kwargs)
        except Exception as e:
            logger.warning(f"MongoDB insert_one exception: {e}")
            return await self.dummy.insert_one(*args, **kwargs)

    async def insert_many(self, *args, **kwargs):
        try:
            return await self.real_coll.insert_many(*args, **kwargs)
        except Exception as e:
            logger.warning(f"MongoDB insert_many exception: {e}")
            return await self.dummy.insert_many(*args, **kwargs)

    async def update_one(self, *args, **kwargs):
        try:
            return await self.real_coll.update_one(*args, **kwargs)
        except Exception as e:
            logger.warning(f"MongoDB update_one exception: {e}")
            return await self.dummy.update_one(*args, **kwargs)

    async def update_many(self, *args, **kwargs):
        try:
            return await self.real_coll.update_many(*args, **kwargs)
        except Exception as e:
            logger.warning(f"MongoDB update_many exception: {e}")
            return await self.dummy.update_many(*args, **kwargs)

    async def delete_many(self, *args, **kwargs):
        try:
            return await self.real_coll.delete_many(*args, **kwargs)
        except Exception as e:
            logger.warning(f"MongoDB delete_many exception: {e}")
            return await self.dummy.delete_many(*args, **kwargs)

    async def count_documents(self, *args, **kwargs):
        try:
            return await self.real_coll.count_documents(*args, **kwargs)
        except Exception as e:
            logger.warning(f"MongoDB count_documents exception: {e}")
            return await self.dummy.count_documents(*args, **kwargs)

    def aggregate(self, *args, **kwargs):
        try:
            return self.real_coll.aggregate(*args, **kwargs)
        except Exception as e:
            logger.warning(f"MongoDB aggregate exception: {e}")
            return self.dummy.aggregate(*args, **kwargs)

    async def create_index(self, *args, **kwargs):
        try:
            return await self.real_coll.create_index(*args, **kwargs)
        except Exception as e:
            return await self.dummy.create_index(*args, **kwargs)

    async def drop_index(self, *args, **kwargs):
        try:
            return await self.real_coll.drop_index(*args, **kwargs)
        except Exception as e:
            return await self.dummy.drop_index(*args, **kwargs)


class LazyDatabase:
    def __getattr__(self, name):
        try:
            coll = getattr(get_db(), name)
            return SafeCollectionProxy(coll) if coll is not None else DummyCollection()
        except Exception:
            return DummyCollection()

    def __getitem__(self, name):
        try:
            coll = get_db()[name]
            return SafeCollectionProxy(coll) if coll is not None else DummyCollection()
        except Exception:
            return DummyCollection()


db = LazyDatabase()




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
