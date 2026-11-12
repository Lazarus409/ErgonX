"""Data classification: how sensitive each kind of data in ErgonX is, and who may open it.

Four levels, from least to most sensitive. ``DATA_CATALOGUE`` lists every kind of personal,
pay and business data ErgonX holds, its level, the module it belongs to and the permissions
that open it. The catalogue is what the Privacy page shows, and the same levels label exports
and gate Restricted documents. tests/test_classification.py checks every field named here exists.
"""

from dataclasses import dataclass

PUBLIC = "PUBLIC"
INTERNAL = "INTERNAL"
CONFIDENTIAL = "CONFIDENTIAL"
RESTRICTED = "RESTRICTED"

LEVELS = (
    {"code": PUBLIC, "label": "Public", "rank": 0,
     "meaning": "Meant to be seen outside the organisation, such as published job adverts."},
    {"code": INTERNAL, "label": "Internal", "rank": 1,
     "meaning": "For staff of the organisation: names, departments, positions, work emails, policies."},
    {"code": CONFIDENTIAL, "label": "Confidential", "rank": 2,
     "meaning": "Personal or business data limited to the people whose work needs it."},
    {"code": RESTRICTED, "label": "Restricted", "rank": 3,
     "meaning": "Serious harm if disclosed: pay, bank and tax details, complaints, talent ratings, credentials."},
)
RANK = {level["code"]: level["rank"] for level in LEVELS}
LABEL = {level["code"]: level["label"] for level in LEVELS}


def highest(*levels):
    """The most sensitive of ``levels`` (ignores blanks); INTERNAL when none are given."""
    present = [level for level in levels if level in RANK]
    return max(present, key=RANK.__getitem__) if present else INTERNAL


@dataclass(frozen=True)
class DataCategory:
    key: str
    label: str
    module: str
    level: str
    kind: str  # Identity | Personal | Health | Location | Pay | Financial | Conduct | Performance | Recruitment | Security
    fields: tuple  # "app_label.Model.field"
    access: tuple  # permission codes that open it (any one); () means nobody can read it back
    note: str = ""


DATA_CATALOGUE = (
    # People
    DataCategory("employee_directory", "Employee names, numbers, work email and hire date", "CORE_HR", INTERNAL, "Identity",
                 ("employees.Employee.first_name", "employees.Employee.last_name", "employees.Employee.employee_number", "employees.Employee.work_email", "employees.Employee.hire_date"),
                 ("employee.view",)),
    DataCategory("employee_personal", "Date of birth, gender and personal contact details", "CORE_HR", CONFIDENTIAL, "Personal",
                 ("employees.Employee.date_of_birth", "employees.Employee.gender", "employees.Employee.personal_email", "employees.Employee.phone", "employees.Employee.mobile_phone"),
                 ("employee.view",), "Hidden from the audit trail's change values. Birthdays appear in Celebrations only by the employee's choice, without the year."),
    DataCategory("emergency_contacts", "Emergency contacts", "CORE_HR", CONFIDENTIAL, "Personal",
                 ("employees.EmergencyContact.full_name", "employees.EmergencyContact.relationship", "employees.EmergencyContact.phone", "employees.EmergencyContact.alternate_phone", "employees.EmergencyContact.address"),
                 ("employee.view",)),
    DataCategory("offboarding", "Reasons for leaving", "CORE_HR", CONFIDENTIAL, "Conduct",
                 ("employees.EmployeeOffboarding.reason",), ("employee.update",)),
    # Pay
    DataCategory("tax_and_bank", "Tax identification and bank account details", "PAYROLL", RESTRICTED, "Financial",
                 ("payroll.EmployeePayrollProfile.tax_identification_number", "payroll.EmployeePayrollProfile.bank_name", "payroll.EmployeePayrollProfile.bank_branch", "payroll.EmployeePayrollProfile.bank_sort_code", "payroll.EmployeePayrollProfile.account_number"),
                 ("payroll.view",)),
    DataCategory("salaries", "Salaries and pay components", "PAYROLL", RESTRICTED, "Pay",
                 ("compensation.EmployeeCompensation.base_salary", "compensation.EmployeePayComponent.amount"),
                 ("compensation.view",)),
    DataCategory("payroll_results", "Payroll results, payslips and adjustments", "PAYROLL", RESTRICTED, "Pay",
                 ("payroll.PayrollRecord.gross_pay", "payroll.PayrollRecord.net_pay", "payroll.PayrollItem.amount", "payroll.PayrollAdjustment.amount", "payroll.PayrollAdjustment.reason"),
                 ("payroll.view",), "Each employee also sees their own payslips."),
    DataCategory("tax_reliefs", "Tax relief claims", "PAYROLL", RESTRICTED, "Pay",
                 ("payroll.EmployeeTaxReliefClaim.claimed_amount", "payroll.EmployeeTaxReliefClaim.approved_amount"),
                 ("tax_relief.view",)),
    # Time
    DataCategory("leave_reasons", "Leave requests and their reasons", "LEAVE", CONFIDENTIAL, "Health",
                 ("leave.LeaveRequest.reason",), ("leave.approve", "leave.reject", "leave.configure"), "Sick leave reasons can describe health conditions."),
    DataCategory("clock_locations", "Where staff clocked in and out", "ATTENDANCE", CONFIDENTIAL, "Location",
                 ("attendance.AttendanceRecord.check_in_position", "attendance.AttendanceRecord.check_out_position"),
                 ("attendance.manage", "attendance.approve"), "Recorded only when a work location checks position."),
    DataCategory("attendance_corrections", "Attendance correction reasons", "ATTENDANCE", CONFIDENTIAL, "Personal",
                 ("attendance.AttendanceAdjustment.reason",), ("attendance.adjust",)),
    # Conduct and performance
    DataCategory("complaints", "Complaints and grievances", "CORE_HR", RESTRICTED, "Conduct",
                 ("complaints.Complaint.description", "complaints.Complaint.respondent_description", "complaints.Complaint.incident_location"),
                 ("complaint.view",), "Hidden from anyone the complaint names."),
    DataCategory("performance_ratings", "Performance reviews and feedback ratings", "PERFORMANCE", CONFIDENTIAL, "Performance",
                 ("performance.PerformanceReview.overall_rating", "performance.PerformanceReview.calibrated_rating", "performance.ReviewRating.self_rating", "performance.ReviewRating.manager_rating", "performance.FeedbackRating.rating"),
                 ("performance.view",)),
    DataCategory("talent_potential", "Talent grid and potential ratings", "PERFORMANCE", RESTRICTED, "Performance",
                 ("performance.TalentProfile.potential",), ("talent.view",)),
    # Recruitment
    DataCategory("job_adverts", "Published job adverts", "RECRUITMENT", PUBLIC, "Recruitment",
                 ("recruitment.JobPosting.title", "recruitment.JobPosting.description", "recruitment.JobPosting.location"),
                 ("job_posting.view",), "Shown on the public careers site once published."),
    DataCategory("candidates", "Candidates, CVs and applications", "RECRUITMENT", CONFIDENTIAL, "Recruitment",
                 ("recruitment.Candidate.first_name", "recruitment.Candidate.last_name", "recruitment.Candidate.email", "recruitment.Candidate.phone", "recruitment.Application.cover_letter", "recruitment.Application.rejection_reason"),
                 ("candidate.view",)),
    DataCategory("interview_scores", "Interview evaluations", "RECRUITMENT", CONFIDENTIAL, "Recruitment",
                 ("recruitment.CompetencyRating.rating",), ("interview.view",)),
    DataCategory("offers", "Job offers, offered salaries and signatures", "RECRUITMENT", RESTRICTED, "Pay",
                 ("recruitment.Offer.base_salary", "recruitment.Offer.candidate_signature_ip", "recruitment.Offer.candidate_signature_user_agent"),
                 ("offer.view",)),
    # Finance
    DataCategory("vendors_customers", "Supplier and customer contacts and tax numbers", "ACCOUNTING", CONFIDENTIAL, "Financial",
                 ("accounting.Vendor.phone", "accounting.Vendor.address", "accounting.Vendor.tax_identification_number", "accounting.Customer.phone", "accounting.Customer.address", "accounting.Customer.tax_identification_number"),
                 ("vendor.view", "customer.view")),
    DataCategory("ledger", "Journals, bills, invoices and payments", "ACCOUNTING", CONFIDENTIAL, "Financial",
                 ("accounting.JournalEntry.description", "accounting.JournalLine.description", "accounting.VendorBill.total_amount", "accounting.Invoice.total_amount", "accounting.Payment.amount", "accounting.Receipt.amount"),
                 ("journal.view", "vendor_bill.view", "invoice.view", "payment.view", "receipt.view")),
    DataCategory("bank_accounts", "Organisation bank accounts and statements", "ACCOUNTING", CONFIDENTIAL, "Financial",
                 ("accounting.BankAccount.bank_name", "accounting.BankAccount.masked_account_number", "accounting.BankStatementLine.description", "accounting.BankStatementLine.amount"),
                 ("bank_account.view",), "Account numbers are stored masked."),
    DataCategory("expenses", "Expense claims and receipts", "ACCOUNTING", CONFIDENTIAL, "Financial",
                 ("accounting.Expense.amount", "accounting.Expense.description", "accounting.ExpenseLine.amount", "accounting.ExpenseLine.description"),
                 ("expense.view",), "Claimants see their own claims."),
    # Security and privacy
    DataCategory("credentials", "Passwords and two-step sign-in secrets", "PLATFORM", RESTRICTED, "Security",
                 ("accounts.User.password", "accounts.UserMFA.secret"),
                 (), "Stored hashed or encrypted; nobody can read them back, including administrators."),
    DataCategory("sign_in_records", "Sign-in attempts, sessions and devices", "PLATFORM", CONFIDENTIAL, "Security",
                 ("accounts.AuthAttempt.ip_address", "accounts.UserSession.ip_address", "accounts.UserSession.user_agent"),
                 ("settings.security.manage", "audit.view")),
    DataCategory("signatures", "Policy acknowledgements and e-signatures", "CORE_HR", CONFIDENTIAL, "Security",
                 ("documents.PolicyAcknowledgement.ip_address", "documents.PolicyAcknowledgement.user_agent", "documents.SignatureRequest.ip_address", "documents.SignatureRequest.user_agent"),
                 ("policy.view", "document.view")),
    DataCategory("privacy_records", "Data subject requests and legal holds", "CORE_HR", CONFIDENTIAL, "Personal",
                 ("privacy.DataSubjectRequest.outcome", "privacy.LegalHold.reason"),
                 ("privacy.view",)),
)

# Exports are labelled with the level of the data they carry.
REPORT_LEVELS = {
    "workforce-cost": RESTRICTED,
    "payroll": RESTRICTED,
    "recruitment": CONFIDENTIAL,
    "leave": CONFIDENTIAL,
    "attendance": CONFIDENTIAL,
    "accounting": CONFIDENTIAL,
    "ap-ar": CONFIDENTIAL,
    "expenses": CONFIDENTIAL,
}


def catalogue_models(category):
    """The distinct ``app_label.Model`` names a category's fields live on."""
    return list(dict.fromkeys(field.rsplit(".", 1)[0] for field in category.fields))
