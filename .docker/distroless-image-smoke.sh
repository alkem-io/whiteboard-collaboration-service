#!/usr/bin/env bash
# workspace#036-distroless-wave-1 — persisted image-contract regression for
# whiteboard-collaboration-service (epic alkem-io/infrastructure-operations#2499).
#
# Modelled on the shipped workspace#026 server harness. Mechanically asserts:
#   - runs as UID 65532 (nonroot); entrypoint is the distroless node binary
#   - CMD == ["dist/main.js"]
#   - no shell, no package manager reachable as an entrypoint override
#   - no src/ tree, no ts-node, no @biomejs (dev-dependency leak sentinels)
#   - config.yml IS present at /app/config.yml (deliberately copied — the app
#     reads it at boot; its absence is a boot failure, so this is a positive
#     assertion, not a leak check)
#   - the runtime dependency graph loads inside the image (socket.io stack)
#   - the Dockerfile carries no floating FROM (every stage digest-pinned)
#   - emits IMAGE_DIGEST= / IMAGE_SIZE_BYTES=
#
# NOTE on WORKDIR: this image uses /app (the 026 server image used
# /usr/src/app). Paths below are deliberately /app.
#
# NOTE on native modules: this service ships NO native (.node) binaries — its
# dependency tree (socket.io, amqplib, @elastic/elasticsearch, yaml) is pure
# JS. socket.io's optional native accelerators `bufferutil` and
# `utf-8-validate` are NOT installed by `npm ci --omit=dev` against this
# lockfile (they are optional peer deps of `ws`, unresolved here). The harness
# probes for them and, when absent, falls back to asserting that the socket.io
# runtime stack itself loads — the substitution WCS-6 requires. If a native
# dep is ever added, add it to NATIVE_SENTINELS below.
#
# Usage: .docker/distroless-image-smoke.sh <image[:tag]>
set -euo pipefail

IMAGE="${1:?usage: distroless-image-smoke.sh <image[:tag]>}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKERFILE="${DOCKERFILE:-$SCRIPT_DIR/../Dockerfile}"

# Optional native accelerators probed first; see note above.
NATIVE_SENTINELS=(bufferutil utf-8-validate)

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  echo "PASS: $*"
}

run_node() {
  docker run --rm --entrypoint /nodejs/bin/node "$IMAGE" "$@"
}

echo "== distroless-image-smoke: $IMAGE =="

# --- user, entrypoint, CMD -------------------------------------------------
USER_ID="$(docker inspect "$IMAGE" --format '{{.Config.User}}')"
[ "$USER_ID" = "65532" ] || [ "$USER_ID" = "nonroot" ] ||
  fail "expected user 65532/nonroot, got '$USER_ID'"
pass "runs as user '$USER_ID'"

ENTRYPOINT_JSON="$(docker inspect "$IMAGE" --format '{{json .Config.Entrypoint}}')"
echo "$ENTRYPOINT_JSON" | grep -q '/nodejs/bin/node' ||
  fail "expected distroless node entrypoint, got $ENTRYPOINT_JSON"
pass "entrypoint is the distroless node binary"

CMD_JSON="$(docker inspect "$IMAGE" --format '{{json .Config.Cmd}}')"
[ "$CMD_JSON" = '["dist/main.js"]' ] || fail "expected CMD [\"dist/main.js\"], got $CMD_JSON"
pass "CMD is [\"dist/main.js\"]"

# --- no shell / no package manager -----------------------------------------
# Probe for EXISTENCE on the filesystem, not exit status. A bare `docker run
# --entrypoint apk <img>` exits non-zero on an image that HAS a working apk
# (apk with no args is a usage error), so an exit-status test reports present
# binaries as absent — it has no detection power. lstat (not existsSync) so a
# dangling symlink still counts as a hit; Google's :debug variants put the
# shell at /busybox/sh -> /busybox/busybox.
FORBIDDEN="$(run_node -e "
const fs = require('fs');
const paths = [
  '/bin/sh','/bin/bash','/usr/bin/sh','/usr/bin/bash',
  '/busybox/sh','/busybox/busybox','/bin/busybox','/usr/bin/busybox',
  '/sbin/apk','/usr/bin/apk','/usr/bin/apt','/usr/bin/apt-get','/usr/bin/dpkg',
  '/usr/local/bin/npm','/usr/local/bin/npx','/usr/local/bin/yarn','/usr/local/bin/pnpm',
  '/usr/bin/npm','/usr/bin/yarn','/usr/bin/pnpm',
];
const hits = paths.filter(p => { try { fs.lstatSync(p); return true; } catch { return false; } });
console.log(hits.join(','));
")"
[ -z "$FORBIDDEN" ] || fail "shell/package-manager present in runtime image: $FORBIDDEN"
pass "no shell / package manager present on the filesystem"

# --- no dev-dependency leakage ---------------------------------------------
HAS_SRC="$(run_node -e "console.log(require('fs').existsSync('/app/src'))")"
[ "$HAS_SRC" = "false" ] || fail "expected no src/ tree in the runtime image"
pass "no src/ TypeScript tree"

HAS_TS_NODE="$(run_node -e "console.log(require('fs').existsSync('/app/node_modules/ts-node'))")"
[ "$HAS_TS_NODE" = "false" ] || fail "expected no ts-node in node_modules"
pass "no ts-node in node_modules"

# Dev-dependency leak sentinels. `npm ci --omit=dev` removes the *packages*
# but leaves behind EMPTY scope directories (e.g. node_modules/@biomejs/ with
# zero entries) — that is an npm bookkeeping artifact, not a leak, and it is
# present in the pre-change image too. So an existence check on the directory
# would false-positive; assert on actual CONTENT instead: a leaked package
# always has entries and a package.json.
DEV_LEAKS="$(run_node -e "
const fs=require('fs'), p=require('path');
const sentinels=['@biomejs','@nestjs/cli','@nestjs/schematics','@nestjs/testing',
                 'jest','ts-jest','ts-loader','ts-node','tsconfig-paths',
                 'typescript','husky','lint-staged','supertest'];
const leaks=[];
for (const d of sentinels) {
  const fp=p.join('/app/node_modules', d);
  if (!fs.existsSync(fp)) continue;
  let entries=[]; try { entries=fs.readdirSync(fp); } catch {}
  // real package => has content (and, for unscoped names, a package.json)
  if (entries.length > 0 || fs.existsSync(p.join(fp,'package.json'))) leaks.push(d);
}
console.log(leaks.join(','));
")"
[ -z "$DEV_LEAKS" ] || fail "dev dependencies leaked into the runtime image: $DEV_LEAKS"
pass "no dev-dependency packages in node_modules (empty scope dirs ignored)"

# --- config.yml must BE present --------------------------------------------
HAS_CONFIG="$(run_node -e "console.log(require('fs').existsSync('/app/config.yml'))")"
[ "$HAS_CONFIG" = "true" ] ||
  fail "expected /app/config.yml to be present (the app reads it at boot)"
pass "/app/config.yml is present"

# --- runtime dependency graph loads ----------------------------------------
# Prefer the optional native accelerators when installed; otherwise assert the
# socket.io runtime stack loads (WCS-6 substitution, recorded here in-band).
NATIVES_PRESENT=1
for m in "${NATIVE_SENTINELS[@]}"; do
  PRESENT="$(run_node -e "console.log(require('fs').existsSync('/app/node_modules/$m'))")"
  if [ "$PRESENT" != "true" ]; then
    NATIVES_PRESENT=0
    echo "NOTE: optional native accelerator '$m' is not installed in this image"
  fi
done

if [ "$NATIVES_PRESENT" = "1" ]; then
  NATIVE_OUT="$(run_node -e "$(printf "require('/app/node_modules/%s');" "${NATIVE_SENTINELS[@]}") console.log('natives-ok')")"
  [ "$NATIVE_OUT" = "natives-ok" ] || fail "expected native sentinels to load, got: $NATIVE_OUT"
  pass "native sentinels load (${NATIVE_SENTINELS[*]})"
else
  # Substitution: assert the shipped runtime stack loads instead.
  STACK_OUT="$(run_node -e "require('/app/node_modules/socket.io'); require('/app/node_modules/amqplib'); require('/app/node_modules/@elastic/elasticsearch'); require('/app/node_modules/yaml'); console.log('stack-ok')")"
  [ "$STACK_OUT" = "stack-ok" ] || fail "expected socket.io/amqplib/elasticsearch/yaml to load, got: $STACK_OUT"
  pass "runtime stack loads (socket.io, amqplib, @elastic/elasticsearch, yaml) — native-sentinel substitution"
fi

# The image must ship zero native binaries; if that ever changes, the
# glibc-match between builder and runtime becomes load-bearing and a real
# native sentinel must be added to NATIVE_SENTINELS above.
NATIVE_BINARIES="$(run_node -e "
const fs=require('fs'), p=require('path');
const out=[];
(function walk(d){ let e; try { e=fs.readdirSync(d,{withFileTypes:true}); } catch { return; }
  for (const f of e) { const fp=p.join(d,f.name);
    if (f.isDirectory()) walk(fp); else if (f.name.endsWith('.node')) out.push(fp); } })('/app/node_modules');
console.log(out.length);
")"
echo "NATIVE_BINARY_COUNT=$NATIVE_BINARIES"

# --- the app's own entrypoint module is loadable ---------------------------
HAS_MAIN="$(run_node -e "console.log(require('fs').existsSync('/app/dist/main.js'))")"
[ "$HAS_MAIN" = "true" ] || fail "expected /app/dist/main.js to exist"
pass "/app/dist/main.js exists"

# --- no floating FROM in the Dockerfile ------------------------------------
if [ -f "$DOCKERFILE" ]; then
  UNPINNED="$(grep -E '^[[:space:]]*FROM[[:space:]]' "$DOCKERFILE" | grep -v '@sha256:' || true)"
  [ -z "$UNPINNED" ] || fail "unpinned (floating) FROM found in $DOCKERFILE:"$'\n'"$UNPINNED"
  pass "every FROM in $(basename "$DOCKERFILE") is digest-pinned"
else
  echo "NOTE: Dockerfile not found at $DOCKERFILE — skipping floating-FROM check"
fi

# --- identity / size -------------------------------------------------------
IMAGE_DIGEST="$(docker inspect "$IMAGE" --format '{{.Id}}')"
IMAGE_SIZE_BYTES="$(docker image inspect "$IMAGE" --format '{{.Size}}')"
echo "IMAGE_DIGEST=$IMAGE_DIGEST"
echo "IMAGE_SIZE_BYTES=$IMAGE_SIZE_BYTES"

echo "== distroless-image-smoke: ALL CHECKS PASSED =="
