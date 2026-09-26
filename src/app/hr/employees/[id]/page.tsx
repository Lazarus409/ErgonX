"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  Mail,
  MapPin,
  Pencil,
  Save,
  ShieldCheck,
  Users,
  Plus,
  Trash2,
  X,
  Download,
  Upload,
} from "lucide-react";

import StatusBadge from "@/components/ui/StatusBadge";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import BackNavigation from "@/components/ui/BackNavigation";
import { Avatar } from "@/components/ui/Card";
import { Button, buttonClasses } from "@/components/ui/Button";
import { employeesApi, getApiErrorMessage, organizationApi } from "@/lib/api";
import { operationsApi } from "@/lib/api";
import type { DocumentRecord } from "@/types/operations";
import type { OrganizationLookups } from "@/lib/api/organization";
import type {
  EmergencyContact as ApiEmergencyContact,
  EmployeeLifecycle,
  Employee as ApiEmployee,
  Employment,
} from "@/types/hr";
import { PrintButton, PrintFooter, PrintMasthead } from "@/components/brand/PrintDocument";

interface EmployeeView {
  id: string;
  employmentId: string;
  employeeNumber: string;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: string;
  status: string;
  hireDate: string;
  employmentType: string;
  department: string;
  position: string;
  grade: string;
  location: string;
  manager: string;
}

interface EmploymentChangeForm {
  department: string;
  position: string;
  grade: string;
  location: string;
  employmentType: string;
  effectiveDate: string;
}

interface EmergencyContactView {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  address: string;
  primary: boolean;
}

function toEmergencyContactView(contact: ApiEmergencyContact): EmergencyContactView {
  return {
    id: contact.id,
    name: contact.full_name,
    relationship: contact.relationship,
    phone: contact.phone,
    email: contact.email,
    address: contact.address,
    primary: contact.is_primary,
  };
}

const emptyLookups: OrganizationLookups = {
  departments: [],
  positions: [],
  grades: [],
  locations: [],
};

function labelFor(
  items: Array<{ id: string; name?: string; title?: string }>,
  id: string | null,
): string {
  if (!id) {
    return "Not assigned";
  }

  const item = items.find((candidate) => candidate.id === id);
  return item?.name ?? item?.title ?? "Not assigned";
}

function toEmployeeView(
  employee: ApiEmployee,
  employment: Employment | undefined,
  lookups: OrganizationLookups,
): EmployeeView {
  return {
    id: employee.id,
    employmentId: employment?.id ?? "",
    employeeNumber: employee.employee_number,
    firstName: employee.first_name,
    middleName: employee.middle_name,
    lastName: employee.last_name,
    email: employee.work_email || employee.personal_email,
    phone: employee.phone,
    gender: employee.gender
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase()),
    status: employee.status,
    hireDate: employee.hire_date,
    employmentType: employment?.employment_type ?? "Not assigned",
    department: labelFor(lookups.departments, employment?.department ?? null),
    position: labelFor(lookups.positions, employment?.position ?? null),
    grade: labelFor(lookups.grades, employment?.grade ?? null),
    location: labelFor(lookups.locations, employment?.location ?? null),
    manager: "Not assigned",
  };
};


const tabs = [
  { label: "Overview", href: "#overview" },
  { label: "Current Employment", href: "#current-employment" },
  { label: "Employment History", href: "#employment-history" },
  { label: "Documents", href: "#documents" },
  { label: "Emergency Contacts", href: "#emergency-contacts" },
  { label: "Onboarding / Offboarding", href: "#onboarding-offboarding" },
  { label: "Leave", href: "#leave" },
  { label: "Attendance", href: "#attendance" },
  { label: "Compensation", href: "#compensation" },
  { label: "Payroll", href: "#payroll" },
];

function InfoItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
;
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
        {icon}
        {label}
      </div>

      <p className="mt-2 font-medium text-ink-strong">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
;
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">
        {label}
        {required && <span className="ml-1 text-danger-ink">*</span>}
      </span>

      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="w-full h-9 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink-strong outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  required?: boolean;
}) {
;
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">
        {label}
        {required && <span className="ml-1 text-danger-ink">*</span>}
      </span>

      <select
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="w-full h-9 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink-strong outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function LookupSelect({
  label,
  value,
  options,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">
        {label}
        {required && <span className="ml-1 text-danger-ink">*</span>}
      </span>

      <select
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="w-full h-9 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink-strong outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SectionCard({
  id,
  title,
  description,
  action,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-line bg-surface">
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink-strong">{title}</h2>

          {description && (
            <p className="mt-1 text-sm text-ink-muted">{description}</p>
          )}
        </div>

        {action && (
          <div className="shrink-0">
            {action}
          </div>
        )}
      </div>

      <div className="p-6">{children}</div>
    </section>
  );
}

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const editMode = searchParams.get("edit") === "true";
  const [employee, setEmployee] = useState<EmployeeView | null>(null);
  const [formData, setFormData] = useState<EmployeeView | null>(null);
  const [employmentHistory, setEmploymentHistory] = useState<Employment[]>([]);
  const [lookups, setLookups] = useState<OrganizationLookups>(emptyLookups);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(editMode);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showEmploymentChange, setShowEmploymentChange] = useState(false);
  const [isRehire, setIsRehire] = useState(false);
  const [employmentChange, setEmploymentChange] =
    useState<EmploymentChangeForm | null>(null);
  const [changingEmployment, setChangingEmployment] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContactView[]>([]);
  const [showEmergencyForm, setShowEmergencyForm] = useState(false);
  const [editingEmergencyId, setEditingEmergencyId] = useState<string | null>(null);
  const [emergencyForm, setEmergencyForm] = useState({
    name: "",
    relationship: "",
    phone: "",
    email: "",
    address: "",
    primary: false,
  });
  const [lifecycle, setLifecycle] = useState<EmployeeLifecycle | null>(null);
  const [lifecycleSaving, setLifecycleSaving] = useState(false);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [documentUploading, setDocumentUploading] = useState(false);
  const [documentProgress, setDocumentProgress] = useState(0);
  const [documentActionId, setDocumentActionId] = useState<string | null>(null);

  const updateField = (field: keyof EmployeeView, value: string) => {
    setFormData((current) => ({
      ...(current as EmployeeView),
      [field]: value,
    }));
  };

  useEffect(() => {
    let active = true;

    async function loadEmployee() {
      setLoading(true);
      setLoadError(null);

      try {
        const [record, history, referenceData, contacts, lifecycleData, documentData] = await Promise.all([
          employeesApi.getEmployee(params.id),
          employeesApi.listEmploymentHistory(params.id),
          organizationApi.loadOrganizationLookups(),
          employeesApi.listEmergencyContacts(params.id),
          employeesApi.getEmployeeLifecycle(params.id),
          operationsApi.listDocuments({ entity_type: "employees.Employee", entity_id: params.id, is_active: true, page_size: 100 }),
        ]);
        const currentEmployment = history.results.find(
          (employment) => employment.is_current,
        );

        if (!active) {
          return;
        }

        const view = toEmployeeView(record, currentEmployment, referenceData);
        setEmployee(view);
        setFormData(view);
        setEmploymentHistory(history.results);
        setLookups(referenceData);
        setEmergencyContacts(contacts.results.map(toEmergencyContactView));
        setLifecycle(lifecycleData);
        setDocuments(documentData.results);
        setDocumentsError(null);
      } catch (caught) {
        if (active) {
          setLoadError(getApiErrorMessage(caught));
          setDocumentsError(getApiErrorMessage(caught));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadEmployee();

    return () => {
      active = false;
    };
  }, [params.id]);

  const uploadEmployeeDocument = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > operationsApi.MAX_DOCUMENT_BYTES) {
      setDocumentsError("Employee documents must be 25 MB or smaller.");
      return;
    }
    setDocumentUploading(true);
    setDocumentProgress(0);
    setDocumentsError(null);
    try {
      const uploaded = await operationsApi.uploadDocument(
        file,
        { category: "EMPLOYEE_DOCUMENT", classification: "CONFIDENTIAL", entity_type: "employees.Employee", entity_id: params.id },
        setDocumentProgress,
      );
      setDocuments((current) => [uploaded, ...current]);
    } catch (caught) {
      setDocumentsError(getApiErrorMessage(caught));
    } finally {
      setDocumentUploading(false);
    }
  };

  const downloadEmployeeDocument = async (document: DocumentRecord) => {
    try {
      const blob = await operationsApi.downloadDocument(document.id);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = document.original_filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setDocumentsError(getApiErrorMessage(caught));
    }
  };

  const deactivateEmployeeDocument = async (document: DocumentRecord) => {
    if (!window.confirm(`Deactivate ${document.original_filename}? It will remain in history but no longer be active.`)) return;
    setDocumentActionId(document.id);
    setDocumentsError(null);
    try {
      await operationsApi.deactivateDocument(document.id);
      setDocuments((current) => current.filter((item) => item.id !== document.id));
    } catch (caught) {
      setDocumentsError(getApiErrorMessage(caught));
    } finally {
      setDocumentActionId(null);
    }
  };

  const startEditing = () => {
    if (!employee) return;
    setFormData(employee);
    setSavedMessage("");
    setSaveError(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setFormData(employee);
    setSavedMessage("");
    setSaveError(null);
    setShowSaveConfirmation(false);
    setIsEditing(false);
  };

  const requestSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setShowSaveConfirmation(true);
  };

  const confirmSave = async () => {
    if (!formData || saving) return;

    setSaving(true);

    try {
      const updated = await employeesApi.updateEmployee(formData.id, {
        first_name: formData.firstName.trim(),
        middle_name: formData.middleName.trim(),
        last_name: formData.lastName.trim(),
        work_email: formData.email.trim(),
        phone: formData.phone.trim(),
        gender: formData.gender
          .toUpperCase()
          .replace(/\s+/g, "_"),
        hire_date: formData.hireDate,
      });
      const currentEmployment = employmentHistory.find(
        (employment) => employment.is_current,
      );
      const view = toEmployeeView(updated, currentEmployment, lookups);

      setEmployee(view);
      setFormData(view);
      setShowSaveConfirmation(false);
      setIsEditing(false);
      setSavedMessage("Employee profile details saved.");
    } catch (caught) {
      setShowSaveConfirmation(false);
      setSaveError(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const currentEmployment = employmentHistory.find(
    (employment) => employment.is_current,
  );

  const openEmploymentChange = () => {
    setSavedMessage("");
    setSaveError(null);
    setEmploymentChange({
      department: currentEmployment?.department ?? "",
      position: currentEmployment?.position ?? "",
      grade: currentEmployment?.grade ?? "",
      location: currentEmployment?.location ?? "",
      employmentType: currentEmployment?.employment_type ?? "",
      effectiveDate: "",
    });
    setIsRehire(employee?.status === "TERMINATED" || employee?.status === "INACTIVE");
    setShowEmploymentChange(true);
  };

  const updateEmploymentChange = (
    field: keyof EmploymentChangeForm,
    value: string,
  ) => {
    setEmploymentChange((current) =>
      current ? { ...current, [field]: value } : current,
    );
  };

  const saveEmploymentChange = async () => {
    if (!employee || !employmentChange || changingEmployment) {
      return;
    }

    if (
      !employmentChange.grade ||
      !employmentChange.location ||
      !employmentChange.employmentType ||
      !employmentChange.effectiveDate
      || (isRehire && (!employmentChange.department || !employmentChange.position))
    ) {
      setSaveError(
        "Effective date, department, position, grade, location, and employment type are required for rehire.",
      );
      return;
    }

    setChangingEmployment(true);
    setSaveError(null);

    try {
      const created = isRehire ? (await employeesApi.rehireEmployee(employee.id, {
        department_id: employmentChange.department,
        position_id: employmentChange.position,
        grade_id: employmentChange.grade,
        location_id: employmentChange.location,
        employment_type: employmentChange.employmentType,
        staff_category: currentEmployment?.staff_category ?? "OTHER",
        start_date: employmentChange.effectiveDate,
      })).employment : await employeesApi.createEmployment({
        employee: employee.id,
        department: employmentChange.department || null,
        position: employmentChange.position || null,
        grade: employmentChange.grade,
        location: employmentChange.location,
        employment_type: employmentChange.employmentType,
        reports_to: currentEmployment?.reports_to ?? null,
        staff_category: currentEmployment?.staff_category ?? "OTHER",
        start_date: employmentChange.effectiveDate,
      });
      const [profile, history] = await Promise.all([
        employeesApi.getEmployee(employee.id),
        employeesApi.listEmploymentHistory(employee.id),
      ]);
      const view = toEmployeeView(profile, created, lookups);

      setEmploymentHistory(history.results);
      setEmployee(view);
      setFormData(view);
      setShowEmploymentChange(false);
      setEmploymentChange(null);
      setSavedMessage(isRehire ? "Employee rehired and onboarding started." : "Employment assignment changed and prior history preserved.");
    } catch (caught) {
      setSaveError(getApiErrorMessage(caught));
    } finally {
      setChangingEmployment(false);
    }
  };

  const resetEmergencyForm = () => {
    setEmergencyForm({
      name: "",
      relationship: "",
      phone: "",
      email: "",
      address: "",
    primary: false,
    });
    setEditingEmergencyId(null);
    setShowEmergencyForm(false);
  };

  const openAddEmergencyForm = () => {
    setEmergencyForm({
      name: "",
      relationship: "",
      phone: "",
      email: "",
      address: "",
    primary: false,
    });
    setEditingEmergencyId(null);
    setShowEmergencyForm(true);
  };

  const openEditEmergencyForm = (
    contact: (typeof emergencyContacts)[number]
  ) => {
    setEmergencyForm({
      name: contact.name,
      relationship: contact.relationship,
      phone: contact.phone,
      email: contact.email,
      address: contact.address,
      primary: contact.primary,
    });
    setEditingEmergencyId(contact.id);
    setShowEmergencyForm(true);
  };

  const saveEmergencyContact = async () => {
    if (
      !emergencyForm.name.trim() ||
      !emergencyForm.relationship.trim() ||
      !emergencyForm.phone.trim() ||
      !employee
    ) {
      return;
    }

    setSaveError(null);
    try {
      const payload = {
        employee: employee.id,
        full_name: emergencyForm.name.trim(),
        relationship: emergencyForm.relationship.trim(),
        phone: emergencyForm.phone.trim(),
        email: emergencyForm.email.trim(),
        address: emergencyForm.address.trim(),
        is_primary: emergencyForm.primary,
      };

      if (editingEmergencyId) {
        await employeesApi.updateEmergencyContact(editingEmergencyId, payload);
      } else {
        await employeesApi.createEmergencyContact(payload);
      }

      const contacts = await employeesApi.listEmergencyContacts(employee.id);
      setEmergencyContacts(contacts.results.map(toEmergencyContactView));
      resetEmergencyForm();
      setSavedMessage("Emergency contact saved.");
    } catch (caught) {
      setSaveError(getApiErrorMessage(caught));
    }
  };

  const deleteEmergencyContact = async (id: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this emergency contact?"
      )
    ) {
      return;
    }

    try {
      await employeesApi.deleteEmergencyContact(id);
      setEmergencyContacts((contacts) => contacts.filter((contact) => contact.id !== id));
      setSavedMessage("Emergency contact removed.");
    } catch (caught) {
      setSaveError(getApiErrorMessage(caught));
    }
  };

  const runLifecycleAction = async (
    action: "onboarding-start" | "onboarding-complete" | "offboarding-start" | "offboarding-complete",
  ) => {
    if (!employee || lifecycleSaving) return;

    const isOffboardingCompletion = action === "offboarding-complete";
    if (isOffboardingCompletion && !window.confirm("Complete offboarding? This ends the employee's current employment and deactivates their membership in this institution.")) {
      return;
    }

    setLifecycleSaving(true);
    setSaveError(null);
    try {
      if (action === "onboarding-start") await employeesApi.startEmployeeOnboarding(employee.id);
      if (action === "onboarding-complete") await employeesApi.completeEmployeeOnboarding(employee.id);
      if (action === "offboarding-start") await employeesApi.startEmployeeOffboarding(employee.id);
      if (action === "offboarding-complete") await employeesApi.completeEmployeeOffboarding(employee.id);

      const [nextLifecycle, nextEmployee, history] = await Promise.all([
        employeesApi.getEmployeeLifecycle(employee.id),
        employeesApi.getEmployee(employee.id),
        employeesApi.listEmploymentHistory(employee.id),
      ]);
      const current = history.results.find((employment) => employment.is_current);
      const view = toEmployeeView(nextEmployee, current, lookups);
      setLifecycle(nextLifecycle);
      setEmploymentHistory(history.results);
      setEmployee(view);
      setFormData(view);
      setSavedMessage("Employee lifecycle updated.");
    } catch (caught) {
      setSaveError(getApiErrorMessage(caught));
    } finally {
      setLifecycleSaving(false);
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  if (loadError) {
    return (
      <ErrorState
        title="Unable to load employee"
        message={loadError}
      />
    );
  }

  if (!employee || !formData) {
    return <ErrorState message="The employee record could not be found." />;
  }

  return (
    <div className="space-y-6">
      <PrintMasthead documentTitle="Employee record" reference={employee.employeeNumber} />
      <div className="print:hidden"><BackNavigation fallback="/hr/employees" label="Back to Employees" /></div>

      {savedMessage && (
        <div className="rounded-xl border border-success/25 bg-success-soft px-4 py-3 text-sm text-success-ink">
          {savedMessage}
        </div>
      )}

      {saveError && (
        <ErrorState title="Unable to save employee" message={saveError} />
      )}

      {showEmploymentChange && employmentChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-ink-strong">
              Change Employment Assignment
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              This creates a new current employment record from the effective
              date. The backend closes the prior assignment and retains the
              complete history.
            </p>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field
                label="Effective Date"
                type="date"
                value={employmentChange.effectiveDate}
                required
                onChange={(value) => updateEmploymentChange("effectiveDate", value)}
              />

              <LookupSelect
                label="Employment Type"
                value={employmentChange.employmentType}
                required
                options={[
                  { value: "PERMANENT", label: "Permanent" },
                  { value: "CONTRACT", label: "Contract" },
                  { value: "TEMPORARY", label: "Temporary" },
                  { value: "INTERN", label: "Intern" },
                  { value: "CASUAL", label: "Casual" },
                ]}
                onChange={(value) => updateEmploymentChange("employmentType", value)}
              />

              <LookupSelect
                label="Department"
                value={employmentChange.department}
                options={lookups.departments.map((department) => ({
                  value: department.id,
                  label: department.name,
                }))}
                onChange={(value) => {
                  updateEmploymentChange("department", value);
                  updateEmploymentChange("position", "");
                }}
              />

              <LookupSelect
                label="Position"
                value={employmentChange.position}
                options={lookups.positions
                  .filter(
                    (position) =>
                      !employmentChange.department ||
                      position.department === employmentChange.department,
                  )
                  .map((position) => ({
                    value: position.id,
                    label: position.title,
                  }))}
                onChange={(value) => updateEmploymentChange("position", value)}
              />

              <LookupSelect
                label="Grade"
                value={employmentChange.grade}
                required
                options={lookups.grades.map((grade) => ({
                  value: grade.id,
                  label: grade.name,
                }))}
                onChange={(value) => updateEmploymentChange("grade", value)}
              />

              <LookupSelect
                label="Location"
                value={employmentChange.location}
                required
                options={lookups.locations.map((location) => ({
                  value: location.id,
                  label: location.name,
                }))}
                onChange={(value) => updateEmploymentChange("location", value)}
              />
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowEmploymentChange(false);
                  setEmploymentChange(null);
                }}
                disabled={changingEmployment}
                className={buttonClasses({ variant: "secondary" })}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveEmploymentChange()}
                disabled={changingEmployment}
                className={buttonClasses({ variant: "primary" })}
              >
                <Save className="h-4 w-4" />
                {changingEmployment ? "Saving..." : "Confirm Change"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-surface p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={`${employee.firstName} ${employee.lastName}`} size="lg" />

            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-title font-semibold tracking-tight text-ink-strong">
                  {employee.firstName} {employee.middleName}{" "}
                  {employee.lastName}
                </h1>

                <StatusBadge status={employee.status} />
              </div>

              <p className="mt-1 text-sm text-ink-muted">
                {employee.employeeNumber} · {employee.position}
              </p>

              <div className="mt-2 flex flex-wrap gap-4 text-sm text-ink-muted">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {employee.location}
                </span>

                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-4 w-4" />
                  Joined{" "}
                  {new Date(employee.hireDate).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>

          {!isEditing && (
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <PrintButton />
              <Button onClick={startEditing} leadingIcon={<Pencil className="h-4 w-4" />}>
                Edit Employee
              </Button>
            </div>
          )}
        </div>
      </div>

      {!isEditing && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <div className="flex min-w-max">
              {tabs.map((tab, index) => (
                <a
                  key={tab.label}
                  href={tab.href}
                  className={`border-b-2 px-5 py-4 text-sm font-medium ${
                    index === 0
                      ? "border-primary text-ink-strong"
                      : "border-transparent text-ink-muted hover:text-ink-strong"
                  }`}
                >
                  {tab.label}
                </a>
              ))}
            </div>
          </div>

          <SectionCard
            id="overview"
            title="Personal Information"
            description="Basic employee profile information."
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <InfoItem label="First Name" value={employee.firstName} />
              <InfoItem label="Middle Name" value={employee.middleName} />
              <InfoItem label="Last Name" value={employee.lastName} />
              <InfoItem label="Gender" value={employee.gender} />

              <InfoItem
                label="Email"
                value={employee.email}
                icon={<Mail className="h-3.5 w-3.5" />}
              />

              <InfoItem label="Phone" value={employee.phone} />
              <InfoItem
                label="Employee Number"
                value={employee.employeeNumber}
              />

              <InfoItem
                label="Hire Date"
                value={new Date(employee.hireDate).toLocaleDateString(
                  "en-GB",
                  {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  }
                )}
              />
            </div>
          </SectionCard>

          <SectionCard
            id="current-employment"
            title="Current Employment"
            description="The employee's current employment assignment."
            action={
              <button
                type="button"
                onClick={openEmploymentChange}
                className={buttonClasses({ variant: "secondary" })}
              >
                <BriefcaseBusiness className="h-4 w-4" />
                Change Assignment
              </button>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <InfoItem
                label="Department"
                value={employee.department}
                icon={<BriefcaseBusiness className="h-3.5 w-3.5" />}
              />

              <InfoItem label="Position" value={employee.position} />
              <InfoItem label="Grade" value={employee.grade} />
              <InfoItem label="Location" value={employee.location} />
              <InfoItem
                label="Employment Type"
                value={employee.employmentType}
              />

              <InfoItem
                label="Manager"
                value={employee.manager}
                icon={<Users className="h-3.5 w-3.5" />}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Account Access"
            description="User account and access status for this employee."
          >
            <div className="flex items-center justify-between rounded-xl border border-line p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-surface-sunken p-2">
                  <ShieldCheck className="h-5 w-5 text-ink-muted" />
                </div>

                <div>
                  <p className="font-medium text-ink-strong">
                    Account Active
                  </p>

                  <p className="text-sm text-ink-muted">
                    The employee has an active system account.
                  </p>
                </div>
              </div>

              <StatusBadge status="ACTIVE" />
            </div>
          </SectionCard>

          <SectionCard
            id="employment-history"
            title="Employment History"
            description="Historical employment assignments are preserved and are not overwritten."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-ink-muted">
                    <th className="px-4 py-3 font-medium">Department</th>
                    <th className="px-4 py-3 font-medium">Position</th>
                    <th className="px-4 py-3 font-medium">Grade</th>
                    <th className="px-4 py-3 font-medium">Location</th>
                    <th className="px-4 py-3 font-medium">Start Date</th>
                    <th className="px-4 py-3 font-medium">End Date</th>
                  </tr>
                </thead>

                <tbody>
                  {employmentHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-ink-muted">
                        No employment history is available.
                      </td>
                    </tr>
                  ) : (
                    employmentHistory.map((employment) => (
                      <tr key={employment.id} className="border-b border-line-soft">
                        <td className="px-4 py-4">
                          {labelFor(lookups.departments, employment.department)}
                        </td>
                        <td className="px-4 py-4">
                          {labelFor(lookups.positions, employment.position)}
                        </td>
                        <td className="px-4 py-4">
                          {labelFor(lookups.grades, employment.grade)}
                        </td>
                        <td className="px-4 py-4">
                          {labelFor(lookups.locations, employment.location)}
                        </td>
                        <td className="px-4 py-4">
                          {new Date(employment.start_date).toLocaleDateString("en-GB")}
                        </td>
                        <td className="px-4 py-4 text-ink-muted">
                          {employment.is_current
                            ? "Current"
                            : employment.end_date
                              ? new Date(employment.end_date).toLocaleDateString("en-GB")
                              : "Not recorded"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard
            id="documents"
            title="Documents"
            description="Upload and review protected documents associated with this employee."
            action={
              <label className={buttonClasses({ variant: "primary" })}>
                <Upload className="h-4 w-4" />
                {documentUploading ? `Uploading… ${documentProgress}%` : "Add Document"}
                <input
                  type="file"
                  className="sr-only"
                  disabled={documentUploading}
                  onChange={(event) => {
                    void uploadEmployeeDocument(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            }
          >
            {documentsError && <p className="mb-4 rounded-lg border border-danger/25 bg-danger-soft p-3 text-sm text-danger-ink">{documentsError}</p>}
            {documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong py-10 text-center">
                <FileText className="h-10 w-10 text-ink-subtle" />
                <h3 className="mt-3 font-medium text-ink-strong">No documents available</h3>
                <p className="mt-1 text-sm text-ink-muted">Add an employee document to make it available to authorized users.</p>
              </div>
            ) : (
              <div className="divide-y divide-line-soft rounded-xl border border-line">
                {documents.map((document) => (
                  <div key={document.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink-strong">{document.original_filename}</p>
                      <p className="mt-1 text-xs text-ink-muted">{document.category || "Employee document"} · {(document.size_bytes / 1024).toFixed(0)} KB · {new Date(document.created_at).toLocaleDateString("en-GB")}</p>
                    </div>
                    <div className="flex shrink-0 gap-2 self-start sm:self-auto">
                      <button type="button" onClick={() => void downloadEmployeeDocument(document)} className={buttonClasses({ variant: "secondary" })} title="Download document">
                        <Download className="h-4 w-4" />
                        Download
                      </button>
                      <button type="button" onClick={() => void deactivateEmployeeDocument(document)} disabled={documentActionId === document.id} className="rounded-lg border border-danger/25 px-3 py-2 text-sm font-medium text-danger-ink hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-60">
                        {documentActionId === document.id ? "Deactivating…" : "Deactivate"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            id="emergency-contacts"
            title="Emergency Contacts"
            description="Emergency contact records for this employee."
            action={
              <button
                type="button"
                onClick={openAddEmergencyForm}
                className={buttonClasses({ variant: "primary" })}
              >
                <Plus className="h-4 w-4" />
                Add Contact
              </button>
            }
          >
            {showEmergencyForm && (
              <div className="mb-6 rounded-xl border border-line bg-surface-muted p-5">
                <div className="mb-5">
                  <h3 className="text-sm font-semibold text-ink-strong">
                    {editingEmergencyId
                      ? "Edit Emergency Contact"
                      : "Add Emergency Contact"}
                  </h3>

                  <p className="mt-1 text-xs text-ink-muted">
                    Enter the contact details for this employee.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-ink">
                      Full Name
                    </label>

                    <input
                      value={emergencyForm.name}
                      onChange={(event) =>
                        setEmergencyForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="Enter full name"
                      className="w-full h-9 rounded-lg border border-line-strong bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-ink">
                      Address
                    </label>

                    <input
                      value={emergencyForm.address}
                      onChange={(event) =>
                        setEmergencyForm((current) => ({
                          ...current,
                          address: event.target.value,
                        }))
                      }
                      placeholder="Optional residential address"
                      className="w-full h-9 rounded-lg border border-line-strong bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-ink">
                      Relationship
                    </label>

                    <input
                      value={emergencyForm.relationship}
                      onChange={(event) =>
                        setEmergencyForm((current) => ({
                          ...current,
                          relationship: event.target.value,
                        }))
                      }
                      placeholder="e.g. Parent, Spouse, Brother"
                      className="w-full h-9 rounded-lg border border-line-strong bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-ink">
                      Phone Number
                    </label>

                    <input
                      type="tel"
                      value={emergencyForm.phone}
                      onChange={(event) =>
                        setEmergencyForm((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                      placeholder="+233..."
                      className="w-full h-9 rounded-lg border border-line-strong bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-ink">
                      Email
                    </label>

                    <input
                      type="email"
                      value={emergencyForm.email}
                      onChange={(event) =>
                        setEmergencyForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                      placeholder="contact@example.com"
                      className="w-full h-9 rounded-lg border border-line-strong bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </div>

                  <label className="flex items-center gap-3 md:col-span-2">
                    <input
                      type="checkbox"
                      checked={emergencyForm.primary}
                      onChange={(event) =>
                        setEmergencyForm((current) => ({
                          ...current,
                          primary: event.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-line-strong"
                    />

                    <span className="text-sm text-ink">
                      Set as primary emergency contact
                    </span>
                  </label>
                </div>

                <div className="mt-5 flex justify-end gap-3 border-t border-line pt-4">
                  <button
                    type="button"
                    onClick={resetEmergencyForm}
                    className={buttonClasses({ variant: "secondary" })}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => void saveEmergencyContact()}
                    className={buttonClasses({ variant: "primary" })}
                  >
                    {editingEmergencyId ? "Save Changes" : "Add Contact"}
                  </button>
                </div>
              </div>
            )}

            {emergencyContacts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line-strong p-8 text-center">
                <Users className="mx-auto h-9 w-9 text-ink-subtle" />

                <p className="mt-3 font-medium text-ink-strong">
                  No emergency contacts
                </p>

                <p className="mt-1 text-sm text-ink-muted">
                  Add an emergency contact for this employee.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {emergencyContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="rounded-xl border border-line p-4"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-ink-strong">
                            {contact.name}
                          </h3>

                          {contact.primary && (
                            <span className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink">
                              Primary
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-sm text-ink-muted">
                          {contact.relationship}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditEmergencyForm(contact)}
                          className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-ink hover:bg-surface-hover"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => void deleteEmergencyContact(contact.id)}
                          className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-danger-ink hover:bg-danger-soft"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 border-t border-line-soft pt-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                          Phone
                        </p>
                        <p className="mt-1 text-sm text-ink">
                          {contact.phone}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                          Email
                        </p>
                        <p className="mt-1 break-all text-sm text-ink">
                          {contact.email || "Not provided"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            id="onboarding-offboarding"
            title="Onboarding / Offboarding"
            description="Lifecycle transitions are completed by the backend and cannot be edited directly."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-line bg-surface p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-ink-strong">
                      Onboarding
                    </h3>

                    <p className="mt-1 text-sm text-ink-muted">Activate the onboarding workflow once employment is ready.</p>
                  </div>

                  <StatusBadge status={lifecycle?.onboarding?.status ?? "NOT_STARTED"} />
                </div>

                <div className="mt-5 border-t border-line-soft pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Current Status
                  </p>

                  <p className="mt-1 text-sm font-medium text-ink-strong">
                    {(lifecycle?.onboarding?.status ?? "NOT_STARTED").replaceAll("_", " ")}
                  </p>
                  {lifecycle?.onboarding?.notes && <p className="mt-2 text-sm text-warning-ink">{lifecycle.onboarding.notes}</p>}
                  <div className="mt-4 flex gap-2">
                    {lifecycle?.onboarding?.status !== "COMPLETED" && <button type="button" onClick={() => void runLifecycleAction("onboarding-start")} disabled={lifecycleSaving} className={buttonClasses({ variant: "secondary" })}>Start</button>}
                    {lifecycle?.onboarding?.status !== "COMPLETED" && <button type="button" onClick={() => void runLifecycleAction("onboarding-complete")} disabled={lifecycleSaving} className={buttonClasses({ variant: "primary" })}>Complete</button>}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-ink-strong">
                      Offboarding
                    </h3>

                    <p className="mt-1 text-sm text-ink-muted">Start before the employee&apos;s final working day; completion is irreversible.</p>
                  </div>

                  <StatusBadge status={lifecycle?.offboarding?.status ?? "NOT_STARTED"} />
                </div>

                <div className="mt-5 border-t border-line-soft pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Current Status
                  </p>

                  <p className="mt-1 text-sm font-medium text-ink-strong">
                    {(lifecycle?.offboarding?.status ?? "NOT_STARTED").replaceAll("_", " ")}
                  </p>
                  {lifecycle?.offboarding?.notes && <p className="mt-2 text-sm text-warning-ink">{lifecycle.offboarding.notes}</p>}
                  <div className="mt-4 flex gap-2">
                    {(employee.status === "TERMINATED" || employee.status === "INACTIVE") && <button type="button" onClick={openEmploymentChange} disabled={lifecycleSaving} className="rounded-lg bg-success px-3 py-2 text-sm font-medium text-white hover:bg-success/90 disabled:opacity-50">Rehire</button>}
                    {lifecycle?.offboarding?.status !== "COMPLETED" && <button type="button" onClick={() => void runLifecycleAction("offboarding-start")} disabled={lifecycleSaving} className={buttonClasses({ variant: "secondary" })}>Start</button>}
                    {lifecycle?.offboarding?.status !== "COMPLETED" && <button type="button" onClick={() => void runLifecycleAction("offboarding-complete")} disabled={lifecycleSaving} className={buttonClasses({ variant: "danger" })}>Complete</button>}
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          <div className="grid gap-6 lg:grid-cols-3">
            <SectionCard
              id="leave"
              title="Leave"
              description="Leave information for this employee."
            >
              <div className="space-y-4">
                <div className="rounded-xl border border-line bg-surface p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-ink-strong">
                        Employee Leave
                      </h3>

                      <p className="mt-1 text-sm text-ink-muted">
                        Leave records and requests for this employee will be
                        displayed here when available.
                      </p>
                    </div>

                    <Link
                      href="/leave/requests"
                      className={buttonClasses({ variant: "secondary" })}
                    >
                      View Leave Requests
                    </Link>
                  </div>
                </div>

                <div className="rounded-xl border border-dashed border-line-strong bg-surface-muted p-5">
                  <p className="text-sm text-ink-muted">
                    Employee leave data will be populated when the Leave
                    module API integration is available.
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard id="attendance" title="Attendance">
              <p className="text-sm text-ink-muted">
                Attendance information will be displayed when available.
              </p>
            </SectionCard>

            <SectionCard id="compensation" title="Compensation">
              <p className="text-sm text-ink-muted">
                Compensation information is permission-protected.
              </p>
            </SectionCard>
          </div>

          <SectionCard
            id="payroll"
            title="Payroll"
            description="Employee payroll information."
          >
            <div className="rounded-xl border border-line bg-surface p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-sunken">
                  <ShieldCheck className="h-5 w-5 text-ink-muted" />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-ink-strong">
                    Permission-Protected Payroll
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-ink-muted">
                    Payroll information is restricted to authorised users.
                    Payroll records and related information will be displayed
                    here when the Payroll module integration is available.
                  </p>

                  <div className="mt-4 rounded-lg bg-surface-muted px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                      Integration Status
                    </p>

                    <p className="mt-1 text-sm font-medium text-ink">
                      Pending backend integration
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </>
      )}

      {isEditing && (
        <form onSubmit={requestSave} className="space-y-6">
          <SectionCard
            title="Edit Personal Details"
            description="Update the employee's basic profile information."
          >
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Field
                label="First Name"
                value={formData.firstName}
                required
                onChange={(value) => updateField("firstName", value)}
              />

              <Field
                label="Middle Name"
                value={formData.middleName}
                onChange={(value) => updateField("middleName", value)}
              />

              <Field
                label="Last Name"
                value={formData.lastName}
                required
                onChange={(value) => updateField("lastName", value)}
              />

              <SelectField
                label="Gender"
                value={formData.gender}
                required
                options={["Male", "Female", "Other", "Prefer Not To Say"]}
                onChange={(value) => updateField("gender", value)}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Edit Contact Details"
            description="Update the employee's contact information."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Email"
                type="email"
                value={formData.email}
                required
                onChange={(value) => updateField("email", value)}
              />

              <Field
                label="Phone"
                value={formData.phone}
                required
                onChange={(value) => updateField("phone", value)}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Edit Employee Details"
            description="Update the employee's core employment information."
          >
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <InfoItem label="Employee Number" value={formData.employeeNumber} />

              <Field
                label="Hire Date"
                type="date"
                value={formData.hireDate}
                required
                onChange={(value) => updateField("hireDate", value)}
              />

              <SelectField
                label="Employment Type"
                value={formData.employmentType}
                required
                options={["Full Time", "Part Time", "Contract", "Temporary"]}
                onChange={(value) => updateField("employmentType", value)}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Current Employment Assignment"
            description="Employment assignments are effective-dated and cannot be overwritten from this profile form."
          >
            <div className="mb-4 rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm text-warning-ink">
              Emergency-contact and lifecycle changes are currently session-only in the frontend. They will not be retained after a refresh until the backend exposes the corresponding endpoints.
            </div>
            <div className="rounded-xl border border-dashed border-line-strong bg-surface-muted p-4 text-sm text-ink-muted">
              Save profile changes first, then use Change Assignment on the
              profile to create an effective-dated employment change safely.
            </div>
          </SectionCard>

          <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-xl border border-line bg-surface/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={cancelEditing}
              className={buttonClasses({ variant: "secondary" })}
            >
              <X className="h-4 w-4" />
              Cancel
            </button>

            <button
              type="submit"
              className={buttonClasses({ variant: "primary" })}
            >
              <Save className="h-4 w-4" />
              Save Changes
            </button>
          </div>

          {showSaveConfirmation && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4">
              <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
                <h2 className="text-lg font-semibold text-ink-strong">
                  Confirm Changes
                </h2>

                <p className="mt-2 text-sm leading-6 text-ink-muted">
                  Are you sure you want to save these employee changes?
                  Employment history will remain preserved.
                </p>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSaveConfirmation(false)}
                    className={buttonClasses({ variant: "secondary" })}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => void confirmSave()}
                    disabled={saving}
                    className={buttonClasses({ variant: "primary" })}
                  >
                    <Save className="h-4 w-4" />
                    {saving ? "Saving..." : "Confirm Save"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      )}

      <PrintFooter />
    </div>
  );
}
