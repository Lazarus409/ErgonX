"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Edit3,
  Mail,
  Users,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";

type Employee = {
  id: string;
  name: string;
  employeeNumber: string;
  department: string;
  status: "ACTIVE" | "INACTIVE";
  email: string;
};

const position = {
  id: "1",
  code: "HR-MGR",
  title: "HR Manager",
  department: "Human Resources",
  grade: "G8",
  employeeCount: 1,
  status: "ACTIVE" as const,
  description:
    "Responsible for leading HR operations, workforce administration and employee management.",
};

const employees: Employee[] = [
  {
    id: "1",
    name: "Ama Mensah",
    employeeNumber: "EMP-001",
    department: "Human Resources",
    status: "ACTIVE",
    email: "ama.mensah@example.com",
  },
];

export default function PositionDetailPage() {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(position.title);
  const [code, setCode] = useState(position.code);
  const [description, setDescription] = useState(position.description);

  const handleSave = () => {
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={`Position code: ${code}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/hr/positions"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>

            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Edit3 className="h-4 w-4" />
              Edit
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Position Information
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Basic information about this position.
                </p>
              </div>

              <BriefcaseBusiness className="h-5 w-5 text-slate-400" />
            </div>

            {isEditing ? (
              <div className="space-y-5 p-6">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Position Title
                    </label>
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Position Code
                    </label>
                    <input
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={4}
                    className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                  />
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleSave}
                    className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Position Title
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {title}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Position Code
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {code}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Department
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {position.department}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Grade
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {position.grade}
                  </p>
                </div>

                <div className="md:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Description
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">
                    {description}
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                Employees in Position
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Employees currently assigned to this position.
              </p>
            </div>

            {employees.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">
                No employees are currently assigned to this position.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {employees.map((employee) => (
                  <div
                    key={employee.id}
                    className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                        {employee.name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)}
                      </div>

                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {employee.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {employee.employeeNumber} · {employee.department}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <StatusBadge status={employee.status} />

                      <Link
                        href={`/hr/employees/${employee.id}`}
                        className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              Position Summary
            </h2>

            <div className="mt-5 space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Status</span>
                <StatusBadge status={position.status} />
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-5">
                <span className="text-sm text-slate-500">
                  Employees
                </span>

                <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Users className="h-4 w-4 text-slate-400" />
                  {position.employeeCount}
                </span>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Department
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {position.department}
                </p>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Grade
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {position.grade}
                </p>
              </div>

              {employees[0] && (
                <div className="border-t border-slate-100 pt-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Current Employee
                  </p>

                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {employees[0].name}
                  </p>

                  <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <Mail className="h-3.5 w-3.5" />
                    {employees[0].email}
                  </p>
                </div>
              )}
            </div>
          </section>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Development Mode
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Position information is currently using development data.
              Backend integration will replace this data once the API
              contract is available.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}