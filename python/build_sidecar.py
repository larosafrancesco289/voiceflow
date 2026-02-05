#!/usr/bin/env python3
"""Build the VoiceFlow server as a standalone executable for Tauri sidecar."""

import platform
import subprocess
import sys
from pathlib import Path


def main():
    project_root = Path(__file__).parent
    src_dir = project_root / "src" / "voiceflow_server"
    output_dir = project_root.parent / "apps" / "desktop" / "src-tauri" / "binaries"

    output_dir.mkdir(parents=True, exist_ok=True)

    # Determine platform suffix
    system = platform.system().lower()
    machine = platform.machine().lower()

    if system == "darwin":
        if machine == "arm64":
            suffix = "aarch64-apple-darwin"
        else:
            suffix = "x86_64-apple-darwin"
    elif system == "linux":
        suffix = "x86_64-unknown-linux-gnu"
    elif system == "windows":
        suffix = "x86_64-pc-windows-msvc"
    else:
        suffix = f"{machine}-{system}"

    output_name = f"voiceflow-server-{suffix}"

    print(f"Building VoiceFlow server for {suffix}...")

    # Use uv to run pyinstaller
    cmd = [
        "uv",
        "run",
        "pyinstaller",
        "--onefile",
        "--name",
        output_name,
        "--distpath",
        str(output_dir),
        "--workpath",
        str(project_root / "build"),
        "--specpath",
        str(project_root / "build"),
        "--clean",
        "--noconfirm",
        str(src_dir / "server.py"),
    ]

    try:
        subprocess.run(cmd, check=True, cwd=project_root)
        print(f"Successfully built: {output_dir / output_name}")
    except subprocess.CalledProcessError as e:
        print(f"Build failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
