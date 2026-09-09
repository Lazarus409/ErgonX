"use client";

import {
  BarChart3,
  BriefcaseBusiness,
  Calculator,
  CalendarDays,
  Clock3,
  Users,
  WalletCards,
} from "lucide-react";

interface ModuleSelectorProps {
  selected: string[];
  onChange: (modules: string[]) => void;
}

const modules = [
  {
    id: "HR",
    name: "Human Resources",
    description: "Employees, departments, positions and HR records.",
    icon: Users,
    required: true,
  },
  {
    id: "LEAVE",
    name: "Leave Management",
    description: "Leave requests, balances, policies and approvals.",
    icon: CalendarDays,
    required: false,
  },
  {
    id: "ATTENDANCE",
    name: "Attendance",
    description: "Schedules, attendance, overtime and adjustments.",
    icon: Clock3,
    required: false,
  },
  {
    id: "PAYROLL",
    name: "Payroll",
    description: "Payroll processing, deductions and payslips.",
    icon: WalletCards,
    required: false,
  },
  {
    id: "ACCOUNTING",
    name: "Accounting",
    description: "Journals, ledgers, expenses and financial reporting.",
    icon: Calculator,
    required: false,
  },
  {
    id: "REPORTS",
    name: "Reports & Analytics",
    description: "Workforce, payroll and operational analytics.",
    icon: BarChart3,
    required: false,
  },
  {
    id: "RECRUITMENT",
    name: "Recruitment",
    description: "Jobs, candidates and recruitment workflows.",
    icon: BriefcaseBusiness,
    required: false,
  },
];

export default function ModuleSelector({
  selected,
  onChange,
}: ModuleSelectorProps) {
  const toggleModule = (moduleId: string) => {
    const selectedModule = modules.find(
      (item) => item.id === moduleId
    );

    if (selectedModule?.required) {
      return;
    }

    if (selected.includes(moduleId)) {
      onChange(
        selected.filter((item) => item !== moduleId)
      );
    } else {
      onChange([...selected, moduleId]);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {modules.map((selectedModule) => {
        const Icon = selectedModule.icon;
        const enabled = selected.includes(selectedModule.id);

        return (
          <button
            key={selectedModule.id}
            type="button"
            onClick={() => toggleModule(selectedModule.id)}
            className={`rounded-xl border p-5 text-left transition ${
              enabled
                ? "border-slate-950 bg-slate-50 ring-1 ring-slate-950"
                : "border-slate-200 bg-white hover:border-slate-400"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                <Icon
                  size={19}
                  className="text-slate-700"
                />
              </div>

              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                  enabled
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {selectedModule.required
                  ? "Required"
                  : enabled
                  ? "Enabled"
                  : "Optional"}
              </span>
            </div>

            <h3 className="mt-4 text-sm font-semibold text-slate-950">
              {selectedModule.name}
            </h3>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              {selectedModule.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}
