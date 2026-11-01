# ToF Branch Patcher

A single-file Windows tool that installs a Tower of Fantasy client from scratch or
switches an existing installation to another official branch. The same file is
offered on the [live site](https://tof.smilekritik.beer/) next to the version
tracker.

## Why a BAT file

`ToFPatcher.bat` is a short batch header that starts the PowerShell script stored
in the same file. That choice is deliberate:

- it runs on any Windows PC with the built-in PowerShell, with nothing to install;
- it is about 65 KB;
- it is plain text, so anyone can read exactly what it does before running it.
  There is no compiled executable to trust.

## What it does

1. **Finds the game.** Run it from the game folder or point it at one; it detects
   64-bit (`HottaLaunch`) and legacy 32-bit (`WmGpLaunch`) launchers up to two
   levels deep and never follows junctions.
2. **Reads the current state** from `Config.ini`, the local PatcherSDK cache and
   `PatcherConfig.json`.
3. **Offers the branches** grouped as live (Global, Korea, Taiwan), test and
   development servers sorted by resource version, and China (live, CBT).
4. **Resolves the selected branch online.** It reads each launcher's
   `Version.ini` and resource `config.xml` from the official CDNs, tries the next
   official mirror on failure, and accepts downloads only over HTTPS port 443 from
   an allow-list of official hosts.
5. **Writes the launcher configuration** (`Config.ini` as UTF-8 without BOM,
   `PatcherConfig.json`, `gameinstallconfig.xml`), clears the update caches, and
   prepares the official launcher so it accepts the selected branch. The original
   SDK file is kept as a `.orig` backup and every run starts from that clean copy.
6. **Starts the official updater**, which downloads the game files itself.

Game files are never redistributed; everything is downloaded from the publisher's
own servers.

## Tests

```powershell
# Offline: installation detection and target folders, without running the installer
powershell -NoProfile -File tools/tof-client-patcher/tests/ToFPatcher.Tests.ps1

# Branch resolution offline, or against the official endpoints with -Live
powershell -NoProfile -File tools/tof-client-patcher/test-live-versions.ps1
powershell -NoProfile -File tools/tof-client-patcher/test-live-versions.ps1 -Live
```

Both scripts parse the BAT payload and load only the functions under test; they
never run the interactive installer.

## Disclaimer

This is an unofficial fan tool. Switching branches changes your local launcher
configuration and may be against the game's terms of service. Use it at your own
risk.
