#!/bin/bash
set -e

# Accept version as first parameter, default to 1.0.0
VERSION="${1:-1.0.0}"
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
# Clean up backend environment artifacts
rm -f "${TARGET_DIR}/opt/servmanager/backend/data.json"
rm -rf "${TARGET_DIR}/opt/servmanager/backend/scratch"
rm -rf "${TARGET_DIR}/opt/servmanager/backend/__pycache__"

# Only copy compiled frontend assets to avoid including heavy node_modules
mkdir -p "${TARGET_DIR}/opt/servmanager/frontend"
cp -R ../frontend/dist "${TARGET_DIR}/opt/servmanager/frontend/"
cp ../README.md "${TARGET_DIR}/opt/servmanager/"
cp ../servmanager-cli.sh "${TARGET_DIR}/opt/servmanager/"
cp -R DEBIAN/* "${TARGET_DIR}/DEBIAN/"

# Update version dynamically in control file
sed -i "s/^Version:.*/Version: ${VERSION}/" "${TARGET_DIR}/DEBIAN/control"

# Ensure all control scripts are executable and have correct permissions
chmod 0755 "${TARGET_DIR}/DEBIAN/postinst"
if [ -f "${TARGET_DIR}/DEBIAN/prerm" ]; then
  chmod 0755 "${TARGET_DIR}/DEBIAN/prerm"
fi
if [ -f "${TARGET_DIR}/DEBIAN/postrm" ]; then
  chmod 0755 "${TARGET_DIR}/DEBIAN/postrm"
fi

echo "Building Debian Package..."
dpkg-deb --build "${TARGET_DIR}"

echo "Package built successfully: build/${PACKAGE_NAME}.deb"
