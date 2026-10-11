"""Build every Wasteland Derby runner model (horse + rider, with embedded horse clips).

    blender -b --factory-startup -P tools/blender/build_runners.py -- .   [stable ...]

Needs the unpacked Synty POLYGON packs + the CC0 Quaternius horse in `.asset-cache/` at the
project root (see README). Writes apps/client/public/assets/runners/<stable>/*.glb and
manifest.json, then run `npm run assets:optimize -- runners/`.

Per stable:  w  = knight.glb       (classic rider, first coat)
             b  = jockey.glb       (second rider, second coat)
             j1..j5 = jockey_jN.glb (extra riders from DERBY_JOCKEYS)
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import build_polygon as bp
from build_factions import log, preview, OUT, QA

RUNNERS = os.path.join(OUT, "runners")


def export(root, objs, stable, file, manifest, look, layout, x, y):
    path = os.path.join(RUNNERS, stable, file)
    bp.export_piece(root, objs, path, horse=True)
    manifest["runners"].setdefault(stable, {})[look] = {"file": f"runners/{stable}/{file}", "node": root.name, "clips": bp.KNIGHT_CLIPS}
    layout[root.name] = (x, y)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 30
    rig, meshes = bp.setup_polygon()
    only = [a for a in bp.bf.ARGS[1:] if not a.startswith("--")]
    mpath = os.path.join(OUT, "manifest.json")
    try:
        manifest = json.load(open(mpath))
    except Exception:
        manifest = {}
    manifest.setdefault("version", 1)
    manifest.setdefault("runners", {})
    layout = {}
    for fi, stable in enumerate(bp.ROSTER):
        if only and stable not in only: continue
        coat_a, coat_b = bp.ROSTER[stable]["coat"]
        specs = [("w", "knight.glb", "rider", coat_a, None), ("b", "jockey.glb", "jockey", coat_b, None)]
        specs += [(f"j{i}", f"jockey_j{i}.glb", "jockey", coat, (char, wep)) for i, (char, wep, coat) in enumerate(bp.DERBY_JOCKEYS.get(stable, []), start=1)]
        for xi, (look, file, who, coat, spec) in enumerate(specs):
            try:
                root, objs = bp.build_mount(rig, meshes, stable, who, coat, f"{stable}_{look}", spec=spec)
                export(root, objs, stable, file, manifest, look, layout, xi * 1.4 - 4.0, fi * 1.8)
            except Exception as e:
                import traceback; traceback.print_exc()
                log("FAILED", stable, look, e)
    with open(mpath, "w") as f:
        json.dump(manifest, f, indent=2)
    log("manifest written")
    preview(layout, os.path.join(QA, "runners_preview.png"))


if __name__ == "__main__":
    main()
