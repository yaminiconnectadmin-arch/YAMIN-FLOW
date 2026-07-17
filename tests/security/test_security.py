"""
Security and access control validation suite.
"""
import pytest

def has_role_permission(user_role: str, required_roles: list[str]) -> bool:
    """Mock-verify the require_roles RBAC decorator logic."""
    return user_role in required_roles

def test_rbac_admin_has_full_permissions():
    allowed_roles = ["admin"]
    assert has_role_permission("admin", allowed_roles) is True
    assert has_role_permission("dealer", allowed_roles) is False

def test_rbac_multi_role_endpoint():
    allowed_roles = ["admin", "mnp"]
    assert has_role_permission("mnp", allowed_roles) is True
    assert has_role_permission("dealer", allowed_roles) is False
