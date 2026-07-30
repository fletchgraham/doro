#!/bin/bash
# Build DoroPOC.app — a minimal macOS app bundle testing Spaces integration for Doro.
set -euo pipefail
cd "$(dirname "$0")"

APP=DoroPOC.app
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"

swiftc -O -swift-version 5 -o "$APP/Contents/MacOS/DoroPOC" DoroPOC/main.swift
cp Info.plist "$APP/Contents/Info.plist"

# Ad-hoc signature: its hash changes EVERY build, and the Accessibility grant in
# System Settings is tied to it. After any rebuild you must re-grant:
#   tccutil reset Accessibility com.fletchgraham.doro-poc
# then relaunch and approve the prompt. (A real dev certificate would fix this.)
codesign --force --sign - "$APP"

echo "Built $APP — launch with: open $(pwd)/$APP"
echo "NOTE: if this replaced a previous build, re-grant Accessibility (see comment in build.sh)"
