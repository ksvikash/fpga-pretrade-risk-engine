import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

type Node = { id: string; type?: string; data?: { isFraud?: boolean; risk_level?: string } };
type Edge = { isFraud?: boolean; data?: { risk_flag?: string } };
type Fixture = { nodes: Node[]; edges: Edge[] };

let fixturePromise: Promise<Fixture> | undefined;

function loadFixture() {
  fixturePromise ??= readFile(join(process.cwd(), "public", "graph.json"), "utf8")
    .then((raw) => JSON.parse(raw) as Fixture)
    .catch((error: unknown) => {
      fixturePromise = undefined;
      throw error;
    });
  return fixturePromise;
}

export async function GET() {
  try {
    const { nodes, edges } = await loadFixture();
    const nodeTypes = nodes.reduce<Record<string, number>>((counts, node) => {
      const type = node.type ?? "unknown";
      counts[type] = (counts[type] ?? 0) + 1;
      return counts;
    }, {});
    const riskyNodes = nodes.filter((node) => node.data?.isFraud || node.data?.risk_level === "High").length;
    const riskyEdges = edges.filter((edge) => edge.isFraud || edge.data?.risk_flag === "High").length;
    return NextResponse.json({
      source: "bundled-demo-fixture",
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodeTypes,
      avgConnections: nodes.length ? (2 * edges.length) / nodes.length : 0,
      riskyNodeCount: riskyNodes,
      riskyEdgeCount: riskyEdges,
      riskRate: edges.length ? riskyEdges / edges.length : 0,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to calculate bundled network stats", error);
    return NextResponse.json({ error: "Network statistics are unavailable" }, { status: 500 });
  }
}
