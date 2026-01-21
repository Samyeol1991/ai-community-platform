#!/bin/bash
# Post-build script to copy Python moderation script to dist folder

echo "Copying Python moderation script to dist..."
cp server/check_moderation.py dist/check_moderation.py
chmod +x dist/check_moderation.py
echo "✓ Python script copied successfully"
