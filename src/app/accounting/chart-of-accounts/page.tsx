"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Search } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

type Account = {
  code: string;
  name: string;
  type: string;
  parent?: string;
  balance: string;
  status: "ACTIVE" | "INACTIVE";
};

const initialAccounts: Account[] = [
  { code: "1000", name: "Assets", type: "ASSET", balance: "GHS 842,500", status: "ACTIVE" },
  { code: "1100", name: "Cash and Bank", type: "ASSET", parent: "1000", balance: "GHS 842,500", status: "ACTIVE" },
  { code: "1110", name: "Main Bank Account", type: "ASSET", parent: "1100", balance: "GHS 710,200", status: "ACTIVE" },
  { code: "1120", name: "Petty Cash", type: "ASSET", parent: "1100", balance: "GHS 132,300", status: "ACTIVE" },
  { code: "1200", name: "Accounts Receivable", type: "ASSET", parent: "1000", balance: "GHS 218,400", status: "ACTIVE" },
  { code: "2000", name: "Liabilities", type: "LIABILITY", balance: "GHS 143,750", status: "ACTIVE" },
  { code: "2100", name: "Accounts Payable", type: "LIABILITY", parent: "2000", balance: "GHS 143,750", status: "ACTIVE" },
  { code: "3000", name: "Equity", type: "EQUITY", balance: "GHS 2.1M", status: "ACTIVE" },
  { code: "4000", name: "Revenue", type: "REVENUE", balance: "GHS 1.84M", status: "ACTIVE" },
  { code: "5000", name: "Expenses", type: "EXPENSE", balance: "GHS 1.21M", status: "ACTIVE" },
];

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "1000": true,
    "1100": true,
    "2000": true,
  });

  const visible = useMemo(
    () =>
      accounts.filter((account) =>
        `${account.code} ${account.name} ${account.type}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [accounts, search]
  );

  const addAccount = () => {
    const code = window.prompt("Account code");
    const name = window.prompt("Account name");

    if (!code || !name) return;

    setAccounts((current) => [
      ...current,
      {
        code,
        name,
        type: "EXPENSE",
        balance: "GHS 0",
        status: "ACTIVE",
      },
    ]);
  };

  return (
    <main className="space-y-6">
      <PageHeader
        title="Chart of Accounts"
        description="Manage accounts and their hierarchy for the active institution."
        actions={
          <button
            onClick={addAccount}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            New Account
          </button>
        }
      />

      <section className="rounded-2xl border bg-white p-5">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts..."
            className="w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-slate-500">
                <th className="pb-3">Account</th>
                <th className="pb-3">Type</th>
                <th className="pb-3">Balance</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((account) => {
                const hasChildren = accounts.some((item) => item.parent === account.code);
                const indent = account.parent ? "pl-10" : "pl-2";

                return (
                  <tr key={account.code} className="border-b last:border-0">
                    <td className={`py-4 ${indent}`}>
                      <div className="flex items-center gap-2">
                        {hasChildren ? (
                          <button
                            onClick={() =>
                              setExpanded((current) => ({
                                ...current,
                                [account.code]: !current[account.code],
                              }))
                            }
                          >
                            {expanded[account.code] ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        ) : (
                          <span className="w-4" />
                        )}
                        <span className="font-medium">{account.code}</span>
                        <span>{account.name}</span>
                      </div>
                    </td>
                    <td className="py-4">{account.type}</td>
                    <td className="py-4 font-medium">{account.balance}</td>
                    <td className="py-4">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium">
                        {account.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}