# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for VoiceFlow server binary."""

import platform
from PyInstaller.utils.hooks import collect_all

block_cipher = None

# Collect all data and binaries from key packages
datas = []
binaries = []
hiddenimports = []

# MLX and parakeet dependencies
for pkg in ['mlx', 'parakeet_mlx', 'huggingface_hub', 'safetensors', 'tokenizers']:
    try:
        pkg_datas, pkg_binaries, pkg_hiddenimports = collect_all(pkg)
        datas += pkg_datas
        binaries += pkg_binaries
        hiddenimports += pkg_hiddenimports
    except Exception:
        pass

# Additional hidden imports
hiddenimports += [
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'uvloop',
    'httptools',
    'websockets',
    'soundfile',
    'numpy',
    'numba',
]

a = Analysis(
    ['src/voiceflow_server/server.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='voiceflow-server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch='arm64' if platform.machine().lower() == 'arm64' else 'x86_64',
    codesign_identity=None,
    entitlements_file=None,
)
