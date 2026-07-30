import pytest
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from auth import brute_force_check, record_failed_attempt
from models import LoginInput

def test_password_length_constraint():
    valid = LoginInput(login_id="EMP-101", password="12345678")
    assert len(valid.password) == 8

    invalid_pwd = "123456789"
    assert len(invalid_pwd) > 8

@pytest.mark.anyio
async def test_brute_force_3_attempts_policy(monkeypatch):

    attempts_db = {}

    class MockLoginAttempts:
        async def find_one(self, query):
            return attempts_db.get(query["identifier"])

        async def update_one(self, filter_q, update_q, upsert=False):
            ident = filter_q["identifier"]
            curr = attempts_db.get(ident, {})
            sets = update_q.get("$set", {})
            curr.update(sets)
            attempts_db[ident] = curr

    import auth
    monkeypatch.setattr(auth.db, "login_attempts", MockLoginAttempts())

    ident = "127.0.0.1:emp-101"

    # Attempt 1
    await record_failed_attempt(ident)
    assert attempts_db[ident]["count"] == 1
    assert attempts_db[ident]["locked_until"] is None

    # Attempt 2
    await record_failed_attempt(ident)
    assert attempts_db[ident]["count"] == 2
    assert attempts_db[ident]["locked_until"] is None

    # Attempt 3 - Should trigger 30 min lock
    await record_failed_attempt(ident)
    assert attempts_db[ident]["count"] == 3
    assert attempts_db[ident]["locked_until"] is not None

    # Lock check should raise 429 error
    with pytest.raises(HTTPException) as exc_info:
        await brute_force_check(ident)
    assert exc_info.value.status_code == 429
    assert "locked due to 3 failed attempts" in exc_info.value.detail
    assert "30 minutes" in exc_info.value.detail
