import argparse
from pathlib import Path

import cv2


def collect_video_files(source: Path) -> list[Path]:
    if source.is_file():
        return [source]

    video_extensions = {".mp4", ".mov", ".mkv", ".avi", ".webm"}
    return sorted([path for path in source.rglob("*") if path.suffix.lower() in video_extensions])


def extract_frames(video_path: Path, output_dir: Path, frame_step: int, prefix: str, start_index: int) -> int:
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        return start_index

    frame_index = 0
    saved_index = start_index

    while True:
        success, frame = capture.read()
        if not success:
            break

        if frame_index % frame_step == 0:
            output_file = output_dir / f"{prefix}_{saved_index:06d}.jpg"
            cv2.imwrite(str(output_file), frame)
            saved_index += 1

        frame_index += 1

    capture.release()
    return saved_index


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Video file or directory containing videos")
    parser.add_argument("--output", default="workspace/data_src", help="Output image directory")
    parser.add_argument("--frame-step", type=int, default=5, help="Save every Nth frame")
    parser.add_argument("--prefix", default="src", help="Prefix for saved image names")
    args = parser.parse_args()

    source = Path(args.input).expanduser().resolve()
    output_dir = Path(args.output).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    video_files = collect_video_files(source)
    if not video_files:
        raise SystemExit(f"No video files found in: {source}")

    saved_index = 0
    for video_file in video_files:
        saved_index = extract_frames(video_file, output_dir, args.frame_step, args.prefix, saved_index)

    print(f"Saved {saved_index} frames to {output_dir}")


if __name__ == "__main__":
    main()
