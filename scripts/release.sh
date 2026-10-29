#!/usr/bin/env bash
# Équivalent de `npm version` pour la crate : bump, commit, tag, push.
# Usage : scripts/release.sh <patch|minor|major|X.Y.Z>
set -euo pipefail

bump="${1:?usage: scripts/release.sh <patch|minor|major|X.Y.Z>}"

# Mêmes garde-fous que les repos JS : main propre et à jour.
[ "$(git branch --show-current)" = main ] || { echo "Release depuis main uniquement" >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "Arbre de travail non propre" >&2; exit 1; }
git fetch -q origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "main n'est pas à jour avec origin/main" >&2; exit 1; }

current="$(sed -n 's/^version = "\(.*\)"/\1/p' Cargo.toml | head -1)"
IFS=. read -r major minor patch <<<"$current"
case "$bump" in
  patch) next="$major.$minor.$((patch + 1))" ;;
  minor) next="$major.$((minor + 1)).0" ;;
  major) next="$((major + 1)).0.0" ;;
  [0-9]*.[0-9]*.[0-9]*) next="$bump" ;;
  *) echo "Bump invalide : $bump" >&2; exit 1 ;;
esac

# Mêmes vérifications que la CI.
cargo fmt --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --locked

# Seule la première ligne `version =` (celle de [package]) est modifiée.
sed -i.bak "1,/^version = /s/^version = \".*\"/version = \"$next\"/" Cargo.toml && rm Cargo.toml.bak
cargo update --workspace --offline -q

git commit -q -am "chore(release): v$next"
git tag -a "v$next" -m "v$next"
git push --follow-tags
echo "v$current -> v$next"
