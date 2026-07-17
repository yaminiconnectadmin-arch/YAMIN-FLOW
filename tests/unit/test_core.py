"""
Unit tests for core ERP calculations and matching logic.
"""
import pytest

def calculate_procurement_deficit(on_hand: int, reserved: int, safety_stock: int, moq: int) -> int:
    """Isolate and test the core math of the procurement deficit calculator."""
    available = on_hand - reserved
    if available >= safety_stock:
        return 0
    deficit = safety_stock - available
    if deficit < moq:
        return moq
    return deficit

def test_deficit_no_procurement_needed():
    assert calculate_procurement_deficit(10, 2, 5, 1) == 0

def test_deficit_triggers_procurement():
    assert calculate_procurement_deficit(5, 2, 5, 1) == 2  # available=3, safety=5 -> deficit=2

def test_deficit_enforces_moq():
    assert calculate_procurement_deficit(5, 1, 5, 10) == 10  # available=4, safety=5 -> deficit=1, MOQ=10
