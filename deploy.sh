#!/bin/bash

# TechScope CLI Deployment Script
echo "🚀 Deploying TechScope CLI to npm..."

# Check if we're in the right directory
if [ ! -f "src/newscope-cli.js" ]; then
    echo "❌ Error: src/newscope-cli.js not found. Make sure you're in the project root."
    exit 1
fi

# Check if npm is logged in
if ! npm whoami > /dev/null 2>&1; then
    echo "❌ Error: Not logged in to npm. Please run 'npm login' first."
    exit 1
fi

# Create a temporary package.json for CLI
echo "📦 Creating CLI package.json..."
cat > package-cli.json << 'EOF'
{
  "name": "techscope-cli",
  "version": "1.0.4",
  "description": "Terminal-based tech news reader with smart clustering",
  "type": "module",
  "main": "src/newscope-cli.js",
  "bin": {
    "techscope": "src/newscope-cli.js"
  },
  "files": [
    "src/newscope-cli.js",
    "src/appscope-cli.js",
    "README-CLI.md"
  ],
      "keywords": [
      "cli",
      "news",
      "terminal",
      "tech",
      "hacker-news",
      "developer",
      "tools",
      "apps"
    ],
    "author": "TechScope",
  "license": "MIT",
  "dependencies": {
    "commander": "^14.0.0",
    "node-fetch": "^3.3.2",
    "open": "^10.2.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

# Backup original package.json
echo "📦 Backing up original package.json..."
cp package.json package.json.backup

# Use CLI-specific package.json
echo "🔄 Switching to CLI package.json..."
cp package-cli.json package.json

# Install CLI dependencies
echo "📥 Installing CLI dependencies..."
npm install

# Test the CLI
echo "🧪 Testing CLI..."
if node src/newscope-cli.js --help > /dev/null 2>&1; then
    echo "✅ CLI test passed!"
else
    echo "❌ CLI test failed!"
    cp package.json.backup package.json
    rm package-cli.json
    exit 1
fi

# Publish to npm
echo "📤 Publishing to npm..."
npm publish

# Restore original package.json
echo "🔄 Restoring original package.json..."
cp package.json.backup package.json
rm package-cli.json

echo "🎉 TechScope CLI published successfully!"
echo "📋 Users can now install with: npm install -g techscope-cli"
echo "🔗 Usage: techscope --help"
