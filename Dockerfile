# syntax=docker/dockerfile:1

FROM rust:1-slim-bookworm AS build
# Le binaire résout assets/ et les certificats par défaut depuis CARGO_MANIFEST_DIR :
# on compile dans /app pour que ces chemins existent tels quels à l'exécution.
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src src
COPY migrations migrations
COPY benches benches
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release --locked --bin lumyx-sfu \
    && cp target/release/lumyx-sfu /usr/local/bin/lumyx-sfu

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 lumyx
WORKDIR /app
COPY --from=build /usr/local/bin/lumyx-sfu /usr/local/bin/lumyx-sfu
COPY assets assets
USER lumyx

# TLS est terminé par le reverse proxy ; le média passe en UDP sur une plage fixe.
ENV SFU_BIND_ADDR=0.0.0.0:3000 \
    SFU_TLS=false \
    SFU_UDP_PORT_MIN=40000 \
    SFU_UDP_PORT_MAX=40099 \
    SFU_SERVE_TEST_CLIENT=false \
    SFU_LOG=info
EXPOSE 3000/tcp 40000-40099/udp
ENTRYPOINT ["lumyx-sfu"]
