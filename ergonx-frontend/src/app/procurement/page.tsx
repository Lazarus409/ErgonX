"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import RequisitionList from "@/components/procurement/RequisitionList";
import { buttonClasses } from "@/components/ui/Button";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import Tabs from "@/components/ui/Tabs";
import { procurementApi } from "@/lib/api";
import { useAccess } from "@/lib/access";
import { useApiResource } from "@/lib/useApiResource";
import { MAX_PAGE_SIZE } from "@/types/api";

const FILTERS = [
  { value: "PENDING", label: "Awaiting approval" },
  { value: "APPROVED", label: "Ready to order" },
  { value: "ORDERED", label: "Ordered" },
  { value: "", label: "All" },
];

/** Every purchase requisition in the organisation, by stage. */
export default function RequisitionsPage() {
  const { can } = useAccess();
  const [status, setStatus] = useState("PENDING");
  const load = useCallback(() => procurementApi.listRequisitions({ page_size: MAX_PAGE_SIZE, ordering: "-created_at", ...(status ? { status } : {}) }), [status]);
  const { data, loading, error, reload } = useApiResource(load);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Requisitions"
        actions={
          <div className="flex gap-2">
            {can("requisition.create_own") && <Link href="/me/purchases" className={buttonClasses({ variant: "secondary" })}>My requests</Link>}
            {can("purchase_order.create") && <Link href="/procurement/orders" className={buttonClasses()}>Purchase orders</Link>}
          </div>
        }
      />
      <Tabs label="Requisition stage" variant="pill" items={FILTERS} value={status} onChange={setStatus} />
      {loading && !data ? <LoadingState variant="table" /> : error || !data ? <ErrorState message={error ?? "Requisitions could not be loaded."} onRetry={reload} /> : (
        <RequisitionList requisitions={data.results} showRequester emptyTitle="No requisitions here" />
      )}
    </div>
  );
}
