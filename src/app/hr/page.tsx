"use client";

import { Building2, FileCheck2, GraduationCap, LayoutDashboard, MapPin, Target, Users, UserRoundCog } from "lucide-react";

import ModuleLanding from "@/components/home/ModuleLanding";

const areas = [
  { title: "HR Dashboard", description: "Review source-backed workforce composition, active employment, and recent hires.", href: "/hr/dashboard", icon: LayoutDashboard, permission: "dashboard.hr.view" },
  { title: "Employees", description: "Browse employee records and start an authorized employee creation workflow.", href: "/hr/employees", icon: Users, permission: "employee.view" },
  { title: "Departments / Functional Areas", description: "Add and organize departments / functional areas.", href: "/hr/departments", icon: Building2, permission: "organization.view" },
  { title: "Positions", description: "Add job positions and the department / functional area each belongs to.", href: "/hr/positions", icon: UserRoundCog, permission: "organization.view" },
  { title: "Grades", description: "Set up the grade levels used for employees and pay.", href: "/hr/grades", icon: GraduationCap, permission: "organization.view" },
  { title: "Locations", description: "Add offices, sites and remote arrangements.", href: "/hr/locations", icon: MapPin, permission: "organization.view" },
  { title: "Document Checklist", description: "Required documents and who is still missing them.", href: "/hr/documents", icon: FileCheck2, permission: "document_requirement.view" },
  { title: "Training", description: "Courses, enrolments and certificates to renew.", href: "/training", icon: GraduationCap, permission: "training.view" },
  { title: "Performance", description: "Review cycles, self-assessments, manager reviews and sign-off.", href: "/performance", icon: Target, permission: "performance.view" },
];

export default function HRHomePage() {
  return <ModuleLanding title="Human Resources" description="Manage people and organization data for the active institution." module="HR" accent="hr" icon={Users} eyebrow="Human Resources" areas={areas} />;
}
