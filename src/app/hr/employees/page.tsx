"use client";

import {
  Copy,
  Eye,
  MoreHorizontal,
  Mail,
  Pencil,
  Plus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Alert from "@/components/ui/Alert";
import { Button, ButtonLink, IconButton } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Card";
import { DataTable, DataToolbar, Pagination } from "@/components/ui/DataTable";
import { Field, Input, Select } from "@/components/ui/Field";
import { Dialog, Menu, MenuItem } from "@/components/ui/Overlay";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
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
  const router = useRouter();

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

  const inviteEmployee = async () => {
    setInviting(true);
    setInviteError(null);
    try {
      const invitation = await employeesApi.inviteNewEmployeeToSelfService(inviteEmail.trim());
      setInvitationLink(`${window.location.origin}/accept-invitation/${invitation.acceptance_token}`);
    } catch (caught) {
      setInviteError(getApiErrorMessage(caught));
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Core HR"
        title="Employees"
        description="Manage employee records, employment details and workforce information."
        icon={Users}
        accent="hr"
        actions={
          <>
            <Button variant="secondary" leadingIcon={<Mail className="h-4 w-4" />} onClick={() => { setInviteOpen(true); setInviteError(null); setInvitationLink(null); }}>Invite employee</Button>
            <ButtonLink href="/hr/employees/new" leadingIcon={<Plus className="h-4 w-4" />}>Add employee</ButtonLink>
          </>
        }
      />

      <Dialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        dismissible={!inviting}
        title="Invite to Self-Service"
        description="Invite a new employee by email. They will create their account and complete their Self-Service profile."
        footer={invitationLink ? <Button onClick={() => setInviteOpen(false)}>Done</Button> : (
          <>
            <Button variant="secondary" onClick={() => setInviteOpen(false)} disabled={inviting}>Cancel</Button>
            <Button disabled={!inviteEmail.trim()} loading={inviting} loadingLabel="Creating…" onClick={() => void inviteEmployee()}>Create invitation</Button>
          </>
        )}
      >
        {invitationLink ? (
          <Alert tone="success" title="Invitation created">
            <p>The email will be delivered when email delivery is enabled. You may also copy the secure link below.</p>
            <div className="mt-3 flex gap-2">
              <Input readOnly value={invitationLink} size="sm" aria-label="Invitation link" className="font-mono text-caption" />
              <Button size="sm" variant="secondary" leadingIcon={<Copy className="h-3.5 w-3.5" />} onClick={() => void navigator.clipboard.writeText(invitationLink)}>Copy</Button>
            </div>
          </Alert>
        ) : (
          <div className="space-y-4">
            <Field label="Employee email" helper="The recipient uses this email to create their Employee Self-Service account." required>
              <Input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="employee@example.com" data-autofocus />
            </Field>
            {inviteError && <Alert tone="danger">{inviteError}</Alert>}
          </div>
        )}
      </Dialog>

      <DataTable<Employee>
        caption="Employees"
        rows={employees}
        rowKey={(employee) => employee.id}
        loading={loading}
        error={error}
        onRetry={retry}
        minWidth={1040}
        toolbar={
          <div className="space-y-3">
            <DataToolbar
              search={search}
              onSearchChange={changeSearch}
              searchPlaceholder="Search by employee name, ID or work email…"
              filters={
                <>
                  <Select size="sm" aria-label="Status" value={status} onChange={(event) => changeStatus(event.target.value)}>
                    <option value={ALL}>Status: All</option>
                    {EMPLOYEE_STATUSES.map((option) => <option key={option} value={option}>Status: {humanizeEnum(option)}</option>)}
                  </Select>
                  <Select size="sm" aria-label="Employment type" value={employmentType} onChange={(event) => changeEmploymentType(event.target.value)}>
                    <option value={ALL}>Type: All</option>
                    {EMPLOYMENT_TYPES.map((option) => <option key={option} value={option}>Type: {humanizeEnum(option)}</option>)}
                  </Select>
                  <Select size="sm" aria-label="Department" value={department} onChange={(event) => changeDepartment(event.target.value)}>
                    <option value={ALL}>Department: All</option>
                    {lookups.departments.map((option) => <option key={option.id} value={option.id}>Department: {option.name}</option>)}
                  </Select>
                  <Select size="sm" aria-label="Location" value={location} onChange={(event) => changeLocation(event.target.value)}>
                    <option value={ALL}>Location: All</option>
                    {lookups.locations.map((option) => <option key={option.id} value={option.id}>Location: {option.name}</option>)}
                  </Select>
                </>
              }
              onClear={hasFilters ? clearFilters : undefined}
            />
            <p className="text-caption text-ink-muted">Showing <span className="font-semibold text-ink-strong tabular-nums">{employees.length}</span> of <span className="font-semibold text-ink-strong tabular-nums">{data.count}</span> employees</p>
          </div>
        }
        empty={{
          title: "No employees found",
          description: hasFilters ? "Try changing your search or filters to find employee records." : "No employee records exist for this institution yet.",
          icon: Users,
          action: hasFilters ? <Button size="sm" variant="secondary" onClick={clearFilters}>Clear filters</Button> : <ButtonLink href="/hr/employees/new" size="sm" leadingIcon={<Plus className="h-4 w-4" />}>Add employee</ButtonLink>,
        }}
        footer={
          <div className="space-y-2">
            <Pagination page={page} pageSize={pageSize} total={data.count} onPageChange={(next) => setPage(Math.min(Math.max(1, next), totalPages))} />
            {employments?.truncated && <p className="text-caption text-ink-muted">Assignment columns are resolved for the most recent employment records only.</p>}
          </div>
        }
        columns={[
          {
            key: "employee",
            header: "Employee",
            cell: (employee) => {
              const name = employeesApi.employeeDisplayName(employee);
              return (
                <Link href={`/hr/employees/${employee.id}`} className="group flex min-w-0 items-center gap-3">
                  <Avatar name={name} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink-strong group-hover:text-primary-ink">{name}</span>
                    <span className="block truncate text-caption text-ink-muted">{employee.employee_number}{employee.work_email ? ` · ${employee.work_email}` : ""}</span>
                  </span>
                </Link>
              );
            },
          },
          { key: "department", header: "Department", cell: (employee) => assignmentFor(employee.id).department },
          { key: "position", header: "Position", cell: (employee) => assignmentFor(employee.id).position },
          { key: "employment", header: "Employment", hideBelow: "lg", cell: (employee) => assignmentFor(employee.id).employmentType },
          { key: "location", header: "Location", hideBelow: "xl", cell: (employee) => assignmentFor(employee.id).location },
          { key: "joined", header: "Date joined", sortValue: (employee) => employee.hire_date, cell: (employee) => formatDate(employee.hire_date) },
          { key: "status", header: "Status", cell: (employee) => <StatusBadge status={employee.status} size="sm" /> },
          {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            cell: (employee) => {
              const name = employeesApi.employeeDisplayName(employee);
              return (
                <div className="flex justify-end">
                  <Menu
                    label={`Actions for ${name}`}
                    trigger={(props) => <IconButton {...props} label={`Actions for ${name}`} size="sm"><MoreHorizontal className="h-4 w-4" /></IconButton>}
                  >
                    {(close) => (
                      <div className="p-1.5">
                        <MenuItem icon={<Eye />} onSelect={() => { close(); router.push(`/hr/employees/${employee.id}`); }}>View</MenuItem>
                        <MenuItem icon={<Pencil />} onSelect={() => { close(); router.push(`/hr/employees/${employee.id}?edit=true`); }}>Edit</MenuItem>
                      </div>
                    )}
                  </Menu>
                </div>
              );
            },
          },
        ]}
      />
    </div>
  );
}
