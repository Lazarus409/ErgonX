import WorkspaceHome from "@/components/home/WorkspaceHome";

export default function AccountingPage() {
  return (
    <WorkspaceHome
      areaLabel="Accounting Home"
      continueHref="/accounting/dashboard"
      continueTitle="Accounting Dashboard"
      continueDescription="Review finance totals, approvals, and period controls."
    />
  );
}
