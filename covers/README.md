# Book cover archive

Each available front cover is stored here as `<book id>.jpg`. `data.json` points to these local files, so the library does not depend on third-party image hosts for its existing covers.

`manifest.json` records each file's SHA-256 checksum, dimensions, and original source URL when known. Run `python3 scripts/archive_covers.py --verify` from the project root to check every file against the manifest. Run the script without `--verify` after adding external cover URLs to `data.json` to archive those new images.

Four records still lack a verified original front cover: 169, 273, 349, and 534. Backs and spines are not in this archive because the available catalog sources did not provide reliable images for them.
