#!/bin/bash

# Fix Nuxt hot-reload/cache layout issues
# Run this when you see layout problems after making changes

echo "🔧 Fixing Nuxt cache and layout issues..."

# Clear Nuxt cache
rm -rf .nuxt
echo "✅ Cleared .nuxt folder"

# Clear Vite cache
rm -rf node_modules/.vite
echo "✅ Cleared Vite cache"

# Clear general cache
rm -rf node_modules/.cache
echo "✅ Cleared node_modules cache"

echo ""
echo "✨ Cache cleared! Now:"
echo "   1. Stop your dev server (Ctrl+C)"
echo "   2. Run: npm run dev"
echo "   3. Hard refresh your browser (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)"
echo ""

