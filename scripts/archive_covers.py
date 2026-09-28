"""Save referenced book-cover art in this project and record its source.

Run with: python3 scripts/archive_covers.py
Requires Pillow. Run with --verify to check the local archive without network access.
"""

import concurrent.futures
import hashlib
import io
import json
import pathlib
import sys
import time
import urllib.request

from PIL import Image, ImageOps


ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data.json"
COVER_DIR = ROOT / "covers"
MANIFEST_PATH = COVER_DIR / "manifest.json"


def inspect(path):
    payload = path.read_bytes()
    with Image.open(io.BytesIO(payload)) as image:
        image.load()
        width, height = image.size
    if width < 30 or height < 40:
        raise ValueError(f"too small: {width}x{height}")
    return {
        "path": path.relative_to(ROOT).as_posix(),
        "sha256": hashlib.sha256(payload).hexdigest(),
        "width": width,
        "height": height,
    }


def download(book):
    cover_id = book["id"]
    url = book["cover"]
    target = COVER_DIR / f"{cover_id}.jpg"
    if target.exists():
        return cover_id, {**inspect(target), "source": url}
    error = None
    for attempt in range(3):
        try:
            request = urllib.request.Request(
                url, headers={"User-Agent": "BooksPersonalLibrary/1.0 (personal cover archive)"}
            )
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = response.read(12_000_001)
            if len(payload) > 12_000_000:
                raise ValueError("cover exceeds 12 MB")
            with Image.open(io.BytesIO(payload)) as original:
                original.load()
                if original.width < 30 or original.height < 40:
                    raise ValueError(f"too small: {original.width}x{original.height}")
                image = ImageOps.exif_transpose(original).convert("RGB")
                output = io.BytesIO()
                image.save(output, format="JPEG", quality=92, optimize=True)
            temporary = target.with_suffix(".jpg.tmp")
            temporary.write_bytes(output.getvalue())
            temporary.replace(target)
            return cover_id, {**inspect(target), "source": url}
        except Exception as cause:
            error = cause
            time.sleep(1 + attempt * 2)
    return cover_id, {"error": str(error), "source": url}


def main():
    data = json.loads(DATA_PATH.read_text())
    books = data["books"]
    previous = json.loads(MANIFEST_PATH.read_text()) if MANIFEST_PATH.exists() else {}
    entries = {}
    remote = []
    failed = []

    for book in books:
        cover = book.get("cover", "")
        if not cover:
            continue
        if cover.startswith("covers/"):
            path = ROOT / cover
            try:
                entry = inspect(path)
                prior = previous.get(str(book["id"]), {})
                if "--verify" in sys.argv and prior.get("sha256") != entry["sha256"]:
                    raise ValueError("checksum differs from cover manifest")
                entries[str(book["id"])] = {**entry, "source": prior.get("source")}
            except Exception as cause:
                failed.append((book["id"], str(cause)))
        elif "--verify" in sys.argv:
            failed.append((book["id"], "cover still depends on an external URL"))
        else:
            remote.append(book)

    if remote:
        COVER_DIR.mkdir(exist_ok=True)
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            for index, (cover_id, result) in enumerate(pool.map(download, remote), 1):
                if "error" in result:
                    failed.append((cover_id, result["error"]))
                else:
                    entries[str(cover_id)] = result
                    next(book for book in books if book["id"] == cover_id)["cover"] = result["path"]
                if index % 50 == 0 or index == len(remote):
                    print(f"Archived {index}/{len(remote)} external covers", flush=True)

    if "--verify" not in sys.argv:
        DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
        MANIFEST_PATH.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n")
    elif len(entries) != len(previous):
        failed.append(("manifest", "cover count differs from manifest"))

    print(f"Verified {len(entries)} local covers; {len(failed)} failures")
    for cover_id, error in failed:
        print(f"  {cover_id}: {error}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
