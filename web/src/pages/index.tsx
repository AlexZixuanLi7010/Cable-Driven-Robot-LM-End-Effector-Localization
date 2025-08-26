// web/src/pages/index.tsx
import { useMemo, useState } from "react";
import Scene3D from "../components/Scene3D";

type OptimizeResult = {
  pose: number[];         // [x,y,z,roll,pitch,yaw]
  error: number;          // final error
  iterations: number;     // number of LM iterations
  residuals?: number[];   // per-iteration error (optional, used for chart)
};

export default function Dashboard() {
  // --- Default geometry (replace with your real numbers any time) ---
  const anchors = useMemo(
    () => [
      [-828.274, -438.224, 440.767],
      [-828.274, 1374.676, 669.367],
      [860.051, 1374.676, 669.367],
      [860.051, -438.224, 440.767],
      [-828.274, -438.224, 1990.167],
      [-828.274, 1374.676, 2002.867],
      [860.051, 1374.676, 2002.867],
      [860.051, -438.224, 1990.167],
    ],
    []
  );

  const attachments = useMemo(
    () => [
      [141.471, 7.176, 30.883],
      [141.863, 47.235, 263.421],
      [-101.83, 21.458, 264.398],
      [-106.124, -13.145, 18.728],
      [144.041, 77.969, 41.493],
      [76.834, 107.235, 258.215],
      [-85.543, 85.865, 247.866],
      [-164.557, 47.587, 57.891],
    ],
    []
  );

  // --- UI state ---
  const [cables, setCables] = useState(
    // mm list matching your earlier numbers
    "1086.46,1149.21,1251.04,1182.61,1332.51,1464.13,1534.88,1384.17"
  );
  const [guess, setGuess] = useState("0,0,0,0,0,0");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const parsedCables = useMemo(
    () => cables.split(",").map((s) => parseFloat(s.trim())).filter((v) => Number.isFinite(v)),
    [cables]
  );
  const parsedGuess = useMemo(
    () => guess.split(",").map((s) => parseFloat(s.trim())).filter((v) => Number.isFinite(v)),
    [guess]
  );

  async function runOptimize() {
    setLoading(true);
    setErrorMsg(null);
    setResult(null);

    const query = `
      mutation($input: OptimizeInput!) {
        optimize(input: $input) {
          pose
          error
          iterations
          residuals
        }
      }
    `;

    const variables = {
      input: {
        anchors,
        attachments,
        cableLengths: parsedCables,
        initialGuess: parsedGuess,
      },
    };

    try {
      const res = await fetch("/api/graphql", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, variables }),
      });
      const json = await res.json();

      if (json.errors?.length) {
        setErrorMsg(json.errors[0].message || "GraphQL error");
        return;
      }
      if (!json.data?.optimize) {
        setErrorMsg("Unexpected response from API. Check server logs.");
        return;
      }

      setResult(json.data.optimize as OptimizeResult);
    } catch (err: any) {
      setErrorMsg(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  // --- Simple SVG chart of residuals ---
  const Chart = ({ residuals }: { residuals: number[] }) => {
    if (!residuals || residuals.length === 0) return null;

    const W = 520;
    const H = 180;
    const pad = 24;
    const xs = residuals.map((_, i) => i + 1);
    const maxY = Math.max(...residuals);
    const minY = Math.min(...residuals);

    const x = (i: number) =>
      pad + ((W - 2 * pad) * (i - 1)) / (residuals.length - 1 || 1);
    const y = (v: number) =>
      H - pad - ((H - 2 * pad) * (v - minY)) / (maxY - minY || 1);

    const path = residuals
      .map((v, idx) => `${idx === 0 ? "M" : "L"} ${x(idx + 1)} ${y(v)}`)
      .join(" ");

    return (
      <svg width={W} height={H} style={{ display: "block", borderTop: "1px solid #eee" }}>
        {/* x-axis */}
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#e5e7eb" />
        {/* y-axis */}
        <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="#e5e7eb" />
        {/* path */}
        <path d={path} fill="none" stroke="#111827" strokeWidth={2} />
        {/* dots */}
        {residuals.map((v, idx) => (
          <circle key={idx} cx={x(idx + 1)} cy={y(v)} r={2.5} fill="#111827" />
        ))}
        {/* labels */}
        <text x={pad} y={14} fill="#6b7280" fontSize={11}>
          Error per iteration
        </text>
      </svg>
    );
  };

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>
        LM Solver — Optimization Dashboard
      </h1>
      <p style={{ color: "#6b7280", marginBottom: 18 }}>
        Run Levenberg–Marquardt pose optimization for a cable-driven rig. Results are stored for review.
      </p>

      {/* Inputs */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 14,
          marginBottom: 16,
        }}
      >
        <label style={{ fontWeight: 700, display: "block", marginBottom: 8 }}>
          Cable Lengths (mm)
        </label>
        <input
          value={cables}
          onChange={(e) => setCables(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            fontFamily: "monospace",
          }}
        />
        <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 6 }}>
          Expected 8 values, e.g. <i>1086.46,1149.21,1251.04,1182.61,1332.51,1464.13,1534.88,1384.17</i>
        </div>

        <label style={{ fontWeight: 700, display: "block", marginTop: 14, marginBottom: 8 }}>
          Initial Guess [x, y, z, roll, pitch, yaw]
        </label>
        <input
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            fontFamily: "monospace",
          }}
          placeholder="0,0,0,0,0,0"
        />
        <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 6 }}>
          6 values (x,y,z in mm; roll,pitch,yaw in radians), e.g. <i>0,0,0,0,0,0</i>
        </div>

        <button
          onClick={runOptimize}
          disabled={loading || parsedCables.length !== 8 || parsedGuess.length !== 6}
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 8,
            background: "#111827",
            color: "white",
            border: "none",
            cursor: "pointer",
            opacity:
              loading || parsedCables.length !== 8 || parsedGuess.length !== 6 ? 0.6 : 1,
          }}
        >
          {loading ? "Running…" : "Run Solver"}
        </button>

        {errorMsg && (
          <div style={{ color: "#b91c1c", marginTop: 10, fontSize: 14 }}>{errorMsg}</div>
        )}
      </div>

      {/* Results + 3D */}
      {result && (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 14,
            display: "grid",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            <div>
              <div style={{ color: "#6b7280", fontSize: 13 }}>Iterations</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{result.iterations}</div>
            </div>
            <div>
              <div style={{ color: "#6b7280", fontSize: 13 }}>Final Error</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {result.error.toExponential(5)}
              </div>
            </div>
            <div style={{ minWidth: 280 }}>
              <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 4 }}>
                Pose [x, y, z, φ, θ, ψ]
              </div>
              <code
                style={{
                  padding: "8px 10px",
                  display: "inline-block",
                  background: "#f9fafb",
                  border: "1px solid #eef2f7",
                  borderRadius: 8,
                }}
              >
                {result.pose.map((v) => (Math.abs(v) < 1e-4 ? 0 : +v.toFixed(4))).join(", ")}
              </code>
            </div>
          </div>

          {/* Error chart */}
          {Array.isArray(result.residuals) && result.residuals.length > 0 && (
            <Chart residuals={result.residuals} />
          )}

          {/* 3D visualization */}
          <div style={{ marginTop: 8 }}>
            <h3 style={{ margin: "6px 0 8px 0" }}>3D Visualization</h3>
            <Scene3D anchors={anchors} attachments={attachments} pose={result.pose} />
          </div>

          {/* Raw JSON */}
          <pre
            style={{
              background: "#f9fafb",
              padding: 12,
              borderRadius: 10,
              border: "1px solid #eef2f7",
              fontSize: 12,
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
