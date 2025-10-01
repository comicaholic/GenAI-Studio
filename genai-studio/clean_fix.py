import os
import json

frontend_dir = os.path.join(os.getcwd(), "frontend")
src_dir = os.path.join(frontend_dir, "src")
tsconfig_path = os.path.join(frontend_dir, "tsconfig.json")
package_json_path = os.path.join(frontend_dir, "package.json")

# 1. Clean emitted artifacts
removed = []
for root, _, files in os.walk(src_dir):
    for f in files:
        if f.endswith((".js", ".js.map", ".d.ts")):
            full_path = os.path.join(root, f)
            os.remove(full_path)
            removed.append(full_path)

print(f"Removed {len(removed)} emitted files")
if removed:
    print("Example removed:", removed[:5])

# 2. Ensure tsconfig.json has noEmit: true
if os.path.exists(tsconfig_path):
    with open(tsconfig_path) as f:
        tsconfig = json.load(f)
else:
    tsconfig = {"compilerOptions": {}, "include": ["src"]}

tsconfig.setdefault("compilerOptions", {})
tsconfig["compilerOptions"]["noEmit"] = True

with open(tsconfig_path, "w") as f:
    json.dump(tsconfig, f, indent=2)
print("Updated tsconfig.json with noEmit: true")

# 3. Update package.json build script
if os.path.exists(package_json_path):
    with open(package_json_path) as f:
        pkg = json.load(f)
    scripts = pkg.setdefault("scripts", {})
    if "build" in scripts:
        scripts["build"] = "tsc --noEmit && vite build"
    else:
        scripts["build"] = "tsc --noEmit && vite build"
    pkg["scripts"] = scripts
    with open(package_json_path, "w") as f:
        json.dump(pkg, f, indent=2)
    print("Updated package.json build script")
else:
    print("No package.json found, skipped updating build script")
