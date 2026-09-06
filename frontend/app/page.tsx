"use client";

import { useState } from "react";

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const getLocation = (): Promise<{
    latitude: number;
    longitude: number;
  }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by this browser."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          setLatitude(lat);
          setLongitude(lng);

          resolve({
            latitude: lat,
            longitude: lng,
          });
        },
        (error) => {
          console.error("Location error:", error);
          reject(
            new Error(
              error.code === error.PERMISSION_DENIED
                ? "Location permission was denied. Please allow location access and try again."
                : "Unable to get your current location. Please try again."
            )
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  };

  const handleFileChange = (file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file.");
      return;
    }

    setSelectedFile(file);
    setError(null);
    setResult(null);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      alert("Please select an image first.");
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      // Get the citizen's current GPS location before submitting the issue.
      const currentLocation = await getLocation();

      const formData = new FormData();

      formData.append("file", selectedFile);
      formData.append("description", description);
      formData.append("location", location);

      formData.append("latitude", currentLocation.latitude.toString());
      formData.append("longitude", currentLocation.longitude.toString());

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/issues/analyze`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Analysis failed.");
      }

      setResult(data);
    } catch (error) {
      console.error(error);
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong while analyzing the image."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Navbar */}
      <nav className="border-b border-white/10 bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 font-black text-slate-950">
              C
            </div>

            <div>
              <h1 className="text-lg font-bold tracking-tight">
                CivicPulse <span className="text-cyan-400">AI</span>
              </h1>
              <p className="text-xs text-slate-400">
                Intelligent Civic Infrastructure
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
            <a href="#report" className="transition hover:text-cyan-400">
              Report Issue
            </a>
            <a href="#how-it-works" className="transition hover:text-cyan-400">
              How It Works
            </a>
            <a href="#about" className="transition hover:text-cyan-400">
              About
            </a>
          </div>

          <button className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium transition hover:bg-white/10">
            Authority Login
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-20 lg:px-8 lg:pb-28 lg:pt-28">
          <div className="max-w-4xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-sm text-cyan-300">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              AI-powered civic intelligence
            </div>

            <h2 className="text-5xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
              Report problems.
              <br />
              <span className="text-cyan-400">
                Prove they were fixed.
              </span>
            </h2>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-400">
              CivicPulse AI detects road damage, estimates visual severity,
              prioritizes critical issues, and verifies whether reported
              problems were actually resolved.
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <a
                href="#report"
                className="rounded-xl bg-cyan-400 px-6 py-3.5 text-center font-bold text-slate-950 transition hover:bg-cyan-300"
              >
                Report a Civic Issue
              </a>

              <a
                href="#how-it-works"
                className="rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-center font-semibold transition hover:bg-white/10"
              >
                See How It Works
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Report Section */}
      <section id="report" className="border-t border-white/10 bg-slate-900/60">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="mb-10">
            <p className="text-sm font-semibold uppercase tracking-widest text-cyan-400">
              Citizen Report
            </p>

            <h3 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Report a civic issue
            </h3>

            <p className="mt-3 max-w-2xl text-slate-400">
              Upload a photo of a road or infrastructure problem. CivicPulse
              AI will analyze it and generate an issue assessment.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Upload */}
            <div className="lg:col-span-2">
              <label
                htmlFor="issue-image"
                className="flex min-h-80 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 p-8 text-center transition hover:border-cyan-400/60 hover:bg-slate-950"
              >
                {selectedFile ? (
                  <>
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-cyan-400/10 text-2xl">
                      ✓
                    </div>

                    <p className="font-semibold text-white">
                      {selectedFile.name}
                    </p>

                    <p className="mt-2 text-sm text-slate-400">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>

                    <p className="mt-5 text-sm font-medium text-cyan-400">
                      Click to choose another image
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-400/10 text-3xl">
                      ↑
                    </div>

                    <p className="text-lg font-semibold">
                      Upload issue photo
                    </p>

                    <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
                      Upload a clear image showing the road damage or civic
                      infrastructure problem.
                    </p>

                    <span className="mt-6 rounded-lg bg-white/10 px-5 py-2.5 text-sm font-semibold">
                      Choose Image
                    </span>
                  </>
                )}

                <input
                  id="issue-image"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) =>
                    handleFileChange(event.target.files?.[0] ?? null)
                  }
                />
              </label>
            </div>

            {/* Details */}
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-6">
              <h4 className="text-lg font-semibold">Issue details</h4>

              <div className="mt-6 space-y-5">
                <div>
                  <label className="mb-2 block text-sm text-slate-400">
                    Description
                  </label>

                  <textarea
                    rows={5}
                    placeholder="Describe the problem..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full resize-none rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-400">
                    Location
                  </label>

                  <input
                    type="text"
                    placeholder="Enter location (optional)"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-400"
                  />

                  {latitude !== null && longitude !== null && (
                    <p className="mt-2 text-xs text-emerald-400">
                      GPS location captured: {latitude.toFixed(6)},{" "}
                      {longitude.toFixed(6)}
                    </p>
                  )}
                </div>

                <p className="text-xs leading-5 text-slate-500">
                  Your browser location will be requested when you submit the
                  report so the issue can be placed accurately on the civic map.
                </p>

                <button
                  onClick={handleAnalyze}
                  disabled={!selectedFile || loading}
                  className="w-full rounded-xl bg-cyan-400 px-5 py-3.5 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? "Analyzing..." : "Analyze Issue with AI"}
                </button>

                {error && (
                  <div
                    role="alert"
                    className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-5"
                  >
                    <p className="text-sm font-semibold uppercase tracking-widest text-red-300">
                      Analysis Error
                    </p>
                    <p className="mt-2 text-sm leading-6 text-red-200">
                      {error}
                    </p>
                  </div>
                )}

                {result && (!result.detections || result.detections.length === 0) && !error && (
                  <div className="mt-6 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-5">
                    <p className="text-sm font-semibold uppercase tracking-widest text-yellow-300">
                      No Civic Damage Detected
                    </p>
                    <p className="mt-2 text-sm leading-6 text-yellow-200">
                      CivicPulse AI could not identify a supported road-damage class
                      in this image. Try uploading a clearer road-damage photo.
                    </p>
                  </div>
                )}

                {result?.detections?.length > 0 && (
                  <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5">
                    <p className="text-sm font-semibold uppercase tracking-widest text-cyan-400">
                      AI Analysis
                    </p>

                    {result.detections.map((detection: any, index: number) => (
                      <div key={index} className="mt-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Damage</span>
                          <span className="font-semibold">
                            {detection.damage_type}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Confidence</span>
                          <span>{(detection.confidence * 100).toFixed(1)}%</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Severity</span>
                          <span className="font-semibold">
                            {detection.severity}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Priority</span>
                          <span className="font-semibold">
                            {detection.priority_level}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Priority Score</span>
                          <span>{detection.priority_score}/100</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-center text-xs leading-5 text-slate-500">
                  Your image will be analyzed by the CivicPulse AI detection
                  pipeline.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-cyan-400">
              AI Pipeline
            </p>

            <h3 className="mt-3 text-3xl font-bold sm:text-4xl">
              From report to resolution
            </h3>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                number: "01",
                title: "Detect",
                text: "AI analyzes the uploaded image and identifies road damage.",
              },
              {
                number: "02",
                title: "Assess",
                text: "The system estimates visual severity and damage extent.",
              },
              {
                number: "03",
                title: "Prioritize",
                text: "Issues receive a priority score to help authorities focus on critical problems.",
              },
              {
                number: "04",
                title: "Verify",
                text: "Before and after evidence can be compared to verify whether the issue was actually resolved.",
              },
            ].map((item) => (
              <div
                key={item.number}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <span className="text-sm font-bold text-cyan-400">
                  {item.number}
                </span>

                <h4 className="mt-5 text-xl font-bold">{item.title}</h4>

                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature stats */}
      <section id="about" className="border-t border-white/10 bg-slate-900/60">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 p-6">
              <p className="text-3xl font-bold text-cyan-400">4</p>
              <p className="mt-2 text-sm text-slate-400">
                Road damage classes
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 p-6">
              <p className="text-3xl font-bold text-cyan-400">AI</p>
              <p className="mt-2 text-sm text-slate-400">
                Image-based detection
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 p-6">
              <p className="text-3xl font-bold text-cyan-400">24/7</p>
              <p className="mt-2 text-sm text-slate-400">
                Digital issue tracking
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 p-6">
              <p className="text-3xl font-bold text-cyan-400">1</p>
              <p className="mt-2 text-sm text-slate-400">
                Unified civic intelligence platform
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>© 2026 CivicPulse AI</p>
          <p>AI-assisted civic infrastructure monitoring</p>
        </div>
      </footer>
    </main>
  );
}