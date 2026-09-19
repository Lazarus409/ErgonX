import Link from "next/link";
import { BriefcaseBusiness, CalendarDays, ClipboardCheck, FileText, Handshake, UsersRound, Workflow } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";

const areas = [
  { title: "Job Postings", description: "Create, publish, close, and monitor open roles.", href: "/recruitment/job-postings", icon: BriefcaseBusiness },
  { title: "Candidates", description: "Maintain candidate records and recruitment sources.", href: "/recruitment/candidates", icon: UsersRound },
  { title: "Recruitment Pipeline", description: "See application volume by the server-defined hiring stage.", href: "/recruitment/pipeline", icon: Workflow },
  { title: "Recruitment Stages", description: "Review the ordered stages used by the recruitment pipeline.", href: "/recruitment/stages", icon: Workflow },
  { title: "Applications", description: "Submit candidates and move them through the controlled pipeline.", href: "/recruitment/applications", icon: ClipboardCheck },
  { title: "Interviews", description: "Schedule interviews and record their controlled outcomes.", href: "/recruitment/interviews", icon: CalendarDays },
  { title: "Evaluations", description: "Record interviewer scores and hiring recommendations.", href: "/recruitment/evaluations", icon: FileText },
  { title: "Offers", description: "Manage offer decisions and hire accepted candidates.", href: "/recruitment/offers", icon: Handshake },
];

export default function RecruitmentHomePage() {
  return <div className="space-y-6"><PageHeader title="Recruitment" description="Manage job postings, candidates, and the hiring pipeline." /><div className="grid gap-4 md:grid-cols-3">{areas.map((area) => { const Icon = area.icon; return <Link key={area.href} href={area.href} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm"><Icon className="h-6 w-6 text-slate-700" /><h2 className="mt-5 font-semibold text-slate-950">{area.title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{area.description}</p></Link>; })}</div></div>;
}
