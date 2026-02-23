"use client";

import { useEffect, useRef, useState } from "react";

type StatusResponse = {
  running: boolean;
  pid: number | null;
  command: string;
};

type ReadyResponse = {
  ready: boolean;
  errors: string[];
  command: string;
};

type HealthResponse = {
  service?: string;
  status?: string;
  ai?: string;
  opencv_version?: string;
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const nodeControllerBase = process.env.NEXT_PUBLIC_NODE_CONTROLLER_URL ?? "http://localhost:3001";
const faceServiceBase = process.env.NEXT_PUBLIC_FACE_SERVICE_URL ?? "http://localhost:8000";

export default function HomePage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [readyState, setReadyState] = useState<ReadyResponse | null>(null);
  const [backendHealth, setBackendHealth] = useState<HealthResponse | null>(null);
  const [faceHealth, setFaceHealth] = useState<HealthResponse | null>(null);
  const [nodeHealth, setNodeHealth] = useState<HealthResponse | null>(null);
  const [message, setMessage] = useState<string>("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [wsState, setWsState] = useState<string>("disconnected");
  const [wsMessage, setWsMessage] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  async function fetchStatus() {
    const response = await fetch(`${apiBase}/api/status`);
    const body = await response.json();
    setStatus(body);
  }

  async function fetchBackendHealth() {
    const response = await fetch(`${apiBase}/health`);
    const body = await response.json();
    setBackendHealth(body);
  }

  async function fetchFaceHealth() {
    const response = await fetch(`${faceServiceBase}/ai/health`);
    const body = await response.json();
    setFaceHealth(body);
  }

  async function fetchNodeControllerHealth() {
    const response = await fetch(`${nodeControllerBase}/run-ai`);
    const body = await response.json();
    setNodeHealth(body);
  }

  async function refreshAll() {
    setLoading(true);
    try {
      await Promise.all([
        fetchBackendHealth(),
        fetchFaceHealth(),
        fetchNodeControllerHealth(),
        fetchStatus(),
        fetchReady()
      ]);
      setMessage("Refreshed all services");
    } catch {
      setMessage("One or more services unavailable");
    } finally {
      setLoading(false);
    }
  }

  function connectGatewayWs() {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl =
      process.env.NEXT_PUBLIC_GATEWAY_WS_URL ??
      apiBase.replace(/^http/i, "ws") + "/ws/control";

    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;
    setWsState("connecting");

    socket.onopen = () => {
      setWsState("connected");
      socket.send(JSON.stringify({ type: "frame", source: "nextjs-ui", ts: Date.now() }));
    };

    socket.onmessage = (event) => {
      setWsMessage(typeof event.data === "string" ? event.data : "binary message");
    };

    socket.onerror = () => {
      setWsState("error");
    };

    socket.onclose = () => {
      setWsState("disconnected");
    };
  }

  function disconnectGatewayWs() {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setWsState("disconnected");
  }

  async function callControl(path: "start" | "stop") {
    const response = await fetch(`${apiBase}/api/${path}`, { method: "POST" });
    const body = await response.json();
    setMessage(`${path.toUpperCase()}: ${body.status}`);
    await fetchStatus();
    await fetchReady();
  }

  async function fetchReady() {
    const response = await fetch(`${apiBase}/api/ready`);
    const body = await response.json();
    setReadyState(body);

    if (!body.ready && Array.isArray(body.errors) && body.errors.length > 0) {
      setMessage(`Readiness: ${body.errors.join(" | ")}`);
    }
  }

  async function loadDevices() {
    const list = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = list.filter((d) => d.kind === "videoinput");
    setDevices(videoInputs);
    if (!selectedDeviceId && videoInputs.length > 0) {
      setSelectedDeviceId(videoInputs[0].deviceId);
    }
  }

  async function startPreview(deviceId?: string) {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: deviceId ? { deviceId: { exact: deviceId } } : true,
      audio: false
    });

    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }

  useEffect(() => {
    refreshAll().catch(() => setMessage("Service refresh unavailable"));

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        return loadDevices();
      })
      .catch(() => setMessage("Camera permission denied"));

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (selectedDeviceId) {
      startPreview(selectedDeviceId).catch(() => setMessage("Failed to start camera preview"));
    }
  }, [selectedDeviceId]);

  return (
    <main>
      <h1>VideoFaceLive Dashboard</h1>

      <div className="card">
        <h2>System Overview</h2>
        <button className="secondary" onClick={refreshAll} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh All"}
        </button>
        <div className="status">
          <div>Backend API: {backendHealth?.status ?? "offline"}</div>
          <div>Face AI Service: {faceHealth?.ai ?? faceHealth?.status ?? "offline"}</div>
          <div>Node Controller /run-ai: {nodeHealth?.status ?? "offline"}</div>
          <div>OpenCV: {faceHealth?.opencv_version ?? "-"}</div>
          <small>{message}</small>
        </div>
      </div>

      <div className="card">
        <h2>Realtime Gateway Channel (WebSocket)</h2>
        <button className="primary" onClick={connectGatewayWs}>Connect WS</button>
        <button className="warn" onClick={disconnectGatewayWs}>Disconnect WS</button>
        <div className="status">
          <div>WS State: {wsState}</div>
          <div>Last WS Message:</div>
          <small>{wsMessage || "-"}</small>
        </div>
      </div>

      <div className="card">
        <h2>DeepFaceLive Controller</h2>
        <button
          className="primary"
          onClick={() => callControl("start")}
          disabled={!readyState?.ready}
          title={!readyState?.ready ? "Fix readiness issues before starting" : ""}
        >
          Start Face Swap
        </button>
        <button className="warn" onClick={() => callControl("stop")}>Stop Face Swap</button>
        <button
          className="secondary"
          onClick={async () => {
            await refreshAll();
          }}
        >
          Refresh Controller
        </button>

        <div className="status">
          <div>Ready: {String(readyState?.ready ?? false)}</div>
          <div>Running: {String(status?.running ?? false)}</div>
          <div>PID: {status?.pid ?? "-"}</div>
          <div>Command: {readyState?.command ?? status?.command ?? "-"}</div>
          <small>{message}</small>
        </div>
      </div>

      <div className="card">
        <h2>Camera / Virtual Camera Preview</h2>
        <p>
          Select your OBS Virtual Camera (or any webcam), then use this same camera source in Zoom/Meet/Teams.
        </p>

        <select
          value={selectedDeviceId}
          onChange={(event) => setSelectedDeviceId(event.target.value)}
          style={{ width: "100%", marginBottom: "0.75rem", padding: "0.5rem" }}
        >
          {devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>

        <video ref={videoRef} autoPlay playsInline muted />
      </div>
    </main>
  );
}
