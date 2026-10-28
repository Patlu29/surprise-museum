# 0005: Three photo renditions, signed URLs and nearest-first loading

## Status
Accepted (27/10/2026)

## Context
NFR-3 requires the entrance to render within 8 s on 4G with the rest loading nearest-first and never blank. NFR-5 caps delivered photos at 2048 px and about 600 KB. NFR-6 requires a stable 15-minute session on a 2022 phone; twenty 2048 px textures would use over 300 MB of GPU memory.

## Decision
- Store two files per photo: `full.jpg` (2048 px, target 600 KB) for the full-screen viewer, and `wall.jpg` (1024 px, target 200 KB) for the 3D texture. Store a 24 px LQIP data URL in the database and return it inline.
- `get-museum` returns signed URLs valid for 1 hour; the client refreshes them once on expiry.
- A priority queue loads wall textures 3 at a time, ranked by path distance from the Visitor and re-ranked every 0.5 s. The nearest 2 to 4 are prefetched while the welcome screen shows.
- `full.jpg` is only ever loaded into an `<img>` in the viewer, never as a texture.

## Consequences
- A 20-photo museum downloads about 3.5 MB of wall images, and frames are never blank.
- GPU memory stays around 80 MB at worst, with LRU eviction available if needed.
- Upload volume doubles compared with one file, which is still small.
