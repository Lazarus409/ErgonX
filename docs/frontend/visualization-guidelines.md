# ErgonX Visualization Guidelines

Status: adopted 2026-09-24 · Code: `src/components/charts/` · Library: Recharts 3 (React 19 / Next 16 compatible, SVG, responsive via the `responsive` prop)

## Principles

1. **Analytical correctness wins.** Pick the form that answers the question; diversity is a tie-breaker, never a reason to use a worse chart.
2. **The backend is authoritative.** Charts display server rollups. The browser may only format, scale for display, or compute presentation ratios between server counts (and must label them). Never re-derive balances, pay, totals or statuses — when the API returns a total (e.g. `total_debit`), show that value.
3. **No fabricated data.** Missing data is an empty state that says what will appear, not a placeholder chart. An API failure is an error state, never "No data yet".
   - A series whose values are all zero is also an empty state (use `hasValues(rows, keys)`), worded as "No overtime this week", not blank axes.
   - A trend with only **one period** renders as bars automatically (`TrendChart` / `ComposedTrendChart` fall back to `BarsChart`); a line through one point is a lone dot.
   - Count axes use integer ticks only; negative values get a zero reference line.
4. **Isolated numbers are KPI cards**, not charts.
5. **Module colour identifies the domain**; categorical series use the ordered chart palette.

## Chart selection

| Question | Use |
|---|---|
| How does a value change over time? | Line (continuous, several series) or area (single cumulative quantity) |
| How do parts of a whole change over time? | Stacked bars (discrete periods) or stacked area (continuous) |
| How do discrete periods/categories compare? | Vertical bars; grouped bars for 2–3 series |
| Which items rank highest? | Horizontal ranking (`RankingBars`) |
| What is the composition now? | Donut (≤ 6 slices) or segmented bar (few ordered states) |
| How much of a target is used? | `ProgressMeter` |
| How do candidates flow between stages? | `FunnelChart` (with stage-to-stage conversion) |
| Where/when do events concentrate? | `HeatmapGrid` or calendar grid |
| What happened in sequence? | `Timeline` |
| Trend at a glance inside a tile? | `Sparkline` |
| Which records need action? | Exception table (`DataTable` or compact table) |

Pie charts only when composition genuinely warrants it; prefer donut. Scatter only when a real relationship between two measures exists (none today).

## Governance limits

- **Per dashboard:** normally no more than **two instances of the same visualization type**.
- **System-wide:** aim for no more than **~5–6 uses of the same pattern** across the primary dashboards and analytics surfaces.
- Trivial variations (e.g. recolouring a line chart) count as the same type.

## Dashboard visualization inventory

| Surface | Visualization | Metric | Purpose |
|---|---|---|---|
| **Home** | Sparkline ×≤4 (in snapshot tiles) | Weekly present, monthly leave days, payroll gross by period, net cash movement | At-a-glance trend beside each permitted module pulse |
| **Employee Home** | Area | Hours worked + overtime, last 7 recorded days | Personal weekly effort |
| | Calendar grid | Attendance status, last 4 weeks | Pattern of presence/lateness/leave (letters + colour) |
| | Donut | Leave available by type | Composition of remaining entitlement |
| | Vertical bars | Net pay, recent payslips | Recent pay comparison |
| | Timeline | Upcoming approved leave | Sequence of time off |
| **Executive** | KPI ×4 | Workforce, payroll cost, net result (with Δ), pending leave / open roles | Headline indicators |
| | Multi-series line | Revenue, expenses, net result by month | Financial trajectory |
| | Area | Gross payroll by finalized period | Payroll cost trajectory |
| | Segmented bar ×2 | Workforce by status; attendance today | Current composition |
| | Funnel | Applications → interviews → offers | Hiring flow |
| | Summary list | Bank, AR, AP, posted expenses | Financial position |
| | Exception table | Cross-module risk signals | Executive attention |
| **HR** | KPI ×4 | Workforce, active, new hires, terminated | Headline indicators |
| | Donut | Employees by status | Composition |
| | Vertical bars ×2 | Hires by year; employees by grade | Discrete comparisons |
| | Ranking ×2 | Departments; locations | Where people are |
| | Segmented bar | Employment types | Composition |
| | Table | Recent hires | Lifecycle records |
| **Recruitment** | KPI ×4 | Open jobs, candidates, interviews, offers | Headline indicators |
| | Funnel | Applications by pipeline stage | Stage conversion |
| | Insight cards ×3 | Interview reach, offer rate, load per opening | Labelled presentation ratios of server counts |
| **Leave** | KPI ×4 | Pending, awaiting me, on leave, upcoming | Headline indicators |
| | Area | Approved leave days by month | Seasonal trend |
| | Donut | Approved days by leave type | Composition |
| | Progress meter | Balance utilisation (server %) | Consumption of entitlement |
| | Table | Upcoming leave | Actionable queue |
| **Attendance** | KPI ×8 | Present/late/absent/on leave; scheduled, shifts, overtime & adjustments pending | Headline + exceptions |
| | Stacked bars | Daily outcomes, 7 days | Composition over the week |
| | Area | Overtime minutes, 7 days | Overtime load |
| | Heatmap | Department × outcome today | Concentration of absence/lateness |
| | Exception table (inline bars) | Repeated lateness, 90 days | Ranked follow-up list |
| | Line | Late arrivals by month | Lateness trend |
| **Payroll** | KPI ×4 | Gross, net, deductions, employer contributions | Totals |
| | Workflow stepper | Latest run status | Where the run is |
| | Area | Gross pay by period | Cost trend |
| | Stacked bars | Net pay + deductions by period | Earnings/deductions make-up |
| | Insight card | Latest vs prior period gross change | Variance |
| **Accounting** | KPI ×4 | Bank, AR, AP, posted expenses | Position |
| | Composed (bars + line) | Income & expenses (bars), net result (line) | P&L trend |
| | Grouped bars | Cash inflow vs outflow by month | Cash movement |
| | Horizontal grouped bars | AR vs AP by aging bucket | Aging exposure |
| | Donut | Journals by status | Workflow composition |
| **Recruitment pipeline page** | Funnel | Applications by stage | Stage conversion |

### System-wide counts (primary dashboards)

| Type | Uses | Within target? |
|---|---|---|
| Area | 5 (Employee Home, Executive, Leave, Attendance, Payroll) | Yes |
| Donut | 4 (Employee Home, HR, Leave, Accounting) | Yes |
| Vertical bars (single series) | 3 (Employee Home, HR ×2) | Yes |
| Stacked bars | 2 (Attendance, Payroll) | Yes |
| Grouped bars (vertical + horizontal) | 2 (Accounting ×2) | Yes |
| Line / multi-line | 2 (Executive, Attendance) | Yes |
| Composed | 1 (Accounting) | Yes |
| Funnel | 3 (Executive, Recruitment, Pipeline) | Yes |
| Ranking | 2 (HR) + inline bars in the Attendance exception table | Yes |
| Segmented bar | 3 (Executive ×2, HR) | Yes |
| Heatmap / calendar | 2 (Attendance, Employee Home) | Yes |
| Progress meter | 1 (+ onboarding progress) | Yes |
| Timeline | 1 dashboard (+ Approvals page) | Yes |
| Sparkline | 1 surface (Home) | Yes |

No dashboard uses more than two of the same type (Executive: segmented ×2; HR: vertical bars ×2, ranking ×2; Accounting: bar family ×2).

Update this table whenever a dashboard changes.

## Colour rules

- Categorical series: ordered palette `--chart-1 … --chart-6` (blue, teal, violet, amber, sky, rose), re-tuned for dark mode.
- A chart about one module uses that module's accent (`var(--mod-x)`) for its primary series.
- Semantic series use semantic roles: present/success = `--success`, late/pending = `--warning`, absent/negative = `--danger`, on leave = `--mod-leave`.
- Gridlines `--chart-grid`, axes `--chart-axis`; no heavy borders; bars with 5–6 px top radius.
- Never use the signature gradient inside charts.

## Currency and number formatting

- Money uses institution currency via `formatAmount` (e.g. `GH₵ 12,500.00`); axes use `currencyAxisFormatter` (`GH₵ 12.5k`).
- `ValueFormat`: `currency | number | percent | minutes | days`. Tooltips show full precision; axes show compact values.
- Dates: `dateAxisFormatter("month" | "day" | "weekday")`.
- Tabular numerals everywhere numbers align.

## Accessibility requirements

Every chart is placed in `ChartCard`, which provides:

- `figure` with a visible `figcaption` title and description;
- `summary` — one plain-language sentence for screen readers;
- `data` — a visually hidden table with the underlying values (the SVG is hidden from AT when this exists);
- loading skeleton, empty state and error state;
- legends as text lists (value + label, not colour alone);
- no entrance animation under `prefers-reduced-motion`.

Custom visuals label their cells (heatmap cell text, calendar letters, funnel values, progress `role="progressbar"`).

## Components

`ChartCard`, `ChartLegend`, `ChartTooltip`, `EmptyChartState`, `ChartSkeleton` (in `ui/Skeleton`), `TrendChart` (line / area / stacked area), `BarsChart` (grouped / stacked / 100% / horizontal), `ComposedTrendChart`, `DonutChart` + `donutLegend`, `FunnelChart`, `RankingBars`, `HeatmapGrid`, `SegmentedBar`, `ProgressMeter`, `Sparkline`, `Timeline`; formatters `currencyAxisFormatter`, `percentageFormatter`, `dateAxisFormatter`, `axisFormatter`, `formatValue`.

## Data gaps (do not fake)

Brief-suggested visuals that the API cannot yet support, and are therefore **not** rendered: recruitment application trend, source ranking, interview-status donut, time-to-hire distribution; leave department ranking; attendance shift coverage; accounting expense-category donut and reconciliation exception list; workforce headcount over time; employee next shift (no self-scoped schedule-resolution endpoint). Add them when the backend exposes the rollups.
