import { apiGet } from "./client";
import type { HomePayload } from "@/types/home";

/** Fetches the active user's server-authorised workspace home content. */
export async function getHome(): Promise<HomePayload> {
  return apiGet<HomePayload>("/home/");
}
