"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";


const IssueMap = dynamic(() => import("../../components/IssueMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] items-center justify-center rounded-2xl border border-white/10 bg-slate-900/60 text-sm text-slate-500">
      Loading civic map...
    </div>
  ),
});

const RiskHotspots = dynamic(() => import("../../components/RiskHotspots"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[300px] items-center justify-center rounded-2xl border border-white/10 bg-slate-900/60 text-sm text-slate-500">
      Calculating civic hotspots...
    </div>
  ),
});

type Issue = {
  id: string;
  image_url: string | null;
  damage_type: string;
  confidence: number;
  area_percent: number;
  severity: string;
  priority_score: number;
  priority_level: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  description: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
  resolution_image_url: string | null;
  verification_status: string | null;
  area_reduction_percent: number | null;
  verified_at: string | null;
  duplicate_status: string | null;
  duplicate_issue_id: string | null;
  duplicate_similarity: number | null;
  persistence_status: string | null;
  related_issue_id: string | null;
  reopened_at: string | null;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function Dashboard() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [verifyingIssueId, setVerifyingIssueId] = useState<string | null>(null);
  const [updatingIssueId, setUpdatingIssueId] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authorityUsername, setAuthorityUsername] = useState("");

  useEffect(() => {
    const fetchIssues = async () => {
      const token = localStorage.getItem("civicpulse_authority_token");

      if (!token) {
        window.location.replace("/login");
        return;
      }

      try {
        const meResponse = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (meResponse.status === 401 || meResponse.status === 403) {
          localStorage.removeItem("civicpulse_authority_token");
          window.location.replace("/login");
          return;
        }

        if (!meResponse.ok) {
          throw new Error("Authentication check failed");
        }

        const me = await meResponse.json();
        setAuthorityUsername(me.username || "");

        const response = await fetch(`${API_URL}/api/issues`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem("civicpulse_authority_token");
          window.location.replace("/login");
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to fetch issues");
        }

        const data = await response.json();
        setIssues(data.issues || []);
      } catch (error) {
        console.error(error);
      } finally {
        setAuthChecking(false);
        setLoading(false);
      }
    };

    fetchIssues();
  }, []);

  const updateStatus = async (issueId: string, newStatus: string) => {
    setUpdatingIssueId(issueId);

    try {
      const response = await fetch(
        `${API_URL}/api/issues/${issueId}/status?status=${encodeURIComponent(newStatus)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("civicpulse_authority_token") || ""}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to update status");
      }

      setIssues((currentIssues) =>
        currentIssues.map((issue) =>
          issue.id === issueId
            ? {
                ...issue,
                status: data.issue.status,
                updated_at: data.issue.updated_at,
              }
            : issue
        )
      );
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to update issue status."
      );
    } finally {
      setUpdatingIssueId(null);
    }
  };

  const verifyResolution = async (issueId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      setVerifyingIssueId(issueId);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const token = localStorage.getItem("civicpulse_authority_token");

        if (!token) {
          window.location.replace("/login");
          return;
        }

        const response = await fetch(
          `${API_URL}/api/issues/${issueId}/verify`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          }
        );

        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem("civicpulse_authority_token");
          window.location.replace("/login");
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail || "Resolution verification failed."
          );
        }

        setIssues((currentIssues) =>
          currentIssues.map((issue) =>
            issue.id === issueId
              ? {
                  ...issue,
                  verification_status: data.verification_status,
                  area_reduction_percent:
                    data.area_reduction_percent,
                  verified_at: new Date().toISOString(),
                  status:
                    data.verification_status === "AI Verified"
                      ? "Resolved"
                      : issue.status,
                }
              : issue
          )
        );

        alert(
          `Verification Result: ${data.verification_status}\n` +
            `Area Reduction: ${data.area_reduction_percent}%`
        );
      } catch (error) {
        console.error(error);
        alert(
          error instanceof Error
            ? error.message
            : "Resolution verification failed."
        );
      } finally {
        setVerifyingIssueId(null);
      }
    };

    input.click();
  };

  const logout = () => {
    localStorage.removeItem("civicpulse_authority_token");
    window.location.replace("/login");
  };

  const counts = useMemo(() => {
    return {
      total: issues.length,
      critical: issues.filter(
        (issue) => issue.priority_level === "Critical"
      ).length,
      high: issues.filter(
        (issue) => issue.priority_level === "High"
      ).length,
      reported: issues.filter(
        (issue) => issue.status === "Reported"
      ).length,
    };
  }, [issues]);

  const filteredIssues =
    filter === "All"
      ? issues
      : issues.filter(
          (issue) => issue.priority_level === filter
        );

  if (authChecking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-8 py-7 text-center">
          <p className="text-sm font-semibold text-cyan-400">CIVICPULSE AI</p>
          <p className="mt-3 text-lg font-semibold">Checking authority session...</p>
          <p className="mt-2 text-sm text-slate-500">
            Verifying secure dashboard access.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-950">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <div>
            <p className="text-sm font-semibold text-cyan-400">
              CIVICPULSE AI
            </p>
            <h1 className="mt-1 text-2xl font-bold">
              Authority Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs text-slate-500">Signed in as</p>
              <p className="text-sm font-medium text-slate-200">
                {authorityUsername || "Authority"}
              </p>
            </div>

            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium transition hover:bg-white/10"
            >
              Logout
            </button>

            <a
              href="/"
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium transition hover:bg-white/10"
            >
              Citizen Portal
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <section>
          <div className="mb-6">
            <p className="text-sm uppercase tracking-widest text-slate-500">
              Operations Overview
            </p>
            <h2 className="mt-2 text-3xl font-bold">
              Civic issue intelligence
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Issues"
              value={counts.total}
              description="All reported issues"
            />
            <StatCard
              title="Critical"
              value={counts.critical}
              description="Immediate attention"
            />
            <StatCard
              title="High Priority"
              value={counts.high}
              description="Requires attention"
            />
            <StatCard
              title="Reported"
              value={counts.reported}
              description="Awaiting action"
            />
          </div>
        </section>


        <section className="mt-10">
          <div className="mb-6">
            <p className="text-sm uppercase tracking-widest text-cyan-400">
              Spatial Intelligence
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              Civic issue map
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Live issue locations from the CivicPulse database. Marker size
              reflects priority and color indicates priority level.
            </p>
          </div>

          <IssueMap issues={issues} />
        </section>

        <section className="mt-10">
          <div className="mb-6">
            <p className="text-sm uppercase tracking-widest text-cyan-400">
              Risk Intelligence
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              Civic risk hotspots
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Nearby GPS-tagged issues are grouped into spatial clusters.
              Higher-priority issues contribute more to the hotspot risk score.
            </p>
          </div>

          <RiskHotspots issues={issues} />
        </section>

        <section className="mt-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-widest text-cyan-400">
                Issue Queue
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                Reported civic problems
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {["All", "Critical", "High", "Medium", "Low"].map(
                (item) => (
                  <button
                    key={item}
                    onClick={() => setFilter(item)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      filter === item
                        ? "bg-cyan-400 text-slate-950"
                        : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {item}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60">
            {loading ? (
              <div className="p-10 text-center text-slate-400">
                Loading civic issues...
              </div>
            ) : filteredIssues.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                No issues found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1300px] text-left">
                  <thead className="border-b border-white/10 bg-white/[0.03]">
                    <tr>
                      <th className="px-6 py-4 text-sm text-slate-400">
                        Issue
                      </th>
                      <th className="px-6 py-4 text-sm text-slate-400">
                        Location
                      </th>
                      <th className="px-6 py-4 text-sm text-slate-400">
                        Severity
                      </th>
                      <th className="px-6 py-4 text-sm text-slate-400">
                        Priority
                      </th>
                      <th className="px-6 py-4 text-sm text-slate-400">
                        Score
                      </th>
                      <th className="px-6 py-4 text-sm text-slate-400">
                        Duplicate
                      </th>
                      <th className="px-6 py-4 text-sm text-slate-400">
                        Persistence
                      </th>
                      <th className="px-6 py-4 text-sm text-slate-400">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredIssues.map((issue) => (
                      <tr
                        key={issue.id}
                        className="border-b border-white/5 transition hover:bg-white/[0.03]"
                      >
                        <td className="px-6 py-5 align-top">
                          <p className="font-semibold">
                            {issue.damage_type}
                          </p>
                          <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                            {issue.description ||
                              "No description provided"}
                          </p>
                        </td>

                        <td className="px-6 py-5 align-top text-sm text-slate-300">
                          <p>{issue.location || "GPS location captured"}</p>
                          {issue.latitude !== null &&
                            issue.longitude !== null && (
                              <p className="mt-1 text-xs text-slate-500">
                                {issue.latitude.toFixed(6)},{" "}
                                {issue.longitude.toFixed(6)}
                              </p>
                            )}
                        </td>

                        <td className="px-6 py-5 align-top">
                          <PriorityBadge value={issue.severity} />
                        </td>

                        <td className="px-6 py-5 align-top">
                          <PriorityBadge
                            value={issue.priority_level}
                          />
                        </td>

                        <td className="px-6 py-5 align-top font-semibold">
                          {issue.priority_score}/100
                        </td>

                        <td className="px-6 py-5 align-top">
                          <DuplicateStatus issue={issue} />
                        </td>

                        <td className="px-6 py-5 align-top">
                          <PersistenceStatus issue={issue} />
                        </td>

                        <td className="px-6 py-5 align-top">
                          <select
                            value={issue.status}
                            disabled={
                              updatingIssueId === issue.id
                            }
                            onChange={(e) =>
                              updateStatus(
                                issue.id,
                                e.target.value
                              )
                            }
                            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 outline-none transition focus:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="Reported">
                              Reported
                            </option>
                            <option value="In Progress">
                              In Progress
                            </option>
                            <option value="Resolved">
                              Resolved
                            </option>
                          </select>

                          {issue.status === "Resolved" &&
                            issue.verification_status !==
                              "AI Verified" && (
                              <button
                                onClick={() =>
                                  verifyResolution(issue.id)
                                }
                                disabled={
                                  verifyingIssueId === issue.id
                                }
                                className="mt-3 rounded-lg bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {verifyingIssueId === issue.id
                                  ? "Verifying..."
                                  : "Verify Resolution"}
                              </button>
                            )}

                          {issue.verification_status && (
                            <div className="mt-3 text-xs">
                              <p
                                className={
                                  issue.verification_status ===
                                  "AI Verified"
                                    ? "font-semibold text-green-400"
                                    : "font-semibold text-orange-300"
                                }
                              >
                                AI: {issue.verification_status}
                              </p>

                              {issue.area_reduction_percent !==
                                null && (
                                <p className="mt-1 text-slate-500">
                                  Area reduction:{" "}
                                  {
                                    issue.area_reduction_percent
                                  }
                                  %
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
            <p className="text-sm uppercase tracking-widest text-cyan-400">
              AI Intelligence
            </p>
            <h3 className="mt-3 text-xl font-bold">
              Current system signals
            </h3>

            <div className="mt-6 space-y-4">
              <InfoRow
                label="Detection engine"
                value="YOLO road-damage detector"
              />
              <InfoRow
                label="Damage classes"
                value="4"
              />
              <InfoRow
                label="Priority engine"
                value="Severity + extent + confidence"
              />
              <InfoRow
                label="Duplicate engine"
                value="CLIP image similarity"
              />
              <InfoRow
                label="Persistence"
                value="Database-backed issue tracking"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
            <p className="text-sm uppercase tracking-widest text-cyan-400">
              Resolution Pipeline
            </p>
            <h3 className="mt-3 text-xl font-bold">
              Issue lifecycle
            </h3>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {[
                "Reported",
                "In Progress",
                "Resolved",
                "AI Verified",
              ].map((status, index) => (
                <div
                  key={status}
                  className="flex items-center gap-3"
                >
                  <span className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium">
                    {status}
                  </span>
                  {index < 3 && (
                    <span className="text-slate-600">→</span>
                  )}
                </div>
              ))}
            </div>

            <p className="mt-6 text-sm leading-6 text-slate-500">
              Resolution verification compares evidence before
              and after an authority marks an issue as resolved.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function DuplicateStatus({ issue }: { issue: Issue }) {
  const status = issue.duplicate_status;

  if (!status) {
    return (
      <span className="text-xs text-slate-500">
        Not analyzed
      </span>
    );
  }

  const classes: Record<string, string> = {
    Duplicate:
      "border-red-400/20 bg-red-400/10 text-red-300",
    Related:
      "border-yellow-400/20 bg-yellow-400/10 text-yellow-300",
    "New Issue":
      "border-green-400/20 bg-green-400/10 text-green-300",
  };

  return (
    <div className="space-y-2">
      <span
        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
          classes[status] ||
          "border-white/10 bg-white/5 text-slate-300"
        }`}
      >
        {status}
      </span>

      {issue.duplicate_similarity !== null && (
        <p className="text-xs text-slate-500">
          Similarity:{" "}
          {(issue.duplicate_similarity * 100).toFixed(1)}%
        </p>
      )}

      {issue.duplicate_issue_id && (
        <p className="max-w-[180px] truncate text-xs text-slate-600">
          Match: {issue.duplicate_issue_id}
        </p>
      )}
    </div>
  );
}

function PersistenceStatus({ issue }: { issue: Issue }) {
  const status = issue.persistence_status;

  if (!status) {
    return (
      <span className="text-xs text-slate-500">
        No persistence event
      </span>
    );
  }

  if (status === "Reopened") {
    return (
      <div className="space-y-2">
        <span className="inline-flex rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs font-semibold text-orange-300">
          Reopened
        </span>

        {issue.related_issue_id && (
          <p className="max-w-[180px] truncate text-xs text-slate-600">
            Previous issue: {issue.related_issue_id}
          </p>
        )}

        {issue.reopened_at && (
          <p className="text-xs text-slate-500">
            Detected: {new Date(issue.reopened_at).toLocaleString()}
          </p>
        )}
      </div>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
      {status}
    </span>
  );
}

function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-3 text-4xl font-bold text-cyan-400">
        {value}
      </p>
      <p className="mt-2 text-xs text-slate-500">
        {description}
      </p>
    </div>
  );
}

function PriorityBadge({ value }: { value: string }) {
  const classes: Record<string, string> = {
    Critical:
      "border-red-400/20 bg-red-400/10 text-red-300",
    High:
      "border-orange-400/20 bg-orange-400/10 text-orange-300",
    Medium:
      "border-yellow-400/20 bg-yellow-400/10 text-yellow-300",
    Low:
      "border-green-400/20 bg-green-400/10 text-green-300",
  };

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
        classes[value] ||
        "border-white/10 bg-white/5 text-slate-300"
      }`}
    >
      {value}
    </span>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-4">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-right text-sm font-medium text-slate-200">
        {value}
      </span>
    </div>
  );
}
