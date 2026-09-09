"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Eye,
  GraduationCap,
  Plus,
  Search,
  Users,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";

type Grade = {
  id: string;
  code: string;
  name: string;
  description: string;
  employeeCount: number;
  status: "ACTIVE" | "INACTIVE";
};

const grades: Grade[] = [
  {
    id: "1",
    code: "G1",
    name: "Grade 1",
    description: "Entry-level grade.",
    employeeCount: 4,
    status: "ACTIVE",
  },
  {
    id: "2",
    code: "G2",
    name: "Grade 2",
    description: "Junior operational grade.",
    employeeCount: 6,
    status: "ACTIVE",
  },
  {
    id: "3",
    code: "G3",
    name: "Grade 3",
    description: "Intermediate operational grade.",
    employeeCount: 8,
    status: "ACTIVE",
  },
  {
    id: "4",
    code: "G4",
    name: "Grade 4",
    description: "Administrative and technical grade.",
    employeeCount: 11,
    status: "ACTIVE",
  },
  {
    id: "5",
    code: "G5",
    name: "Grade 5",
    description: "Professional grade.",
    employeeCount: 14,
    status: "ACTIVE",
  },
  {
    id: "6",
    code: "G6",
    name: "Grade 6",
    description: "Senior professional grade.",
    employeeCount: 12,
    status: "ACTIVE",
  },
  {
    id: "7",
    code: "G7",
    name: "Grade 7",
    description: "Senior specialist grade.",
    employeeCount: 9,
    status: "ACTIVE",
  },
  {
    id: "8",
    code: "G8",
    name: "Grade 8",
    description: "Management grade.",
    employeeCount: 5,
    status: "ACTIVE",
  },
];

export default function GradesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");

  const filteredGrades = useMemo(() => {
    const searchValue = search.toLowerCase();

    return grades.filter((grade) => {
      const matchesSearch =
        grade.name.toLowerCase().includes(searchValue) ||
        grade.code.toLowerCase().includes(searchValue) ||
        grade.description.toLowerCase().includes(searchValue);

      const matchesStatus =
        status === "ALL" || grade.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [search, status]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Grades"
        description="Manage employee grades within your institution."
        actions={
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add Grade
          </button>
        }
      />

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search grades..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        {filteredGrades.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No grades found"
              description="Try adjusting your search or status filter."
            />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Grade
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Employees
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredGrades.map((grade) => (
                    <tr
                      key={grade.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                            <GraduationCap className="h-5 w-5 text-slate-600" />
                          </div>

                          <div>
                            <p className="font-medium text-slate-900">
                              {grade.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {grade.code}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="max-w-md px-6 py-4 text-sm text-slate-700">
                        {grade.description}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <Users className="h-4 w-4 text-slate-400" />
                          {grade.employeeCount}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <StatusBadge status={grade.status} />
                      </td>

                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/hr/grades/${grade.id}`}
                          className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {filteredGrades.map((grade) => (
                <div key={grade.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                        <GraduationCap className="h-5 w-5 text-slate-600" />
                      </div>

                      <div>
                        <p className="font-medium text-slate-900">
                          {grade.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {grade.code}
                        </p>
                      </div>
                    </div>

                    <StatusBadge status={grade.status} />
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    {grade.description}
                  </p>

                  <div className="mt-4 flex items-center gap-2 text-sm text-slate-700">
                    <Users className="h-4 w-4 text-slate-400" />
                    {grade.employeeCount} employees
                  </div>

                  <Link
                    href={`/hr/grades/${grade.id}`}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Eye className="h-4 w-4" />
                    View Grade
                  </Link>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}