"use client";

import {
  BriefcaseBusiness,
  Building2,
  MapPin,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  AlertTriangle,
  CalendarDays,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useCallback } from "react";
import { useInstitution } from "@/components/context/InstitutionContext";
import KPIStatCard from "@/components/ui/KPIStatCard";
import ErrorState from "@/components/ui/ErrorState";
import PageHeader from "@/components/ui/PageHeader";
import { dashboardsApi } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";
import { EM_DASH, formatNumber } from "@/lib/format";

/* -------------------------------------------------------------------------- */
/* Development placeholder data                                               */
/*                                                                            */
/* `GET /api/v1/dashboards/hr/` returns only total/active employee counts, a  */
/* status breakdown and a hire-year distribution. The department, grade,      */
/* location, employment-type, recent-hire and incomplete-record sections below*/
/* have no backing endpoint in the current backend contract, so they remain   */
/* static placeholders rather than being wired to invented routes.            */
/* -------------------------------------------------------------------------- */

const MOCK_departmentData = [
  { name: "Human Resources", value: 18, percentage: 15 },
  { name: "Finance", value: 24, percentage: 20 },
  { name: "Information Technology", value: 31, percentage: 26 },
  { name: "Operations", value: 28, percentage: 23 },
  { name: "Administration", value: 19, percentage: 16 },
];

const MOCK_gradeData = [
  { name: "Grade A", value: 14 },
  { name: "Grade B", value: 26 },
  { name: "Grade C", value: 38 },
  { name: "Grade D", value: 29 },
  { name: "Grade E", value: 13 },
];

const MOCK_locationData = [
  { name: "Accra", value: 72 },
  { name: "Kumasi", value: 31 },
  { name: "Takoradi", value: 17 },
];

const MOCK_recentHires = [
  {
    name: "Ama Mensah",
    role: "HR Officer",
    department: "Human Resources",
    date: "02 Sep 2026",
  },
  {
    name: "Kojo Asante",
    role: "Software Engineer",
    department: "Information Technology",
    date: "29 Aug 2026",
  },
  {
    name: "Efua Owusu",
    role: "Accountant",
    department: "Finance",
    date: "25 Aug 2026",
  },
  {
    name: "Daniel Boateng",
    role: "Operations Officer",
    department: "Operations",
    date: "21 Aug 2026",
  },
];

const MOCK_incompleteRecords = [
  {
    name: "Michael Addo",
    issue: "Emergency contact missing",
  },
  {
    name: "Linda Ofori",
    issue: "Employment documents incomplete",
  },
  {
    name: "Yaw Frimpong",
    issue: "Bank details missing",
  },
];

export default function HRDashboardPage() {
  const { activeInstitution } = useInstitution();

  const institutionName =
    activeInstitution?.name || "Your Institution";

  const load = useCallback(() => dashboardsApi.getHrDashboard(), []);
  const { data, loading, error, reload } = useApiResource(load);

  const placeholder = loading ? "…" : EM_DASH;

  const statusCount = (status: string): number | null => {
    if (!data) {
      return null;
    }

    return (
      data.by_status.find((entry) => entry.status === status)?.count ?? 0
    );
  };

  const activeShare =
    data && data.total_employees > 0
      ? `${Math.round((data.active_employees / data.total_employees) * 100)}% of workforce`
      : "Share of workforce";

  // `by_hire_year` is the only hire-date breakdown the backend returns; there
  // is no rolling 30-day window, so the current calendar year is reported.
  const currentYear = new Date().getFullYear();

  const hiresThisYear =
    data?.by_hire_year.find((entry) => entry.year === currentYear)?.count ?? null;

  const inactiveCount = statusCount("INACTIVE");
  const suspendedCount = statusCount("SUSPENDED");
  const terminatedCount = statusCount("TERMINATED");

  const show = (value: number | null): string =>
    value === null ? placeholder : formatNumber(value);

  return (
    <div className="space-y-6">
      <PageHeader
        title="HR Dashboard"
        description={`Workforce overview and HR operations for ${institutionName}.`}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/hr/employees/new" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
              Add Employee
            </Link>
            <Link href="/hr/employees" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
              View Employees
            </Link>
          </div>
        }
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPIStatCard
          title="Total Employees"
          value={data ? formatNumber(data.total_employees) : placeholder}
          subtitle="Across all departments"
          icon={<Users className="h-5 w-5" />}
        />
        <KPIStatCard
          title="Active Employees"
          value={data ? formatNumber(data.active_employees) : placeholder}
          subtitle={activeShare}
          icon={<UserCheck className="h-5 w-5" />}
        />
        <KPIStatCard
          title="New Hires"
          value={show(hiresThisYear)}
          subtitle={`Hired in ${currentYear}`}
          icon={<UserPlus className="h-5 w-5" />}
        />
        <KPIStatCard
          title="Terminations"
          value={show(terminatedCount)}
          subtitle="Terminated employees"
          icon={<UserMinus className="h-5 w-5" />}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Inactive Employees
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {show(inactiveCount)}
              </p>
            </div>
            <div className="rounded-lg bg-slate-100 p-3 text-slate-600">
              <UserMinus className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Employees currently not active
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Suspended</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {show(suspendedCount)}
              </p>
            </div>
            <div className="rounded-lg bg-slate-100 p-3 text-slate-600">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Employees with suspended status
          </p>
        </div>

        {/*
          Placeholder: record-completeness is not exposed by any current
          endpoint. The backend has emergency-contact and onboarding models,
          but no REST routes for them in the OpenAPI contract.
        */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-700">
                Incomplete Records
              </p>
              <p className="mt-2 text-2xl font-semibold text-amber-900">7</p>
            </div>
            <div className="rounded-lg bg-white p-3 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-xs text-amber-700">
            Employee profiles requiring attention
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Department Distribution
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Employees by department
              </p>
            </div>
            <Building2 className="h-5 w-5 text-slate-400" />
          </div>

          <div className="space-y-4">
            {MOCK_departmentData.map((department) => (
              <div key={department.name}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-slate-700">{department.name}</span>
                  <span className="font-medium text-slate-900">
                    {department.value}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-800"
                    style={{ width: `${department.percentage * 3.33}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Grade Distribution
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Employees by grade
              </p>
            </div>
            <BriefcaseBusiness className="h-5 w-5 text-slate-400" />
          </div>

          <div className="space-y-4">
            {MOCK_gradeData.map((grade) => {
              const width = (grade.value / 38) * 100;

              return (
                <div key={grade.name}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-slate-700">{grade.name}</span>
                    <span className="font-medium text-slate-900">
                      {grade.value}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-600"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Location Distribution
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Workforce by location
              </p>
            </div>
            <MapPin className="h-5 w-5 text-slate-400" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {MOCK_locationData.map((location) => (
              <div
                key={location.name}
                className="rounded-lg border border-slate-100 bg-slate-50 p-4"
              >
                <p className="text-sm text-slate-500">{location.name}</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {location.value}
                </p>
                <p className="mt-1 text-xs text-slate-500">employees</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-900">
              Employment Type
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Workforce composition
            </p>
          </div>

          <div className="space-y-3">
            {[
              ["Full-time", 94],
              ["Part-time", 14],
              ["Contract", 12],
            ].map(([type, count]) => (
              <div
                key={type}
                className="flex items-center justify-between rounded-lg bg-slate-50 p-4"
              >
                <span className="text-sm text-slate-700">{type}</span>
                <span className="font-semibold text-slate-900">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Recent Hires
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Latest employees added to the organisation
              </p>
            </div>
            <Link
              href="/hr/employees"
              className="text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              View all
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {MOCK_recentHires.map((employee) => (
              <div
                key={employee.name}
                className="flex items-center gap-4 px-6 py-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                  {employee.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {employee.name}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {employee.role} · {employee.department}
                  </p>
                </div>

                <div className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {employee.date}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-amber-100 px-6 py-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Incomplete Employee Records
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Profiles requiring HR attention
              </p>
            </div>
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>

          <div className="divide-y divide-slate-100">
            {MOCK_incompleteRecords.map((employee) => (
              <Link
                href="/hr/employees"
                key={employee.name}
                className="flex items-center gap-4 px-6 py-4 transition hover:bg-slate-50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-sm font-semibold text-amber-700">
                  {employee.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {employee.name}
                  </p>
                  <p className="truncate text-xs text-amber-700">
                    {employee.issue}
                  </p>
                </div>

                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-slate-900">
            HR Quick Actions
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Common HR management tasks
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              href: "/hr/employees/new",
              icon: UserPlus,
              label: "Add Employee",
            },
            {
              href: "/hr/departments",
              icon: Building2,
              label: "Manage Departments",
            },
            {
              href: "/hr/positions",
              icon: BriefcaseBusiness,
              label: "Manage Positions",
            },
            {
              href: "/hr/locations",
              icon: MapPin,
              label: "Manage Locations",
            },
          ].map((action) => {
            const Icon = action.icon;

            return (
              <Link
                key={action.label}
                href={action.href}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">
                    {action.label}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

