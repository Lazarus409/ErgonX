"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Eye, Plus, Search, Users } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";

type Department = {
  id: string;
  code: string;
  name: string;
  head: string;
  employeeCount: number;
  status: "ACTIVE" | "INACTIVE";
};

const departments: Department[] = [
  {
    id: "1",
    code: "HR",
    name: "Human Resources",
    head: "Ama Mensah",
    employeeCount: 8,
    status: "ACTIVE",
  },
  {
    id: "2",
    code: "FIN",
    name: "Finance",
    head: "Kwame Asare",
    employeeCount: 12,
    status: "ACTIVE",
  },
  {
    id: "3",
    code: "ICT",
    name: "Information Technology",
    head: "Daniel Owusu",
    employeeCount: 15,
    status: "ACTIVE",
  },
  {
    id: "4",
    code: "ADM",
    name: "Administration",
    head: "Grace Boateng",
    employeeCount: 7,
    status: "ACTIVE",
  },
  {
    id: "5",
    code: "OPS",
    name: "Operations",
    head: "Michael Addo",
    employeeCount: 21,
    status: "ACTIVE",
  },
  {
    id: "6",
    code: "PROC",
    name: "Procurement",
    head: "Not Assigned",
    employeeCount: 0,
    status: "INACTIVE",
  },
];

export default function DepartmentsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");

  const filteredDepartments = useMemo(() => {
    return departments.filter((department) => {
      const searchValue = search.toLowerCase();

      const matchesSearch =
        department.name.toLowerCase().includes(searchValue) ||
        department.code.toLowerCase().includes(searchValue) ||
        department.head.toLowerCase().includes(searchValue);

      const matchesStatus =
        status === "ALL" || department.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [search, status]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Manage the departments within your institution."
        actions={
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add Department
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
                placeholder="Search departments..."
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

        {filteredDepartments.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No departments found"
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
                      Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Head
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
                  {filteredDepartments.map((department) => (
                    <tr
                      key={department.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                            <Building2 className="h-5 w-5 text-slate-600" />
                          </div>

                          <div>
                            <p className="font-medium text-slate-900">
                              {department.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {department.code}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-700">
                        {department.head}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <Users className="h-4 w-4 text-slate-400" />
                          {department.employeeCount}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <StatusBadge status={department.status} />
                      </td>

                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/hr/departments/${department.id}`}
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
              {filteredDepartments.map((department) => (
                <div key={department.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                        <Building2 className="h-5 w-5 text-slate-600" />
                      </div>

                      <div>
                        <p className="font-medium text-slate-900">
                          {department.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {department.code}
                        </p>
                      </div>
                    </div>

                    <StatusBadge status={department.status} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">
                        Department Head
                      </p>
                      <p className="mt-1 text-slate-700">
                        {department.head}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">
                        Employees
                      </p>
                      <p className="mt-1 text-slate-700">
                        {department.employeeCount}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/hr/departments/${department.id}`}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Eye className="h-4 w-4" />
                    View Department
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