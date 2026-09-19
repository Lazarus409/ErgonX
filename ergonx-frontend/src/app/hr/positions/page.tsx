"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BriefcaseBusiness,
  Eye,
  Plus,
  Search,
  Users,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";

type Position = {
  id: string;
  code: string;
  title: string;
  department: string;
  grade: string;
  employeeCount: number;
  status: "ACTIVE" | "INACTIVE";
};

const positions: Position[] = [
  {
    id: "1",
    code: "HR-MGR",
    title: "HR Manager",
    department: "Human Resources",
    grade: "G8",
    employeeCount: 1,
    status: "ACTIVE",
  },
  {
    id: "2",
    code: "HR-OFF",
    title: "HR Officer",
    department: "Human Resources",
    grade: "G6",
    employeeCount: 3,
    status: "ACTIVE",
  },
  {
    id: "3",
    code: "FIN-MGR",
    title: "Finance Manager",
    department: "Finance",
    grade: "G8",
    employeeCount: 1,
    status: "ACTIVE",
  },
  {
    id: "4",
    code: "ACC-OFF",
    title: "Accountant",
    department: "Finance",
    grade: "G6",
    employeeCount: 4,
    status: "ACTIVE",
  },
  {
    id: "5",
    code: "SEC-ANL",
    title: "Cybersecurity Analyst",
    department: "Information Technology",
    grade: "G7",
    employeeCount: 2,
    status: "ACTIVE",
  },
  {
    id: "6",
    code: "ADM-ASST",
    title: "Administrative Assistant",
    department: "Administration",
    grade: "G4",
    employeeCount: 5,
    status: "ACTIVE",
  },
  {
    id: "7",
    code: "PROC-OFF",
    title: "Procurement Officer",
    department: "Procurement",
    grade: "G5",
    employeeCount: 0,
    status: "INACTIVE",
  },
];

export default function PositionsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [department, setDepartment] = useState("ALL");

  const filteredPositions = useMemo(() => {
    const searchValue = search.toLowerCase();

    return positions.filter((position) => {
      const matchesSearch =
        position.title.toLowerCase().includes(searchValue) ||
        position.code.toLowerCase().includes(searchValue) ||
        position.department.toLowerCase().includes(searchValue) ||
        position.grade.toLowerCase().includes(searchValue);

      const matchesStatus =
        status === "ALL" || position.status === status;

      const matchesDepartment =
        department === "ALL" || position.department === department;

      return matchesSearch && matchesStatus && matchesDepartment;
    });
  }, [search, status, department]);

  const departments = Array.from(
    new Set(positions.map((position) => position.department))
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Positions"
        description="Manage job positions within your institution."
        actions={
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add Position
          </button>
        }
      />

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search positions..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <select
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-500"
            >
              <option value="ALL">All Departments</option>
              {departments.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

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

        {filteredPositions.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No positions found"
              description="Try adjusting your search or filters."
            />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Position
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Grade
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
                  {filteredPositions.map((position) => (
                    <tr
                      key={position.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                            <BriefcaseBusiness className="h-5 w-5 text-slate-600" />
                          </div>

                          <div>
                            <p className="font-medium text-slate-900">
                              {position.title}
                            </p>
                            <p className="text-xs text-slate-500">
                              {position.code}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-700">
                        {position.department}
                      </td>

                      <td className="px-6 py-4 text-sm font-medium text-slate-700">
                        {position.grade}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <Users className="h-4 w-4 text-slate-400" />
                          {position.employeeCount}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <StatusBadge status={position.status} />
                      </td>

                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/hr/positions/${position.id}`}
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
              {filteredPositions.map((position) => (
                <div key={position.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                        <BriefcaseBusiness className="h-5 w-5 text-slate-600" />
                      </div>

                      <div>
                        <p className="font-medium text-slate-900">
                          {position.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {position.code}
                        </p>
                      </div>
                    </div>

                    <StatusBadge status={position.status} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Department</p>
                      <p className="mt-1 text-slate-700">
                        {position.department}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">Grade</p>
                      <p className="mt-1 font-medium text-slate-700">
                        {position.grade}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">Employees</p>
                      <p className="mt-1 text-slate-700">
                        {position.employeeCount}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/hr/positions/${position.id}`}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Eye className="h-4 w-4" />
                    View Position
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