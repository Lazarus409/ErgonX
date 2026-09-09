import { Users, Clock3, CalendarDays, WalletCards } from "lucide-react";

const stats = [
  {
    title: "Workforce",
    value: "—",
    description: "Current employees",
    icon: Users,
  },
  {
    title: "Attendance",
    value: "—",
    description: "Today's attendance",
    icon: Clock3,
  },
  {
    title: "Leave",
    value: "—",
    description: "Pending requests",
    icon: CalendarDays,
  },
  {
    title: "Payroll",
    value: "—",
    description: "Current payroll status",
    icon: WalletCards,
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-sm font-medium text-slate-500">
          Executive Dashboard
        </p>

        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
          Overview
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Monitor workforce, attendance, leave, payroll and financial activity
          across your institution.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.title}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                  <Icon size={19} className="text-slate-700" />
                </div>

                <span className="text-xs text-slate-400">Live data</span>
              </div>

              <p className="mt-5 text-sm text-slate-500">{stat.title}</p>

              <p className="mt-1 text-2xl font-semibold text-slate-950">
                {stat.value}
              </p>

              <p className="mt-1 text-xs text-slate-400">{stat.description}</p>
            </div>
          );
        })}
      </div>

      {/* Dashboard sections */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="font-semibold text-slate-950">
            Approvals Requiring Attention
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Approval data will appear here when connected to the backend.
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="font-semibold text-slate-950">Compliance Alerts</h3>

          <p className="mt-2 text-sm text-slate-500">
            Compliance alerts will appear here when available.
          </p>
        </section>
      </div>
    </div>
  );
}
