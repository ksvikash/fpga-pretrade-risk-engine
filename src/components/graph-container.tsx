"use client";
import { useEffect, useState } from "react";
import Graph, { NetworkData, NetworkEdge } from "./graph";

export default function GraphContainer() {
  const [data, setData] = useState<NetworkData | null>(null);

  useEffect(() => {
    fetch("/graph.json")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
        return res.json();
      })
      .then((json: NetworkData) => {
        console.log("Fetched graph data:", json);
        setData(json);
      })
      .catch((err) => console.error("Error fetching graph:", err));
  }, []);

  if (!data) return <div>Loading graph...</div>;

  return (
    <Graph
      data={data}
      height="700px"
      layout="dagre"
      className="w-full"
      showFraud={true}
      onEdgeSelect={(edge: NetworkEdge) =>
        console.log("Selected edge:", edge)
      }
    />
  );
}
