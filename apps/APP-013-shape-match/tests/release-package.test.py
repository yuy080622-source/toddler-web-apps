"""Offline ConoHa package preflight. Never executes FTP or a GitHub workflow."""
import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path, PurePosixPath
import re
import shlex
import shutil
import subprocess
import tempfile
from urllib.parse import urljoin, urlsplit, unquote

import yaml  # Verification-only PyYAML; not a runtime dependency.

REPO = Path(__file__).resolve().parents[3]
BASE = "cdfb05b329693ea0850a25de42363d8edfc39708"
WORKFLOW = ".github/workflows/deploy-conoha.yml"
APP = "apps/APP-013-shape-match/"
NEW_FILES = {APP + name for name in ("index.html", "styles.css", "app.js")}


def previous(path):
    return subprocess.check_output(["git", "show", f"{BASE}:{path}"], cwd=REPO)


def workflow_parts(source):
    data = yaml.load(source, Loader=yaml.BaseLoader)
    assert set(data["on"]) == {"push", "workflow_dispatch"}
    assert data["on"]["push"]["branches"] == ["main"], "branch/PR pushes must not deploy"
    steps = data["jobs"]["deploy"]["steps"]
    build = next(s["run"] for s in steps if s["name"] == "Build deployment directory")
    files = shlex.split(re.search(r"public_files=\((.*?)\)", build, re.S)[1])
    assert len(files) == len(set(files)), "no duplicate public paths"
    for file in files:
        p = PurePosixPath(file)
        assert not p.is_absolute() and ".." not in p.parts
        assert not set(p.parts) & {".git", ".github", "docs", "tests", "node_modules"}
        assert p.suffix in {".html", ".css", ".js", ".mp3"}
    return build, files


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []
        self.scripts = []
        self.tags = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.tags.append(tag)
        if tag == "script":
            self.scripts.append(attrs)
        for key in ({"script": "src", "link": "href", "a": "href", "img": "src"}.get(tag),):
            if key and attrs.get(key):
                self.refs.append(attrs[key])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True, help="new/empty local origin directory")
    args = parser.parse_args()
    output = args.output.resolve()
    assert not output.exists() or not any(output.iterdir()), "refuse to overwrite an existing package"
    current = (REPO / WORKFLOW).read_text()
    old = previous(WORKFLOW).decode()
    build, files = workflow_parts(current)
    _, old_files = workflow_parts(old)
    assert set(files) - set(old_files) == NEW_FILES
    assert set(old_files) - set(files) == set(), "preserve all existing public files"
    normalized = current
    for file in NEW_FILES:
        normalized = normalized.replace("            " + file + "\n", "")
    assert normalized == old, "FTP settings, safety checks and workflow triggers stay unchanged"
    for path in set(old_files) - {"index.html", "portal/apps.js"}:
        assert (REPO / path).read_bytes() == previous(path), f"existing asset changed: {path}"
    for name in ("styles.css", "app.js"):
        assert (REPO / APP / name).read_bytes() == previous(APP + name), "game code stays unchanged"
    assert (REPO / APP / "index.html").read_text().split("<body>", 1)[1] == previous(APP + "index.html").decode().split("<body>", 1)[1]

    manifest = []
    with tempfile.TemporaryDirectory(prefix="app013-package-") as directory:
        workspace = Path(directory)
        tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=REPO).decode().split("\0")
        for name in filter(None, tracked):
            source = REPO / name
            assert source.is_file() and not source.is_symlink(), name
            dest = workspace / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, dest)
        # Development and unrelated files must never enter the package.
        for name in ("notes.txt", ".git/not-public", "docs/not-public.md", APP + "tests/not-public.js"):
            dest = workspace / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text("not public")
        subprocess.run(["bash", "-c", build], cwd=workspace, check=True, capture_output=True)
        deployed = workspace / "deploy"
        actual = {p.relative_to(deployed).as_posix() for p in deployed.rglob("*") if p.is_file()}
        assert actual == set(files), "no missing or extra files"
        assert not any(p.is_symlink() for p in deployed.rglob("*"))
        for name in files:
            data = (deployed / name).read_bytes()
            assert data == (REPO / name).read_bytes()
            assert b"/toddler-web-apps/" not in data if not name.endswith(".mp3") else True
            manifest.append({"path": name, "sha256": hashlib.sha256(data).hexdigest()})
            if name.endswith(".html"):
                refs = References()
                refs.feed(data.decode())
                for ref in refs.refs:
                    url = urlsplit(urljoin("https://yulab-web.com/apps/" + name, ref))
                    if url.scheme == "data" or not url.path:
                        continue
                    assert url.netloc == "yulab-web.com", "HTML uses only same-origin resources/links"
                    assert url.path.startswith("/apps/"), "resource must stay under the FTP root URL"
                    target = deployed / unquote(url.path.removeprefix("/apps/"))
                    assert target.is_file() or (target / "index.html").is_file(), (name, ref)
        refs = References()
        refs.feed((deployed / APP / "index.html").read_text())
        for loader in ("ga4", "clarity"):
            tags = [s for s in refs.scripts if s.get("src") == f"../../shared/{loader}.js"]
            assert len(tags) == 1 and tags[0].get("type") == "module", "module URL deduplication"
        assert not set(refs.tags) & {"a", "iframe", "form", "input", "audio", "video"}, "no new child-facing links or controls"
        output.mkdir(parents=True, exist_ok=True)
        shutil.copytree(deployed, output / "apps")
        # Exercise the workflow's missing-file guard, only in the disposable source tree.
        (workspace / APP / "styles.css").unlink()
        missing = subprocess.run(["bash", "-c", build], cwd=workspace, capture_output=True, text=True)
        assert missing.returncode != 0 and APP + "styles.css" in missing.stdout
    report = {"base": BASE, "files": manifest, "count": len(files), "oldAssetsUnchanged": len(old_files) - 2,
              "workflow": "push main or manual dispatch only; no FTP/workflow executed",
              "checks": ["exact allowlist", "existing assets", "resource paths", "module uniqueness", "missing file rejected", "development files excluded"]}
    (output.parent / "package-results.json").write_text(json.dumps(report, indent=2) + "\n")
    print(f"APP-013 release package: PASS ({len(files)} files; {len(old_files) - 2} existing assets unchanged; no FTP)")


if __name__ == "__main__":
    main()
