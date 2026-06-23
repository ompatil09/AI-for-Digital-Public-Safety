import { useEffect, useState } from "react";
import { api } from "../api";

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchReports() {
      try {
        const response = await api.get("/api/reports");
        if (isMounted) {
          setReports(Array.isArray(response.data) ? response.data : []);
          setError("");
        }
      } catch (requestError) {
        if (isMounted) {
          setError(
            requestError.response?.data?.detail ||
              "Unable to load reports. Check that the backend is running.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchReports();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Reports</h2>
          <p className="mt-1 text-sm text-slate-400">
            Saved scam analysis reports from the local backend.
          </p>
        </div>
        <div className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-slate-300">
          {isLoading ? "Loading..." : `${reports.length} report(s)`}
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-line bg-panel p-5 text-sm text-slate-400">
          Loading reports...
        </div>
      ) : reports.length ? (
        <div className="space-y-4">
          {reports.map((report) => (
            <ReportCard key={report.report_id || report.created_at} report={report} />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-line bg-slate-950 p-5 text-sm text-slate-400">
          No reports loaded. Analyze a suspicious message first.
        </div>
      )}
    </section>
  );
}

function ReportCard({ report }) {
  const entities = report.extracted_entities || {};
  const repeatedEntities = report.repeated_entities || [];

  return (
    <article className="rounded-lg border border-line bg-panel p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded border border-signal/40 bg-signal/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-signal">
              {report.scam_type || "Unknown Scam Type"}
            </span>
            <span className="rounded border border-line bg-slate-950 px-2.5 py-1 text-xs text-slate-300">
              {report.city || "Unknown City"}
            </span>
          </div>
          <h3 className="mt-3 break-words text-lg font-semibold text-white">
            {report.verdict || "No verdict"}
          </h3>
          <p className="mt-2 text-sm text-slate-400">
            Created {formatDate(report.created_at)}
          </p>
        </div>

        <div className="rounded-md border border-danger/40 bg-slate-950 px-4 py-3 text-center">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Risk</p>
          <p className="mt-1 text-3xl font-semibold text-danger">
            {report.risk_score ?? 0}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <EntityBlock title="Phone Numbers" values={entities.phone_numbers} />
        <EntityBlock title="UPI IDs" values={entities.upi_ids} />
        <EntityBlock title="URLs" values={entities.urls} />
      </div>

      <div className="mt-4">
        <EntityBlock
          title="Repeated Entity Matches"
          values={repeatedEntities.map(formatRepeatedEntity)}
        />
      </div>
    </article>
  );
}

function EntityBlock({ title, values = [] }) {
  return (
    <div className="rounded-md border border-line bg-slate-950 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>
      <div className="mt-3 space-y-2">
        {values.length ? (
          values.map((value) => (
            <div
              key={value}
              className="break-words rounded border border-line bg-slate-900 px-3 py-2 text-sm text-slate-200"
            >
              {value}
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">None</p>
        )}
      </div>
    </div>
  );
}

function formatRepeatedEntity(entity) {
  const type = entity.entity_type || "Entity";
  const value = entity.value || "Unknown";
  const count = entity.matched_reports_count ?? 0;
  return `${type}: ${value} matched ${count} previous report(s)`;
}

function formatDate(value) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}
