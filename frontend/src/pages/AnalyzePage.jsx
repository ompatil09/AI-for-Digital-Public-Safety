import { useEffect, useState } from "react";
import { createWorker } from "tesseract.js";
import { api } from "../api";

const sampleText =
  "CBI says you are under digital arrest. Pay 5000 to verifyfast@upi or call +91 9876543210 immediately. Visit rbi-verify-payment.com";

export default function AnalyzePage() {
  const [inputMode, setInputMode] = useState("text");
  const [text, setText] = useState(sampleText);
  const [city, setCity] = useState("Mumbai");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState("");
  const [ocrError, setOcrError] = useState("");
  const [ocrMetadata, setOcrMetadata] = useState({
    source_type: "text",
    extracted_text: "",
    original_filename: "",
    ocr_status: "idle",
  });

  useEffect(() => {
    return () => {
      if (screenshotPreview) {
        URL.revokeObjectURL(screenshotPreview);
      }
    };
  }, [screenshotPreview]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setOcrError("");

    const analysisText =
      inputMode === "screenshot_ocr" ? ocrMetadata.extracted_text.trim() : text.trim();

    if (inputMode === "screenshot_ocr" && !screenshotFile) {
      setOcrError("Upload a screenshot first.");
      return;
    }

    if (inputMode === "screenshot_ocr" && !analysisText) {
      setOcrError(
        "No readable text found. Try a clearer screenshot or enter text manually.",
      );
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post("/api/analyze", {
        text: analysisText,
        city,
      });
      setResult({
        ...response.data,
        city: response.data.city || city.trim() || "Unknown",
      });
      setCopyStatus("");
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          "Unable to analyze the message. Check that the backend is running.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleModeChange(nextMode) {
    setInputMode(nextMode);
    setError("");
    setOcrError("");
    setOcrMetadata((currentMetadata) => ({
      ...currentMetadata,
      source_type: nextMode === "screenshot_ocr" ? "screenshot_ocr" : "text",
      ocr_status: nextMode === "screenshot_ocr" ? currentMetadata.ocr_status : "idle",
    }));
  }

  function handleScreenshotChange(event) {
    const file = event.target.files?.[0];
    setOcrError("");

    if (screenshotPreview) {
      URL.revokeObjectURL(screenshotPreview);
    }

    if (!file) {
      setScreenshotFile(null);
      setScreenshotPreview("");
      setOcrMetadata({
        source_type: "screenshot_ocr",
        extracted_text: "",
        original_filename: "",
        ocr_status: "idle",
      });
      return;
    }

    setScreenshotFile(file);
    setScreenshotPreview(URL.createObjectURL(file));
    setOcrMetadata({
      source_type: "screenshot_ocr",
      extracted_text: "",
      original_filename: file.name,
      ocr_status: "ready",
    });
  }

  async function handleExtractText() {
    if (!screenshotFile) {
      setOcrError("Upload a screenshot first.");
      return;
    }

    setOcrError("");
    setOcrMetadata((currentMetadata) => ({
      ...currentMetadata,
      ocr_status: "extracting",
    }));

    let worker;
    try {
      worker = await createWorker("eng");
      const {
        data: { text: extractedText },
      } = await worker.recognize(screenshotFile);
      const cleanedText = extractedText.trim();

      setOcrMetadata((currentMetadata) => ({
        ...currentMetadata,
        extracted_text: cleanedText,
        ocr_status: cleanedText ? "done" : "empty",
      }));

      if (!cleanedText) {
        setOcrError(
          "No readable text found. Try a clearer screenshot or enter text manually.",
        );
      }
    } catch {
      setOcrMetadata((currentMetadata) => ({
        ...currentMetadata,
        ocr_status: "error",
      }));
      setOcrError("OCR extraction failed. Try a clearer screenshot or enter text manually.");
    } finally {
      if (worker) {
        await worker.terminate();
      }
    }
  }

  function handleExtractedTextChange(event) {
    setOcrMetadata((currentMetadata) => ({
      ...currentMetadata,
      extracted_text: event.target.value,
      ocr_status: event.target.value.trim() ? "edited" : currentMetadata.ocr_status,
    }));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-lg border border-line bg-panel p-5">
        <div className="mb-5 flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-white">Analyze Message</h2>
          <p className="text-sm text-slate-400">
            Check suspicious text for scam signals and repeated entities.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-300">Input mode</p>
            <div className="inline-flex rounded-md border border-line bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => handleModeChange("text")}
                className={`min-h-10 rounded px-4 text-sm font-medium ${
                  inputMode === "text"
                    ? "bg-slate-100 text-slate-950"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                Text Input
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("screenshot_ocr")}
                className={`min-h-10 rounded px-4 text-sm font-medium ${
                  inputMode === "screenshot_ocr"
                    ? "bg-slate-100 text-slate-950"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                Screenshot Upload
              </button>
            </div>
          </div>

          {inputMode === "text" ? (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">
                Suspicious message
              </span>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={10}
                required
                className="w-full resize-y rounded-md border border-line bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-100 outline-none focus:border-signal focus:ring-1 focus:ring-signal"
              />
            </label>
          ) : (
            <div className="space-y-4 rounded-md border border-line bg-slate-950 p-4">
              <div>
                <p className="text-sm font-medium text-slate-300">
                  Screenshot OCR
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Screenshot is processed locally for OCR. Only extracted text is
                  analyzed.
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Supported examples: WhatsApp, SMS, Email, UPI payment request
                  screenshots.
                </p>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">
                  Upload screenshot
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleScreenshotChange}
                  className="block w-full rounded-md border border-line bg-slate-900 px-3 py-2 text-sm text-slate-300 file:mr-4 file:rounded file:border-0 file:bg-signal file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-950"
                />
              </label>

              {screenshotPreview ? (
                <div className="rounded-md border border-line bg-slate-900 p-3">
                  <img
                    src={screenshotPreview}
                    alt="Uploaded screenshot preview"
                    className="max-h-72 w-full rounded object-contain"
                  />
                  <p className="mt-2 break-words text-xs text-slate-500">
                    {ocrMetadata.original_filename}
                  </p>
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleExtractText}
                disabled={ocrMetadata.ocr_status === "extracting"}
                className="h-10 rounded-md border border-signal/50 bg-signal/10 px-4 text-sm font-semibold text-signal hover:bg-signal/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {ocrMetadata.ocr_status === "extracting"
                  ? "Extracting..."
                  : "Extract Text"}
              </button>

              {ocrMetadata.ocr_status === "extracting" ? (
                <div className="rounded-md border border-line bg-slate-900 px-3 py-2 text-sm text-slate-300">
                  Extracting text from screenshot...
                </div>
              ) : null}

              {ocrError ? (
                <div className="rounded-md border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-red-200">
                  {ocrError}
                </div>
              ) : null}

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">
                  Extracted text
                </span>
                <textarea
                  value={ocrMetadata.extracted_text}
                  onChange={handleExtractedTextChange}
                  rows={10}
                  placeholder="Extracted OCR text will appear here. You can edit it before analysis."
                  className="w-full resize-y rounded-md border border-line bg-slate-900 px-4 py-3 text-sm leading-6 text-slate-100 outline-none focus:border-signal focus:ring-1 focus:ring-signal"
                />
              </label>
            </div>
          )}

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">
              City
            </span>
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="h-11 w-full rounded-md border border-line bg-slate-950 px-4 text-sm text-slate-100 outline-none focus:border-signal focus:ring-1 focus:ring-signal"
            />
          </label>

          {error ? (
            <div className="rounded-md border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="h-11 rounded-md bg-signal px-5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Analyzing..." : "Analyze"}
          </button>
        </form>
      </section>

      <aside className="rounded-lg border border-line bg-panel p-5">
        <h2 className="text-xl font-semibold text-white">Result</h2>
        {result ? (
          <AnalysisResult
            result={result}
            copyStatus={copyStatus}
            onCopyStatus={setCopyStatus}
          />
        ) : (
          <EmptyResult />
        )}
      </aside>
    </div>
  );
}

function EmptyResult() {
  return (
    <div className="mt-5 rounded-md border border-dashed border-line bg-slate-950 p-5 text-sm text-slate-400">
      Submit a message to see the risk score, scam type, red flags, and extracted
      entities.
    </div>
  );
}

function AnalysisResult({ result, copyStatus, onCopyStatus }) {
  return (
    <div className="mt-5 space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Metric label="Risk" value={result.risk_score} tone="danger" />
        <Metric label="Matches" value={result.matched_reports_count ?? 0} />
      </div>

      <div className="rounded-md border border-line bg-slate-950 p-4">
        <p className="text-sm text-slate-400">Verdict</p>
        <p className="mt-1 text-lg font-semibold text-white">{result.verdict}</p>
        <p className="mt-3 text-sm text-slate-400">Scam type</p>
        <p className="mt-1 text-sm font-medium text-signal">{result.scam_type}</p>
      </div>

      <RiskScoreBreakdown
        breakdown={result.risk_score_breakdown}
        finalScore={result.risk_score}
      />
      <AiPatternAnalysis summary={result.ai_pattern_summary} />
      <PatternKnowledgeMatch summary={result.dataset_match_summary} />
      <EntityList title="Red flags" values={result.red_flags} />
      <GraphIntelligenceMatch result={result} />
      <EntityGroup entities={result.extracted_entities} />

      <div className="rounded-md border border-line bg-slate-950 p-4">
        <p className="text-sm text-slate-400">Recommendation</p>
        <p className="mt-2 text-sm leading-6 text-slate-200">
          {result.recommendation}
        </p>
      </div>

      <IncidentReport
        result={result}
        copyStatus={copyStatus}
        onCopyStatus={onCopyStatus}
      />
    </div>
  );
}

function RiskScoreBreakdown({ breakdown = [], finalScore }) {
  const rawScore = breakdown.reduce((total, item) => total + item.points, 0);

  return (
    <div className="rounded-md border border-line bg-slate-950 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-300">
            Risk Score Breakdown
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Final score is capped at 100.
          </p>
        </div>
        <div className="shrink-0 rounded border border-danger/40 bg-danger/10 px-2.5 py-1 text-sm font-semibold text-danger">
          {finalScore}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {breakdown.length ? (
          breakdown.map((item) => (
            <div
              key={`${item.label}-${item.points}`}
              className="flex items-center justify-between gap-4 rounded border border-line bg-slate-900 px-3 py-2"
            >
              <span className="text-sm text-slate-200">{item.label}</span>
              <span className="shrink-0 text-sm font-semibold text-signal">
                +{item.points}
              </span>
            </div>
          ))
        ) : (
          <p className="rounded border border-line bg-slate-900 px-3 py-2 text-sm text-slate-500">
            No scoring signals found.
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-4 border-t border-line pt-3 text-sm">
        <span className="text-slate-400">Raw score</span>
        <span className="font-semibold text-slate-200">{rawScore}</span>
      </div>
    </div>
  );
}

function AiPatternAnalysis({ summary }) {
  const contentRiskDetected = Boolean(summary?.content_risk_detected);

  return (
    <div className="rounded-md border border-line bg-slate-950 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-300">
            AI Pattern Analysis
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Content-based scam behavior detection.
          </p>
        </div>
        <div
          className={`shrink-0 rounded border px-2.5 py-1 text-sm font-semibold ${
            contentRiskDetected
              ? "border-warning/40 bg-warning/10 text-warning"
              : "border-signal/40 bg-signal/10 text-signal"
          }`}
        >
          {contentRiskDetected ? "Detected" : "No match"}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <ReportField
          label="Pattern Detected"
          value={contentRiskDetected ? "Yes" : "No"}
        />
        <ReportField
          label="Primary Reason"
          value={
            summary?.primary_reason ||
            "No strong scam behavior was detected in the message content."
          }
        />
        <ReportField label="Confidence" value={summary?.confidence || "unknown"} />
        <div className="rounded border border-line bg-slate-900 px-3 py-2 text-sm leading-6 text-slate-200">
          No database match required. This risk is based on message behavior and
          scam-pattern analysis.
        </div>
      </div>
    </div>
  );
}

function PatternKnowledgeMatch({ summary }) {
  const examples = summary?.matched_examples || [];

  return (
    <div className="rounded-md border border-line bg-slate-950 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-300">
            Pattern Knowledge Match
          </p>
          <p className="mt-1 text-xs text-slate-500">
            TF-IDF similarity against local fraud examples.
          </p>
        </div>
        <div
          className={`shrink-0 rounded border px-2.5 py-1 text-sm font-semibold ${
            summary?.matched
              ? "border-warning/40 bg-warning/10 text-warning"
              : "border-signal/40 bg-signal/10 text-signal"
          }`}
        >
          {summary?.matched ? `+${summary.score_boost}` : "No boost"}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <ReportField
          label="Summary"
          value={summary?.primary_reason || "No similar dataset examples found."}
        />
        <ReportField
          label="Suggested Scam Type"
          value={summary?.suggested_scam_type || "None"}
        />
        <ReportField
          label="Best Similarity"
          value={String(summary?.best_similarity ?? 0)}
        />

        <div className="rounded border border-line bg-slate-900 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Matched Examples
          </p>
          <div className="mt-3 space-y-3">
            {examples.length ? (
              examples.map((example) => (
                <div
                  key={example.message_id}
                  className="rounded border border-line bg-slate-950 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300">
                      {example.message_id}
                    </span>
                    <span className="rounded bg-warning/10 px-2 py-1 text-xs text-warning">
                      {example.scam_type}
                    </span>
                    <span className="rounded bg-signal/10 px-2 py-1 text-xs text-signal">
                      {example.similarity}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    {example.message_text}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">None</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function GraphIntelligenceMatch({ result }) {
  const repeatedEntities = result.repeated_entities || [];
  const matchedReportsCount = result.matched_reports_count ?? 0;
  const hasMatch = matchedReportsCount > 0 || repeatedEntities.length > 0;
  const groupedEntities = groupRepeatedEntities(repeatedEntities);

  return (
    <div className="rounded-md border border-line bg-slate-950 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-300">
            Graph Intelligence Match
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Checks extracted entities against previously saved reports.
          </p>
        </div>
        <div className="shrink-0 rounded border border-signal/40 bg-signal/10 px-2.5 py-1 text-sm font-semibold text-signal">
          {matchedReportsCount}
        </div>
      </div>

      {hasMatch ? (
        <div className="mt-4 space-y-4">
          <div className="rounded border border-line bg-slate-900 px-3 py-2 text-sm text-slate-200">
            Matched {matchedReportsCount} previous scam report
            {matchedReportsCount === 1 ? "" : "s"}.
          </div>

          <div className="grid gap-3">
            <RepeatedEntityList
              title="Repeated phone numbers"
              values={groupedEntities.phone_numbers}
            />
            <RepeatedEntityList
              title="Repeated UPI IDs"
              values={groupedEntities.upi_ids}
            />
            <RepeatedEntityList
              title="Repeated URLs"
              values={groupedEntities.urls}
            />
            <RepeatedEntityList
              title="Repeated emails"
              values={groupedEntities.emails}
            />
          </div>

          <div className="rounded border border-warning/40 bg-warning/10 px-3 py-2 text-sm leading-6 text-amber-100">
            {buildRiskIncreaseReason(repeatedEntities, result)}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded border border-line bg-slate-900 px-3 py-2 text-sm text-slate-300">
          No previous graph match found. Risk is based on message pattern only.
        </div>
      )}
    </div>
  );
}

function RepeatedEntityList({ title, values = [] }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>
      <div className="mt-2 space-y-2">
        {values.length ? (
          values.map((entity) => (
            <div
              key={`${entity.value}-${entity.matched_reports_count}`}
              className="break-words rounded border border-line bg-slate-900 px-3 py-2 text-sm text-slate-200"
            >
              {entity.value} was already reported in{" "}
              {entity.matched_reports_count} previous scam report
              {entity.matched_reports_count === 1 ? "" : "s"}.
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">None</p>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, tone = "default" }) {
  const valueClass = tone === "danger" ? "text-danger" : "text-signal";
  return (
    <div className="rounded-md border border-line bg-slate-950 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
}

function groupRepeatedEntities(repeatedEntities) {
  return repeatedEntities.reduce(
    (groups, entity) => {
      const key = repeatedEntityGroupKey(entity.entity_type);
      groups[key].push(entity);
      return groups;
    },
    {
      phone_numbers: [],
      upi_ids: [],
      urls: [],
      emails: [],
    },
  );
}

function repeatedEntityGroupKey(entityType = "") {
  const normalizedType = entityType.toLowerCase();
  if (normalizedType.includes("phone")) {
    return "phone_numbers";
  }
  if (normalizedType.includes("upi")) {
    return "upi_ids";
  }
  if (normalizedType.includes("url") || normalizedType.includes("domain")) {
    return "urls";
  }
  if (normalizedType.includes("email")) {
    return "emails";
  }
  return "urls";
}

function buildRiskIncreaseReason(repeatedEntities, result) {
  const firstEntity = repeatedEntities[0];
  if (!firstEntity) {
    return result.graph_match_summary || "Risk score increased because this message shares entities with previous scam reports.";
  }

  return `${firstEntity.value} was already reported in ${firstEntity.matched_reports_count} previous scam report${
    firstEntity.matched_reports_count === 1 ? "" : "s"
  }. Risk score increased because this entity is linked to ${result.scam_type} reports.`;
}

function EntityList({ title, values = [] }) {
  return (
    <div className="rounded-md border border-line bg-slate-950 p-4">
      <p className="text-sm text-slate-400">{title}</p>
      <div className="mt-3 space-y-2">
        {values.length ? (
          values.map((value) => (
            <div
              key={value}
              className="rounded border border-line bg-slate-900 px-3 py-2 text-sm text-slate-200"
            >
              {value}
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">None found</p>
        )}
      </div>
    </div>
  );
}

function EntityGroup({ entities }) {
  const rows = [
    ["Phones", entities?.phone_numbers],
    ["UPI IDs", entities?.upi_ids],
    ["URLs", entities?.urls],
    ["Emails", entities?.emails],
  ];

  return (
    <div className="rounded-md border border-line bg-slate-950 p-4">
      <p className="text-sm text-slate-400">Extracted entities</p>
      <div className="mt-3 space-y-3">
        {rows.map(([label, values = []]) => (
          <div key={label}>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              {label}
            </p>
            <p className="mt-1 break-words text-sm text-slate-200">
              {values.length ? values.join(", ") : "None"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function IncidentReport({ result, copyStatus, onCopyStatus }) {
  const reportText = buildIncidentReportText(result);
  const lawEnforcementRecommendation = buildLawEnforcementRecommendation(result);
  const evidenceSummary = buildEvidenceSummary(result);

  async function handleCopyReport() {
    try {
      await navigator.clipboard.writeText(reportText);
      onCopyStatus("Copied");
    } catch {
      onCopyStatus("Copy failed");
    }
  }

  return (
    <div className="rounded-md border border-line bg-slate-950 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-300">Incident Report</p>
          <p className="mt-1 text-xs text-slate-500">
            Structured summary for demo review and follow-up.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopyReport}
          className="h-10 rounded-md border border-signal/50 bg-signal/10 px-3 text-sm font-semibold text-signal hover:bg-signal/20"
        >
          Copy Report
        </button>
      </div>

      {copyStatus ? (
        <p className="mt-3 text-sm text-slate-400">{copyStatus}</p>
      ) : null}

      <div className="mt-4 space-y-3">
        <ReportField label="Case ID" value={result.report_id || "Not assigned"} />
        <ReportField label="City" value={result.city || "Unknown"} />
        <ReportField label="Scam Type" value={result.scam_type || "Unknown"} />
        <ReportField label="Verdict" value={result.verdict || "Unknown"} />
        <ReportField label="Risk Score" value={`${result.risk_score ?? 0}/100`} />
        <ReportField
          label="Extracted Entities"
          value={formatExtractedEntities(result.extracted_entities)}
        />
        <ReportField
          label="Repeated Entity Matches"
          value={formatRepeatedEntities(result.repeated_entities)}
        />
        <ReportField label="Red Flags" value={formatList(result.red_flags)} />
        <ReportField
          label="Citizen Recommendation"
          value={result.recommendation || "No recommendation generated."}
        />
        <ReportField
          label="Law Enforcement Recommendation"
          value={lawEnforcementRecommendation}
        />
        <ReportField label="Evidence Summary" value={evidenceSummary} />
      </div>
    </div>
  );
}

function ReportField({ label, value }) {
  return (
    <div className="rounded border border-line bg-slate-900 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">
        {value}
      </p>
    </div>
  );
}

function buildIncidentReportText(result) {
  return [
    "Sentinel AI Incident Report",
    `Case ID: ${result.report_id || "Not assigned"}`,
    `City: ${result.city || "Unknown"}`,
    `Scam Type: ${result.scam_type || "Unknown"}`,
    `Verdict: ${result.verdict || "Unknown"}`,
    `Risk Score: ${result.risk_score ?? 0}/100`,
    `Extracted Entities: ${formatExtractedEntities(result.extracted_entities)}`,
    `Repeated Entity Matches: ${formatRepeatedEntities(result.repeated_entities)}`,
    `Red Flags: ${formatList(result.red_flags)}`,
    `Citizen Recommendation: ${result.recommendation || "No recommendation generated."}`,
    `Law Enforcement Recommendation: ${buildLawEnforcementRecommendation(result)}`,
    `Evidence Summary: ${buildEvidenceSummary(result)}`,
  ].join("\n");
}

function formatExtractedEntities(entities = {}) {
  return [
    `Phone numbers: ${formatList(entities.phone_numbers)}`,
    `UPI IDs: ${formatList(entities.upi_ids)}`,
    `URLs: ${formatList(entities.urls)}`,
    `Emails: ${formatList(entities.emails)}`,
  ].join("\n");
}

function formatRepeatedEntities(repeatedEntities = []) {
  if (!repeatedEntities.length) {
    return "None";
  }

  return repeatedEntities
    .map(
      (entity) =>
        `${entity.entity_type || "Entity"} ${entity.value || "Unknown"} matched ${
          entity.matched_reports_count ?? 0
        } previous report(s)`,
    )
    .join("\n");
}

function formatList(values = []) {
  return values.length ? values.join(", ") : "None";
}

function buildLawEnforcementRecommendation(result) {
  const repeatedCount = result.matched_reports_count ?? 0;
  if (repeatedCount > 0) {
    return "Prioritize entity correlation, review connected reports, and preserve submitted message evidence for investigation.";
  }

  if ((result.risk_score ?? 0) >= 75) {
    return "Review extracted entities, validate reported contact/payment details, and preserve the message as potential scam evidence.";
  }

  return "Monitor the report and compare extracted entities with future submissions.";
}

function buildEvidenceSummary(result) {
  const entities = result.extracted_entities || {};
  const entityCount =
    (entities.phone_numbers?.length || 0) +
    (entities.upi_ids?.length || 0) +
    (entities.urls?.length || 0) +
    (entities.emails?.length || 0);
  const redFlagCount = result.red_flags?.length || 0;
  const repeatedCount = result.repeated_entities?.length || 0;

  return `${entityCount} extracted entity/entities, ${redFlagCount} red flag(s), and ${repeatedCount} repeated graph match(es) were found.`;
}
