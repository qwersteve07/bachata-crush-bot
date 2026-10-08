#!/bin/sh
# Usage: download.sh <list.tsv> <out-dir>
# list.tsv: one "<filename>\t<image url>" per line. Use a fresh scratchpad
# folder as out-dir; the images are only needed to read them, not to keep.
set -e
list="$1"
out="$2"
mkdir -p "$out"
tab=$(printf '\t')
while IFS="$tab" read -r name url; do
  [ -n "$name" ] && curl -sfL -o "$out/$name" "$url"
done < "$list"
file "$out"/*
