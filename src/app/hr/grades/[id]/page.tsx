"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Edit3,
  GraduationCap,
  Users,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";

type Employee = {
  id: string;
  name: string;
  employeeNumber: string;
  position: string;
  department: string;
  status: "ACTIVE" | "INACTIVE";
};

const grade = {
  id: "8",
  code: "G8",
  name: "Grade 8",
  description: "Management grade.",
  employeeCount: 5,
  status: "ACTIVE" as const,
};

const employees: Employee[] = [
  {
    id: "1",
    name: "Ama Mensah",
    employeeNumber: "EMP-001",
    position: "HR Manager",
    department: "Human Resources",
    status: "ACTIVE",
  },
  {
    id: "2",
    name: "Kwame Asare",
    employeeNumber: "EMP-004",
    position: "Finance Manager",
    department: "Finance",
    status: "ACTIVE",
  },
];

export default function GradeDetailPage() {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(grade.name);
  const [code, setCode] = useState(grade.code);
  const [description, setDescription] = useState(grade.description);

  const handleSave = () => {
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={name}
        description={`Grade code: ${code}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/hr/grades"
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
                  Grade Information
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Basic information about this employee grade.
                </p>
              </div>

              <GraduationCap className="h-5 w-5 text-slate-400" />
            </div>

            {isEditing ? (
              <div className="space-y-5 p-6">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Grade Name
                    </label>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Grade Code
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
                    Grade Name
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {name}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Grade Code
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {code}
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
                Employees in Grade
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Employees currently assigned to this grade.
              </p>
            </div>

            {employees.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">
                No employees are currently assigned to this grade.
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
                          {employee.employeeNumber} · {employee.position}
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
              Grade Summary
            </h2>

            <div className="mt-5 space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Status</span>
                <StatusBadge status={grade.status} />
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-5">
                <span className="text-sm text-slate-500">
                  Employees
                </span>

                <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Users className="h-4 w-4 text-slate-400" />
                  {grade.employeeCount}
                </span>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Grade Code
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {code}
                </p>
              </div>
            </div>
          </section>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Development Mode
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Grade information is currently using development data.
              Backend integration will replace this data once the API
              contract is available.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}