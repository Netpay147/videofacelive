import os
import shlex
import shutil
import subprocess
from typing import Optional

import cv2
from fastapi import FastAPI
from fastapi import WebSocket
from fastapi import WebSocketDisconnect
from pydantic import BaseModel

app = FastAPI(title="videofacelive-face-service")

_process: Optional[subprocess.Popen] = None


class StatusResponse(BaseModel):
    running: bool
    pid: Optional[int]
    command: str


class ReadyResponse(BaseModel):
    ready: bool
    workdir_exists: bool
    command_executable_exists: bool
    model_path_exists: bool
    command: str
    workdir: str
    model_path: str
    errors: list[str]


def _command() -> str:
    return os.getenv("DEEPFACELIVE_CMD", "python -m app.deepfacelive_stub")


def _workdir() -> str:
    return os.getenv("DEEPFACELIVE_WORKDIR", "/app")


def _model_path() -> str:
    return os.getenv("MODEL_PATH", "/app/models")


def _command_executable_exists(command: str) -> bool:
    try:
        parts = shlex.split(command)
    except ValueError:
        return False

    if not parts:
        return False

    executable = parts[0]
    if os.path.isabs(executable) or executable.startswith(".") or "/" in executable:
        return os.path.isfile(executable) and os.access(executable, os.X_OK)

    return shutil.which(executable) is not None


def _readiness() -> ReadyResponse:
    command = _command()
    workdir = _workdir()
    model_path = _model_path()

    workdir_exists = os.path.isdir(workdir)
    command_executable_exists = _command_executable_exists(command)
    model_path_exists = os.path.exists(model_path)

    errors: list[str] = []
    if not workdir_exists:
        errors.append("DEEPFACELIVE_WORKDIR does not exist")
    if not command_executable_exists:
        errors.append("DEEPFACELIVE_CMD executable was not found")
    if not model_path_exists:
        errors.append("MODEL_PATH does not exist")

    ready = len(errors) == 0

    return ReadyResponse(
        ready=ready,
        workdir_exists=workdir_exists,
        command_executable_exists=command_executable_exists,
        model_path_exists=model_path_exists,
        command=command,
        workdir=workdir,
        model_path=model_path,
        errors=errors,
    )


@app.get("/health")
def health():
    return {"service": "face-service", "status": "ok"}


@app.get("/ai/health")
def ai_health():
    return {"service": "face-service", "ai": "ok", "opencv_version": cv2.__version__}


@app.websocket("/ws/infer")
async def ws_infer(websocket: WebSocket):
    await websocket.accept()
    await websocket.send_json(
        {
            "status": "connected",
            "engine": "deepface-model-engine",
            "capabilities": ["face-detection", "face-swap", "motion-tracking"],
        }
    )

    try:
        while True:
            payload = await websocket.receive_text()
            await websocket.send_json(
                {
                    "status": "processed",
                    "stage": "gpu-inference",
                    "received": payload,
                    "output": "processed-video-frame",
                }
            )
    except WebSocketDisconnect:
        return


@app.get("/status", response_model=StatusResponse)
def status():
    global _process
    running = _process is not None and _process.poll() is None
    pid = _process.pid if running and _process else None
    return {"running": running, "pid": pid, "command": _command()}


@app.get("/ready", response_model=ReadyResponse)
def ready():
    return _readiness()


@app.post("/start")
def start():
    global _process

    readiness = _readiness()
    if not readiness.ready:
        return {
            "status": "not_ready",
            "errors": readiness.errors,
            "command": readiness.command,
            "workdir": readiness.workdir,
            "model_path": readiness.model_path,
        }

    if _process is not None and _process.poll() is None:
        return {"status": "already_running", "pid": _process.pid, "command": _command()}

    cmd = shlex.split(_command())
    _process = subprocess.Popen(cmd, cwd=_workdir())

    return {"status": "started", "pid": _process.pid, "command": _command()}


@app.post("/stop")
def stop():
    global _process

    if _process is None or _process.poll() is not None:
        return {"status": "not_running"}

    _process.terminate()
    try:
        _process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        _process.kill()
        _process.wait(timeout=5)

    pid = _process.pid
    _process = None
    return {"status": "stopped", "pid": pid}
