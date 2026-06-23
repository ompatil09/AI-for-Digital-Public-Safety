import { useEffect, useMemo, useState } from "react";
import AnalyzePage from "./pages/AnalyzePage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import FraudGraphPage from "./pages/FraudGraphPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";

const routes = {
  "/": AnalyzePage,
  "/dashboard": DashboardPage,
  "/reports": ReportsPage,
  "/graph": FraudGraphPage,
};

const navItems = [
  { path: "/", label: "Analyze" },
  { path: "/dashboard", label: "Dashboard" },
  { path: "/reports", label: "Reports" },
  { path: "/graph", label: "Graph" },
];

export default function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const Page = useMemo(() => routes[path] || AnalyzePage, [path]);

  function navigate(nextPath) {
    window.history.pushState({}, "", nextPath);
    setPath(nextPath);
  }

  return (
    <div className="min-h-screen bg-ink text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-signal">
              Sentinel AI
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-white">
              Fraud intelligence console
            </h1>
          </div>
          <nav className="flex flex-wrap rounded-md border border-line bg-panel p-1">
            {navItems.map((item) => {
              const isActive = path === item.path;
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`min-h-10 rounded px-4 text-sm font-medium ${
                    isActive
                      ? "bg-slate-100 text-slate-950"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </header>
        <main className="flex-1 py-6">
          <Page />
        </main>
      </div>
    </div>
  );
}
