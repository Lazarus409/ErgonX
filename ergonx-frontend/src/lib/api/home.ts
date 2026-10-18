import { apiGet } from "./client";
import type { HomePayload } from "@/types/home";
import type { InsightsPayload } from "@/types/dashboards";

/** Fetches the active user's server-authorised workspace home content. */
export async function getHome(): Promise<HomePayload> {
  return apiGet<HomePayload>("/home/");
}

/** Cross-module Insights for the last `months` months, limited to what the caller may see. */
export async function getInsights(months: number): Promise<InsightsPayload> {
  return apiGet<InsightsPayload>(`/home/insights/?months=${months}`);
}

export interface MyWorkItem {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  route: string;
  due_date: string | null;
  waiting_since: string | null;
  overdue: boolean;
  due_soon: boolean;
}

export interface MyWorkSection {
  key: "approvals" | "to_do" | "team" | "waiting";
  title: string;
  help: string;
  route: string;
  count: number;
  overdue: number;
  items: MyWorkItem[];
}

export interface MyWorkPayload {
  generated_at: string;
  summary: { total: number; overdue: number; due_soon: number; waiting_on_others: number };
  sections: MyWorkSection[];
}

/** Everything waiting on the signed-in user, grouped by section, each item linking to where it is handled. */
export async function getMyWork(): Promise<MyWorkPayload> {
  return apiGet<MyWorkPayload>("/home/my-work/");
}
