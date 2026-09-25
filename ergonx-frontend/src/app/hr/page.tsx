"use client";

import { Building2, GraduationCap, LayoutDashboard, MapPin, Users, UserRoundCog } from "lucide-react";

import ModuleLanding from "@/components/home/ModuleLanding";

const areas = [
  { title: "HR Dashboard", description: "Review source-backed workforce composition, active employment, and recent hires.", href: "/hr/dashboard", icon: LayoutDashboard, permission: "dashboard.hr.view" },
  { title: "Employees", description: "Browse employee records and start an authorized employee creation workflow.", href: "/hr/employees", icon: Users, permission: "employee.view" },
  { title: "Departments", description: "Review the institution's department catalogue.", href: "/hr/departments", icon: Building2, permission: "department.view" },
  { title: "Positions", description: "Review positions and their assigned department references.", href: "/hr/positions", icon: UserRoundCog, permission: "position.view" },
  { title: "Grades", description: "Review grade definitions maintained for this institution.", href: "/hr/grades", icon: GraduationCap, permission: "grade.view" },
  { title: "Locations", description: "Review work locations, remote status, and locale details.", href: "/hr/locations", icon: MapPin, permission: "location.view" },
];

export default function HRHomePage() {
  return <ModuleLanding title="Human Resources" description="Manage people and organization data for the active institution." module="HR" accent="hr" icon={Users} eyebrow="Human Resources" areas={areas} />;
}
