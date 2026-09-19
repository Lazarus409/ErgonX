"use client";

import {
  Eye,
  MoreHorizontal,
  Mail,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import ErrorState from "@/components/ui/ErrorState";
import { employeesApi, getApiErrorMessage, organizationApi } from "@/lib/api";
import type { CurrentEmploymentIndex } from "@/lib/api/employees";
import type { OrganizationLookups } from "@/lib/api/organization";
import { DEFAULT_PAGE_SIZE, emptyPage } from "@/types/api";
import type { PaginatedData } from "@/types/api";
import {
  EMPLOYEE_STATUSES,
  EMPLOYMENT_TYPES,
  type Employee,
} from "@/types/hr";
import { EM_DASH, formatDate, humanizeEnum } from "@/lib/format";

const ALL = "ALL";
const SEARCH_DEBOUNCE_MS = 350;

const emptyLookups: OrganizationLookups = {
  departments: [],
  positions: [],
  grades: [],
  locations: [],
};

export default function EmployeesPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [employmentType, setEmploymentType] = useState(ALL);
  const [department, setDepartment] = useState(ALL);
  const [location, setLocation] = useState(ALL);
  const [page, setPage] = useState(1);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const [data, setData] = useState<PaginatedData<Employee>>(() =>
    emptyPage<Employee>(),
  );
  const [lookups, setLookups] = useState<OrganizationLookups>(emptyLookups);
  const [employments, setEmployments] = useState<CurrentEmploymentIndex | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [invitationLink, setInvitationLink] = useState<string | null>(null);

  // Keeps stale responses from overwriting newer ones while filters change.
  const requestRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [search]);

  // Reference data for the filter selects and the assignment columns.
  useEffect(() => {
    let active = true;

    async function loadReferenceData() {
      try {
        const [organization, employmentIndex] = await Promise.all([
          organizationApi.loadOrganizationLookups(),
          employeesApi.loadCurrentEmploymentIndex(),
        ]);

        if (!active) {
          return;
        }

        setLookups(organization);
        setEmployments(employmentIndex);
      } catch {
        // Assignment columns and filter labels degrade to placeholders; the
        // employee list itself still renders from its own request.
        if (active) {
          setLookups(emptyLookups);
          setEmployments(null);
        }
      }
    }

    loadReferenceData();

    return () => {
      active = false;
    };
  }, [reloadToken]);

  useEffect(() => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    let active = true;

    async function loadEmployees() {
      setLoading(true);
      setError(null);

      try {
        const result = await employeesApi.listEmployees({
          page,
          page_size: DEFAULT_PAGE_SIZE,
          ordering: "employee_number",
          search: debouncedSearch || undefined,
          status: status === ALL ? undefined : status,
          department: department === ALL ? undefined : department,
          location: location === ALL ? undefined : location,
          employment_type:
            employmentType === ALL ? undefined : employmentType,
        });

        if (!active || requestRef.current !== requestId) {
          return;
        }

        setData(result);
      } catch (caught) {
        if (!active || requestRef.current !== requestId) {
          return;
        }

        setError(getApiErrorMessage(caught));
        setData(emptyPage<Employee>());
      } finally {
        if (active && requestRef.current === requestId) {
          setLoading(false);
        }
      }
    }

    loadEmployees();

    return () => {
      active = false;
    };
  }, [
    page,
    debouncedSearch,
    status,
    department,
    location,
    employmentType,
    reloadToken,
  ]);

  const departmentNames = useMemo(
    () => new Map(lookups.departments.map((item) => [item.id, item.name])),
    [lookups.departments],
  );

  const positionTitles = useMemo(
    () => new Map(lookups.positions.map((item) => [item.id, item.title])),
    [lookups.positions],
  );

  const locationNames = useMemo(
    () => new Map(lookups.locations.map((item) => [item.id, item.name])),
    [lookups.locations],
  );

  // Changing any filter returns to the first page. Done in the handlers
  // rather than an effect so no cascading render is triggered.
  const changeSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const changeStatus = useCallback((value: string) => {
    setStatus(value);
    setPage(1);
  }, []);

  const changeEmploymentType = useCallback((value: string) => {
    setEmploymentType(value);
    setPage(1);
  }, []);

  const changeDepartment = useCallback((value: string) => {
    setDepartment(value);
    setPage(1);
  }, []);

  const changeLocation = useCallback((value: string) => {
    setLocation(value);
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setSearch("");
    setStatus(ALL);
    setEmploymentType(ALL);
    setDepartment(ALL);
    setLocation(ALL);
    setPage(1);
  }, []);

  const retry = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const employees = data.results;
  const pageSize = DEFAULT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(data.count / pageSize));
  const hasFilters =
    search !== "" ||
    status !== ALL ||
    employmentType !== ALL ||
    department !== ALL ||
    location !== ALL;

  /** Assignment fields live on the current Employment, not on Employee. */
  const assignmentFor = useCallback(
    (employeeId: string) => {
      const employment = employments?.byEmployee.get(employeeId);

      if (!employment) {
        return {
          department: EM_DASH,
          position: EM_DASH,
          employmentType: EM_DASH,
          location: EM_DASH,
        };
      }

      return {
        department: employment.department
          ? departmentNames.get(employment.department) ?? EM_DASH
          : EM_DASH,
        position: employment.position
          ? positionTitles.get(employment.position) ?? EM_DASH
          : EM_DASH,
        employmentType: humanizeEnum(employment.employment_type),
        location: locationNames.get(employment.location) ?? EM_DASH,
      };
    },
    [employments, departmentNames, positionTitles, locationNames],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description="Manage employee records, employment details and workforce information."
        actions={<div className="flex items-center gap-3"><button type="button" onClick={() => { setInviteOpen(true); setInviteError(null); setInvitationLink(null); }} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50"><Mail className="h-4 w-4" />Invite Employee</button><Link href="/hr/employees/new" className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"><Plus className="h-4 w-4" />Add Employee</Link></div>}
      />

      {inviteOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold tracking-[0.16em] text-sky-700">EMPLOYEE INVITATION</p><h2 className="mt-1 text-xl font-bold text-slate-950">Invite to Self-Service</h2><p className="mt-2 text-sm text-slate-500">Invite a new employee by email. They will create their account and complete their Self-Service profile.</p></div><button onClick={() => setInviteOpen(false)} className="text-slate-400 hover:text-slate-800" aria-label="Close">×</button></div>{invitationLink ? <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="font-semibold text-emerald-900">Invitation created</p><p className="mt-1 text-sm text-emerald-800">The email will be delivered when email delivery is enabled. You may also copy the secure link below.</p><div className="mt-3 flex gap-2"><input readOnly value={invitationLink} className="min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-slate-600" /><button onClick={() => void navigator.clipboard.writeText(invitationLink)} className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Copy</button></div></div> : <><label className="mt-6 grid gap-2 text-sm font-medium text-slate-700">Employee email<input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="employee@example.com" className="h-11 rounded-xl border border-slate-200 px-3 text-slate-900" /></label><p className="mt-2 text-xs text-slate-500">The recipient uses this email to create their Employee Self-Service account.</p>{inviteError && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{inviteError}</p>}<div className="mt-6 flex justify-end gap-3"><button onClick={() => setInviteOpen(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button><button disabled={!inviteEmail.trim() || inviting} onClick={async () => { setInviting(true); setInviteError(null); try { const invitation = await employeesApi.inviteNewEmployeeToSelfService(inviteEmail.trim()); setInvitationLink(`${window.location.origin}/accept-invitation/${invitation.acceptance_token}`); } catch (caught) { setInviteError(getApiErrorMessage(caught)); } finally { setInviting(false); } }} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{inviting ? "Creating…" : "Create invitation"}</button></div></>}</div></div>}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="search"
                value={search}
                onChange={(event) => changeSearch(event.target.value)}
                placeholder="Search by employee name, ID or work email..."
                className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-slate-500" />

              <select
                value={status}
                onChange={(event) => changeStatus(event.target.value)}
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-500"
              >
                <option value={ALL}>Status: All</option>

                {EMPLOYEE_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    Status: {humanizeEnum(option)}
                  </option>
                ))}
              </select>

              <select
                value={employmentType}
                onChange={(event) => changeEmploymentType(event.target.value)}
                className="hidden h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-500 md:block"
              >
                <option value={ALL}>Type: All</option>

                {EMPLOYMENT_TYPES.map((option) => (
                  <option key={option} value={option}>
                    Type: {humanizeEnum(option)}
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
              onChange={(event) => changeDepartment(event.target.value)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-500"
            >
              <option value={ALL}>Department: All</option>

              {lookups.departments.map((option) => (
                <option key={option.id} value={option.id}>
                  Department: {option.name}
                </option>
              ))}
            </select>

            <select
              value={location}
              onChange={(event) => changeLocation(event.target.value)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-500"
            >
              <option value={ALL}>Location: All</option>

              {lookups.locations.map((option) => (
                <option key={option.id} value={option.id}>
                  Location: {option.name}
                </option>
              ))}
            </select>

            <div className="flex items-center rounded-lg bg-slate-50 px-3 text-sm text-slate-600">
              Showing{" "}
              <span className="mx-1 font-semibold text-slate-900">
                {employees.length}
              </span>
              of{" "}
              <span className="ml-1 font-semibold text-slate-900">
                {data.count}
              </span>{" "}
              employees
            </div>
          </div>
        </div>

        {error ? (
          <div className="p-4">
            <ErrorState message={error} onRetry={retry} />
          </div>
        ) : loading ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />

            <p className="mt-4 text-sm text-slate-500">Loading employees...</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Search className="h-5 w-5 text-slate-400" />
            </div>

            <h2 className="mt-4 text-sm font-semibold text-slate-900">
              No employees found
            </h2>

            <p className="mt-1 max-w-sm text-sm text-slate-500">
              {hasFilters
                ? "Try changing your search or filters to find employee records."
                : "No employee records exist for this institution yet."}
            </p>

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 text-sm font-medium text-slate-900 underline underline-offset-4"
              >
                Clear filters
              </button>
            )}
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
                {employees.map((employee) => {
                  const name = employeesApi.employeeDisplayName(employee);
                  const assignment = assignmentFor(employee.id);

                  return (
                    <tr
                      key={employee.id}
                      className="border-b border-slate-100 transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                            {employeesApi.employeeInitials(employee)}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {name}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {employee.employee_number}
                              {employee.work_email
                                ? ` · ${employee.work_email}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {assignment.department}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {assignment.position}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {assignment.employmentType}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {assignment.location}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {formatDate(employee.hire_date)}
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
                          aria-label={`Actions for ${name}`}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            {employments?.truncated
              ? "Assignment columns are resolved for the most recent employment records only."
              : `Page ${page} of ${totalPages}`}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={loading || !data.previous}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
            >
              Previous
            </button>

            <span className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white">
              {page}
            </span>

            <button
              type="button"
              onClick={() => setPage((current) => current + 1)}
              disabled={loading || !data.next}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
