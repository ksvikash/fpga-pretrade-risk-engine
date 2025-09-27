"use client";

import React, { useEffect, useRef, useState } from "react";
import cytoscape, { Core, ElementDefinition, NodeDefinition, EdgeDefinition } from "cytoscape";
// @ts-ignore
import dagre from "cytoscape-dagre";
// @ts-ignore
import fcose from "cytoscape-fcose";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// Register extensions
cytoscape.use(dagre);
cytoscape.use(fcose);

export interface NetworkNode {
  id: string;
  label: string;
  type?: string;
  data?: any;
}

export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  weight?: number;
  type?: string;
  isFraud?: boolean;
  data?: any;
}

export interface NetworkData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

export interface GraphProps {
  data: NetworkData;
  height?: string | number;
  layout?: "dagre" | "fcose" | "grid" | "circle" | "breadthfirst";
  className?: string;
  showFraud?: boolean;
  onEdgeSelect?: (edge: NetworkEdge) => void;
}

const Graph: React.FC<GraphProps> = ({ 
  data, 
  height = "600px", 
  layout = "dagre",
  className = "",
  showFraud = false,
  onEdgeSelect
}) => {
  const cyRef = useRef<HTMLDivElement>(null);
  const cyInstance = useRef<Core | null>(null);
  const [selectedLayout, setSelectedLayout] = useState(layout);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getLayoutConfig = (layoutType: string) => {
    switch (layoutType) {
      case "dagre":
        return {
          name: "dagre",
          directed: true,
          spacingFactor: 1.2,
          nodeDimensionsIncludeLabels: true,
          rankDir: "TB",
        };
      case "fcose":
        return {
          name: "fcose",
          animate: true,
          animationDuration: 1000,
          randomize: false,
          packComponents: true,
          nodeSeparation: 75,
          idealEdgeLength: 100,
          edgeElasticity: 0.45,
        };
      case "grid":
        return {
          name: "grid",
          spacingFactor: 2,
          animate: true,
          animationDuration: 500,
        };
      case "circle":
        return {
          name: "circle",
          animate: true,
          animationDuration: 500,
          spacingFactor: 1.5,
        };
      case "breadthfirst":
        return {
          name: "breadthfirst",
          directed: true,
          spacingFactor: 1.2,
          animate: true,
          animationDuration: 500,
        };
      default:
        return { name: "fcose" };
    }
  };

  const transformDataToCytoscape = (networkData: NetworkData): ElementDefinition[] => {
    const elements: ElementDefinition[] = [];

    // Add nodes
    networkData.nodes.forEach((node) => {
      elements.push({
        data: {
          id: node.id,
          label: node.label,
          type: node.type || "default",
          ...node.data,
        },
      } as NodeDefinition);
    });

    // Add edges
    networkData.edges.forEach((edge) => {
      const fraudValue = edge.isFraud === true;
      console.log(`Edge ${edge.id}: isFraud = ${edge.isFraud} -> ${fraudValue}`);
      
      elements.push({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label || "",
          weight: edge.weight || 1,
          type: edge.type || "transaction",
          isFraud: fraudValue,
          ...edge.data,
        },
        classes: fraudValue ? 'fraud-edge' : 'normal-edge'
      } as EdgeDefinition);
    });

    console.log('Total edges:', elements.filter(el => !el.data.source).length);
    console.log('Fraud edges:', elements.filter(el => el.data.source && el.data.isFraud === true).length);

    return elements;
  };

  const initializeCytoscape = () => {
    if (!cyRef.current || !data) return;

    if (cyInstance.current) {
      cyInstance.current.destroy();
    }

    const elements = transformDataToCytoscape(data);

    cyInstance.current = cytoscape({
      container: cyRef.current,
      elements,
      style: [
        // All transaction nodes - Small circles with risk-based colors (matching matplotlib style)
        {
          selector: "node",
          style: {
            "background-color": "#87ceeb", // Light blue for safe (default)
            "border-color": "#87ceeb",
            "border-width": 0,
            "width": 8,
            "height": 8,
            "shape": "ellipse",
            "label": "", // No labels to match matplotlib clean appearance
            "text-valign": "center",
            "text-halign": "center",
            "color": "#ffffff",
            "font-size": 0,
            "text-outline-color": "#000000",
            "text-outline-width": 0,
            "text-wrap": "none",
            "text-max-width": "0px",
          },
        },
        
        // High risk nodes - Red
        {
          selector: "node[data.risk_level='High']",
          style: {
            "background-color": "#ff0000",
            "border-color": "#ff0000",
          },
        },
        
        // Medium risk nodes - Orange
        {
          selector: "node[data.risk_level='Medium']",
          style: {
            "background-color": "#ffa500",
            "border-color": "#ffa500",
          },
        },
        
        // Low risk nodes - Yellow
        {
          selector: "node[data.risk_level='Low']",
          style: {
            "background-color": "#ffff00",
            "border-color": "#ffff00",
          },
        },
        
        // Selected node style
        {
          selector: "node:selected",
          style: {
            "border-width": 4,
            "border-color": "#3b82f6",
            "overlay-color": "#dbeafe",
            "overlay-opacity": 0.2,
          },
        },
        
        // Node hover effect
        {
          selector: "node:active",
          style: {
            "overlay-opacity": 0.15,
            "border-color": "#60a5fa",
          },
        },
        
        // All edges - thin light gray lines (matching matplotlib style)
        {
          selector: "edge",
          style: {
            "width": 0.5,
            "line-color": "#d3d3d3",
            "target-arrow-color": "#d3d3d3",
            "target-arrow-shape": "none",
            "arrow-scale": 0,
            "curve-style": "straight",
            "label": "",
            "font-size": 0,
            "color": "#d3d3d3",
            "text-rotation": "autorotate",
            "text-margin-y": 0,
            "text-background-color": "transparent",
            "text-background-opacity": 0,
            "text-background-padding": "0px",
            "text-border-color": "transparent",
            "text-border-width": 0,
            "opacity": 0.8,
          },
        },
        
        // Fraud edges - red when showFraud is enabled (matching matplotlib style)
        ...(showFraud ? [{
          selector: "edge.fraud-edge",
          style: {
            "line-color": "#ff0000",
            "target-arrow-color": "#ff0000", 
            "width": 0.8,
            "opacity": 1,
            "color": "#ff0000",
          },
        }] : []),

        
        // Selected edge style
        {
          selector: "edge:selected",
          style: {
            "line-color": "#3b82f6",
            "target-arrow-color": "#3b82f6",
            "width": 4,
            "opacity": 1,
            "color": "#1e40af",
          },
        },
        
        // High-weight transactions
        {
          selector: "edge[weight >= 8.0]",
          style: {
            "width": 2.5,
            "opacity": 0.8,
          },
        },
        
        // Medium-weight edges
        {
          selector: "edge[weight >= 7][weight < 8.5]",
          style: {
            "width": 3,
            "opacity": 0.9,
          },
        },
        
        // Low-weight edge styling - Subtle for less important connections
        {
          selector: "edge[weight < 7]",
          style: {
            "opacity": 0.6,
            "width": 2,
          },
        },
      ],
      layout: getLayoutConfig(selectedLayout),
      minZoom: 0.1,
      maxZoom: 3,
      wheelSensitivity: 0.2,
    });

    // Add event listeners
    cyInstance.current.on("tap", "node", (evt) => {
      const node = evt.target;
      setSelectedNode({
        id: node.id(),
        label: node.data("label"),
        type: node.data("type"),
        data: node.data(),
      });
    });

    // Add edge click handler
    cyInstance.current.on("tap", "edge", (evt) => {
      const edge = evt.target;
      const edgeData = {
        id: edge.id(),
        source: edge.source().id(),
        target: edge.target().id(),
        label: edge.data("label"),
        weight: edge.data("weight"),
        type: edge.data("type"),
        isFraud: edge.data("isFraud"),
        data: edge.data(),
      };
      
      if (onEdgeSelect) {
        onEdgeSelect(edgeData);
      }
    });

    cyInstance.current.on("tap", (evt) => {
      if (evt.target === cyInstance.current) {
        setSelectedNode(null);
      }
    });

    setIsLoading(false);
  };

  const changeLayout = (newLayout: "dagre" | "fcose" | "grid" | "circle" | "breadthfirst") => {
    if (cyInstance.current) {
      setSelectedLayout(newLayout);
      const layoutConfig = getLayoutConfig(newLayout);
      cyInstance.current.layout(layoutConfig).run();
    }
  };

  const fitGraph = () => {
    if (cyInstance.current) {
      cyInstance.current.fit();
    }
  };

  const resetZoom = () => {
    if (cyInstance.current) {
      cyInstance.current.zoom(1);
      cyInstance.current.center();
    }
  };

  useEffect(() => {
    initializeCytoscape();
    return () => {
      if (cyInstance.current) {
        cyInstance.current.destroy();
      }
    };
  }, [data, showFraud]);

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-muted rounded-lg">
        <div className="flex items-center gap-2">
          <label htmlFor="layout-select" className="text-sm font-medium">
            Layout:
          </label>
          <Select value={selectedLayout} onValueChange={changeLayout}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fcose">F-CoSE</SelectItem>
              <SelectItem value="dagre">Dagre</SelectItem>
              <SelectItem value="grid">Grid</SelectItem>
              <SelectItem value="circle">Circle</SelectItem>
              <SelectItem value="breadthfirst">Hierarchical</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fitGraph}>
            Fit to View
          </Button>
          <Button variant="outline" size="sm" onClick={resetZoom}>
            Reset Zoom
          </Button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Badge variant="secondary">
            {data.nodes.length} nodes
          </Badge>
          <Badge variant="secondary">
            {data.edges.length} edges
          </Badge>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Graph Container */}
        <Card className="flex-1">
          <CardContent className="p-0">
            <div
              ref={cyRef}
              style={{ height, width: "100%" }}
              className="border rounded-lg bg-background"
            />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Node Details Panel */}
        {selectedNode && (
          <Card className="w-80">
            <CardHeader>
              <CardTitle className="text-lg">Node Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">ID</p>
                <p className="text-sm">{selectedNode.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Label</p>
                <p className="text-sm">{selectedNode.label}</p>
              </div>
              {selectedNode.type && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Type</p>
                  <Badge variant={selectedNode.type === 'important' ? 'destructive' : 'default'}>
                    {selectedNode.type}
                  </Badge>
                </div>
              )}
              {selectedNode.data && Object.keys(selectedNode.data).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Additional Data</p>
                  <div className="space-y-1">
                    {Object.entries(selectedNode.data).map(([key, value]) => (
                      <div key={key} className="text-xs">
                        <span className="font-medium">{key}:</span>{" "}
                        <span className="text-muted-foreground">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Graph;