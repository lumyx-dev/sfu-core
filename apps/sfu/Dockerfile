# Image du SFU. Contexte de build : la racine du depot.
ARG RUST_VERSION=1.98

FROM rust:${RUST_VERSION}-slim-bookworm AS build
WORKDIR /app

# aws-lc-sys, le backend cryptographique de rustls, se compile depuis ses
# sources C. D'ou cmake/clang/perl -- et d'ou Debian plutot qu'Alpine, ou ce
# meme paquet se construit mal sur musl.
RUN apt-get update \
    && apt-get install -y --no-install-recommends cmake clang perl pkg-config \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY apps/sfu apps/sfu

# Deux caches BuildKit : le registre cargo et le repertoire de compilation.
# Le binaire est copie hors de target/ dans le meme RUN -- un montage de cache
# ne survit pas a l'etape, contrairement a une couche.
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release -p lumyx-sfu \
    && cp target/release/lumyx-sfu /usr/local/bin/lumyx-sfu

FROM debian:bookworm-slim AS runtime

# openssl genere le certificat auto-signe, curl sert au healthcheck.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /usr/local/bin/lumyx-sfu /usr/local/bin/lumyx-sfu

# Le client de test est resolu depuis CARGO_MANIFEST_DIR, fige a la
# compilation : l'image d'execution doit donc reproduire le chemin de build.
# Les migrations, elles, sont embarquees dans le binaire par sqlx::migrate!.
WORKDIR /app/apps/sfu
COPY apps/sfu/assets assets

COPY apps/sfu/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
