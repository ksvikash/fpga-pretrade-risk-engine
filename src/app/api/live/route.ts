import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const backendUrl = (process.env.FRAUD_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

export async function GET() {
  try {
    const response = await fetch(`${backendUrl}/dashboard`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (response.status === 404) {
      return NextResponse.json(
        {
          connected: false,
          stream_available: false,
          stream: null,
          alerts: [],
          investigations: [],
          error: "FastAPI is reachable, but this process does not expose GET /dashboard. Restart Uvicorn from the updated workspace.",
        },
        { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
      );
    }
    const payload: unknown = await response.json();
    return NextResponse.json(payload, {
      status: response.status,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Fraud scoring backend unavailable", error);
    return NextResponse.json(
      { connected: false, stream_available: false, stream: null, alerts: [], investigations: [] },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
