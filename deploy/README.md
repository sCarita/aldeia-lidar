# Docker deployment on home.one

The container serves the static documentation with Nginx on port 8080. Its host
port is bound only to `127.0.0.1:8766`. The approximately 6 GB `docs/` tree,
including ignored generated assets, is mounted read-only rather than baked into
the image. Copying Git alone is insufficient for the full viewer.

Deployment directory: `/home/solid/services/lidar` on SSH host `home.one`.
The SSH account must be able to run Docker and configure Tailscale Serve.

From this repository on the machine holding all local assets:

```sh
ssh home.one 'mkdir -p ~/services/lidar/deploy ~/services/lidar/docs'
rsync -rt --partial --bwlimit=3072 --exclude=.DS_Store docs/ home.one:services/lidar/docs/
rsync -t Dockerfile compose.yaml .dockerignore home.one:services/lidar/
rsync -t deploy/nginx.conf home.one:services/lidar/deploy/
ssh home.one 'cd ~/services/lidar && docker compose up -d --build --wait'
```

This transfer is incremental and does not delete destination files. Keep the
dataset manifests, packets, provenance and imagery together. After updating a
dataset, verify its checksums; avoid changing data during active viewing.

Add the new Tailscale handler without resetting existing Serve/Funnel routes:

```sh
ssh home.one 'tailscale serve --bg --https=443 --set-path=/lidar/ http://127.0.0.1:8766'
```

Open <https://saraivitas-00.tailca6b6.ts.net/lidar/> with Tailscale connected.
The main viewer is at `/lidar/aldeia-da-mata/surface.html`. `/lidar/index.html`
opens the explainer, and `/lidar/aldeia-da-mata/analysis-parish/` opens patches.

[Tailscale Serve](https://tailscale.com/docs/reference/tailscale-cli/serve) supplies
HTTPS and tailnet access. The `--bg` route persists across Tailscale restarts.
This deployment does not enable Funnel or change unrelated routes. Existing
tailnet access rules still apply. HTTPS also supports browser cryptographic
checks for dataset packets.

Check service health and recent logs:

```sh
ssh home.one 'cd ~/services/lidar && docker compose ps && docker compose logs --tail=30'
ssh home.one 'curl -fsS http://127.0.0.1:8766/healthz && tailscale serve status'
```

From the source machine with matching local data, run an HTTPS/data check:

```sh
python3 scripts/check-deployment-http.py https://saraivitas-00.tailca6b6.ts.net/lidar/ --include-analysis
```

If development continues locally during deployment, add `--code-ref REVISION`
to compare tracked application files with the fixed deployed revision. The
17 November deployment uses application revision `2bf5f1b8`; local ignored data
must still match its original transfer inventory. New, uncommitted application
features created during that transfer are separate from this deployment.

It checks byte-identical page, script, representative packet and imagery responses,
plus MIME types, byte-range support, health and missing-file behaviour.

On 17 November 2026 the kernel reported SD-card I/O stalls while the initial
unrestricted bulk transfer was active (MMC workqueue waits above 240 seconds).
Pausing the receiver
allowed queued writes to drain. Prioritise the main viewer before the multi-GB
patch archive and use a bounded rsync rate when updating this host. Do not reboot
or change its storage/kernel settings as part of an ordinary site update.
The host kernel also reported that Docker memory limits are unsupported;
the Compose memory limit is enforced only on kernels with the required cgroups.

The deployed image was built from the cached pinned base using the legacy
builder after cancelling the initial stalled BuildKit attempt:

```sh
DOCKER_BUILDKIT=0 docker build -t aldeia-lidar:local .
docker compose up -d --no-build --wait
```

The ordinary BuildKit/Compose command above remains the preferred rebuild path.

To stop this deployment without touching other services:

```sh
ssh home.one 'tailscale serve --https=443 --set-path=/lidar/ off'
ssh home.one 'cd ~/services/lidar && docker compose down'
```

The [official Nginx image](https://hub.docker.com/_/nginx) supports ARM64 for
home.one. `Dockerfile` pins the resolved official 1.30.6 Alpine image digest.
The container runs as nginx with a read-only filesystem,
a temporary filesystem for runtime files and a read-only dataset mount. It
restarts unless explicitly stopped. The image is built on home.one; no image or
dataset is uploaded to a registry.
