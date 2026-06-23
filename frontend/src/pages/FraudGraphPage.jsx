import { useEffect, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { api } from "../api";

const nodeStyles = {
  Report: {
    background: "#14213d",
    border: "1px solid #60a5fa",
    color: "#eff6ff",
  },
  Phone: {
    background: "#10231f",
    border: "1px solid #2dd4bf",
    color: "#ecfeff",
  },
  UPI: {
    background: "#281b08",
    border: "1px solid #f59e0b",
    color: "#fffbeb",
  },
  URL: {
    background: "#2a1212",
    border: "1px solid #ef4444",
    color: "#fef2f2",
  },
  Email: {
    background: "#24132a",
    border: "1px solid #f472b6",
    color: "#fdf2f8",
  },
  City: {
    background: "#1d1633",
    border: "1px solid #a78bfa",
    color: "#f5f3ff",
  },
  ScamType: {
    background: "#172033",
    border: "1px solid #38bdf8",
    color: "#f0f9ff",
  },
};

const typeOrder = {
  City: 0,
  ScamType: 1,
  Report: 2,
  Phone: 3,
  UPI: 4,
  URL: 5,
  Email: 6,
};

export default function FraudGraphPage() {
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchGraph() {
      try {
        const response = await api.get("/api/graph");
        if (isMounted) {
          setGraph(response.data);
          setError("");
        }
      } catch (requestError) {
        if (isMounted) {
          setError(
            requestError.response?.data?.detail ||
              "Unable to load graph. Check that the backend is running.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchGraph();
    return () => {
      isMounted = false;
    };
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    setNodes(buildFlowNodes(graph.nodes));
    setEdges(buildFlowEdges(graph.edges));
  }, [graph, setEdges, setNodes]);

  const hasGraph = nodes.length > 0;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Fraud Network Graph</h2>
          <p className="mt-1 text-sm text-slate-400">
            Connected reports, cities, phone numbers, UPI IDs, and suspicious URLs.
          </p>
        </div>
        <div className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-slate-300">
          {isLoading
            ? "Loading graph..."
            : `${graph.nodes.length} nodes / ${graph.edges.length} edges`}
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="h-[640px] overflow-hidden rounded-lg border border-line bg-panel">
        {hasGraph ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            minZoom={0.35}
          >
            <Background color="#253044" gap={18} />
            <Controls />
            <MiniMap
              nodeStrokeColor="#253044"
              nodeColor={(node) => node.style?.background || "#111620"}
              maskColor="rgba(9, 11, 16, 0.72)"
            />
          </ReactFlow>
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500">
            No graph data yet. Analyze one or more suspicious messages to create
            report and entity connections.
          </div>
        )}
      </div>
    </section>
  );
}

function buildFlowNodes(nodes) {
  const groupedCounts = {};

  return nodes.map((node) => {
    const column = typeOrder[node.type] ?? 5;
    const row = groupedCounts[node.type] ?? 0;
    groupedCounts[node.type] = row + 1;

    return {
      id: node.id,
      type: "default",
      position: {
        x: 40 + column * 230,
        y: 60 + row * 120,
      },
      data: {
        label: formatNodeLabel(node),
      },
      style: {
        width: 180,
        minHeight: 64,
        borderRadius: 8,
        padding: 0,
        fontSize: 12,
        ...nodeStyles[node.type],
      },
    };
  });
}

function buildFlowEdges(edges) {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: labelForEdge(edge.label),
    style: { stroke: "#64748b", strokeWidth: 1.5 },
    labelStyle: { fill: "#cbd5e1", fontSize: 11 },
    labelBgStyle: { fill: "#111620", fillOpacity: 0.9 },
  }));
}

function formatNodeLabel(node) {
  const title = labelForNodeType(node.type);
  const value = node.type === "Report" ? node.label : node.label;

  return (
    <div className="px-3 py-2 text-left">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-75">
        {title}
      </div>
      <div className="mt-1 break-words text-xs font-semibold leading-5">{value}</div>
      {node.type === "Report" ? (
        <div className="mt-1 text-[11px] opacity-75">Risk {node.risk_score}</div>
      ) : null}
    </div>
  );
}

function labelForNodeType(type) {
  const labels = {
    Report: "Report",
    Phone: "Phone",
    UPI: "UPI ID",
    URL: "URL",
    Email: "Email",
    City: "City",
    ScamType: "Scam Type",
  };
  return labels[type] || type;
}

function labelForEdge(label) {
  const labels = {
    HAS_PHONE: "phone",
    HAS_UPI: "upi",
    HAS_URL: "url",
    HAS_EMAIL: "email",
    FROM_CITY: "city",
    SCAM_TYPE: "scam type",
  };
  return labels[label] || label;
}
