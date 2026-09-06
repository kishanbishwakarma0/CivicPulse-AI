"use client";

import { useMemo } from "react";

type Issue = {
  id: string;
  damage_type: string;
  severity: string;
  priority_score: number;
  priority_level: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
};

type Cluster = {
  latitude: number;
  longitude: number;
  issues: Issue[];
  riskScore: number;
  criticalCount: number;
  highCount: number;
  radiusMeters: number;
};

const CLUSTER_RADIUS_METERS = 500;

function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const earthRadius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return (
    2 *
    earthRadius *
    Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  );
}

function calculateClusters(issues: Issue[]): Cluster[] {
  const mapped = issues.filter(
    (issue) =>
      typeof issue.latitude === "number" &&
      typeof issue.longitude === "number" &&
      Number.isFinite(issue.latitude) &&
      Number.isFinite(issue.longitude)
  );

  const visited = new Set<string>();
  const clusters: Cluster[] = [];

  for (const seed of mapped) {
    if (visited.has(seed.id)) continue;

    const cluster: Issue[] = [];
    const queue = [seed];
    visited.add(seed.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      cluster.push(current);

      for (const candidate of mapped) {
        if (visited.has(candidate.id)) continue;

        const distance = distanceMeters(
          current.latitude!,
          current.longitude!,
          candidate.latitude!,
          candidate.longitude!
        );

        if (distance <= CLUSTER_RADIUS_METERS) {
          visited.add(candidate.id);
          queue.push(candidate);
        }
      }
    }

    if (cluster.length < 2) continue;

    const totalWeight = cluster.reduce(
      (sum, issue) => sum + Math.max(issue.priority_score, 0),
      0
    );

    const riskScore = Math.min(
      100,
      (totalWeight / cluster.length) *
        (1 + Math.min(cluster.length - 1, 5) * 0.08)
    );

    const latitude =
      cluster.reduce((sum, issue) => sum + issue.latitude!, 0) /
      cluster.length;

    const longitude =
      cluster.reduce((sum, issue) => sum + issue.longitude!, 0) /
      cluster.length;

    const radiusMeters = Math.max(
      ...cluster.map((issue) =>
        distanceMeters(
          latitude,
          longitude,
          issue.latitude!,
          issue.longitude!
        )
      )
    );

    clusters.push({
      latitude,
      longitude,
      issues: cluster,
      riskScore,
      criticalCount: cluster.filter(
        (issue) => issue.priority_level === "Critical"
      ).length,
      highCount: cluster.filter(
        (issue) => issue.priority_level === "High"
      ).length,
      radiusMeters,
    });
  }

  return clusters.sort((a, b) => b.riskScore - a.riskScore);
}

function riskLabel(score: number) {
  if (score >= 75) return "Critical";
  if (score >= 55) return "High";
  if (score >= 35) return "Medium";
  return "Low";
}

function riskClass(label: string) {
  switch (label) {
    case "Critical":
      return "border-red-400/20 bg-red-400/10 text-red-300";
    case "High":
      return "border-orange-400/20 bg-orange-400/10 text-orange-300";
    case "Medium":
      return "border-yellow-400/20 bg-yellow-400/10 text-yellow-300";
    default:
      return "border-green-400/20 bg-green-400/10 text-green-300";
  }
}

export default function RiskHotspots({ issues }: { issues: Issue[] }) {
  const clusters = useMemo(() => calculateClusters(issues), [issues]);

  const mappedCount = issues.filter(
    (issue) =>
      typeof issue.latitude === "number" &&
      typeof issue.longitude === "number"
  ).length;

  if (clusters.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8">
        <p className="font-semibold text-white">
          No multi-issue hotspot detected yet.
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Hotspots appear when at least two GPS-tagged issues occur within
          approximately 500 meters of each other.
        </p>
        <p className="mt-4 text-xs text-slate-600">
          {mappedCount} GPS-tagged issue{mappedCount === 1 ? "" : "s"} currently
          available for clustering.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {clusters.slice(0, 6).map((cluster, index) => {
        const label = riskLabel(cluster.riskScore);

        return (
          <div
            key={`${cluster.latitude}-${cluster.longitude}-${index}`}
            className="rounded-2xl border border-white/10 bg-slate-900/60 p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500">
                  Hotspot #{index + 1}
                </p>
                <h3 className="mt-2 text-lg font-bold">
                  {cluster.issues.length} nearby issues
                </h3>
              </div>

              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${riskClass(
                  label
                )}`}
              >
                {label}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Risk" value={cluster.riskScore.toFixed(1)} />
              <Metric label="Critical" value={String(cluster.criticalCount)} />
              <Metric label="High" value={String(cluster.highCount)} />
              <Metric
                label="Radius"
                value={`${Math.round(cluster.radiusMeters)}m`}
              />
            </div>

            <div className="mt-5 border-t border-white/5 pt-4">
              <p className="text-xs text-slate-500">Cluster center</p>
              <p className="mt-1 font-mono text-xs text-slate-300">
                {cluster.latitude.toFixed(6)}, {cluster.longitude.toFixed(6)}
              </p>
            </div>

            <div className="mt-4 space-y-2">
              {cluster.issues.slice(0, 4).map((issue) => (
                <div
                  key={issue.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {issue.damage_type}
                    </p>
                    <p className="text-xs text-slate-600">{issue.status}</p>
                  </div>

                  <span className="shrink-0 text-xs font-semibold text-slate-300">
                    {issue.priority_score}/100
                  </span>
                </div>
              ))}
            </div>

            {cluster.issues.length > 4 && (
              <p className="mt-3 text-xs text-slate-600">
                +{cluster.issues.length - 4} more issues in this hotspot
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <p className="text-[11px] uppercase tracking-wider text-slate-600">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-slate-200">{value}</p>
    </div>
  );
}
