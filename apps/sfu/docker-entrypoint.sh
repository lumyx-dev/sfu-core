#!/bin/sh
# Garantit un certificat TLS avant de rendre la main au serveur : le SFU ne
# sert qu'en HTTPS, et les navigateurs refusent getUserMedia sans.
set -eu

MKCERT_DIR=/mkcert
CERT="${SFU_CERT_PATH:-/certs/localhost+1.pem}"
KEY="${SFU_KEY_PATH:-/certs/localhost+1-key.pem}"

if [ -f "$MKCERT_DIR/localhost+1.pem" ] && [ -f "$MKCERT_DIR/localhost+1-key.pem" ]; then
    # Les certificats mkcert du depot ont ete montes. Si `mkcert -install` a
    # ete passe sur cette machine, le navigateur ne proteste pas.
    CERT="$MKCERT_DIR/localhost+1.pem"
    KEY="$MKCERT_DIR/localhost+1-key.pem"
    echo "TLS : certificats mkcert montes depuis $MKCERT_DIR"
elif [ -f "$CERT" ] && [ -f "$KEY" ]; then
    echo "TLS : certificat auto-signe deja present ($CERT)"
else
    # Aucune etape prealable n'est demandee a l'utilisateur : on fabrique le
    # certificat ici, une fois, dans un volume. Le navigateur affichera un
    # avertissement a accepter -- le contexte reste securise, WebRTC marche.
    echo "TLS : aucun certificat, generation d'un auto-signe dans $CERT"
    mkdir -p "$(dirname "$CERT")" "$(dirname "$KEY")"
    openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
        -keyout "$KEY" -out "$CERT" \
        -subj "/CN=localhost" \
        -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" 2>/dev/null
fi

SFU_CERT_PATH="$CERT"
SFU_KEY_PATH="$KEY"
export SFU_CERT_PATH SFU_KEY_PATH

# exec : le SFU devient PID 1 et recoit SIGTERM directement, sans quoi
# `docker compose down` attendrait dix secondes avant de le tuer.
exec lumyx-sfu "$@"
