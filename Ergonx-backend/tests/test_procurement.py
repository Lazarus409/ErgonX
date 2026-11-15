"""Procurement (Future additions item 9): requisition -> order -> goods received -> vendor bill."""
from datetime import date
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.accounting.budgets import budget_figures
from apps.accounting.models import Account, Budget, BudgetLine, FiscalYear, VendorBill
from apps.accounting.services import create_vendor
from apps.institutions.models import InstitutionModule
from apps.workflows.models import ApprovalWorkflowDefinition, ApprovalWorkflowStep
from tests.test_accounts_payable import _accounting_foundation, _enable_accounting, _finance

pytestmark = pytest.mark.django_db
BASE = "/api/v1/procurement"


def _enable_procurement(institution):
    institution.modules.filter(module_code=InstitutionModule.ModuleCode.PROCUREMENT).update(is_enabled=True)


def _client(user, institution):
    client = APIClient()
    client.force_authenticate(user)
    client.credentials(HTTP_X_INSTITUTION_ID=str(institution.id))
    return client


@pytest.fixture
def shop(institution_factory, user_factory, membership_factory):
    institution = institution_factory(code="PROC", country_code="GH")
    _enable_accounting(institution)
    _enable_procurement(institution)
    buyer = _finance(institution, user_factory, membership_factory, "buyer@proc.example")
    approver = _finance(institution, user_factory, membership_factory, "approver@proc.example")
    period, tax_code, _ = _accounting_foundation(institution, buyer, code="PROC-GH")
    vendor = create_vendor(institution=institution, actor=buyer, name="Office Supplies Ltd", country_code="GH", tax_residency="RESIDENT")
    staff = user_factory(email="staff@proc.example")
    membership_factory(user=staff, institution=institution, role_code="EMPLOYEE", is_primary=True)
    colleague = user_factory(email="colleague@proc.example")
    membership_factory(user=colleague, institution=institution, role_code="EMPLOYEE", is_primary=True)
    account = Account.objects.get(institution=institution, code="5000")
    return {"institution": institution, "buyer": buyer, "approver": approver, "staff": staff, "colleague": colleague,
            "vendor": vendor, "account": account, "tax_code": tax_code, "period": period}


def _raise_requisition(shop, quantity="10", price="25.00"):
    client = _client(shop["staff"], shop["institution"])
    created = client.post(f"{BASE}/requisitions/", {
        "title": "Printer paper", "justification": "Stock for the quarter",
        "lines": [{"description": "A4 paper, box", "quantity": quantity, "unit": "box", "estimated_unit_price": price}],
    }, format="json")
    assert created.status_code == 201, created.data
    return client, created.data


def test_requisition_to_order_to_receipt_to_bill(shop):
    institution, buyer, approver = shop["institution"], shop["buyer"], shop["approver"]
    staff_client, requisition = _raise_requisition(shop)
    assert requisition["estimated_total"] == "250.00" and requisition["currency"] == "GHS"
    url = f"{BASE}/requisitions/{requisition['id']}/"

    submitted = staff_client.post(url + "submit/")
    assert submitted.status_code == 200 and submitted.data["status"] == "PENDING"
    assert [step["step_name"] for step in submitted.data["approvals"]] == ["Procurement approval"]
    assert staff_client.post(url + "approve/", {}, format="json").status_code == 400  # never your own
    assert _client(shop["colleague"], institution).get(url).status_code == 404  # colleagues cannot see it

    approver_client = _client(approver, institution)
    inbox = approver_client.get("/api/v1/approvals/inbox/").data
    assert any(item["kind"] == "PURCHASE_REQUISITION" and item["id"] == requisition["id"] for item in inbox["items"])
    approved = approver_client.post(url + "approve/", {"comment": "Fine"}, format="json")
    assert approved.status_code == 200 and approved.data["status"] == "APPROVED", approved.data

    buyer_client = _client(buyer, institution)
    drafted = buyer_client.post(f"{BASE}/orders/from-requisition/", {
        "requisition": requisition["id"], "vendor": str(shop["vendor"].id), "order_date": "2026-01-05", "expected_date": "2026-01-12",
        "lines": [{"description": "A4 paper, box", "quantity": "10", "unit": "box", "unit_price": "24.00", "expense_account": str(shop["account"].id), "tax_code": str(shop["tax_code"].id)}],
    }, format="json")
    assert drafted.status_code == 201, drafted.data
    order = drafted.data
    assert order["status"] == "DRAFT" and order["subtotal"] == "240.00" and order["tax_total"] == "48.00" and order["total_amount"] == "288.00"
    assert staff_client.get(url).data["status"] == "ORDERED"
    order_url = f"{BASE}/orders/{order['id']}/"
    line_id = order["lines"][0]["id"]

    assert buyer_client.post(order_url + "submit/").data["status"] == "PENDING"
    blocked = buyer_client.post(order_url + "approve/")
    assert blocked.status_code == 400 and blocked.data["code"] == "separation_of_duties"
    issued = approver_client.post(order_url + "approve/")
    assert issued.status_code == 200 and issued.data["status"] == "ISSUED"

    too_many = buyer_client.post(order_url + "receive/", {"received_date": "2026-01-10", "lines": [{"order_line": line_id, "quantity": "11"}]}, format="json")
    assert too_many.status_code == 400
    part = buyer_client.post(order_url + "receive/", {"received_date": "2026-01-10", "delivery_note": "DN-1", "lines": [{"order_line": line_id, "quantity": "6", "rejected_quantity": "1", "note": "One box wet"}]}, format="json")
    assert part.status_code == 201, part.data
    assert buyer_client.get(order_url).data["status"] == "PART_RECEIVED"

    over_bill = buyer_client.post(order_url + "bill/", {"bill_number": "INV-77", "bill_date": "2026-01-15", "due_date": "2026-01-30", "lines": [{"order_line": line_id, "quantity": "7"}]}, format="json")
    assert over_bill.status_code == 400  # only 6 received
    billed = buyer_client.post(order_url + "bill/", {"bill_number": "INV-77", "bill_date": "2026-01-15", "due_date": "2026-01-30"}, format="json")
    assert billed.status_code == 201, billed.data
    bill = VendorBill.objects.get(pk=billed.data["id"])
    assert bill.status == VendorBill.Status.DRAFT and bill.vendor_id == shop["vendor"].id and bill.subtotal == Decimal("144.00") and bill.tax_total == Decimal("28.80")
    assert buyer_client.post(order_url + "bill/", {"bill_number": "INV-78", "bill_date": "2026-01-15", "due_date": "2026-01-30"}, format="json").status_code == 400  # nothing left

    match = buyer_client.get(order_url + "match/").data
    assert match["lines"][0]["received_quantity"] == "6" and match["lines"][0]["billed_quantity"] == "6" and match["lines"][0]["rejected_quantity"] == "1"
    assert match["bills"][0]["matches"] is True and match["fully_received"] is False

    commitments = buyer_client.get(f"{BASE}/orders/commitments/").data
    assert commitments["total"] == "96.00"  # 4 boxes not yet billed
    year = FiscalYear.objects.get(institution=institution, name="FY2026")
    budget = Budget.objects.create(institution=institution, name="Office", fiscal_year=year, created_by=buyer, status=Budget.Status.APPROVED)
    BudgetLine.objects.create(institution=institution, budget=budget, category="SUPPLIES", account=shop["account"], allocated=Decimal("200.00"))
    _, totals = budget_figures(budget)
    assert totals["committed"] == Decimal("96.00")  # the draft bill is not yet committed; the unbilled order is
    check = buyer_client.get(order_url + "budget-check/").data
    assert check["rows"][0]["status"] == "OVER_BUDGET"

    rest = buyer_client.post(order_url + "receive/", {"received_date": "2026-01-11", "lines": [{"order_line": line_id, "quantity": "4"}]}, format="json")
    assert rest.status_code == 201
    assert buyer_client.get(order_url).data["status"] == "RECEIVED"
    document = buyer_client.get(order_url + "document/")
    assert document.status_code == 200 and document["Content-Type"] == "application/pdf"
    assert buyer_client.post(order_url + "close/", {}, format="json").data["status"] == "CLOSED"


def test_requisition_follows_configured_workflow_and_can_be_returned(shop):
    institution = shop["institution"]
    definition = ApprovalWorkflowDefinition.objects.create(institution=institution, code="PR-ALL", name="Purchases", trigger="PURCHASE_REQUISITION")
    ApprovalWorkflowStep.objects.create(institution=institution, workflow=definition, order=1, name="Budget holder", approver_type="USER", approver_user=shop["colleague"])
    staff_client, requisition = _raise_requisition(shop)
    url = f"{BASE}/requisitions/{requisition['id']}/"
    submitted = staff_client.post(url + "submit/").data
    assert [(step["step_name"], step["approver_name"]) for step in submitted["approvals"]] == [("Budget holder", "colleague@proc.example")]

    approver_client = _client(shop["approver"], institution)
    assert approver_client.post(url + "approve/", {}, format="json").status_code == 400  # not their step
    colleague = _client(shop["colleague"], institution)
    assert colleague.get(url).status_code == 200
    assert colleague.post(url + "return/", {}, format="json").status_code == 400  # a reason is required
    returned = colleague.post(url + "return/", {"comment": "Get a second quote"}, format="json")
    assert returned.data["status"] == "RETURNED" and returned.data["decision_note"] == "Get a second quote"

    edited = staff_client.patch(url, {"lines": [{"description": "A4 paper, box", "quantity": "8", "estimated_unit_price": "22"}]}, format="json")
    assert edited.status_code == 200 and edited.data["estimated_total"] == "176.00"
    assert staff_client.post(url + "submit/").data["status"] == "PENDING"
    assert colleague.post(url + "approve/", {}, format="json").data["status"] == "APPROVED"


def test_order_cannot_be_approved_by_its_requester_and_module_is_gated(shop, institution_factory, user_factory, membership_factory):
    institution = shop["institution"]
    approver_client = _client(shop["approver"], institution)
    # The approver raises a requisition themselves; someone else approves it.
    created = approver_client.post(f"{BASE}/requisitions/", {"title": "Laptop", "lines": [{"description": "Laptop", "quantity": "1", "estimated_unit_price": "9000"}]}, format="json").data
    approver_client.post(f"{BASE}/requisitions/{created['id']}/submit/")
    _client(shop["buyer"], institution).post(f"{BASE}/requisitions/{created['id']}/approve/", {}, format="json")
    buyer_client = _client(shop["buyer"], institution)
    order = buyer_client.post(f"{BASE}/orders/from-requisition/", {"requisition": created["id"], "vendor": str(shop["vendor"].id)}, format="json").data
    assert order["lines"][0]["unit_price"] == "9000.0000"
    assert buyer_client.post(f"{BASE}/orders/{order['id']}/submit/").status_code == 400  # line has no account yet
    buyer_client.patch(f"{BASE}/orders/{order['id']}/", {"lines": [{"description": "Laptop", "quantity": "1", "unit_price": "8800", "expense_account": str(shop["account"].id)}]}, format="json")
    # Only the approver (the requester) and the buyer (the author) hold approval: nobody independent is left.
    refused = buyer_client.post(f"{BASE}/orders/{order['id']}/submit/")
    assert refused.status_code == 400 and "Nobody else" in str(refused.data)

    other = institution_factory(code="NOPROC", country_code="GH")
    _enable_accounting(other)
    admin = user_factory(email="admin@noproc.example")
    membership_factory(user=admin, institution=other, role_code="INSTITUTION_ADMIN", is_primary=True)
    assert _client(admin, other).get(f"{BASE}/orders/").status_code == 403
