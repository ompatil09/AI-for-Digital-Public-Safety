import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api";

const chartColors = ["#2dd4bf", "#f59e0b", "#ef4444", "#60a5fa", "#a78bfa"];

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchDashboard() {
      try {
        const response = await api.get("/api/dashboard");
        if (isMounted) {
          setDashboard(response.data);
          setError("");
        }
      } catch (requestError) {
        if (isMounted) {
          setError(
            requestError.response?.data?.detail ||
              "Unable to load dashboard. Check that the backend is running.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  const scamTypeData = useMemo(
    () => toChartData(dashboard?.scam_type_counts),
    [dashboard],
  );
  const cityData = useMemo(() => toChartData(dashboard?.city_counts), [dashboard]);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Dashboard</h2>
          <p className="mt-1 text-sm text-slate-400">
            Public-safety view of reported scams and risk patterns.
          </p>
        </div>
        <div className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-slate-300">
          {isLoading ? "Refreshing..." : "Live local prototype data"}
        </div>
      </section>

      {error ? (
        <div className="rounded-md border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <DashboardTile
          label="Total Reports"
          value={isLoading ? "--" : dashboard?.total_reports ?? 0}
          accent="signal"
        />
        <DashboardTile
          label="High Risk Cases"
          value={isLoading ? "--" : dashboard?.high_risk_count ?? 0}
          accent="danger"
        />
        <DashboardTile
          label="Average Risk Score"
          value={isLoading ? "--" : dashboard?.average_risk_score ?? 0}
          accent="warning"
        />
      </div>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
        <div className="rounded-lg border border-line bg-panel p-5">
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-white">Scam Type Mix</h3>
            <p className="mt-1 text-sm text-slate-400">
              Count of reports grouped by detected scam category.
            </p>
          </div>
          <div className="h-80">
            {scamTypeData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={scamTypeData}
                  layout="vertical"
                  margin={{ left: 12, right: 18 }}
                >
                  <CartesianGrid stroke="#253044" strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fill: "#cbd5e1", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "#253044" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={150}
                    tick={{ fill: "#cbd5e1", fontSize: 12 }}
                    tickFormatter={truncateLabel}
                    tickLine={false}
                    axisLine={{ stroke: "#253044" }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
                    contentStyle={{
                      background: "#111620",
                      border: "1px solid #253044",
                      borderRadius: "6px",
                      color: "#f8fafc",
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {scamTypeData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={chartColors[index % chartColors.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text="No scam type data yet." />
            )}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-panel p-5">
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-white">City Reports</h3>
            <p className="mt-1 text-sm text-slate-400">
              Reports grouped by submitted city.
            </p>
          </div>
          <div className="space-y-3">
            {cityData.length ? (
              cityData.map((city) => (
                <CityRow
                  key={city.name}
                  city={city.name}
                  count={city.count}
                  max={cityData[0]?.count || 1}
                />
              ))
            ) : (
              <EmptyState text="No city data yet." />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function DashboardTile({ label, value, accent }) {
  const accentClasses = {
    signal: "text-signal border-signal/40",
    warning: "text-warning border-warning/40",
    danger: "text-danger border-danger/40",
  };

  return (
    <div className={`rounded-md border bg-panel p-5 ${accentClasses[accent]}`}>
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function CityRow({ city, count, max }) {
  const width = `${Math.max(8, Math.round((count / max) * 100))}%`;

  return (
    <div className="rounded-md border border-line bg-slate-950 p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="break-words text-sm font-medium text-white">{city}</p>
        <p className="shrink-0 text-sm font-semibold text-signal">{count}</p>
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-800">
        <div className="h-2 rounded-full bg-signal" style={{ width }} />
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="flex h-full min-h-40 items-center justify-center rounded-md border border-dashed border-line bg-slate-950 p-5 text-sm text-slate-500">
      {text}
    </div>
  );
}

function toChartData(counts = {}) {
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((first, second) => second.count - first.count);
}

function truncateLabel(label) {
  return label.length > 18 ? `${label.slice(0, 17)}...` : label;
}
