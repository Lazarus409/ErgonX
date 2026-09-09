"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Eye,
  MapPin,
  Plus,
  Search,
  Users,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";

type Location = {
  id: string;
  code: string;
  name: string;
  address: string;
  city: string;
  region: string;
  employeeCount: number;
  status: "ACTIVE" | "INACTIVE";
};

const locations: Location[] = [
  {
    id: "1",
    code: "ACC-HQ",
    name: "Accra Head Office",
    address: "Independence Avenue",
    city: "Accra",
    region: "Greater Accra",
    employeeCount: 42,
    status: "ACTIVE",
  },
  {
    id: "2",
    code: "KSI-BR",
    name: "Kumasi Branch",
    address: "Adum Business District",
    city: "Kumasi",
    region: "Ashanti",
    employeeCount: 18,
    status: "ACTIVE",
  },
  {
    id: "3",
    code: "TAK-BR",
    name: "Takoradi Branch",
    address: "Harbour Road",
    city: "Takoradi",
    region: "Western",
    employeeCount: 11,
    status: "ACTIVE",
  },
  {
    id: "4",
    code: "TEM-BR",
    name: "Tema Office",
    address: "Community 1",
    city: "Tema",
    region: "Greater Accra",
    employeeCount: 9,
    status: "ACTIVE",
  },
  {
    id: "5",
    code: "CAP-BR",
    name: "Cape Coast Branch",
    address: "Commercial Centre",
    city: "Cape Coast",
    region: "Central",
    employeeCount: 0,
    status: "INACTIVE",
  },
];

export default function LocationsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [region, setRegion] = useState("ALL");

  const regions = Array.from(
    new Set(locations.map((location) => location.region))
  );

  const filteredLocations = useMemo(() => {
    const searchValue = search.toLowerCase();

    return locations.filter((location) => {
      const matchesSearch =
        location.name.toLowerCase().includes(searchValue) ||
        location.code.toLowerCase().includes(searchValue) ||
        location.address.toLowerCase().includes(searchValue) ||
        location.city.toLowerCase().includes(searchValue) ||
        location.region.toLowerCase().includes(searchValue);

      const matchesStatus =
        status === "ALL" || location.status === status;

      const matchesRegion =
        region === "ALL" || location.region === region;

      return matchesSearch && matchesStatus && matchesRegion;
    });
  }, [search, status, region]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Locations"
        description="Manage institution locations and employee work locations."
        actions={
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add Location
          </button>
        }
      />

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search locations..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <select
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-500"
            >
              <option value="ALL">All Regions</option>

              {regions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

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

        {filteredLocations.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No locations found"
              description="Try adjusting your search or filters."
            />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Location
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Address
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Region
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
                  {filteredLocations.map((location) => (
                    <tr
                      key={location.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                            <MapPin className="h-5 w-5 text-slate-600" />
                          </div>

                          <div>
                            <p className="font-medium text-slate-900">
                              {location.name}
                            </p>

                            <p className="text-xs text-slate-500">
                              {location.code}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm text-slate-700">
                            {location.address}
                          </p>

                          <p className="text-xs text-slate-500">
                            {location.city}
                          </p>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-700">
                        {location.region}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <Users className="h-4 w-4 text-slate-400" />
                          {location.employeeCount}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <StatusBadge status={location.status} />
                      </td>

                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/hr/locations/${location.id}`}
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
              {filteredLocations.map((location) => (
                <div key={location.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                        <MapPin className="h-5 w-5 text-slate-600" />
                      </div>

                      <div>
                        <p className="font-medium text-slate-900">
                          {location.name}
                        </p>

                        <p className="text-xs text-slate-500">
                          {location.code}
                        </p>
                      </div>
                    </div>

                    <StatusBadge status={location.status} />
                  </div>

                  <div className="mt-4 space-y-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Address</p>
                      <p className="mt-1 text-slate-700">
                        {location.address}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-500">City</p>
                        <p className="mt-1 text-slate-700">
                          {location.city}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">Region</p>
                        <p className="mt-1 text-slate-700">
                          {location.region}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-slate-700">
                      <Users className="h-4 w-4 text-slate-400" />
                      {location.employeeCount} employees
                    </div>
                  </div>

                  <Link
                    href={`/hr/locations/${location.id}`}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Eye className="h-4 w-4" />
                    View Location
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