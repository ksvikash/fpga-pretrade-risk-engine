// Network service for handling backend API calls

export interface NetworkNode {
  id: string;
  label: string;
  type?: string;
  data?: Record<string, any>;
}

export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  weight?: number;
  data?: Record<string, any>;
}

export interface NetworkData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

export interface NetworkMetadata {
  lastUpdated: string;
  version: string;
  nodeCount: number;
  edgeCount: number;
  [key: string]: any;
}

export interface NetworkResponse {
  data: NetworkData;
  metadata: NetworkMetadata;
  success: boolean;
  message?: string;
}

class NetworkService {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_API_URL || '';
  }

  /**
   * Fetch network data from the backend
   */
  async fetchNetworkData(): Promise<NetworkResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/network`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error fetching network data:', error);
      throw new Error(`Failed to fetch network data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch network data with filters
   */
  async fetchFilteredNetworkData(filters: {
    nodeTypes?: string[];
    maxNodes?: number;
    includeMetadata?: boolean;
  }): Promise<NetworkResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      if (filters.nodeTypes && filters.nodeTypes.length > 0) {
        queryParams.append('nodeTypes', filters.nodeTypes.join(','));
      }
      
      if (filters.maxNodes) {
        queryParams.append('maxNodes', filters.maxNodes.toString());
      }
      
      if (filters.includeMetadata !== undefined) {
        queryParams.append('includeMetadata', filters.includeMetadata.toString());
      }

      const url = `${this.baseUrl}/api/network${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error fetching filtered network data:', error);
      throw new Error(`Failed to fetch filtered network data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload network data to the backend
   */
  async uploadNetworkData(data: NetworkData): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/network`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error uploading network data:', error);
      throw new Error(`Failed to upload network data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get network statistics
   */
  async getNetworkStats(): Promise<{
    nodeCount: number;
    edgeCount: number;
    nodeTypes: Record<string, number>;
    avgConnections: number;
    lastUpdated: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/network/stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error fetching network stats:', error);
      throw new Error(`Failed to fetch network stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Create a default instance
export const networkService = new NetworkService();

// Export the class for custom instances
export default NetworkService;

// Utility functions for working with network data
export const networkUtils = {
  /**
   * Calculate network density (ratio of actual edges to possible edges)
   */
  calculateDensity: (data: NetworkData): number => {
    const nodeCount = data.nodes.length;
    const edgeCount = data.edges.length;
    const maxPossibleEdges = (nodeCount * (nodeCount - 1)) / 2;
    return maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;
  },

  /**
   * Find nodes with the most connections
   */
  findMostConnectedNodes: (data: NetworkData, limit: number = 5): Array<{ nodeId: string; connections: number }> => {
    const connectionCounts: Record<string, number> = {};
    
    // Initialize all nodes with 0 connections
    data.nodes.forEach(node => {
      connectionCounts[node.id] = 0;
    });
    
    // Count connections for each node
    data.edges.forEach(edge => {
      connectionCounts[edge.source] = (connectionCounts[edge.source] || 0) + 1;
      connectionCounts[edge.target] = (connectionCounts[edge.target] || 0) + 1;
    });
    
    // Sort and return top nodes
    return Object.entries(connectionCounts)
      .map(([nodeId, connections]) => ({ nodeId, connections }))
      .sort((a, b) => b.connections - a.connections)
      .slice(0, limit);
  },

  /**
   * Filter network data by node types
   */
  filterByNodeTypes: (data: NetworkData, allowedTypes: string[]): NetworkData => {
    const filteredNodes = data.nodes.filter(node => 
      !node.type || allowedTypes.includes(node.type)
    );
    
    const nodeIds = new Set(filteredNodes.map(node => node.id));
    const filteredEdges = data.edges.filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );
    
    return {
      nodes: filteredNodes,
      edges: filteredEdges
    };
  },

  /**
   * Validate network data structure
   */
  validateNetworkData: (data: any): data is NetworkData => {
    if (!data || typeof data !== 'object') return false;
    if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) return false;
    
    // Validate nodes
    for (const node of data.nodes) {
      if (!node.id || !node.label) return false;
    }
    
    // Validate edges
    const nodeIds = new Set(data.nodes.map((n: any) => n.id));
    for (const edge of data.edges) {
      if (!edge.id || !edge.source || !edge.target) return false;
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return false;
    }
    
    return true;
  }
};