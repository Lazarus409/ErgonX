"use client";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Save,
} from "lucide-react";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/guards/AuthProvider";
import OnboardingStepper from "@/components/onboarding/OnboardingStepper";
import ModuleSelector from "@/components/onboarding/ModuleSelector";
import ConfigurationIncomplete from "@/components/ui/ConfigurationIncomplete";

import {
  DEFAULT_ONBOARDING_DATA,
  ONBOARDING_STEPS,
} from "@/lib/onboarding";

import {
  OnboardingData,
  OnboardingStepId,
} from "@/types/onboarding";

const STORAGE_KEY = "ergonx_onboarding_draft";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(
    DEFAULT_ONBOARDING_DATA
  );

  const [completedSteps, setCompletedSteps] =
    useState<OnboardingStepId[]>([]);

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    const stored =
      localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored);

      if (parsed.data) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setData(parsed.data);
      }

      if (
        Array.isArray(parsed.completedSteps)
      ) {
        setCompletedSteps(
          parsed.completedSteps
        );
      }

      if (
        typeof parsed.currentStep === "number"
      ) {
        setCurrentStep(parsed.currentStep);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const saveProgress = () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        currentStep,
        completedSteps,
        data,
      })
    );

    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 2000);
  };

  const updateData = <K extends keyof OnboardingData>(
    key: K,
    value: OnboardingData[K]
  ) => {
    setData((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const enabledModules = data.enabledModules;

  const visibleSteps = useMemo(() => {
    return ONBOARDING_STEPS.filter((step) => {
      if (!step.module) {
        return true;
      }

      return enabledModules.includes(step.module);
    });
  }, [enabledModules]);

  const currentVisibleStep =
    visibleSteps[currentStep];

  const blockers = useMemo(() => {
    const result: string[] = [];

    if (!data.institution.name.trim()) {
      result.push("Institution name is required.");
    }

    if (!data.institution.code.trim()) {
      result.push("Institution code is required.");
    }

    if (!data.organisation.organisationType) {
      result.push(
        "Organisation type is required."
      );
    }

    if (
      enabledModules.includes("HR") &&
      !data.hr.employeeNumberPrefix.trim()
    ) {
      result.push(
        "Employee number prefix is required."
      );
    }

    if (
      enabledModules.includes("PAYROLL") &&
      !data.payroll.configurationMode
    ) {
      result.push(
        "Payroll configuration must be selected."
      );
    }

    if (
      enabledModules.includes("ACCOUNTING") &&
      !data.accounting.institutionType
    ) {
      result.push(
        "Accounting institution type is required."
      );
    }

    if (
      enabledModules.includes("ACCOUNTING") &&
      !data.accounting.configurationMode
    ) {
      result.push(
        "Accounting configuration must be selected."
      );
    }

    if (
      enabledModules.includes("PAYROLL") &&
      !data.payrollGl.mapped
    ) {
      result.push(
        "Payroll-to-GL mapping must be completed."
      );
    }

    if (!data.usersRoles.adminEmail.trim()) {
      result.push(
        "Initial administrator email is required."
      );
    }

    return result;
  }, [data, enabledModules]);

  const markCurrentStepComplete = () => {
    if (!currentVisibleStep) {
      return;
    }

    if (
      !completedSteps.includes(
        currentVisibleStep.id
      )
    ) {
      setCompletedSteps((previous) => [
        ...previous,
        currentVisibleStep.id,
      ]);
    }
  };

  const nextStep = () => {
    markCurrentStepComplete();

    if (
      currentStep <
      visibleSteps.length - 1
    ) {
      setCurrentStep((previous) => previous + 1);
    }
  };

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep((previous) => previous - 1);
    }
  };

  const completeOnboarding = () => {
    if (blockers.length > 0) {
      return;
    }

    localStorage.setItem(
      "ergonx_onboarding_ready",
      "true"
    );

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        currentStep,
        completedSteps: visibleSteps.map(
          (step) => step.id
        ),
        data,
        ready: true,
      })
    );

    setCompletedSteps(
      visibleSteps.map((step) => step.id)
    );
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-500">
          Loading onboarding...
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              ERGONX
            </p>

            <h1 className="mt-1 text-xl font-semibold text-slate-950">
              Institution Setup
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Configure your institution before using
              operational modules.
            </p>
          </div>

          <button
            type="button"
            onClick={saveProgress}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Save size={16} />

            {saved
              ? "Progress saved"
              : "Save progress"}
          </button>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[280px_1fr]">

        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-4 border-b border-slate-100 pb-4">
            <p className="text-xs text-slate-400">
              Setup progress
            </p>

            <p className="mt-1 text-lg font-semibold text-slate-950">
              {currentStep + 1} of{" "}
              {visibleSteps.length}
            </p>
          </div>

          <OnboardingStepper
            steps={visibleSteps}
            currentStep={currentStep}
            completedSteps={completedSteps}
            onStepClick={setCurrentStep}
          />
        </aside>

        <section className="min-w-0">
          <div className="rounded-xl border border-slate-200 bg-white">

            <div className="border-b border-slate-200 px-6 py-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Step {currentStep + 1}
              </p>

              <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                {currentVisibleStep?.title}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                {currentVisibleStep?.description}
              </p>
            </div>

            <div className="p-6">

              {currentVisibleStep?.id ===
                "institution" && (
                <div className="grid gap-5 md:grid-cols-2">

                  <Field
                    label="Institution name"
                    required
                    value={data.institution.name}
                    onChange={(value) =>
                      updateData(
                        "institution",
                        {
                          ...data.institution,
                          name: value,
                        }
                      )
                    }
                    placeholder="e.g. Cyber Security Authority"
                  />

                  <Field
                    label="Institution code"
                    required
                    value={data.institution.code}
                    onChange={(value) =>
                      updateData(
                        "institution",
                        {
                          ...data.institution,
                          code: value,
                        }
                      )
                    }
                    placeholder="e.g. CSA"
                  />

                  <SelectField
                    label="Country"
                    value={data.institution.country}
                    options={[
                      "Ghana",
                      "Nigeria",
                      "Kenya",
                      "Other",
                    ]}
                    onChange={(value) =>
                      updateData(
                        "institution",
                        {
                          ...data.institution,
                          country: value,
                          currency:
                            value === "Ghana"
                              ? "GHS"
                              : data.institution.currency,
                          timezone:
                            value === "Ghana"
                              ? "Africa/Accra"
                              : data.institution.timezone,
                        }
                      )
                    }
                  />

                  <Field
                    label="Timezone"
                    value={data.institution.timezone}
                    onChange={(value) =>
                      updateData(
                        "institution",
                        {
                          ...data.institution,
                          timezone: value,
                        }
                      )
                    }
                  />

                  <Field
                    label="Currency"
                    value={data.institution.currency}
                    onChange={(value) =>
                      updateData(
                        "institution",
                        {
                          ...data.institution,
                          currency: value,
                        }
                      )
                    }
                  />
                </div>
              )}

              {currentVisibleStep?.id ===
                "modules" && (
                <div>
                  <p className="mb-5 text-sm text-slate-600">
                    Select the modules your institution
                    needs. Disabled modules will not appear
                    in the operational navigation.
                  </p>

                  <ModuleSelector
                    selected={data.enabledModules}
                    onChange={(modules) =>
                      updateData(
                        "enabledModules",
                        modules
                      )
                    }
                  />
                </div>
              )}

              {currentVisibleStep?.id ===
                "organisation" && (
                <div className="grid gap-5 md:grid-cols-2">

                  <SelectField
                    label="Organisation type"
                    required
                    value={
                      data.organisation
                        .organisationType
                    }
                    options={[
                      "Private / Commercial",
                      "SME",
                      "Government / Public Sector",
                      "NGO / Nonprofit",
                      "School / Educational Institution",
                      "Other",
                    ]}
                    placeholder="Select organisation type"
                    onChange={(value) =>
                      updateData(
                        "organisation",
                        {
                          ...data.organisation,
                          organisationType: value,
                        }
                      )
                    }
                  />

                  <Field
                    label="Official email"
                    type="email"
                    value={
                      data.organisation.email
                    }
                    onChange={(value) =>
                      updateData(
                        "organisation",
                        {
                          ...data.organisation,
                          email: value,
                        }
                      )
                    }
                  />

                  <Field
                    label="Phone"
                    value={
                      data.organisation.phone
                    }
                    onChange={(value) =>
                      updateData(
                        "organisation",
                        {
                          ...data.organisation,
                          phone: value,
                        }
                      )
                    }
                  />

                  <Field
                    label="Website"
                    value={
                      data.organisation.website
                    }
                    onChange={(value) =>
                      updateData(
                        "organisation",
                        {
                          ...data.organisation,
                          website: value,
                        }
                      )
                    }
                  />

                  <div className="md:col-span-2">
                    <Field
                      label="Address"
                      value={
                        data.organisation.address
                      }
                      onChange={(value) =>
                        updateData(
                          "organisation",
                          {
                            ...data.organisation,
                            address: value,
                          }
                        )
                      }
                    />
                  </div>
                </div>
              )}

              {currentVisibleStep?.id ===
                "hr" && (
                <div className="space-y-6">

                  <Field
                    label="Employee number prefix"
                    required
                    value={
                      data.hr.employeeNumberPrefix
                    }
                    onChange={(value) =>
                      updateData("hr", {
                        ...data.hr,
                        employeeNumberPrefix:
                          value,
                      })
                    }
                    placeholder="EMP"
                  />

                  <div>
                    <label className="mb-3 block text-sm font-medium text-slate-700">
                      Employment types
                    </label>

                    <div className="flex flex-wrap gap-2">
                      {data.hr.employmentTypes.map(
                        (type) => (
                          <span
                            key={type}
                            className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-700"
                          >
                            {type}
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="mb-3 block text-sm font-medium text-slate-700">
                      Staff categories
                    </label>

                    <div className="flex flex-wrap gap-2">
                      {data.hr.staffCategories.map(
                        (category) => (
                          <span
                            key={category}
                            className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-700"
                          >
                            {category}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}

              {currentVisibleStep?.id ===
                "scheduling" && (
                <div className="space-y-6">

                  <div>
                    <label className="mb-3 block text-sm font-medium text-slate-700">
                      Working days
                    </label>

                    <div className="flex flex-wrap gap-2">
                      {[
                        "Monday",
                        "Tuesday",
                        "Wednesday",
                        "Thursday",
                        "Friday",
                        "Saturday",
                        "Sunday",
                      ].map((day) => {
                        const selected =
                          data.scheduling.workWeek.includes(
                            day
                          );

                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              const next =
                                selected
                                  ? data.scheduling.workWeek.filter(
                                      (item) =>
                                        item !== day
                                    )
                                  : [
                                      ...data
                                        .scheduling
                                        .workWeek,
                                      day,
                                    ];

                              updateData(
                                "scheduling",
                                {
                                  ...data.scheduling,
                                  workWeek: next,
                                }
                              );
                            }}
                            className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                              selected
                                ? "border-slate-950 bg-slate-950 text-white"
                                : "border-slate-200 text-slate-600"
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-5 md:grid-cols-3">

                    <Field
                      label="Start time"
                      type="time"
                      value={
                        data.scheduling.startTime
                      }
                      onChange={(value) =>
                        updateData(
                          "scheduling",
                          {
                            ...data.scheduling,
                            startTime: value,
                          }
                        )
                      }
                    />

                    <Field
                      label="End time"
                      type="time"
                      value={
                        data.scheduling.endTime
                      }
                      onChange={(value) =>
                        updateData(
                          "scheduling",
                          {
                            ...data.scheduling,
                            endTime: value,
                          }
                        )
                      }
                    />

                    <Field
                      label="Working hours"
                      type="number"
                      value={
                        data.scheduling.workingHours
                      }
                      onChange={(value) =>
                        updateData(
                          "scheduling",
                          {
                            ...data.scheduling,
                            workingHours: value,
                          }
                        )
                      }
                    />

                  </div>
                </div>
              )}

              {currentVisibleStep?.id ===
                "payroll" && (
                <div className="space-y-6">

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <h3 className="font-semibold text-slate-950">
                      Payroll configuration
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Choose whether to use the Ghana
                      payroll preset or configure payroll
                      manually.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">

                    <OptionCard
                      selected={
                        data.payroll
                          .configurationMode ===
                        "ghana_preset"
                      }
                      title="Ghana Payroll Preset"
                      description="Recommended. Applies versioned Ghana payroll configuration including PAYE, pension and compliance settings."
                      onClick={() =>
                        updateData("payroll", {
                          ...data.payroll,
                          configurationMode:
                            "ghana_preset",
                        })
                      }
                    />

                    <OptionCard
                      selected={
                        data.payroll
                          .configurationMode ===
                        "manual"
                      }
                      title="Configure Manually"
                      description="Use generic payroll configuration and configure the required rules yourself."
                      onClick={() =>
                        updateData("payroll", {
                          ...data.payroll,
                          configurationMode:
                            "manual",
                        })
                      }
                    />

                  </div>

                  {data.institution.country ===
                    "Ghana" && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                      Ghana payroll localisation is
                      optional. The preset is recommended
                      but is not forced solely because the
                      institution is in Ghana.
                    </div>
                  )}
                </div>
              )}

              {currentVisibleStep?.id ===
                "accounting" && (
                <div className="space-y-6">

                  <SelectField
                    label="Institution type"
                    required
                    value={
                      data.accounting
                        .institutionType
                    }
                    options={[
                      "Private / Commercial",
                      "SME",
                      "Government / Public Sector",
                      "NGO / Nonprofit",
                      "Other",
                    ]}
                    placeholder="Select institution type"
                    onChange={(value) =>
                      updateData(
                        "accounting",
                        {
                          ...data.accounting,
                          institutionType:
                            value,
                        }
                      )
                    }
                  />

                  <div className="grid gap-4 md:grid-cols-2">

                    <OptionCard
                      selected={
                        data.accounting
                          .configurationMode ===
                        "ghana_preset"
                      }
                      title="Ghana Accounting Preset"
                      description="Includes GHS defaults, starter Chart of Accounts, tax codes and compliance reminders."
                      onClick={() =>
                        updateData("accounting", {
                          ...data.accounting,
                          configurationMode:
                            "ghana_preset",
                        })
                      }
                    />

                    <OptionCard
                      selected={
                        data.accounting
                          .configurationMode ===
                        "manual"
                      }
                      title="Configure Manually"
                      description="Create your own accounting configuration and tax settings."
                      onClick={() =>
                        updateData("accounting", {
                          ...data.accounting,
                          configurationMode:
                            "manual",
                        })
                      }
                    />

                  </div>

                  {data.institution.country ===
                    "Ghana" && (
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <p className="text-sm font-medium text-slate-800">
                        Ghana accounting localisation
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        The accounting configuration can
                        support VAT, NHIL, GETFund,
                        withholding tax and VAT withholding.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {currentVisibleStep?.id ===
                "payroll_gl" && (
                <div className="space-y-6">

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      Payroll-to-GL mapping
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      These mappings connect payroll
                      transactions to accounting accounts.
                      Payroll finalisation will not silently
                      post directly to the ledger.
                    </p>
                  </div>

                  <div className="grid gap-5">

                    <Field
                      label="Payroll clearing account"
                      value={
                        data.payrollGl.payrollAccount
                      }
                      onChange={(value) =>
                        updateData(
                          "payrollGl",
                          {
                            ...data.payrollGl,
                            payrollAccount:
                              value,
                            mapped:
                              Boolean(
                                value &&
                                data.payrollGl
                                  .salaryExpenseAccount &&
                                data.payrollGl
                                  .taxPayableAccount
                              ),
                          }
                        )
                      }
                      placeholder="e.g. 2100"
                    />

                    <Field
                      label="Salary expense account"
                      value={
                        data.payrollGl
                          .salaryExpenseAccount
                      }
                      onChange={(value) =>
                        updateData(
                          "payrollGl",
                          {
                            ...data.payrollGl,
                            salaryExpenseAccount:
                              value,
                            mapped:
                              Boolean(
                                data.payrollGl
                                  .payrollAccount &&
                                value &&
                                data.payrollGl
                                  .taxPayableAccount
                              ),
                          }
                        )
                      }
                      placeholder="e.g. 6100"
                    />

                    <Field
                      label="Tax payable account"
                      value={
                        data.payrollGl
                          .taxPayableAccount
                      }
                      onChange={(value) =>
                        updateData(
                          "payrollGl",
                          {
                            ...data.payrollGl,
                            taxPayableAccount:
                              value,
                            mapped:
                              Boolean(
                                data.payrollGl
                                  .payrollAccount &&
                                data.payrollGl
                                  .salaryExpenseAccount &&
                                value
                              ),
                          }
                        )
                      }
                      placeholder="e.g. 2200"
                    />
                  </div>

                  {data.payrollGl.mapped && (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                      <CheckCircle2 size={18} />
                      Required payroll mappings are
                      complete.
                    </div>
                  )}
                </div>
              )}

              {currentVisibleStep?.id ===
                "users_roles" && (
                <div className="space-y-6">

                  <Field
                    label="Initial administrator email"
                    required
                    type="email"
                    value={
                      data.usersRoles.adminEmail
                    }
                    onChange={(value) =>
                      updateData(
                        "usersRoles",
                        {
                          ...data.usersRoles,
                          adminEmail: value,
                        }
                      )
                    }
                    placeholder="admin@example.com"
                  />

                  <SelectField
                    label="Administrator role"
                    value={
                      data.usersRoles.adminRole
                    }
                    options={[
                      "INSTITUTION_ADMIN",
                      "HR_ADMIN",
                    ]}
                    onChange={(value) =>
                      updateData(
                        "usersRoles",
                        {
                          ...data.usersRoles,
                          adminRole: value,
                        }
                      )
                    }
                  />

                  <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-4">
                    <input
                      type="checkbox"
                      checked={
                        data.usersRoles.inviteUsers
                      }
                      onChange={(event) =>
                        updateData(
                          "usersRoles",
                          {
                            ...data.usersRoles,
                            inviteUsers:
                              event.target.checked,
                          }
                        )
                      }
                      className="h-4 w-4 rounded border-slate-300"
                    />

                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        Invite additional users
                      </p>

                      <p className="text-xs text-slate-500">
                        User invitations can be completed
                        after the institution is created.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {currentVisibleStep?.id ===
                "validation" && (
                <div className="space-y-6">

                  <ConfigurationIncomplete
                    blockers={blockers}
                  />

                  {blockers.length === 0 ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
                      <div className="flex items-center gap-3">
                        <CheckCircle2
                          size={24}
                          className="text-emerald-600"
                        />

                        <div>
                          <h3 className="font-semibold text-emerald-900">
                            Configuration ready
                          </h3>

                          <p className="mt-1 text-sm text-emerald-700">
                            All required onboarding
                            configuration has been completed.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white p-5">
                      <p className="text-sm text-slate-600">
                        Return to the relevant steps using
                        the setup menu to resolve the
                        remaining blockers.
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={blockers.length > 0}
                    onClick={completeOnboarding}
                    className="flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <CheckCircle2 size={17} />
                    Mark Institution READY
                  </button>

                  {localStorage.getItem(
                    "ergonx_onboarding_ready"
                  ) === "true" && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
                      Institution is READY.
                    </div>
                  )}
                </div>
              )}

            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-5">

              <button
                type="button"
                onClick={previousStep}
                disabled={currentStep === 0}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft size={16} />
                Back
              </button>

              <div className="flex items-center gap-3">

                <button
                  type="button"
                  onClick={saveProgress}
                  className="hidden items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 sm:flex"
                >
                  <Save size={16} />
                  Save
                </button>

                {currentStep <
                visibleSteps.length - 1 ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="flex items-center gap-2 rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Continue
                    <ArrowRight size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={blockers.length > 0}
                    onClick={completeOnboarding}
                    className="flex items-center gap-2 rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Complete Setup
                    <CheckCircle2 size={16} />
                  </button>
                )}

              </div>
            </div>

          </div>
        </section>
      </div>
    </main>
  );
}


function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
      />
    </div>
  );
}


function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
      >
        {placeholder && (
          <option value="">
            {placeholder}
          </option>
        )}

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}


function OptionCard({
  selected,
  title,
  description,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-5 text-left transition ${
        selected
          ? "border-slate-950 bg-slate-50 ring-1 ring-slate-950"
          : "border-slate-200 bg-white hover:border-slate-400"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`h-4 w-4 rounded-full border-4 ${
            selected
              ? "border-slate-950"
              : "border-slate-300"
          }`}
        />

        <h3 className="text-sm font-semibold text-slate-950">
          {title}
        </h3>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </button>
  );
}
