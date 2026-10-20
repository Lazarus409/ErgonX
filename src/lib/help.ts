/**
 * In-app help: plain-language definitions for the terms people meet in ErgonX, and short
 * how-to guides. Kept in the frontend so it works offline and ships with the screens it
 * explains. Ghana-specific figures name their source so readers can check them.
 */

export interface GlossaryEntry { term: string; definition: string }

export const GLOSSARY = {
  gross_pay: { term: "Gross pay", definition: "Everything earned in the pay period before anything is taken off: basic salary, allowances, overtime and bonuses." },
  basic_salary: { term: "Basic salary", definition: "The fixed pay agreed in the contract, before allowances. Pension and most statutory deductions are worked out from it." },
  taxable_income: { term: "Taxable income", definition: "The part of pay that income tax is charged on: gross pay minus non-taxable items, the employee's pension contribution and any approved reliefs." },
  paye: { term: "PAYE", definition: "Pay As You Earn: income tax the employer takes from each salary and pays to the Ghana Revenue Authority (GRA) every month, by the 15th of the following month." },
  ssnit: { term: "SSNIT / Tier 1", definition: "Ghana's basic national pension. The employer sends 13.5% of basic salary to SSNIT (11% pension, 2.5% to the NHIA)." },
  tier_2: { term: "Tier 2", definition: "The mandatory occupational pension: 5% of basic salary, paid to the licensed trustee the organisation has chosen." },
  pension_split: { term: "Pension contributions", definition: "18.5% of basic salary in total: 5.5% from the employee (taken from pay) and 13% from the employer. It is split 13.5% to SSNIT (Tier 1) and 5% to Tier 2." },
  relief: { term: "Tax relief", definition: "An approved amount that lowers taxable income, such as marriage, disability or old-age relief. ErgonX applies a twelfth of the yearly relief each month." },
  deductions: { term: "Deductions", definition: "Everything taken off gross pay: income tax, the employee's pension share and other deductions like loans or welfare dues." },
  net_pay: { term: "Net pay", definition: "What reaches the employee's account: gross pay minus all deductions." },
  employer_contributions: { term: "Employer contributions", definition: "What the organisation pays on top of salary, such as its 13% pension share. They are a cost to the employer and are not taken from pay." },
  proration: { term: "Partial-period pay", definition: "Someone who joins, leaves or changes salary during a pay period is paid only for the days that apply: by calendar days, or by working days (Monday to Friday, without public holidays)." },
  run_exception: { term: "Run exception", definition: "Something in a calculated payroll run that needs a person to look at it before review, such as zero net pay, a big change from last month or pay below the minimum wage." },
  finalize: { term: "Finalize", definition: "The last payroll step. It locks the run, issues payslips and makes the bank, mobile-money, pension and PAYE files available. Finalized figures can't be changed." },
  minimum_wage: { term: "Minimum wage", definition: "Ghana's national daily minimum wage (GHS 21.77 for 2026). ErgonX compares monthly salaries with 27 days of it, GHS 587.79." },
  leave_working_days: { term: "Leave days", definition: "Leave is counted in working days: weekends and public holidays inside a request are not taken from the balance." },
  carry_forward: { term: "Carry forward", definition: "Unused leave that moves into the next year, up to the limit the leave policy allows." },
} satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;

export interface HelpArticle { slug: string; title: string; summary: string; audience: string; steps: string[]; links: Array<{ label: string; href: string }> }

export const ARTICLES: HelpArticle[] = [
  {
    slug: "get-started",
    title: "Getting your organisation ready",
    summary: "The order that works: structure, people, policies, pay, then invitations.",
    audience: "Administrators and HR",
    steps: [
      "Finish the setup checklist under Onboarding: institution profile, modules, departments, positions, grades and locations.",
      "Import your employees from a spreadsheet (Employees, then Import), or add them one by one.",
      "Set up leave types and policies, and add this year's public holidays under Settings.",
      "Choose your payroll setup, then give everyone a salary and record how they are paid (Payroll, then Employee payroll profiles).",
      "Invite staff to self-service so they can see payslips, request leave and clock in.",
      "The Ready to go live card on Home shows what is still missing.",
    ],
    links: [{ label: "Import employees", href: "/hr/employees/import" }, { label: "Public holidays", href: "/settings/holidays" }, { label: "Employee payroll profiles", href: "/payroll/employee-profiles" }],
  },
  {
    slug: "run-payroll",
    title: "Running monthly payroll",
    summary: "From a new run to bank files, with the checks in between.",
    audience: "Payroll and finance",
    steps: [
      "Create the pay period, then a payroll run for it.",
      "Calculate. ErgonX works out pay, tax and pension for everyone employed in the period, paying joiners and leavers for their days.",
      "Open the Exceptions tab and deal with each one: fix the data and recalculate, or acknowledge it with a note.",
      "Submit for review. Someone else approves; nobody approves their own run.",
      "Finalize. Payslips go out and the run is locked.",
      "On the Payments tab, download the bank and mobile-money files for payment, and the pension and PAYE schedules for SSNIT, your Tier 2 trustee and GRA.",
    ],
    links: [{ label: "Payroll runs", href: "/payroll/runs" }],
  },
  {
    slug: "import-employees",
    title: "Importing employees from a spreadsheet",
    summary: "Download the template, fill it in, check it, then import.",
    audience: "HR",
    steps: [
      "Create departments, positions, grades and locations first; the file refers to them by name or code.",
      "Download the template from Employees, then Import. Keep the first row of column names and delete the example row.",
      "Dates can be YYYY-MM-DD or DD/MM/YYYY. Leave employee_number blank to have one generated.",
      "Upload the file. Nothing is saved yet; each row shows any problems.",
      "Fix problem rows in the file and check it again, or import the rows that are ready and skip the rest.",
    ],
    links: [{ label: "Import employees", href: "/hr/employees/import" }],
  },
  {
    slug: "leave",
    title: "Requesting and approving leave",
    summary: "How balances are counted and who approves.",
    audience: "Everyone",
    steps: [
      "Request leave from My leave. Only working days count: weekends and public holidays are left out.",
      "Your manager (and anyone else in the approval workflow) is notified and decides. You'll be notified of the outcome.",
      "Approvers can decide from the Approvals inbox, or straight from the notification.",
      "You can cancel a request until it starts; after that, ask your manager or HR.",
    ],
    links: [{ label: "My leave", href: "/me/leave" }, { label: "Approvals", href: "/approvals" }],
  },
  {
    slug: "notifications",
    title: "Getting notifications on your phone",
    summary: "Turn on push notifications for each device you use.",
    audience: "Everyone",
    steps: [
      "Open Notifications, then Preferences.",
      "Under Notifications on this device, choose Turn on and allow notifications when the browser asks.",
      "On iPhone, first add ErgonX to your Home Screen (Share, then Add to Home Screen) and open it from there.",
      "Repeat on each phone or computer where you want them. You can also choose which modules email you a copy.",
    ],
    links: [{ label: "Notifications", href: "/notifications" }],
  },
];
