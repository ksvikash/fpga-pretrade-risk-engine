import { NextResponse } from 'next/server';

const getNetworkStats = () => {
  const sampleData = {
    nodeCount: 203769, 
    edgeCount: 234355, 
    nodeTypes: {
      'merchant': 282,
      'user': 203487,
    },
    avgConnections: 3.6,
    lastUpdated: new Date().toISOString(),
    density: 0.0000113,
    mostConnectedNode: {
      id: 'merchant-1',
      label: 'Amazon Store',
      connections: 6,
    },
    clusters: 2,
    isolatedNodes: 0,
    fraudStats: {
      totalTransactions: 234355,
      fraudulentTransactions: 15,
      fraudRate: 0.33, // 33% fraud rate
      highRiskMerchants: 2,
      suspiciousUsers: 4,
    },
    categories: {
      'Merchants': 10,
      'Users': 15,
      'Normal Transactions': 30,
      'Fraudulent Transactions': 15,
    }
  };

  return sampleData;
};

export async function GET() {
  try {
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 200));

    const stats = getNetworkStats();

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching network stats:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch network statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}