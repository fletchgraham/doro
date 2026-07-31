#!/bin/bash
# Build Doro.app — native macOS doro with Spaces integration.
set -euo pipefail
cd "$(dirname "$0")"

APP=Doro.app
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

swiftc -O -swift-version 5 -o "$APP/Contents/MacOS/Doro" Doro/*.swift
cp Info.plist "$APP/Contents/Info.plist"
cp AppIcon.icns "$APP/Contents/Resources/AppIcon.icns"

# Ad-hoc signature: its hash changes EVERY build, and the Accessibility grant in
# System Settings is tied to it. After any rebuild you must re-grant:
#   tccutil reset Accessibility com.fletchgraham.doro-poc
# then relaunch and approve the prompt. (A real dev certificate would fix this.)
codesign --force --sign - "$APP"

echo "Built $APP — launch with: open $(pwd)/$APP"
echo "NOTE: if this replaced a previous build, re-grant Accessibility (see comment in build.sh)"
