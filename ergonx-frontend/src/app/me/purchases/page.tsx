"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import RequisitionForm from "@/components/procurement/RequisitionForm";
import RequisitionList from "@/components/procurement/RequisitionList";
import { Button } from "@/components/ui/Button";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import ModuleDisabled from "@/components/ui/ModuleDisabled";
import PageHeader from "@/components/ui/PageHeader";
import { procurementApi } from "@/lib/api";
import { useAccess } from "@/lib/access";
import { useApiResource } from "@/lib/useApiResource";
import { MAX_PAGE_SIZE } from "@/types/api";

/** My purchase requests: what the member asked to buy, and where each request is. */
export default function MyPurchasesPage() {
  const router = useRouter();
  const { user, can, moduleEnabled } = useAccess();
  const enabled = moduleEnabled("PROCUREMENT") && can("requisition.create_own");
  const load = useCallback(async () => (enabled ? (await procurementApi.listRequisitions({ mine: "1", page_size: MAX_PAGE_SIZE, ordering: "-created_at" })).results : []), [enabled]);
  const { data, loading, error, reload } = useApiResource(load);
  const [creating, setCreating] = useState(false);

  if (!moduleEnabled("PROCUREMENT")) return <ModuleDisabled moduleName="Procurement" />;
  if (!enabled) return <ErrorState title="Purchase requests are not available" message="Your role does not include requesting purchases. Ask your administrator." />;
  if (loading && !data) return <LoadingState variant="table" />;
  if (error || !data) return <ErrorState message={error ?? "Your requests could not be loaded."} onRetry={reload} />;
  // Requests you approve for others are in Approvals.
  const mine = data.filter((requisition) => requisition.requested_by === user?.id);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="My purchase requests" actions={<Button leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>New request</Button>} />
      <RequisitionList requisitions={mine} emptyTitle="No purchase requests yet" />
      {creating && <RequisitionForm requisition={null} onClose={() => setCreating(false)} onSaved={(saved) => router.push(`/procurement/requisitions/${saved.id}`)} />}
    </div>
  );
}
