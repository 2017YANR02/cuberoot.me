#!/bin/sh

# Run this script from the main folder (../../)

darkhttpd web/http \
  --header 'Cross-Origin-Opener-Policy: same-origin' \
  --header 'Cross-Origin-Embedder-Policy: require-corp' \
  --mimetypes web/http/mime
