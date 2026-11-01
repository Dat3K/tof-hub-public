===============================================================================
 ToF Exporter - Tower of Fantasy site data update
===============================================================================

SINGLE EXE (default release)
  Copy ToFExporter.exe into a writable folder and double-click it. No
  installation or manual extraction is needed. Bundled tools unpack under
  %TEMP% and are removed when the exporter finishes. GAME_PATH.txt, work and
  output stay next to the EXE.

  Example:  ToFExporter.exe --game-path "D:\Tower of Fantasy" --jobs 4
  Help:     ToFExporter.exe --help

  The rest of this file describes the optional unpacked folder / ZIP release.

HOW TO RUN
  1. Extract the whole folder to a short path, for example D:\tof-update.
     About 10 GB of free space is needed. Windows handles long paths poorly.
  2. Run RUN.bat.
  3. On the first run, pick the game installation folder. Later runs show the
     saved folder: press Enter to keep it, or 2 to choose another.
  4. When it says "Done", the output folder opens with a
     tof-update-<version>-<date> folder. That is the update for the site.
     Run RUN.bat --zip to get a ZIP directly.

  Nothing else needs to be installed: Node.js, the game unpacker, the WebP
  encoder and the image library are all inside this folder. If optional
  UnrealExporter DLLs were not bundled, they are downloaded on first use.
  Later runs are faster because converted images are cached in work\webp-cache.

  The first release is full (about 5 GB). Later releases contain only the
  changes since the previous one (the name ends with -delta). If the previous
  release was never applied to the site, run RUN.bat --full.

OPTIONS (RUN.bat ...)
  --game-path <dir>     game folder, skips the prompt
  --raw <dir>           process an already extracted export
  --full                full release instead of changes only
  --zip                 produce a ZIP instead of a folder
  --baseline <file>     the site's tof-update-manifest.json; pack only changes
  --jobs N              parallel workers (default: all logical CPUs)
  --no-archive          keep output\site\public only, no release folder or ZIP
  --verbose             detailed media conversion diagnostics

PROGRESS AND WORKERS
  Generators, media conversion, file hashing and ZIP packing report progress.
  Long steps print the elapsed time every 15 seconds. Independent generators
  run in parallel and dependent ones run in order, so CPU usage varies with
  the dependency graph and disk speed. --jobs does not affect UnrealExporter's
  own internal scheduling.

WHAT IS INSIDE
  RUN.bat               one-click update
  runtime\node.exe      Node.js 24 LTS
  bin\                  UnrealExporter (with Oodle, zlib-ng, Detex) and cwebp
  config\               extraction rules and runtime checksums
  processors\           game data processors and curated inputs
  generators\           tool page data generators
  site-inputs\          data the game does not contain
  node_modules\sharp    image library used by the generators
  output\               result: site\public, site\pre-release, tof-update-*
  work\                 extracted game files and caches (safe to delete)

REPORTS (output\site\pre-release)
  enemies-without-art.md   enemies shown without a picture, with candidates
  fce-all-bosses.md        all FCE bosses with 4+ mechanics
  fce-new-bosses.md        new FCE bosses with 4+ mechanics
  fce-boss-card-drafts.md  new FCE bosses with ready card drafts
  fce-boss-drafts\*.json   editable drafts, also included in the release
  new-artworks.json        new artworks without an editorial title
  missing-media.json       images the data references but the game lacks

OTHER ENTRY POINTS
  export.bat            extraction only (diagnostics)
  process-existing.bat  process previously prepared files
  validate.bat          validate a game-data folder
===============================================================================
