import argparse
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


def zip_folder(source_dir: Path, zip_path: Path) -> None:
    if not source_dir.exists() or not source_dir.is_dir():
        raise FileNotFoundError(f"Directory not found: {source_dir}")

    with ZipFile(zip_path, "w", compression=ZIP_DEFLATED) as archive:
        for path in sorted(source_dir.rglob("*")):
            if path.is_file():
                archive.write(path, arcname=path.relative_to(source_dir.parent))


def main() -> None:
    parser = argparse.ArgumentParser(description="Package DeepFaceLab datasets for Colab upload")
    parser.add_argument("--src", default="/tmp/data_src", help="Path to data_src directory")
    parser.add_argument("--dst", default="/tmp/data_dst", help="Path to data_dst directory")
    parser.add_argument("--out", default="/tmp", help="Output directory for zip files")
    args = parser.parse_args()

    src_dir = Path(args.src).expanduser().resolve()
    dst_dir = Path(args.dst).expanduser().resolve()
    out_dir = Path(args.out).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    src_zip = out_dir / "data_src.zip"
    dst_zip = out_dir / "data_dst.zip"

    zip_folder(src_dir, src_zip)
    zip_folder(dst_dir, dst_zip)

    print(f"Created: {src_zip}")
    print(f"Created: {dst_zip}")


if __name__ == "__main__":
    main()
