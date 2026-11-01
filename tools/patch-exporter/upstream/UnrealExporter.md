# UnrealExporter

The exporter reads the game's Unreal Engine archives with [UnrealExporter](https://github.com/luk-gg/UnrealExporter), a self-contained .NET 9 command-line tool built on CUE4Parse. It supports Tower of Fantasy's engine profile (`TowerOfFantasy`).

## Pinned release

| Property | Value |
| --- | --- |
| Version | [`v2.0.0`](https://github.com/luk-gg/UnrealExporter/releases/tag/v2.0.0) |
| Asset | `UnrealExporter-2.0.0.zip` |
| Size | 44,704,818 bytes |
| SHA-256 | `7cf97b4fc66f8007a07b3657a4110542501e8bf5a1d45dc3e4d0ccd5fde82b58` |

The authoritative values are in [`config/runtime.json`](../config/runtime.json). Update the manifest and rebuild the package together; never copy hashes into other files.

## Packaging

1. The packaging step downloads the archive into an ignored cache directory.
2. The SHA-256 is verified before extraction. A mismatch stops packaging.
3. `UnrealExporter.exe`, `libSkiaSharp.dll`, `blake3_dotnet.dll` and `LICENSE.txt` are copied into the portable bundle.

The upstream archive also contains sample key files (`aes.txt`, `olderkeys.txt`). They are **never** shipped. Game extraction keys are restored from the bootstrap package or supplied explicitly at runtime.

No binaries from this release are committed to Git.

## License

UnrealExporter is licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0). Redistribution must keep its copyright notice, a copy of the license (`LICENSE.txt`) and the warranty disclaimer.
