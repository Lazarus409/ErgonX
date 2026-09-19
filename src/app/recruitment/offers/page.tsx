"use client";

import Link from "next/link";
import { useCallback } from "react";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { recruitmentApi } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";

export default function OffersPage() {
  const load = useCallback(() => recruitmentApi.listOffers({ ordering: "-created_at" }), []); const { data, loading, error, reload } = useApiResource(load); if (loading) return <LoadingState />; if (error || !data) return <ErrorState message={error ?? "Unable to load offers."} onRetry={reload} />;
  return <div className="space-y-6"><PageHeader title="Offers" description="Track offer decisions and use the controlled hire workflow for accepted offers." actions={<Link href="/recruitment/offers/new" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">New Offer</Link>} /><div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-slate-500"><th className="px-5 py-3 font-medium">Offer</th><th className="px-5 py-3 font-medium">Start date</th><th className="px-5 py-3 font-medium">Compensation</th><th className="px-5 py-3 font-medium">Status</th></tr></thead><tbody>{data.results.length === 0 ? <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-500">No offers found.</td></tr> : data.results.map((offer) => <tr key={offer.id} className="border-b border-slate-100"><td className="px-5 py-4"><Link href={`/recruitment/offers/${offer.id}`} className="font-medium hover:underline">Offer {offer.id.slice(0, 8)}</Link></td><td className="px-5 py-4">{offer.proposed_start_date}</td><td className="px-5 py-4">{offer.base_salary ? `${offer.currency} ${offer.base_salary}` : "Not set"}</td><td className="px-5 py-4"><StatusBadge status={offer.status} /></td></tr>)}</tbody></table></div></div>;
}
