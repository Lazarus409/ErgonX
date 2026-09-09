"use client";

import {
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";

type EmployeeStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

interface Employee {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  position: string;
  employmentType: string;
  location: string;
  dateJoined: string;
  status: EmployeeStatus;
}

const employees: Employee[] = [
  {
    id: "1",
    employeeId: "EMP-0001",
    name: "Kwame Mensah",
    email: "kwame.mensah@example.com",
    department: "Human Resources",
    position: "HR Manager",
    employmentType: "Full Time",
    location: "Accra",
    dateJoined: "12 Jan 2023",
    status: "ACTIVE",
  },
  {
    id: "2",
    employeeId: "EMP-0002",
    name: "Ama Boateng",
    email: "ama.boateng@example.com",
    department: "Finance",
    position: "Senior Accountant",
    employmentType: "Full Time",
    location: "Accra",
    dateJoined: "03 Mar 2023",
    status: "ACTIVE",
  },
  {
    id: "3",
    employeeId: "EMP-0003",
    name: "Daniel Owusu",
    email: "daniel.owusu@example.com",
    department: "Information Technology",
    position: "Software Engineer",
    employmentType: "Full Time",
    location: "Kumasi",
    dateJoined: "18 Jun 2024",
    status: "ACTIVE",
  },
  {
    id: "4",
    employeeId: "EMP-0004",
    name: "Akosua Asante",
    email: "akosua.asante@example.com",
    department: "Operations",
    position: "Operations Officer",
    employmentType: "Full Time",
    location: "Accra",
    dateJoined: "22 Aug 2024",
    status: "ACTIVE",
  },
  {
    id: "5",
    employeeId: "EMP-0005",
    name: "Michael Addo",
    email: "michael.addo@example.com",
    department: "Administration",
    position: "Administrative Officer",
    employmentType: "Contract",
    location: "Tema",
    dateJoined: "10 Feb 2024",
    status: "INACTIVE",
  },
  {
    id: "6",
    employeeId: "EMP-0006",
    name: "Abena Asare",
    email: "abena.asare@example.com",
    department: "Human Resources",
    position: "HR Officer",
    employmentType: "Full Time",
    location: "Accra",
    dateJoined: "15 Apr 2025",
    status: "ACTIVE",
  },
  {
    id: "7",
    employeeId: "EMP-0007",
    name: "Samuel Ofori",
    email: "samuel.ofori@example.com",
    department: "Information Technology",
    position: "Network Administrator",
    employmentType: "Full Time",
    location: "Kumasi",
    dateJoined: "06 May 2025",
    status: "SUSPENDED",
  },
  {
    id: "8",
    employeeId: "EMP-0008",
    name: "Esi Adjei",
    email: "esi.adjei@example.com",
    department: "Finance",
    position: "Finance Officer",
    employmentType: "Part Time",
    location: "Accra",
    dateJoined: "27 Sep 2025",
    status: "ACTIVE",
  },
];

const statusOptions = ["ALL", "ACTIVE", "INACTIVE", "SUSPENDED"];
const employmentOptions = ["ALL", "Full Time", "Part Time", "Contract"];

export default function EmployeesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [employmentType, setEmploymentType] = useState("ALL");
  const [department, setDepartment] = useState("ALL");
  const [location, setLocation] = useState("ALL");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const departments = useMemo(
    () => ["ALL", ...Array.from(new Set(employees.map((employee) => employee.department)))],
    [],
  );

  const locations = useMemo(
    () => ["ALL", ...Array.from(new Set(employees.map((employee) => employee.location)))],
    [],
  );

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchesSearch =
        !query ||
        employee.name.toLowerCase().includes(query) ||
        employee.employeeId.toLowerCase().includes(query) ||
        employee.email.toLowerCase().includes(query) ||
        employee.department.toLowerCase().includes(query) ||
        employee.position.toLowerCase().includes(query);

      const matchesStatus =
        status === "ALL" || employee.status === status;

      const matchesEmployment =
        employmentType === "ALL" ||
        employee.employmentType === employmentType;

      const matchesDepartment =
        department === "ALL" ||
        employee.department === department;

      const matchesLocation =
        location === "ALL" || employee.location === location;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesEmployment &&
        matchesDepartment &&
        matchesLocation
      );
    });
  }, [search, status, employmentType, department, location]);

  const clearFilters = () => {
    setSearch("");
    setStatus("ALL");
    setEmploymentType("ALL");
    setDepartment("ALL");
    setLocation("ALL");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description="Manage employee records, employment details and workforce information."
        actions={
          <Link
            href="/hr/employees/new"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add Employee
          </Link>
        }
      />

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by employee name, ID, email or position..."
                className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-slate-500" />

              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-500"
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    Status: {option}
                  </option>
                ))}
              </select>

              <select
                value={employmentType}
                onChange={(event) => setEmploymentType(event.target.value)}
                className="hidden h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-500 md:block"
              >
                {employmentOptions.map((option) => (
                  <option key={option} value={option}>
                    Type: {option}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={clearFilters}
                className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <select
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-500"
            >
              {departments.map((option) => (
                <option key={option} value={option}>
                  Department: {option}
                </option>
              ))}
            </select>

            <select
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-500"
            >
              {locations.map((option) => (
                <option key={option} value={option}>
                  Location: {option}
                </option>
              ))}
            </select>

            <div className="flex items-center rounded-lg bg-slate-50 px-3 text-sm text-slate-600">
              Showing{" "}
              <span className="mx-1 font-semibold text-slate-900">
                {filteredEmployees.length}
              </span>
              of{" "}
              <span className="ml-1 font-semibold text-slate-900">
                {employees.length}
              </span>{" "}
              employees
            </div>
          </div>
        </div>

        {filteredEmployees.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Search className="h-5 w-5 text-slate-400" />
            </div>

            <h2 className="mt-4 text-sm font-semibold text-slate-900">
              No employees found
            </h2>

            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Try changing your search or filters to find employee records.
            </p>

            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 text-sm font-medium text-slate-900 underline underline-offset-4"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Employee
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Department
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Position
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Employment
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Location
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Date Joined
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredEmployees.map((employee) => (
                  <tr
                    key={employee.id}
                    className="border-b border-slate-100 transition hover:bg-slate-50"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                          {employee.name
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {employee.name}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {employee.employeeId} · {employee.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {employee.department}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {employee.position}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {employee.employmentType}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {employee.location}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {employee.dateJoined}
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge status={employee.status} />
                    </td>

                    <td className="relative px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenu(
                            openMenu === employee.id ? null : employee.id,
                          )
                        }
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                        aria-label={`Actions for ${employee.name}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>

                      {openMenu === employee.id && (
                        <div className="absolute right-5 top-12 z-20 w-40 rounded-lg border border-slate-200 bg-white p-1 text-left shadow-lg">
                          <Link
                            href={`/hr/employees/${employee.id}`}
                            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            onClick={() => setOpenMenu(null)}
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Link>

                          <Link
                            href={`/hr/employees/${employee.id}?edit=true`}
                            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            onClick={() => setOpenMenu(null)}
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Link>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Employee records shown are temporary development data.
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-400"
            >
              Previous
            </button>

            <span className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white">
              1
            </span>

            <button
              type="button"
              disabled
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-400"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
