#!/usr/bin/env python3
"""Entry point — installs deps if needed and starts the FastAPI server."""
import subprocess, sys, os

def main():
    # Install requirements if not present
    try:
        import fastapi, uvicorn, numpy, scipy
    except ImportError:
        print("Installing dependencies...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r",
                               os.path.join(os.path.dirname(__file__), "requirements.txt")])

    import uvicorn
    uvicorn.run("nexus_api.main:app", host="0.0.0.0", port=8000, reload=True,
                log_level="info")

if __name__ == "__main__":
    main()
