#!/bin/bash
set -e

VERSION="1.0.0"
PACKAGE_NAME="servmanager_${VERSION}_all"
TARGET_DIR="build/${PACKAGE_NAME}"

echo "Compiling React Frontend..."
cd ../frontend
npm install
npm run build
cd ../packaging

echo "Preparing DEB package directory structure..."
mkdir -p "${TARGET_DIR}/opt/servmanager"
mkdir -p "${TARGET_DIR}/DEBIAN"

echo "Copying source files..."
cp -R ../backend "${TARGET_DIR}/opt/servmanager/"
cp -R ../frontend "${TARGET_DIR}/opt/servmanager/"
cp ../README.md "${TARGET_DIR}/opt/servmanager/"
cp -R DEBIAN/* "${TARGET_DIR}/DEBIAN/"

# Ensure postinst is executable
chmod 0755 "${TARGET_DIR}/DEBIAN/postinst"

echo "Building Debian Package..."
dpkg-deb --build "${TARGET_DIR}"

echo "Package built successfully: build/${PACKAGE_NAME}.deb"
