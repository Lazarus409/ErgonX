"use client";

import {
  ArrowLeft,
  Check,
  ChevronDown,
  Mail,
  Save,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import ErrorState from "@/components/ui/ErrorState";
import {
  employeesApi,
  getApiErrorMessage,
  isApiRequestError,
  organizationApi,
} from "@/lib/api";
import type { OrganizationLookups } from "@/lib/api/organization";
import type { EmploymentType, Gender } from "@/types/hr";

type FormData = {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  phone: string;
  employeeNumber: string;
  hireDate: string;
  gender: string;
  department: string;
  position: string;
  grade: string;
  location: string;
  employmentType: string;
  inviteAccount: boolean;
};

const initialForm: FormData = {
  firstName: "",
  middleName: "",
  lastName: "",
  email: "",
  phone: "",
  employeeNumber: "",
  hireDate: "",
  gender: "",
  department: "",
  position: "",
  grade: "",
  location: "",
  employmentType: "",
  inviteAccount: false,
};

const emptyLookups: OrganizationLookups = {
  departments: [],
  positions: [],
  grades: [],
  locations: [],
};

const genderOptions: Array<{ value: Gender; label: string }> = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
];

const employmentTypeOptions: Array<{ value: EmploymentType; label: string }> = [
  { value: "PERMANENT", label: "Permanent" },
  { value: "CONTRACT", label: "Contract" },
  { value: "TEMPORARY", label: "Temporary" },
  { value: "INTERN", label: "Intern" },
  { value: "CASUAL", label: "Casual" },
];

export default function CreateEmployeePage() {
  const [form, setForm] = useState<FormData>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [lookups, setLookups] = useState<OrganizationLookups>(emptyLookups);
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [lookupsError, setLookupsError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [invitationStatus, setInvitationStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadLookups() {
      setLookupsLoading(true);
      setLookupsError(null);

      try {
        const result = await organizationApi.loadOrganizationLookups();

        if (active) {
          setLookups(result);
        }
      } catch (caught) {
        if (active) {
          setLookupsError(getApiErrorMessage(caught));
        }
      } finally {
        if (active) {
          setLookupsLoading(false);
        }
      }
    }

    loadLookups();

    return () => {
      active = false;
    };
  }, []);

  const positions = useMemo(
    () =>
      lookups.positions.filter(
        (position) => !form.department || position.department === form.department,
      ),
    [lookups.positions, form.department],
  );

  const updateField = (
    field: keyof FormData,
    value: string | boolean,
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors((current) => {
        const next = { ...current };
        delete next[field];
        return next;
      });
    }

    setSaved(false);
    setInvitationStatus(null);
    setSubmitError(null);
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!form.firstName.trim()) {
      nextErrors.firstName = "First name is required.";
    }

    if (!form.lastName.trim()) {
      nextErrors.lastName = "Last name is required.";
    }

    if (!form.email.trim()) {
      nextErrors.email = "Email address is required.";
    }

    if (!form.employeeNumber.trim()) {
      nextErrors.employeeNumber = "Employee number is required.";
    }

    if (!form.hireDate) {
      nextErrors.hireDate = "Hire date is required.";
    }

    if (!form.gender) {
      nextErrors.gender = "Gender is required.";
    }

    if (!form.department) {
      nextErrors.department = "Department is required.";
    }

    if (!form.position) {
      nextErrors.position = "Position is required.";
    }

    if (!form.grade) {
      nextErrors.grade = "Grade is required.";
    }

    if (!form.location) {
      nextErrors.location = "Location is required.";
    }

    if (!form.employmentType) {
      nextErrors.employmentType = "Employment type is required.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validate() || submitting) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const employee = await employeesApi.createEmployee({
        first_name: form.firstName.trim(),
        middle_name: form.middleName.trim(),
        last_name: form.lastName.trim(),
        employee_number: form.employeeNumber.trim(),
        work_email: form.email.trim(),
        phone: form.phone.trim(),
        gender: form.gender,
        hire_date: form.hireDate,
      });

      await employeesApi.createEmployment({
        employee: employee.id,
        department: form.department,
        position: form.position,
        grade: form.grade,
        location: form.location,
        employment_type: form.employmentType,
        start_date: form.hireDate,
      });

      if (form.inviteAccount) {
        const invitation = await employeesApi.inviteEmployeeToSelfService(employee.id);
        setInvitationStatus(
          invitation.email_delivery_status === "sent"
            ? `A Self-Service invitation was sent to ${invitation.email}.`
            : `The employee account invitation was created for ${invitation.email}. Email delivery is not configured; send them the secure invitation link from the employee record.`,
        );
      }

      setSaved(true);
    } catch (caught) {
      const apiError = isApiRequestError(caught) ? caught : null;
      const fieldMap: Record<string, keyof FormData> = {
        first_name: "firstName",
        middle_name: "middleName",
        last_name: "lastName",
        employee_number: "employeeNumber",
        work_email: "email",
        phone: "phone",
        gender: "gender",
        hire_date: "hireDate",
        department: "department",
        position: "position",
        grade: "grade",
        location: "location",
        employment_type: "employmentType",
        start_date: "hireDate",
      };
      const fieldErrors: Record<string, string> = {};

      for (const [apiField, formField] of Object.entries(fieldMap)) {
        const message = apiError?.fieldError(apiField);
        if (message) {
          fieldErrors[formField] = message;
        }
      }

      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
      }

      setSubmitError(getApiErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/hr/employees"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          aria-label="Back to employees"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div>
          <p className="text-sm text-slate-500">HR / Employees</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Add Employee
          </h1>
        </div>
      </div>

      {saved && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <Check className="h-4 w-4 text-emerald-700" />
          </div>

          <div>
            <p className="text-sm font-semibold text-emerald-900">
              Employee record saved
            </p>
            <p className="mt-0.5 text-sm text-emerald-700">
              {invitationStatus ?? "The employee and their current employment assignment have been saved."}
            </p>
          </div>
        </div>
      )}

      {lookupsError && (
        <ErrorState
          title="Unable to load organisation data"
          message={lookupsError}
        />
      )}

      {submitError && (
        <ErrorState title="Unable to create employee" message={submitError} />
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-base font-semibold text-slate-900">
              Personal Details
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Enter the employee&apos;s basic personal information.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2 lg:grid-cols-3">
            <Field
              label="First Name"
              required
              value={form.firstName}
              error={errors.firstName}
              onChange={(value) => updateField("firstName", value)}
            />

            <Field
              label="Middle Name"
              value={form.middleName}
              onChange={(value) => updateField("middleName", value)}
            />

            <Field
              label="Last Name"
              required
              value={form.lastName}
              error={errors.lastName}
              onChange={(value) => updateField("lastName", value)}
            />

            <SelectField
              label="Gender"
              required
              value={form.gender}
              error={errors.gender}
              options={genderOptions}
              onChange={(value) => updateField("gender", value)}
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-base font-semibold text-slate-900">
              Contact Details
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Provide the employee&apos;s primary contact information.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2">
            <Field
              label="Email Address"
              required
              type="email"
              value={form.email}
              error={errors.email}
              icon={<Mail className="h-4 w-4" />}
              onChange={(value) => updateField("email", value)}
            />

            <Field
              label="Phone Number"
              value={form.phone}
              placeholder="e.g. 024 000 0000"
              onChange={(value) => updateField("phone", value)}
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-base font-semibold text-slate-900">
              Employee Details
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Assign the employee to the organisation and record their
              employment details.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Employee Number"
              required
              value={form.employeeNumber}
              placeholder="e.g. EMP-0009"
              error={errors.employeeNumber}
              onChange={(value) => updateField("employeeNumber", value)}
            />

            <Field
              label="Hire Date"
              required
              type="date"
              value={form.hireDate}
              error={errors.hireDate}
              onChange={(value) => updateField("hireDate", value)}
            />

            <SelectField
              label="Employment Type"
              required
              value={form.employmentType}
              error={errors.employmentType}
              options={employmentTypeOptions}
              onChange={(value) => updateField("employmentType", value)}
            />

            <SelectField
              label="Department"
              required
              value={form.department}
              error={errors.department}
              options={lookups.departments.map((department) => ({
                value: department.id,
                label: department.name,
              }))}
              onChange={(value) => updateField("department", value)}
            />

            <SelectField
              label="Position"
              required
              value={form.position}
              error={errors.position}
              options={positions.map((position) => ({
                value: position.id,
                label: position.title,
              }))}
              onChange={(value) => updateField("position", value)}
            />

            <SelectField
              label="Grade"
              required
              value={form.grade}
              error={errors.grade}
              options={lookups.grades.map((grade) => ({
                value: grade.id,
                label: grade.name,
              }))}
              onChange={(value) => updateField("grade", value)}
            />

            <SelectField
              label="Location"
              required
              value={form.location}
              error={errors.location}
              options={lookups.locations.map((location) => ({
                value: location.id,
                label: location.name,
              }))}
              onChange={(value) => updateField("location", value)}
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-base font-semibold text-slate-900">
              Account Invitation
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              An employee does not need a user account to exist in ErgonX.
              You can optionally invite them to use employee self-service.
            </p>
          </div>

          <div className="p-6">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={form.inviteAccount}
                onChange={(event) =>
                  updateField("inviteAccount", event.target.checked)
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
              />

              <span>
                <span className="block text-sm font-medium text-slate-900">
                  Invite employee to create an account
                </span>
                <span className="mt-1 block text-sm text-slate-500">
                  The employee can later use self-service features such as
                  leave, attendance and payslips when enabled and authorised.
                </span>
              </span>
            </label>
          </div>
        </section>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/hr/employees"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </Link>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setForm(initialForm);
                setErrors({});
                setSaved(false);
              }}
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Clear Form
            </button>

            <button
              type="submit"
              disabled={submitting || lookupsLoading || Boolean(lookupsError)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              <Save className="h-4 w-4" />
              {submitting ? "Creating..." : "Create Employee"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  value,
  error,
  type = "text",
  placeholder,
  icon,
  onChange,
}: {
  label: string;
  required?: boolean;
  value: string;
  error?: string;
  type?: string;
  placeholder?: string;
  icon?: React.ReactNode;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </span>
        )}

        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={`h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 ${
            icon ? "pl-10" : ""
          } ${
            error
              ? "border-red-300 focus:border-red-400 focus:ring-red-100"
              : "border-slate-300 focus:border-slate-500 focus:ring-slate-200"
          }`}
        />
      </div>

      {error && (
        <p className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function SelectField({
  label,
  required,
  value,
  error,
  options,
  onChange,
}: {
  label: string;
  required?: boolean;
  value: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`h-10 w-full appearance-none rounded-lg border bg-white px-3 pr-9 text-sm text-slate-900 outline-none transition focus:ring-2 ${
            error
              ? "border-red-300 focus:border-red-400 focus:ring-red-100"
              : "border-slate-300 focus:border-slate-500 focus:ring-slate-200"
          }`}
        >
          <option value="">Select {label.toLowerCase()}</option>

          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>

      {error && (
        <p className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
