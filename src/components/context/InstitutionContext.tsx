"use client";

import { createContext, useContext } from "react";

const DEV_INSTITUTION = {
  id: "dev-institution",
  name: "ErgonX Demo Institution",
  code: "DEMO",
  enabledModules: [
    "HR",
    "LEAVE",
    "ATTENDANCE",
    "PAYROLL",
    "ACCOUNTING",
    "REPORTS",
    "RECRUITMENT",
  ],
};

const InstitutionContext = createContext({
  institution: DEV_INSTITUTION,
  institutionId: DEV_INSTITUTION.id,
  enabledModules: DEV_INSTITUTION.enabledModules,
  hasModule: (module: string) =>
    DEV_INSTITUTION.enabledModules.includes(module),
});

export default function InstitutionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InstitutionContext.Provider
      value={{
        institution: DEV_INSTITUTION,
        institutionId: DEV_INSTITUTION.id,
        enabledModules: DEV_INSTITUTION.enabledModules,
        hasModule: (module: string) =>
          DEV_INSTITUTION.enabledModules.includes(module),
      }}
    >
      {children}
    </InstitutionContext.Provider>
  );
}

export function useInstitution() {
  return useContext(InstitutionContext);
}
