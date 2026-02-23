import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import http from "node:http";
import { WebSocket, WebSocketServer } from "ws";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const faceServiceUrl = process.env.FACE_SERVICE_URL ?? "http://localhost:8000";
const faceServiceWsUrl = process.env.FACE_SERVICE_WS_URL ?? "ws://localhost:8000/ws/infer";
const apiGatewayToken = process.env.API_GATEWAY_TOKEN ?? "";

const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  if (!apiGatewayToken || req.path === "/health") {
    return next();
  }

  const providedToken = req.header("x-api-key");
  if (providedToken !== apiGatewayToken) {
    return res.status(401).json({ status: "unauthorized", message: "Invalid API key" });
  }

  next();
});

async function forwardFaceService(path: string, method: "GET" | "POST") {
  const response = await fetch(`${faceServiceUrl}${path}`, {
    method,
    headers: { "content-type": "application/json" }
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  return {
    ok: response.ok,
    status: response.status,
    body
  };
}

app.get("/health", (_req: Request, res: Response) => {
  res.json({ service: "backend", status: "ok", mode: "api-gateway" });
});

app.get("/api/stream/config", (_req: Request, res: Response) => {
  res.json({
    gateway_ws: `ws://localhost:${port}/ws/control`,
    upstream_ws: faceServiceWsUrl,
    protocols: ["REST", "WebSocket"]
  });
});

app.get("/api/status", async (_req: Request, res: Response) => {
  try {
    const result = await forwardFaceService("/status", "GET");
    res.status(result.status).json(result.body);
  } catch (error) {
    res.status(502).json({
      status: "error",
      message: "Face service unavailable",
      detail: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.get("/api/ready", async (_req: Request, res: Response) => {
  try {
    const result = await forwardFaceService("/ready", "GET");
    res.status(result.status).json(result.body);
  } catch (error) {
    res.status(502).json({
      ready: false,
      errors: ["Face service unavailable"],
      detail: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.post("/api/start", async (_req: Request, res: Response) => {
  try {
    const result = await forwardFaceService("/start", "POST");
    res.status(result.status).json(result.body);
  } catch (error) {
    res.status(502).json({
      status: "error",
      message: "Failed to start face pipeline",
      detail: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.post("/api/stop", async (_req: Request, res: Response) => {
  try {
    const result = await forwardFaceService("/stop", "POST");
    res.status(result.status).json(result.body);
  } catch (error) {
    res.status(502).json({
      status: "error",
      message: "Failed to stop face pipeline",
      detail: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

const wss = new WebSocketServer({ server, path: "/ws/control" });

wss.on("connection", (clientSocket, req) => {
  if (apiGatewayToken) {
    const requestUrl = new URL(req.url ?? "/", `http://localhost:${port}`);
    const token = requestUrl.searchParams.get("token") ?? "";
    if (token !== apiGatewayToken) {
      clientSocket.send(JSON.stringify({ status: "unauthorized", message: "Invalid token" }));
      clientSocket.close(1008, "Unauthorized");
      return;
    }
  }

  const upstreamSocket = new WebSocket(faceServiceWsUrl);

  upstreamSocket.on("open", () => {
    clientSocket.send(
      JSON.stringify({ status: "connected", gateway: "ok", upstream: faceServiceWsUrl })
    );
  });

  upstreamSocket.on("message", (data) => {
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(data.toString());
    }
  });

  upstreamSocket.on("error", (error) => {
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(
        JSON.stringify({ status: "error", message: "Upstream websocket error", detail: error.message })
      );
    }
  });

  clientSocket.on("message", (data) => {
    if (upstreamSocket.readyState === WebSocket.OPEN) {
      upstreamSocket.send(data.toString());
    }
  });

  clientSocket.on("close", () => {
    if (upstreamSocket.readyState === WebSocket.OPEN) {
      upstreamSocket.close();
    }
  });

  upstreamSocket.on("close", () => {
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.close();
    }
  });
});

server.listen(port, () => {
  console.log(`Backend API gateway listening on :${port}`);
});
