 "use client";

import { useEffect, useMemo } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Issue = {
  id: string;
  damage_type: string;
  confidence: number;
  severity: string;
  priority_score: number;
  priority_level: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  location: string | null;
  duplicate_status: string | null;
};


const CLUSTER_RADIUS_METERS = 500;

type Hotspot = {
  latitude: number;
  longitude: number;
  issueCount: number;
  riskScore: number;
  priorityLevel: string;
  radiusMeters: number;
};

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

function calculateHotspots(issues: Issue[]): Hotspot[] {
  const mapped = issues.filter(
    (issue) =>
      typeof issue.latitude === "number" &&
      typeof issue.longitude === "number" &&
      Number.isFinite(issue.latitude) &&
      Number.isFinite(issue.longitude)
  );

  const visited = new Set<string>();
  const hotspots: Hotspot[] = [];

  for (const seed of mapped) {
    if (visited.has(seed.id)) continue;

    const cluster: Issue[] = [];
    const queue = [seed];
    visited.add(seed.id);

    while (queue.length) {
      const current = queue.shift()!;
      cluster.push(current);

      for (const candidate of mapped) {
        if (visited.has(candidate.id)) continue;

        if (
          distanceMeters(
            current.latitude!,
            current.longitude!,
            candidate.latitude!,
            candidate.longitude!
          ) <= CLUSTER_RADIUS_METERS
        ) {
          visited.add(candidate.id);
          queue.push(candidate);
        }
      }
    }

    if (cluster.length < 2) continue;

    const latitude =
      cluster.reduce((sum, issue) => sum + issue.latitude!, 0) /
      cluster.length;

    const longitude =
      cluster.reduce((sum, issue) => sum + issue.longitude!, 0) /
      cluster.length;

    const averagePriority =
      cluster.reduce(
        (sum, issue) => sum + Math.max(issue.priority_score, 0),
        0
      ) / cluster.length;

    const riskScore = Math.min(
      100,
      averagePriority *
        (1 + Math.min(cluster.length - 1, 5) * 0.08)
    );

    const priorityLevel =
      riskScore >= 75
        ? "Critical"
        : riskScore >= 55
          ? "High"
          : riskScore >= 35
            ? "Medium"
            : "Low";

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

    hotspots.push({
      latitude,
      longitude,
      issueCount: cluster.length,
      riskScore,
      priorityLevel,
      radiusMeters: Math.max(75, Math.min(500, radiusMeters + 50)),
    });
  }

  return hotspots.sort((a, b) => b.riskScore - a.riskScore);
}

function hotspotColor(priority: string) {
  switch (priority) {
    case "Critical":
      return "#ef4444";
    case "High":
      return "#f97316";
    case "Medium":
      return "#eab308";
    default:
      return "#22c55e";
  }
}

function MapViewport({
  points,
}: {
  points: Array<[number, number]>;
}) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }

    map.fitBounds(L.latLngBounds(points), {
      padding: [40, 40],
      maxZoom: 15,
    });
  }, [map, points]);

  return null;
}

function markerColor(priority: string) {
  switch (priority) {
    case "Critical":
      return "#ef4444";
    case "High":
      return "#f97316";
    case "Medium":
      return "#eab308";
    case "Low":
      return "#22c55e";
    default:
      return "#94a3b8";
  }
}

export default function IssueMap({ issues }: { issues: Issue[] }) {
  const mappedIssues = useMemo(
    () =>
      issues.filter(
        (issue) =>
          typeof issue.latitude === "number" &&
          typeof issue.longitude === "number" &&
          Number.isFinite(issue.latitude) &&
          Number.isFinite(issue.longitude)
      ),
    [issues]
  );

  const points = useMemo(
    () =>
      mappedIssues.map(
        (issue) => [issue.latitude!, issue.longitude!] as [number, number]
      ),
    [mappedIssues]
  );

  const center: [number, number] =
    points.length > 0 ? points[0] : [23.072197, 76.859911];

  const hotspots = useMemo(
    () => calculateHotspots(mappedIssues),
    [mappedIssues]
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60">
      <div className="relative">
        <MapContainer
          center={center}
          zoom={13}
          scrollWheelZoom
          className="h-[480px] w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapViewport points={points} />

          {hotspots.map((hotspot, index) => (
            <Circle
              key={`hotspot-${index}`}
              center={[hotspot.latitude, hotspot.longitude]}
              radius={hotspot.radiusMeters}
              pathOptions={{
                color: hotspotColor(hotspot.priorityLevel),
                fillColor: hotspotColor(hotspot.priorityLevel),
                fillOpacity: 0.12,
                weight: 2,
                dashArray: "6 6",
              }}
            >
              <Popup>
                <div className="min-w-[190px] text-slate-900">
                  <h3 className="font-bold">Civic Risk Hotspot</h3>
                  <div className="mt-2 space-y-1 text-sm">
                    <p>
                      <strong>Level:</strong>{" "}
                      {hotspot.priorityLevel}
                    </p>
                    <p>
                      <strong>Risk Score:</strong>{" "}
                      {hotspot.riskScore.toFixed(1)}
                    </p>
                    <p>
                      <strong>Nearby Issues:</strong>{" "}
                      {hotspot.issueCount}
                    </p>
                    <p>
                      <strong>Radius:</strong>{" "}
                      {Math.round(hotspot.radiusMeters)} m
                    </p>
                  </div>
                </div>
              </Popup>
            </Circle>
          ))}

          {mappedIssues.map((issue) => (
            <CircleMarker
              key={issue.id}
              center={[issue.latitude!, issue.longitude!]}
              radius={Math.max(7, Math.min(16, issue.priority_score / 7))}
              pathOptions={{
                color: markerColor(issue.priority_level),
                fillColor: markerColor(issue.priority_level),
                fillOpacity: 0.75,
                weight: 2,
              }}
            >
              <Popup>
                <div className="min-w-[210px] text-slate-900">
                  <h3 className="font-bold">{issue.damage_type}</h3>

                  <div className="mt-2 space-y-1 text-sm">
                    <p>
                      <strong>Priority:</strong>{" "}
                      {issue.priority_level}
                    </p>
                    <p>
                      <strong>Score:</strong>{" "}
                      {issue.priority_score}/100
                    </p>
                    <p>
                      <strong>Severity:</strong>{" "}
                      {issue.severity}
                    </p>
                    <p>
                      <strong>Status:</strong>{" "}
                      {issue.status}
                    </p>
                    <p>
                      <strong>Duplicate:</strong>{" "}
                      {issue.duplicate_status || "Not analyzed"}
                    </p>
                    <p>
                      <strong>Location:</strong>{" "}
                      {issue.location || "GPS coordinates"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {issue.latitude!.toFixed(6)},{" "}
                      {issue.longitude!.toFixed(6)}
                    </p>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        <div className="absolute bottom-4 left-4 z-[1000] rounded-xl border border-white/10 bg-slate-950/90 px-4 py-3 text-xs shadow-xl backdrop-blur">
          <p className="mb-2 font-semibold text-white">
            Priority Legend
          </p>
          {hotspots.length > 0 && (
            <p className="mb-2 text-[11px] text-slate-400">
              Dashed circles = {hotspots.length} hotspot
              {hotspots.length === 1 ? "" : "s"}
            </p>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-slate-300">
            {[
              ["Critical", "#ef4444"],
              ["High", "#f97316"],
              ["Medium", "#eab308"],
              ["Low", "#22c55e"],
            ].map(([label, color]) => (
              <span key={label} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 px-5 py-4 text-sm text-slate-400">
        {mappedIssues.length} issue
        {mappedIssues.length === 1 ? "" : "s"} mapped
        {issues.length > mappedIssues.length &&
          ` • ${issues.length - mappedIssues.length} without GPS coordinates`}
      </div>
    </div>
  );
}
