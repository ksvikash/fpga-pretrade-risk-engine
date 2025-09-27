"use client";

import React, { useState, useEffect } from "react";
import Graph from "@/components/graph";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw, Upload, Download } from "lucide-react";
import { networkService, NetworkData, networkUtils } from "@/services/networkService";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import GraphContainer from "@/components/graph-container";

// Mock data - replace this with actual API call
const generateMockNetworkData = (): NetworkData => {
  const nodeCount = Math.floor(Math.random() * 20) + 10; // 10-30 nodes
  const nodes = [];
  const edges = [];

  // Generate nodes
  for (let i = 0; i < nodeCount; i++) {
    const nodeTypes = ['default', 'important', 'secondary'];
    const nodeType = nodeTypes[Math.floor(Math.random() * nodeTypes.length)];
    
    nodes.push({
      id: `node-${i}`,
      label: `Node ${i + 1}`,
      type: nodeType,
      data: {
        value: Math.floor(Math.random() * 100),
        category: `Category ${Math.floor(Math.random() * 3) + 1}`,
        description: `Description for node ${i + 1}`,
      }
    });
  }

  // Generate edges (approximately 1.5x the number of nodes)
  const edgeCount = Math.floor(nodeCount * 1.5);
  const edgeSet = new Set<string>();

  for (let i = 0; i < edgeCount; i++) {
    let source, target, edgeId;
    let attempts = 0;
    
    do {
      source = Math.floor(Math.random() * nodeCount);
      target = Math.floor(Math.random() * nodeCount);
      edgeId = `${source}-${target}`;
      attempts++;
    } while ((source === target || edgeSet.has(edgeId) || edgeSet.has(`${target}-${source}`)) && attempts < 50);

    if (attempts < 50) {
      edgeSet.add(edgeId);
      edges.push({
        id: `edge-${i}`,
        source: `node-${source}`,
        target: `node-${target}`,
        label: `Edge ${i + 1}`,
        weight: Math.random() * 10 + 1,
        data: {
          strength: Math.random(),
          type: Math.random() > 0.5 ? 'strong' : 'weak',
        }
      });
    }
  }

  return { nodes, edges };
};

const GraphPage: React.FC = () => {
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [density, setDensity] = useState<number>(0);
  const [mostConnectedNodes, setMostConnectedNodes] = useState<Array<{ nodeId: string; connections: number }>>([]);
  const [showFraud, setShowFraud] = useState<boolean>(false);
  const [selectedEdge, setSelectedEdge] = useState<any>(null);
  const [selectedNodes, setSelectedNodes] = useState<{source: any, target: any} | null>(null);

  const fetchNetworkData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Try to fetch from backend first
      try {
        const response = await networkService.fetchNetworkData();
        if (response.success && response.data) {
          setNetworkData(response.data);
          setLastUpdated(new Date(response.metadata.lastUpdated));
          return;
        }
      } catch (backendError) {
        console.warn('Backend not available, using mock data:', backendError);
      }
      
      // Fallback to mock data if backend is not available
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockData = generateMockNetworkData();
      setNetworkData(mockData);
      setLastUpdated(new Date());
      
      // Calculate additional metrics
      setDensity(networkUtils.calculateDensity(mockData));
      setMostConnectedNodes(networkUtils.findMostConnectedNodes(mockData));
    } catch (err) {
      setError('Failed to fetch network data');
      console.error('Error fetching network data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNetworkData();
  }, []);

  const handleRefresh = () => {
    fetchNetworkData();
  };

  const handleEdgeSelect = (edge: any) => {
    if (!networkData) return;
    
    setSelectedEdge(edge);
    
    // Find the source and target nodes
    const sourceNode = networkData.nodes.find(node => node.id === edge.source);
    const targetNode = networkData.nodes.find(node => node.id === edge.target);
    
    setSelectedNodes({
      source: sourceNode,
      target: targetNode
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string);
        if (networkUtils.validateNetworkData(jsonData)) {
          setNetworkData(jsonData);
          setLastUpdated(new Date());
          setDensity(networkUtils.calculateDensity(jsonData));
          setMostConnectedNodes(networkUtils.findMostConnectedNodes(jsonData));
        } else {
          setError('Invalid network data format');
        }
      } catch (error) {
        setError('Failed to parse JSON file');
      }
    };
    reader.readAsText(file);
  };

  const handleDownload = () => {
    if (!networkData) return;
    
    const dataStr = JSON.stringify(networkData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `network-data-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-md mx-auto">
          <CardContent className="flex flex-col items-center justify-center p-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error Loading Network</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!networkData) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Network Graph</h1>
          <p className="text-muted-foreground">
            Interactive visualization of the network data from the backend
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="file-upload" className="sr-only">Upload Network Data</Label>
            <Input
              id="file-upload"
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button 
              onClick={() => document.getElementById('file-upload')?.click()}
              variant="outline" 
              size="sm"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
          </div>
          <Button 
            onClick={handleDownload} 
            variant="outline" 
            size="sm"
            disabled={!networkData}
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button onClick={handleRefresh} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Nodes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">203,769</div>
            <p className="text-xs text-muted-foreground">
              Total entities in the network
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">P2P Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              234,355
            </div>
            <p className="text-xs text-muted-foreground">
              Peer-to-peer transfers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Merchant Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              282
            </div>
            <p className="text-xs text-muted-foreground">
              Merchant payments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fraud Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              12,414
            </div>
            <p className="text-xs text-muted-foreground">
              Suspicious activities
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gather Frauds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              203
            </div>
            <p className="text-xs text-muted-foreground">
              Accounts with High Inflow
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scatter Frauds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              203
            </div>
            <p className="text-xs text-muted-foreground">
              Accounts with High Outflow
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Fraud Pattern Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">🎯 Gather Fraud Pattern</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Multiple accounts sending money to centralized fraud accounts
              </p>
              <div className="flex justify-between">
                <span className="text-sm">Active Collectors:</span>
                <Badge variant="destructive">
                  203
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Total Volume:</span>
                <Badge variant="outline">
                  29523.59 BTC
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-purple-600">💨 Scatter Fraud Pattern</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Centralized accounts distributing money across multiple targets
              </p>
              <div className="flex justify-between">
                <span className="text-sm">Active Distributors:</span>
                <Badge variant="destructive">
                  203
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Total Volume:</span>
                <Badge variant="outline">
                  51454.01 BTC
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Network Density</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0.0013%</div>
            <p className="text-xs text-muted-foreground">
              Connection ratio
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Original Analysis Cards - updated for better fraud analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Last Updated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}
            </div>
            <p className="text-xs text-muted-foreground">
              {lastUpdated ? lastUpdated.toLocaleDateString() : 'No data'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Network Composition & Risk Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(
                networkData.nodes.reduce((acc, node) => {
                  const type = node.type || 'unknown';
                  acc[type] = (acc[type] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([type, count]) => (
                <Badge 
                  key={type} 
                  variant={type === 'merchant' ? 'default' : type === 'user' ? 'secondary' : 'outline'}
                >
                  {type === 'merchant' ? 'Merchants' : type === 'user' ? 'Users' : type}: {count}
                </Badge>
              ))}
            </div>
            <div className="space-y-2 pt-2 border-t">
              <div className="flex justify-between">
                <span className="text-sm">Total P2P Volume:</span>
                <span className="text-sm font-semibold text-blue-600">
                  586012.18 BTC
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Fraudulent Volume:</span>
                <span className="text-sm font-semibold text-red-600">
                  51846.75 BTC
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Average Risk Score:</span>
                <Badge variant="destructive">
                  17% High Risk
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most Connected Nodes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {mostConnectedNodes.slice(0, 5).map(({ nodeId, connections }) => {
                const node = networkData.nodes.find(n => n.id === nodeId);
                return (
                  <div key={nodeId} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{node?.label || nodeId}</span>
                    <Badge variant="outline">{connections} connections</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fraud Detection Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Fraud Detection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="fraud-checkbox" 
              checked={showFraud}
              onCheckedChange={(checked) => setShowFraud(checked as boolean)}
            />
            <Label htmlFor="fraud-checkbox" className="text-sm font-medium">
              Highlight fraudulent transactions in red
            </Label>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            When enabled, suspicious or fraudulent transactions will be highlighted in red, while normal transactions remain gray.
          </p>
        </CardContent>
      </Card>

      {/* Graph Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <GraphContainer />
        </div>
        
        {/* Transaction Details Panel */}
        <div className="lg:col-span-1">
          {selectedEdge && selectedNodes ? (
            <Card className="h-[700px] overflow-y-auto">
              <CardHeader className="sticky top-0 bg-white z-10 border-b">
                <CardTitle className="flex items-center justify-between">
                  Transaction Details
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setSelectedEdge(null);
                      setSelectedNodes(null);
                    }}
                  >
                    ✕
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-6">
                {/* Transaction Information */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-blue-600">Transaction Info</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">ID:</span>
                      <span className="text-sm font-mono">{selectedEdge.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Amount:</span>
                      <span className="text-sm font-semibold text-green-600">{selectedEdge.label}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Type:</span>
                      <Badge variant={selectedEdge.type === 'p2p' ? 'default' : 'secondary'}>
                        {selectedEdge.type === 'p2p' ? 'P2P Transfer' : 'Merchant Payment'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Weight:</span>
                      <span className="text-sm">{selectedEdge.weight?.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      <Badge variant={selectedEdge.isFraud ? 'destructive' : 'outline'}>
                        {selectedEdge.isFraud ? 'FRAUD DETECTED' : 'Legitimate'}
                      </Badge>
                    </div>
                    {selectedEdge.isFraud && (
                      <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-sm text-red-700 font-medium">
                          🚨 Fraud Alert
                        </p>
                        <p className="text-xs text-red-600 mt-1">
                          {selectedEdge.id.includes('gather') ? 
                            'This transaction is part of a gather fraud pattern - multiple sources sending to one account.' :
                            selectedEdge.id.includes('scatter') ?
                            'This transaction is part of a scatter fraud pattern - one account distributing to multiple targets.' :
                            'This transaction has been flagged as suspicious or fraudulent activity.'
                          }
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Source Node Details */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-green-600">From (Source)</h3>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">ID:</span>
                        <span className="text-sm font-mono">{selectedNodes.source?.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Name:</span>
                        <span className="text-sm font-semibold">{selectedNodes.source?.label}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Type:</span>
                        <Badge variant={selectedNodes.source?.type === 'merchant' ? 'default' : 'secondary'}>
                          {selectedNodes.source?.type === 'merchant' ? 'Merchant' : 'User Account'}
                        </Badge>
                      </div>
                      {selectedNodes.source?.data?.description && (
                        <div className="mt-2">
                          <span className="text-sm text-muted-foreground">Description:</span>
                          <p className="text-sm mt-1">{selectedNodes.source.data.description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Target Node Details */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-purple-600">To (Target)</h3>
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-md">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">ID:</span>
                        <span className="text-sm font-mono">{selectedNodes.target?.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Name:</span>
                        <span className="text-sm font-semibold">{selectedNodes.target?.label}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Type:</span>
                        <Badge variant={selectedNodes.target?.type === 'merchant' ? 'default' : 'secondary'}>
                          {selectedNodes.target?.type === 'merchant' ? 'Merchant' : 'User Account'}
                        </Badge>
                      </div>
                      {selectedNodes.target?.data?.description && (
                        <div className="mt-2">
                          <span className="text-sm text-muted-foreground">Description:</span>
                          <p className="text-sm mt-1">{selectedNodes.target.data.description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Risk Analysis */}
                {selectedEdge.isFraud && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-red-600">Risk Analysis</h3>
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Risk Level:</span>
                        <Badge variant="destructive">HIGH</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Pattern Type:</span>
                        <span className="text-sm font-medium">
                          {selectedEdge.id.includes('gather') ? 'Money Gathering' :
                           selectedEdge.id.includes('scatter') ? 'Money Scattering' :
                           'Suspicious Activity'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Confidence:</span>
                        <span className="text-sm font-medium text-red-600">
                          {Math.floor(Math.random() * 20) + 80}%
                        </span>
                      </div>
                      <div className="mt-3 pt-2 border-t border-red-300">
                        <p className="text-xs text-red-700">
                          <strong>Recommendation:</strong> Review this transaction and related accounts for potential fraud investigation.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Connection Statistics */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-600">Connection Analysis</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Source Connections:</span>
                      <span className="text-sm">
                        {networkData.edges.filter(e => e.source === selectedEdge.source || e.target === selectedEdge.source).length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Target Connections:</span>
                      <span className="text-sm">
                        {networkData.edges.filter(e => e.source === selectedEdge.target || e.target === selectedEdge.target).length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Transaction Flow:</span>
                      <span className="text-sm">
                        {selectedNodes.source?.label} → {selectedNodes.target?.label}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-[700px] flex items-center justify-center">
              <CardContent className="text-center">
                <div className="text-muted-foreground mb-4">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2">No Transaction Selected</h3>
                <p className="text-sm text-muted-foreground">
                  Click on any edge (connection) in the graph to view detailed transaction information and node details.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Legend and Instructions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Network Legend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">Node Types</h4>
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-3 rounded-sm bg-gray-800 border-2 border-gray-600"></div>
                    <span className="text-sm">Merchants</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-gray-800 border-2 border-gray-600"></div>
                    <span className="text-sm">User Accounts</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold mb-2">Transaction Types</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-0.5 bg-gray-500"></div>
                    <span>Normal Transactions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-0.5 bg-red-500"></div>
                    <span>Fraudulent Transactions (when enabled)</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Use the fraud detection checkbox to highlight suspicious transactions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• <strong>Node types:</strong> Round squares are merchants, circles are user accounts</p>
              <p>• <strong>Click nodes</strong> to view account or merchant details in the side panel</p>
              <p>• <strong>Fraud detection:</strong> Enable checkbox to highlight fraudulent transactions in red</p>
              <p>• <strong>Layout selector:</strong> Dagre (default) shows hierarchical relationships</p>
              <p>• <strong>Mouse controls:</strong> Scroll to zoom, drag to pan around the network</p>
              <p>• <strong>Transaction amounts:</strong> Edge labels show transaction values</p>
              <p>• <strong>Upload/Download:</strong> Import/export transaction network data as JSON</p>
              <p>• <strong>Refresh:</strong> Reload the latest transaction data from backend</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GraphPage;