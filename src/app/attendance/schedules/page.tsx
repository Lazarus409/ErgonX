"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";

type ScheduleType = "FIXED" | "SHIFT_PATTERN" | "ROTATING" | "FLEXIBLE";

type Employee = {
  id: number;
  name: string;
  number: string;
  department: string;
  location: string;
  selected: boolean;
};

type Schedule = {
  id: number;
  name: string;
  code: string;
  type: ScheduleType;
  status: "ACTIVE" | "INACTIVE";
  effectiveFrom: string;
  employees: number;
  details: string;
};

const initialSchedules: Schedule[] = [
  {
    id: 1,
    name: "Standard Work Schedule",
    code: "STD-08",
    type: "FIXED",
    status: "ACTIVE",
    effectiveFrom: "01 Jan 2026",
    employees: 42,
    details: "08:00 - 17:00 · Mon - Fri",
  },
  {
    id: 2,
    name: "Security Rotation",
    code: "SEC-ROT",
    type: "ROTATING",
    status: "ACTIVE",
    effectiveFrom: "01 Jan 2026",
    employees: 24,
    details: "3-week rotation cycle",
  },
  {
    id: 3,
    name: "Operations Flexible",
    code: "OPS-FLEX",
    type: "FLEXIBLE",
    status: "ACTIVE",
    effectiveFrom: "01 Mar 2026",
    employees: 18,
    details: "07:00 - 10:00 start window",
  },
];

const initialEmployees: Employee[] = [
  {
    id: 1,
    name: "Ama Mensah",
    number: "EMP-001",
    department: "Human Resources",
    location: "Main Office",
    selected: false,
  },
  {
    id: 2,
    name: "Kofi Asare",
    number: "EMP-002",
    department: "Finance",
    location: "Main Office",
    selected: false,
  },
  {
    id: 3,
    name: "Adwoa Owusu",
    number: "EMP-003",
    department: "Operations",
    location: "Operations Site",
    selected: false,
  },
  {
    id: 4,
    name: "Kwesi Boateng",
    number: "EMP-004",
    department: "IT",
    location: "Main Office",
    selected: false,
  },
  {
    id: 5,
    name: "Akosua Ofori",
    number: "EMP-005",
    department: "Operations",
    location: "Operations Site",
    selected: false,
  },
];

const stepLabels = [
  "Schedule Type",
  "Schedule Details",
  "Effective Dates",
  "Assign Employees",
  "Preview",
];

const typeNames: Record<ScheduleType, string> = {
  FIXED: "Fixed",
  SHIFT_PATTERN: "Shift Pattern",
  ROTATING: "Rotating",
  FLEXIBLE: "Flexible",
};

const typeDescriptions: Record<ScheduleType, string> = {
  FIXED: "A regular schedule with defined working days and start/end times.",
  SHIFT_PATTERN: "A schedule driven by a predefined shift pattern.",
  ROTATING: "A schedule that follows an ordered rotation sequence.",
  FLEXIBLE: "A schedule with permitted time windows and required working time.",
};

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState(initialSchedules);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(0);

  const [scheduleType, setScheduleType] = useState<ScheduleType>("FIXED");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [breakMinutes, setBreakMinutes] = useState("60");
  const [workingDays, setWorkingDays] = useState([
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
  ]);

  const [shiftPattern, setShiftPattern] = useState("Standard Shift Pattern");
  const [rotationPattern, setRotationPattern] = useState(
    "Security 3-Shift Rotation"
  );
  const [flexibleRule, setFlexibleRule] = useState(
    "Standard Flexible Work"
  );

  const [effectiveFrom, setEffectiveFrom] = useState("2026-09-13");
  const [effectiveTo, setEffectiveTo] = useState("");

  const [employees, setEmployees] = useState(initialEmployees);
  const [employeeSearch, setEmployeeSearch] = useState("");

  const filteredSchedules = useMemo(() => {
    return schedules.filter((schedule) => {
      const matchesSearch =
        !search ||
        `${schedule.name} ${schedule.code}`
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesType =
        typeFilter === "ALL" || schedule.type === typeFilter;

      const matchesStatus =
        statusFilter === "ALL" || schedule.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [schedules, search, typeFilter, statusFilter]);

  const filteredEmployees = employees.filter((employee) =>
    `${employee.name} ${employee.number} ${employee.department}`
      .toLowerCase()
      .includes(employeeSearch.toLowerCase())
  );

  const selectedEmployees = employees.filter((employee) => employee.selected);

  const toggleDay = (day: string) => {
    setWorkingDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day]
    );
  };

  const toggleEmployee = (id: number) => {
    setEmployees((current) =>
      current.map((employee) =>
        employee.id === id
          ? { ...employee, selected: !employee.selected }
          : employee
      )
    );
  };

  const resetWizard = () => {
    setStep(0);
    setScheduleType("FIXED");
    setName("");
    setCode("");
    setStartTime("08:00");
    setEndTime("17:00");
    setBreakMinutes("60");
    setWorkingDays(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    setShiftPattern("Standard Shift Pattern");
    setRotationPattern("Security 3-Shift Rotation");
    setFlexibleRule("Standard Flexible Work");
    setEffectiveFrom("2026-09-13");
    setEffectiveTo("");
    setEmployeeSearch("");
    setEmployees(initialEmployees);
  };

  const openWizard = () => {
    resetWizard();
    setShowWizard(true);
  };

  const closeWizard = () => {
    setShowWizard(false);
    resetWizard();
  };

  const nextStep = () => {

    if (step < 4) {

      setStep((current) => current + 1);

    }

  };


  const previousStep = () => {

    if (step > 0) {

      setStep((current) => current - 1);

    }

  };


  const canContinue = () => {
    if (step === 0) return true;

    if (step === 1) {
      if (!name.trim() || !code.trim()) return false;
      if (scheduleType === "FIXED" && workingDays.length === 0) {
        return false;
      }
      return true;
    }

    if (step === 2) return Boolean(effectiveFrom);

    if (step === 3) return selectedEmployees.length > 0;

    return true;
  };

  const createSchedule = () => {
    const effectiveFromLabel = new Date(
      effectiveFrom
    ).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    let details = "";

    if (scheduleType === "FIXED") {
      details = `${startTime} - ${endTime} · ${workingDays.join(", ")}`;
    }

    if (scheduleType === "SHIFT_PATTERN") {
      details = shiftPattern;
    }

    if (scheduleType === "ROTATING") {
      details = rotationPattern;
    }

    if (scheduleType === "FLEXIBLE") {
      details = flexibleRule;
    }

    setSchedules((current) => [
      ...current,
      {
        id: Date.now(),
        name: name.trim(),
        code: code.trim(),
        type: scheduleType,
        status: "ACTIVE",
        effectiveFrom: effectiveFromLabel,
        employees: selectedEmployees.length,
        details,
      },
    ]);

    closeWizard();
  };

  return (
    <main className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Attendance & Scheduling
          </p>

          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Schedules
          </h1>

          <p className="mt-1 text-sm text-slate-600">
            Create and manage employee work schedules across fixed, shift,
            rotating, and flexible arrangements.
          </p>
        </div>

        <button
          type="button"
          onClick={openWizard}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Plus size={17} />
          Create Schedule
        </button>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Schedules</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {schedules.length}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Active</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {schedules.filter((item) => item.status === "ACTIVE").length}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Assigned Employees</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {schedules.reduce((sum, item) => sum + item.employees, 0)}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row">
          <div className="relative flex-1">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search schedules..."
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
          >
            <option value="ALL">All types</option>
            <option value="FIXED">Fixed</option>
            <option value="SHIFT_PATTERN">Shift Pattern</option>
            <option value="ROTATING">Rotating</option>
            <option value="FLEXIBLE">Flexible</option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Schedule</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Details</th>
                <th className="px-5 py-3 font-medium">Effective From</th>
                <th className="px-5 py-3 font-medium">Employees</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredSchedules.map((schedule) => (
                <tr key={schedule.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">
                      {schedule.name}
                    </p>

                    <p className="text-xs text-slate-500">
                      {schedule.code}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {typeNames[schedule.type]}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-slate-600">
                    {schedule.details}
                  </td>

                  <td className="px-5 py-4 text-slate-600">
                    {schedule.effectiveFrom}
                  </td>

                  <td className="px-5 py-4 text-slate-600">
                    {schedule.employees}
                  </td>

                  <td className="px-5 py-4">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      {schedule.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-100 md:hidden">
          {filteredSchedules.map((schedule) => (
            <div key={schedule.id} className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">
                    {schedule.name}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {schedule.code}
                  </p>
                </div>

                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  {schedule.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Type</p>
                  <p className="mt-1 text-slate-700">
                    {typeNames[schedule.type]}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Employees</p>
                  <p className="mt-1 text-slate-700">
                    {schedule.employees}
                  </p>
                </div>

                <div className="col-span-2">
                  <p className="text-xs text-slate-500">Details</p>
                  <p className="mt-1 text-slate-700">
                    {schedule.details}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredSchedules.length === 0 && (
          <div className="p-10 text-center text-sm text-slate-500">
            No schedules match the current filters.
          </div>
        )}
      </section>

      {showWizard && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 p-4">
          <div className="mx-auto my-8 w-full max-w-5xl rounded-xl bg-white shadow-xl">
            <div className="border-b border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Create Schedule
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Configure the schedule from type through employee
                    assignment and final preview.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeWizard}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-6 grid grid-cols-5 gap-2">
                {stepLabels.map((label, index) => (
                  <div key={label}>
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                        index <= step
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {index < step ? <Check size={15} /> : index + 1}
                    </div>

                    <p
                      className={`mt-2 hidden text-xs sm:block ${
                        index === step
                          ? "font-semibold text-slate-900"
                          : "text-slate-500"
                      }`}
                    >
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="min-h-[420px] p-5">
              {step === 0 && (
                <section>
                  <h3 className="font-semibold text-slate-900">
                    Choose Schedule Type
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Select the scheduling model that will control this
                    schedule.
                  </p>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {(Object.keys(typeNames) as ScheduleType[]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setScheduleType(type)}
                        className={`rounded-xl border p-5 text-left transition ${
                          scheduleType === type
                            ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900">
                            {typeNames[type]}
                          </span>

                          {scheduleType === type && (
                            <Check size={18} />
                          )}
                        </div>

                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {typeDescriptions[type]}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {step === 1 && (
                <section className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Schedule Details
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Configure the details required for the selected schedule
                      type.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-slate-600">
                        Schedule Name
                      </label>

                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="e.g. Standard Work Schedule"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600">
                        Schedule Code
                      </label>

                      <input
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                        placeholder="e.g. STD-08"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                      />
                    </div>
                  </div>

                  {scheduleType === "FIXED" && (
                    <>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                          <label className="text-xs font-medium text-slate-600">
                            Start Time
                          </label>

                          <input
                            type="time"
                            value={startTime}
                            onChange={(event) =>
                              setStartTime(event.target.value)
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-slate-600">
                            End Time
                          </label>

                          <input
                            type="time"
                            value={endTime}
                            onChange={(event) =>
                              setEndTime(event.target.value)
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-slate-600">
                            Break Minutes
                          </label>

                          <input
                            type="number"
                            min="0"
                            value={breakMinutes}
                            onChange={(event) =>
                              setBreakMinutes(event.target.value)
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-slate-600">
                          Working Days
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                            (day) => (
                              <button
                                key={day}
                                type="button"
                                onClick={() => toggleDay(day)}
                                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                                  workingDays.includes(day)
                                    ? "border-slate-900 bg-slate-900 text-white"
                                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                {day}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {scheduleType === "SHIFT_PATTERN" && (
                    <div>
                      <label className="text-xs font-medium text-slate-600">
                        Shift Pattern
                      </label>

                      <select
                        value={shiftPattern}
                        onChange={(event) =>
                          setShiftPattern(event.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                      >
                        <option>Standard Shift Pattern</option>
                        <option>Operations Shift Pattern</option>
                        <option>Security Shift Pattern</option>
                      </select>
                    </div>
                  )}

                  {scheduleType === "ROTATING" && (
                    <div>
                      <label className="text-xs font-medium text-slate-600">
                        Rotation Pattern
                      </label>

                      <select
                        value={rotationPattern}
                        onChange={(event) =>
                          setRotationPattern(event.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                      >
                        <option>Security 3-Shift Rotation</option>
                        <option>Operations 2-Shift Rotation</option>
                      </select>

                      <div className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                        The selected rotation follows its configured ordered
                        sequence and repeats according to its cycle.
                      </div>
                    </div>
                  )}

                  {scheduleType === "FLEXIBLE" && (
                    <div>
                      <label className="text-xs font-medium text-slate-600">
                        Flexible Work Rule
                      </label>

                      <select
                        value={flexibleRule}
                        onChange={(event) =>
                          setFlexibleRule(event.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                      >
                        <option>Standard Flexible Work</option>
                        <option>Management Flexible Rule</option>
                      </select>
                    </div>
                  )}
                </section>
              )}

              {step === 2 && (
                <section>
                  <h3 className="font-semibold text-slate-900">
                    Effective Dates
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Define when the schedule becomes applicable.
                  </p>

                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-slate-600">
                        Effective From
                      </label>

                      <input
                        type="date"
                        value={effectiveFrom}
                        onChange={(event) =>
                          setEffectiveFrom(event.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600">
                        Effective To
                      </label>

                      <input
                        type="date"
                        value={effectiveTo}
                        onChange={(event) =>
                          setEffectiveTo(event.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                      />
                    </div>
                  </div>

                  <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start gap-3">
                      <CalendarDays size={19} className="mt-0.5 text-slate-600" />

                      <div>
                        <p className="font-medium text-slate-900">
                          Historical integrity
                        </p>

                        <p className="mt-1 text-sm text-slate-600">
                          Future schedule changes should not overwrite the
                          historical schedule context used for past attendance.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {step === 3 && (
                <section>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        Assign Employees
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Select the employees who should follow this schedule.
                      </p>
                    </div>

                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                      {selectedEmployees.length} selected
                    </span>
                  </div>

                  <div className="relative mt-5">
                    <Search
                      size={17}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      value={employeeSearch}
                      onChange={(event) =>
                        setEmployeeSearch(event.target.value)
                      }
                      placeholder="Search employees..."
                      className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-slate-500"
                    />
                  </div>

                  <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                    {filteredEmployees.map((employee) => (
                      <button
                        key={employee.id}
                        type="button"
                        onClick={() => toggleEmployee(employee.id)}
                        className="flex w-full items-center gap-4 border-b border-slate-100 p-4 text-left last:border-b-0 hover:bg-slate-50"
                      >
                        <div
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                            employee.selected
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-300"
                          }`}
                        >
                          {employee.selected && <Check size={13} />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-900">
                            {employee.name}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {employee.number} · {employee.department}
                          </p>
                        </div>

                        <div className="hidden items-center gap-1 text-xs text-slate-500 sm:flex">
                          <MapPin size={14} />
                          {employee.location}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {step === 4 && (
                <section>
                  <h3 className="font-semibold text-slate-900">
                    Preview
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Review the complete schedule before creating it.
                  </p>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs text-slate-500">Schedule</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {name || "Unnamed Schedule"}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {code || "No code"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs text-slate-500">Type</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {typeNames[scheduleType]}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs text-slate-500">
                        Effective Period
                      </p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {effectiveFrom || "Not set"}
                        {effectiveTo
                          ? ` → ${effectiveTo}`
                          : " → No end date"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs text-slate-500">Employees</p>
                      <p className="mt-1 flex items-center gap-2 font-semibold text-slate-900">
                        <Users size={16} />
                        {selectedEmployees.length}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2">
                      <Clock3 size={17} className="text-slate-600" />

                      <p className="font-semibold text-slate-900">
                        Schedule Configuration
                      </p>
                    </div>

                    <p className="mt-2 text-sm text-slate-600">
                      {scheduleType === "FIXED" &&
                        `${startTime} - ${endTime}, ${breakMinutes} minute break, ${workingDays.join(", ")}`}
                      {scheduleType === "SHIFT_PATTERN" && shiftPattern}
                      {scheduleType === "ROTATING" && rotationPattern}
                      {scheduleType === "FLEXIBLE" && flexibleRule}
                    </p>
                  </div>
                </section>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={step === 0 ? closeWizard : previousStep}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft size={16} />
                {step === 0 ? "Cancel" : "Back"}
              </button>

              {step < 4 ? (
                <button
                  type="button"
                  disabled={!canContinue()}
                  onClick={nextStep}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continue
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={createSchedule}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <Check size={16} />
                  Create Schedule
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-medium">Development mode</p>

        <p className="mt-1">
          Schedule records and assignments currently use local demo data.
          Final validation, persistence, permissions, effective-date
          enforcement, and attendance calculations will be controlled by the
          backend.
        </p>
      </div>
    </main>
  );
}
