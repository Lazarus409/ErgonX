"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Clock3,
  Users,
  Moon,
  Sun,
  Pencil,
  Eye,
  ChevronDown,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";

type Shift = {
  id: string;
  name: string;
  code: string;
  type: "DAY" | "NIGHT" | "ROTATING";
  startTime: string;
  endTime: string;
  breakDuration: string;
  duration: string;
  assignedEmployees: number;
  department: string;
  location: string;
  status: "ACTIVE" | "INACTIVE";
};

const initialShifts: Shift[] = [
  {
    id: "SHF-001",
    name: "Morning Shift",
    code: "MORNING",
    type: "DAY",
    startTime: "08:00",
    endTime: "17:00",
    breakDuration: "1 hour",
    duration: "8 hours",
    assignedEmployees: 286,
    department: "All Departments",
    location: "Head Office",
    status: "ACTIVE",
  },
  {
    id: "SHF-002",
    name: "Evening Shift",
    code: "EVENING",
    type: "DAY",
    startTime: "14:00",
    endTime: "22:00",
    breakDuration: "1 hour",
    duration: "7 hours",
    assignedEmployees: 54,
    department: "Operations",
    location: "Regional Office",
    status: "ACTIVE",
  },
  {
    id: "SHF-003",
    name: "Night Shift",
    code: "NIGHT",
    type: "NIGHT",
    startTime: "22:00",
    endTime: "06:00",
    breakDuration: "1 hour",
    duration: "7 hours",
    assignedEmployees: 46,
    department: "Operations",
    location: "Regional Office",
    status: "ACTIVE",
  },
  {
    id: "SHF-004",
    name: "IT Support Rotation",
    code: "IT-ROT",
    type: "ROTATING",
    startTime: "09:00",
    endTime: "17:00",
    breakDuration: "1 hour",
    duration: "7 hours",
    assignedEmployees: 32,
    department: "IT",
    location: "Head Office",
    status: "ACTIVE",
  },
];

const emptyForm = {
  name: "",
  code: "",
  type: "DAY" as Shift["type"],
  startTime: "08:00",
  endTime: "17:00",
  breakDuration: "1 hour",
  department: "All Departments",
  location: "Head Office",
};

export default function AttendanceShiftsPage() {
  const [shifts, setShifts] = useState(initialShifts);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredShifts = useMemo(() => {
    const value = search.toLowerCase().trim();

    return shifts.filter((shift) => {
      const matchesSearch =
        !value ||
        shift.name.toLowerCase().includes(value) ||
        shift.code.toLowerCase().includes(value) ||
        shift.id.toLowerCase().includes(value);

      const matchesType =
        typeFilter === "All Types" || shift.type === typeFilter;

      const matchesStatus =
        statusFilter === "All Statuses" ||
        shift.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [shifts, search, typeFilter, statusFilter]);

  const openCreate = () => {
    setEditingShift(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (shift: Shift) => {
    setEditingShift(shift);

    setForm({
      name: shift.name,
      code: shift.code,
      type: shift.type,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakDuration: shift.breakDuration,
      department: shift.department,
      location: shift.location,
    });

    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingShift(null);
    setForm(emptyForm);
  };

  const calculateDuration = () => {
    const [startHour, startMinute] = form.startTime
      .split(":")
      .map(Number);

    const [endHour, endMinute] = form.endTime
      .split(":")
      .map(Number);

    let minutes =
      endHour * 60 +
      endMinute -
      (startHour * 60 + startMinute);

    if (minutes <= 0) {
      minutes += 24 * 60;
    }

    const breakMatch = form.breakDuration.match(/(\d+)/);
    const breakMinutes = breakMatch
      ? Number(breakMatch[1]) * 60
      : 0;

    const workedMinutes = Math.max(0, minutes - breakMinutes);

    const hours = Math.floor(workedMinutes / 60);
    const remaining = workedMinutes % 60;

    return remaining > 0
      ? `${hours}h ${remaining}m`
      : `${hours} hours`;
  };

  const saveShift = () => {
    if (
      !form.name.trim() ||
      !form.code.trim() ||
      !form.startTime ||
      !form.endTime
    ) {
      return;
    }

    const duration = calculateDuration();

    if (editingShift) {
      setShifts((current) =>
        current.map((shift) =>
          shift.id === editingShift.id
            ? {
                ...shift,
                ...form,
                duration,
              }
            : shift
        )
      );
    } else {
      const newShift: Shift = {
        id: `SHF-${String(shifts.length + 1).padStart(3, "0")}`,
        ...form,
        duration,
        assignedEmployees: 0,
        status: "ACTIVE",
      };

      setShifts((current) => [...current, newShift]);
    }

    closeModal();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shifts"
        description="Manage day, night and rotating employee shifts."
        actions={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add Shift
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Shifts"
          value={shifts.length}
          icon={<Clock3 className="h-5 w-5" />}
        />

        <SummaryCard
          title="Day Shifts"
          value={
            shifts.filter((shift) => shift.type === "DAY").length
          }
          icon={<Sun className="h-5 w-5" />}
        />

        <SummaryCard
          title="Night Shifts"
          value={
            shifts.filter((shift) => shift.type === "NIGHT").length
          }
          icon={<Moon className="h-5 w-5" />}
        />

        <SummaryCard
          title="Assigned Employees"
          value={shifts.reduce(
            (total, shift) => total + shift.assignedEmployees,
            0
          )}
          icon={<Users className="h-5 w-5" />}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search shifts..."
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-slate-400"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
          >
            <option>All Types</option>
            <option value="DAY">Day</option>
            <option value="NIGHT">Night</option>
            <option value="ROTATING">Rotating</option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
          >
            <option>All Statuses</option>
            <option>ACTIVE</option>
            <option>INACTIVE</option>
          </select>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1050px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Shift
                </th>

                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Type
                </th>

                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Time
                </th>

                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Duration
                </th>

                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Employees
                </th>

                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Assignment
                </th>

                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>

                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredShifts.map((shift) => (
                <tr
                  key={shift.id}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">
                      {shift.name}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {shift.code}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <ShiftType type={shift.type} />
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-700">
                    <p>
                      {shift.startTime} - {shift.endTime}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Break: {shift.breakDuration}
                    </p>
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-700">
                    {shift.duration}
                  </td>

                  <td className="px-5 py-4 text-sm font-medium text-slate-700">
                    {shift.assignedEmployees}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-700">
                    <p>{shift.department}</p>

                    <p className="mt-1 text-xs text-slate-500">
                      {shift.location}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge status={shift.status} />
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/attendance/shifts/${shift.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Link>

                      <button
                        onClick={() => openEdit(shift)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredShifts.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      No shifts found
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Try changing your search or filters.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-100 md:hidden">
          {filteredShifts.map((shift) => {
            const expanded = expandedId === shift.id;

            return (
              <div key={shift.id} className="p-4">
                <button
                  onClick={() =>
                    setExpandedId(expanded ? null : shift.id)
                  }
                  className="flex w-full items-center justify-between text-left"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {shift.name}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {shift.code}
                    </p>
                  </div>

                  <ChevronDown
                    className={`h-5 w-5 text-slate-400 transition-transform ${
                      expanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <div className="mt-3 flex items-center justify-between">
                  <ShiftType type={shift.type} />

                  <div className="flex gap-3">
                    <Link
                      href={`/attendance/shifts/${shift.id}`}
                      className="text-sm font-medium text-slate-700"
                    >
                      View
                    </Link>

                    <button
                      onClick={() => openEdit(shift)}
                      className="text-sm font-medium text-slate-700"
                    >
                      Edit
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
                    <Info
                      label="Start"
                      value={shift.startTime}
                    />

                    <Info
                      label="End"
                      value={shift.endTime}
                    />

                    <Info
                      label="Duration"
                      value={shift.duration}
                    />

                    <Info
                      label="Break"
                      value={shift.breakDuration}
                    />

                    <Info
                      label="Employees"
                      value={String(shift.assignedEmployees)}
                    />

                    <Info
                      label="Location"
                      value={shift.location}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {filteredShifts.length === 0 && (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium text-slate-700">
                No shifts found
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 px-5 py-3">
          <p className="text-xs text-slate-500">
            Showing {filteredShifts.length} of {shifts.length} shifts
          </p>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingShift ? "Edit Shift" : "Add Shift"}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Configure the shift timing and assignment scope.
              </p>
            </div>

            <div className="space-y-6 p-6">
              <section>
                <h3 className="mb-4 text-sm font-semibold text-slate-900">
                  Shift Details
                </h3>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      Shift Name
                    </span>

                    <input
                      value={form.name}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          name: event.target.value,
                        })
                      }
                      placeholder="e.g. Morning Shift"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      Shift Code
                    </span>

                    <input
                      value={form.code}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          code: event.target.value.toUpperCase(),
                        })
                      }
                      placeholder="e.g. MORNING"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm uppercase outline-none focus:border-slate-400"
                    />
                  </label>

                  <label className="space-y-1.5 md:col-span-2">
                    <span className="text-sm font-medium text-slate-700">
                      Shift Type
                    </span>

                    <select
                      value={form.type}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          type: event.target.value as Shift["type"],
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none"
                    >
                      <option value="DAY">Day Shift</option>
                      <option value="NIGHT">Night Shift</option>
                      <option value="ROTATING">Rotating Shift</option>
                    </select>
                  </label>
                </div>
              </section>

              <section>
                <h3 className="mb-4 text-sm font-semibold text-slate-900">
                  Shift Timing
                </h3>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      Start Time
                    </span>

                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          startTime: event.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none"
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      End Time
                    </span>

                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          endTime: event.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none"
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      Break Duration
                    </span>

                    <input
                      value={form.breakDuration}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          breakDuration: event.target.value,
                        })
                      }
                      placeholder="e.g. 1 hour"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none"
                    />
                  </label>
                </div>

                <div className="mt-4 rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">
                    Calculated working duration
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {calculateDuration()}
                  </p>
                </div>
              </section>

              <section>
                <h3 className="mb-4 text-sm font-semibold text-slate-900">
                  Assignment
                </h3>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      Department
                    </span>

                    <select
                      value={form.department}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          department: event.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none"
                    >
                      <option>All Departments</option>
                      <option>Human Resources</option>
                      <option>Finance</option>
                      <option>IT</option>
                      <option>Operations</option>
                      <option>Administration</option>
                    </select>
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      Location
                    </span>

                    <select
                      value={form.location}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          location: event.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none"
                    >
                      <option>Head Office</option>
                      <option>Regional Office</option>
                      <option>Remote</option>
                    </select>
                  </label>
                </div>
              </section>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                onClick={closeModal}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                onClick={saveShift}
                disabled={
                  !form.name.trim() ||
                  !form.code.trim() ||
                  !form.startTime ||
                  !form.endTime
                }
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {editingShift ? "Save Changes" : "Create Shift"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{title}</p>

        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          {icon}
        </span>
      </div>

      <p className="mt-3 text-2xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function ShiftType({
  type,
}: {
  type: Shift["type"];
}) {
  const content = {
    DAY: {
      label: "Day",
      icon: <Sun className="h-3.5 w-3.5" />,
    },
    NIGHT: {
      label: "Night",
      icon: <Moon className="h-3.5 w-3.5" />,
    },
    ROTATING: {
      label: "Rotating",
      icon: <Clock3 className="h-3.5 w-3.5" />,
    },
  };

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
      {content[type].icon}
      {content[type].label}
    </span>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">
        {value}
      </p>
    </div>
  );
}
