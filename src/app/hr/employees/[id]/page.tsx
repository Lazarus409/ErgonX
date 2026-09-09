"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  Mail,
  MapPin,
  Pencil,
  Save,
  ShieldCheck,
  User,
  Users,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import StatusBadge from "@/components/ui/StatusBadge";

interface Employee {
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

const initialEmployee: Employee = {
  employeeNumber: "EMP-0001",
  firstName: "Kwame",
  middleName: "Mensah",
  lastName: "Asante",
  email: "kwame.asante@example.com",
  phone: "+233 24 000 0000",
  gender: "Male",
  status: "ACTIVE",
  hireDate: "2025-01-12",
  employmentType: "Full Time",
  department: "Information Technology",
  position: "IT Officer",
  grade: "Grade 6",
  location: "Accra",
  manager: "Director of IT",
};


const tabs = [
  "Overview",
  "Current Employment",
  "Employment History",
  "Documents",
  "Emergency Contacts",
  "Onboarding / Offboarding",
  "Leave",
  "Attendance",
  "Compensation",
  "Payroll",
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
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>

      <p className="mt-2 font-medium text-slate-900">{value}</p>
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
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>

      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
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
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>

      <select
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
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

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>

        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>

      <div className="p-6">{children}</div>
    </section>
  );
}

export default function EmployeeDetailPage() {
  const searchParams = useSearchParams();
  const editMode = searchParams.get("edit") === "true";
  const [employee, setEmployee] = useState<Employee>(initialEmployee);
  const [formData, setFormData] = useState<Employee>(initialEmployee);
  const [isEditing, setIsEditing] = useState(editMode);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  const updateField = (field: keyof Employee, value: string) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const startEditing = () => {
    setFormData(employee);
    setSavedMessage("");
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setFormData(employee);
    setSavedMessage("");
    setShowSaveConfirmation(false);
    setIsEditing(false);
  };

  const requestSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setShowSaveConfirmation(true);
  };

  const confirmSave = () => {
    setEmployee(formData);
    setShowSaveConfirmation(false);
    setIsEditing(false);
    setSavedMessage(
      "Employee details saved in development mode. Backend integration is pending."
    );
  };

;
;
  const [emergencyContacts, setEmergencyContacts] = useState<
    {
      id: string;
      name: string;
      relationship: string;
      phone: string;
      email: string;
      address: string;
    }[]
  >([]);

  const [showEmergencyForm, setShowEmergencyForm] = useState(false);
  const [editingEmergencyId, setEditingEmergencyId] = useState<string | null>(null);

  const [emergencyForm, setEmergencyForm] = useState({
    name: "",
    relationship: "",
    phone: "",
    email: "",
    address: "",
  });

  const resetEmergencyForm = () => {
    setEmergencyForm({
      name: "",
      relationship: "",
      phone: "",
      email: "",
      address: "",
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
    });
    setEditingEmergencyId(contact.id);
    setShowEmergencyForm(true);
  };

  const saveEmergencyContact = () => {
    if (
      !emergencyForm.name.trim() ||
      !emergencyForm.relationship.trim() ||
      !emergencyForm.phone.trim()
    ) {
      return;
    }

    if (editingEmergencyId) {
      setEmergencyContacts((contacts) =>
        contacts.map((contact) =>
          contact.id === editingEmergencyId
            ? {
                ...contact,
                ...emergencyForm,
              }
            : contact
        )
      );
    } else {
      setEmergencyContacts((contacts) => [
        ...contacts,
        {
          id: `emergency-${Date.now()}`,
          ...emergencyForm,
        },
      ]);
    }

    resetEmergencyForm();
  };

  const deleteEmergencyContact = (id: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this emergency contact?"
      )
    ) {
      return;
    }

    setEmergencyContacts((contacts) =>
      contacts.filter((contact) => contact.id !== id)
    );
  };
  return (
    <div className="space-y-6">
      <Link
        href="/hr/employees"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Employees
      </Link>

      {savedMessage && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {savedMessage}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <User className="h-8 w-8 text-slate-500" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">
                  {employee.firstName} {employee.middleName}{" "}
                  {employee.lastName}
                </h1>

                <StatusBadge status={employee.status} />
              </div>

              <p className="mt-1 text-sm text-slate-500">
                {employee.employeeNumber} · {employee.position}
              </p>

              <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-500">
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
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Pencil className="h-4 w-4" />
              Edit Employee
            </button>
          )}
        </div>
      </div>

      {!isEditing && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <div className="flex min-w-max">
              {tabs.map((tab, index) => (
                <button
                  key={tab}
                  type="button"
                  className={`border-b-2 px-5 py-4 text-sm font-medium ${
                    index === 0
                      ? "border-slate-900 text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <SectionCard
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
            title="Current Employment"
            description="The employee's current employment assignment."
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
            <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-slate-100 p-2">
                  <ShieldCheck className="h-5 w-5 text-slate-600" />
                </div>

                <div>
                  <p className="font-medium text-slate-900">
                    Account Active
                  </p>

                  <p className="text-sm text-slate-500">
                    The employee has an active system account.
                  </p>
                </div>
              </div>

              <StatusBadge status="ACTIVE" />
            </div>
          </SectionCard>

          <SectionCard
            title="Employment History"
            description="Historical employment assignments are preserved and are not overwritten."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-4 py-3 font-medium">Department</th>
                    <th className="px-4 py-3 font-medium">Position</th>
                    <th className="px-4 py-3 font-medium">Grade</th>
                    <th className="px-4 py-3 font-medium">Location</th>
                    <th className="px-4 py-3 font-medium">Start Date</th>
                    <th className="px-4 py-3 font-medium">End Date</th>
                  </tr>
                </thead>

                <tbody>
                  <tr>
                    <td className="px-4 py-4">{employee.department}</td>
                    <td className="px-4 py-4">{employee.position}</td>
                    <td className="px-4 py-4">{employee.grade}</td>
                    <td className="px-4 py-4">{employee.location}</td>
                    <td className="px-4 py-4">
                      {new Date(employee.hireDate).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-4 py-4 text-slate-500">Current</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard
            title="Documents"
            description="Employee documents will appear here when available."
          >
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-10 text-center">
              <FileText className="h-10 w-10 text-slate-400" />

              <h3 className="mt-3 font-medium text-slate-900">
                No documents available
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Employee documents will be displayed here.
              </p>
            </div>
          </SectionCard>

          <SectionCard
            title="Emergency Contacts"
            description="Emergency contact records for this employee."
            action={
              <button
                type="button"
                onClick={openAddEmergencyForm}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Add Contact
              </button>
            }
          >
            {showEmergencyForm && (
              <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <div className="mb-5">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {editingEmergencyId
                      ? "Edit Emergency Contact"
                      : "Add Emergency Contact"}
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    Enter the contact details for this employee.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
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
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
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
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
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
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
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
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
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
                      className="h-4 w-4 rounded border-slate-300"
                    />

                    <span className="text-sm text-slate-700">
                      Set as primary emergency contact
                    </span>
                  </label>
                </div>

                <div className="mt-5 flex justify-end gap-3 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={resetEmergencyForm}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={saveEmergencyContact}
                    className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    {editingEmergencyId ? "Save Changes" : "Add Contact"}
                  </button>
                </div>
              </div>
            )}

            {emergencyContacts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                <Users className="mx-auto h-9 w-9 text-slate-400" />

                <p className="mt-3 font-medium text-slate-900">
                  No emergency contacts
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Add an emergency contact for this employee.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {emergencyContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-900">
                            {contact.name}
                          </h3>

                          {contact.primary && (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                              Primary
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-sm text-slate-500">
                          {contact.relationship}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditEmergencyForm(contact)}
                          className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteEmergencyContact(contact.id)}
                          className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Phone
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          {contact.phone}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Email
                        </p>
                        <p className="mt-1 break-all text-sm text-slate-700">
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
            title="Onboarding / Offboarding"
            description="Employee lifecycle information."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Onboarding
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Basic onboarding status for this employee.
                    </p>
                  </div>

                  <StatusBadge status="APPROVED" />
                </div>

                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Current Status
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-900">
                    Completed
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Offboarding
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Basic offboarding status for this employee.
                    </p>
                  </div>

                  <StatusBadge status="PENDING" />
                </div>

                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Current Status
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-900">
                    Not Started
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">
                Onboarding and offboarding lifecycle actions will be connected
                to the backend when the corresponding API contract is available.
              </p>
            </div>
          </SectionCard>

          <div className="grid gap-6 lg:grid-cols-3">
            <SectionCard
              title="Leave"
              description="Leave information for this employee."
            >
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        Employee Leave
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Leave records and requests for this employee will be
                        displayed here when available.
                      </p>
                    </div>

                    <Link
                      href="/leave/requests"
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      View Leave Requests
                    </Link>
                  </div>
                </div>

                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
                  <p className="text-sm text-slate-600">
                    Employee leave data will be populated when the Leave
                    module API integration is available.
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Attendance">
              <p className="text-sm text-slate-500">
                Attendance information will be displayed when available.
              </p>
            </SectionCard>

            <SectionCard title="Compensation">
              <p className="text-sm text-slate-500">
                Compensation information is permission-protected.
              </p>
            </SectionCard>
          </div>

          <SectionCard
            title="Payroll"
            description="Employee payroll information."
          >
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                  <ShieldCheck className="h-5 w-5 text-slate-600" />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-slate-900">
                    Permission-Protected Payroll
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Payroll information is restricted to authorised users.
                    Payroll records and related information will be displayed
                    here when the Payroll module integration is available.
                  </p>

                  <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Integration Status
                    </p>

                    <p className="mt-1 text-sm font-medium text-slate-700">
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
                options={["Male", "Female"]}
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
              <Field
                label="Employee Number"
                value={formData.employeeNumber}
                required
                onChange={(value) => updateField("employeeNumber", value)}
              />

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
            description="Update the employee's current assignment. Historical assignments remain preserved."
          >
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Department"
                value={formData.department}
                required
                onChange={(value) => updateField("department", value)}
              />

              <Field
                label="Position"
                value={formData.position}
                required
                onChange={(value) => updateField("position", value)}
              />

              <Field
                label="Grade"
                value={formData.grade}
                required
                onChange={(value) => updateField("grade", value)}
              />

              <Field
                label="Location"
                value={formData.location}
                required
                onChange={(value) => updateField("location", value)}
              />

              <Field
                label="Manager"
                value={formData.manager}
                required
                onChange={(value) => updateField("manager", value)}
              />
            </div>
          </SectionCard>

          <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={cancelEditing}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>

            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Save className="h-4 w-4" />
              Save Changes
            </button>
          </div>

          {showSaveConfirmation && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                <h2 className="text-lg font-semibold text-slate-900">
                  Confirm Changes
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Are you sure you want to save these employee changes?
                  Employment history will remain preserved.
                </p>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSaveConfirmation(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={confirmSave}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    <Save className="h-4 w-4" />
                    Confirm Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      )}

      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        <strong>Development mode:</strong> Employee editing currently uses
        local mock state. The backend update endpoint will be connected once
        the backend API contract is confirmed.
      </div>
    </div>
  );
}