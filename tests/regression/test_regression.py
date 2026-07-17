"""
Regression test suite safeguarding voucher matching logic.
"""
import pytest

def party_matches(p1: str, p2: str) -> bool:
    """Fuzzy name match logic for Tally parties."""
    n1 = p1.lower().replace("pvt", "").replace("ltd", "").replace("corp", "").strip()
    n2 = p2.lower().replace("pvt", "").replace("ltd", "").replace("corp", "").strip()
    return n1 in n2 or n2 in n1

def test_fuzzy_party_name_matching():
    assert party_matches("Suresh Traders", "Suresh Traders Pvt Ltd") is True
    assert party_matches("Krishna Enterprises", "krishna enterprises") is True
    assert party_matches("Suresh Traders", "Krishna Enterprises") is False
