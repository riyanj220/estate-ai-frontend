import { getApi } from "@/lib/api";

export const dynamic = "force-dynamic";

async function readStatus(): Promise<"ok" | "unavailable"> {
  try {
    const api = await getApi();
    const { data } = await api.GET("/api/v1/health");
    return data?.status === "ok" ? "ok" : "unavailable";
  } catch {
    // Never render backend or network detail.
    return "unavailable";
  }
}

export default async function HealthPage() {
  const status = await readStatus();
  return (
    <>
      <h1 className="text-2xl font-semibold">Service health</h1>
      <p data-testid="health-status">
        {status === "ok" ? "Status: ok" : "Status: unavailable"}
      </p>
    </>
  );
}
