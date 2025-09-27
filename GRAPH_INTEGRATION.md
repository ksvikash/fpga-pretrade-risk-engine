# Network Graph Integration

This document describes the network graph subpage that has been integrated into the frontend application.

## Overview

The network graph subpage provides an interactive visualization of network data from the backend. It supports various graph layouts, node interactions, and data analysis features.

## Features

### Core Functionality
- **Interactive Graph Visualization**: Uses Cytoscape.js for rendering network graphs
- **Multiple Layout Algorithms**: Supports F-CoSE, Dagre, Grid, Circle, and Hierarchical layouts
- **Node Selection**: Click on nodes to view detailed information
- **Zoom and Pan**: Mouse wheel to zoom, drag to pan around the graph
- **Fit to View**: Automatically fit the entire network in the viewport

### Data Management
- **Backend Integration**: Fetches network data from backend API
- **Mock Data Fallback**: Falls back to generated mock data when backend is unavailable
- **File Upload**: Upload network data from JSON files
- **File Download**: Export current network data as JSON
- **Data Validation**: Validates uploaded network data structure

### Analytics
- **Network Statistics**: Displays node count, edge count, and network density
- **Node Type Distribution**: Shows breakdown of different node types
- **Most Connected Nodes**: Identifies and displays nodes with most connections
- **Real-time Updates**: Refreshes data and recalculates metrics

## File Structure

```
src/
├── app/
│   ├── graph/
│   │   └── page.tsx              # Main graph page component
│   └── api/
│       └── network/
│           ├── route.ts          # Network data API endpoint
│           └── stats/
│               └── route.ts      # Network statistics API endpoint
├── components/
│   └── graph.tsx                 # Reusable graph component
└── services/
    └── networkService.ts         # Backend API integration service
```

## API Endpoints

### GET /api/network
Fetches network data from the backend.

**Query Parameters:**
- `nodeTypes`: Comma-separated list of node types to filter by
- `maxNodes`: Maximum number of nodes to return
- `includeMetadata`: Include additional metadata in response

**Response:**
```json
{
  "success": true,
  "data": {
    "nodes": [...],
    "edges": [...]
  },
  "metadata": {
    "lastUpdated": "2023-...",
    "version": "1.0.0",
    "nodeCount": 10,
    "edgeCount": 13
  }
}
```

### POST /api/network
Uploads network data to the backend.

**Request Body:**
```json
{
  "nodes": [
    {
      "id": "node-1",
      "label": "Node 1",
      "type": "default",
      "data": { ... }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "node-1",
      "target": "node-2",
      "label": "Connection",
      "weight": 1.0
    }
  ]
}
```

### GET /api/network/stats
Fetches network statistics.

**Response:**
```json
{
  "nodeCount": 10,
  "edgeCount": 13,
  "nodeTypes": {
    "important": 3,
    "default": 4,
    "secondary": 3
  },
  "avgConnections": 2.6,
  "lastUpdated": "2023-...",
  "density": 0.289
}
```

## Data Format

### Network Data Structure
```typescript
interface NetworkData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

interface NetworkNode {
  id: string;
  label: string;
  type?: string;           // 'default' | 'important' | 'secondary'
  data?: Record<string, any>;
}

interface NetworkEdge {
  id: string;
  source: string;          // Node ID
  target: string;          // Node ID
  label?: string;
  weight?: number;
  data?: Record<string, any>;
}
```

### Node Types
- **default**: Standard blue nodes
- **important**: Red nodes for critical entities
- **secondary**: Green nodes for supporting entities

## Usage Instructions

### Accessing the Graph Page
1. Start the development server: `npm run dev`
2. Navigate to `http://localhost:3000/graph`
3. The page will automatically load network data from the backend or use mock data

### Interacting with the Graph
1. **View Node Details**: Click on any node to see its properties in the side panel
2. **Change Layout**: Use the layout dropdown to switch between different arrangements
3. **Navigate**: 
   - Scroll to zoom in/out
   - Drag to pan around the graph
   - Use "Fit to View" to see the entire network
   - Use "Reset Zoom" to return to default zoom level

### Data Management
1. **Upload Data**: Click "Upload" and select a JSON file with network data
2. **Download Data**: Click "Download" to export current network as JSON
3. **Refresh Data**: Click "Refresh" to reload data from the backend

### Understanding the Statistics
- **Total Nodes**: Number of entities in the network
- **Total Connections**: Number of relationships between entities
- **Network Density**: Percentage of actual connections vs. possible connections
- **Node Distribution**: Breakdown of nodes by type
- **Most Connected Nodes**: Top 5 nodes with most connections

## Backend Integration

To connect to your actual backend:

1. **Set Environment Variable**: Add your backend URL to `.env.local`:
   ```
   NEXT_PUBLIC_API_URL=http://your-backend-url:port
   ```

2. **Backend API Requirements**: Your backend should implement:
   - `GET /api/network` - Return network data in the specified format
   - `POST /api/network` - Accept network data uploads
   - `GET /api/network/stats` - Return network statistics

3. **CORS Configuration**: Ensure your backend allows requests from the frontend domain

## Customization

### Adding New Node Types
1. Update the node type styling in `graph.tsx`:
   ```javascript
   {
     selector: "node[type='your-new-type']",
     style: {
       "background-color": "#your-color",
       "border-color": "#your-border-color",
     },
   }
   ```

2. Add the new type to the TypeScript interface in `networkService.ts`

### Custom Layout Algorithms
Add new layout configurations in the `getLayoutConfig` function in `graph.tsx`:
```javascript
case "your-layout":
  return {
    name: "your-layout",
    // layout-specific options
  };
```

### Additional Graph Features
The graph component supports many Cytoscape.js features:
- Custom edge styles
- Node animations
- Event handlers
- Extensions and plugins

## Dependencies

- **cytoscape**: Core graph visualization library
- **cytoscape-dagre**: Directed graph layout algorithm
- **cytoscape-fcose**: Force-directed layout algorithm
- **@radix-ui/react-***: UI components
- **lucide-react**: Icons

## Troubleshooting

### Common Issues

1. **Graph not loading**: Check browser console for API errors
2. **Layout issues**: Try switching between different layout algorithms
3. **Performance with large graphs**: Consider implementing node/edge filtering
4. **Backend connection**: Verify the API URL and CORS settings

### Performance Optimization

For large networks (>1000 nodes):
1. Implement server-side filtering
2. Use virtualization for large datasets
3. Consider clustering similar nodes
4. Implement progressive loading

## Future Enhancements

Potential improvements to consider:
- Graph search and filtering
- Node clustering and grouping
- Timeline/animation support
- Advanced analytics (centrality measures, community detection)
- Export to various formats (PNG, SVG, PDF)
- Real-time data updates via WebSocket
- Graph comparison tools
- Collaborative editing features