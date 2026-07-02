"""
Run this from your server folder to see every route FastAPI has registered.
Usage: python3 check_routes.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

# Import your app (adjust if your file is named differently)
from main import app

print("\n=== REGISTERED ROUTES ===\n")
for route in sorted(app.routes, key=lambda r: getattr(r, 'path', '')):
    path = getattr(route, 'path', '')
    methods = getattr(route, 'methods', set()) or set()
    if path and not path.startswith('/openapi') and not path.startswith('/docs') and not path.startswith('/redoc'):
        print(f"  {', '.join(sorted(methods)) or 'GET':8s}  {path}")

print("\n=== SEARCHING FOR SPECIFIC ROUTES ===")
paths = [r.path for r in app.routes if hasattr(r, 'path')]
for target in ['/api/notifications', '/api/dashboard/stats', '/api/teacher/attendance/roster', '/api/discipline']:
    found = target in paths
    print(f"  {'✓' if found else '✗'}  {target}  {'(registered)' if found else '(MISSING)'}")