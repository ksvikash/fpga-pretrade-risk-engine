import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type NetworkNode = { id: string; label: string; type?: string; data?: Record<string, unknown> };
type NetworkEdge = { id: string; source: string; target: string; label?: string; weight?: number };
type NetworkData = { nodes: NetworkNode[]; edges: NetworkEdge[] };

let networkPromise: Promise<NetworkData> | undefined;

async function loadNetwork(): Promise<NetworkData> {
  networkPromise ??= readFile(join(process.cwd(), "public", "graph.json"), "utf8")
    .then((contents) => JSON.parse(contents) as NetworkData)
    .catch((error: unknown) => {
      networkPromise = undefined;
      throw error;
    });
  return networkPromise;
}

export async function GET(request: NextRequest) {
  try {
    const network = await loadNetwork();
    const params = request.nextUrl.searchParams;
    const nodeTypes = params.get("nodeTypes")?.split(",").filter(Boolean);
    const rawLimit = params.get("maxNodes");
    const maxNodes = rawLimit === null ? undefined : Number(rawLimit);

    if (maxNodes !== undefined && (!Number.isInteger(maxNodes) || maxNodes < 1 || maxNodes > 100_000)) {
      return NextResponse.json({ error: "maxNodes must be an integer from 1 to 100000" }, { status: 400 });
    }

    let nodes = nodeTypes?.length
      ? network.nodes.filter((node) => node.type && nodeTypes.includes(node.type))
      : network.nodes;
    if (maxNodes !== undefined) nodes = nodes.slice(0, maxNodes);
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = network.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
    const includeMetadata = params.get("includeMetadata") !== "false";

    return NextResponse.json({
      success: true,
      data: { nodes, edges },
      ...(includeMetadata && {
        metadata: {
          lastUpdated: new Date().toISOString(),
          version: "1.0.0-demo",
          nodeCount: nodes.length,
          edgeCount: edges.length,
          source: "bundled-demo-fixture",
        },
      }),
    });
  } catch (error) {
    console.error("Failed to load bundled network fixture", error);
    return NextResponse.json({ error: "Network data is unavailable" }, { status: 500 });
  }
}
