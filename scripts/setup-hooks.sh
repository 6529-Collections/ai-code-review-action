#!/bin/bash
# Setup git hooks for the project

echo "Setting up git hooks..."

# Create the pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
# Pre-commit hook to run yarn build

echo "🔨 Running pre-commit build..."
yarn build

# Check if build was successful
if [ $? -ne 0 ]; then
  echo "❌ Build failed! Commit aborted."
  exit 1
fi

echo "✅ Build successful! Proceeding with commit."
exit 0
EOF

# Make it executable
chmod +x .git/hooks/pre-commit

echo "✅ Pre-commit hook installed successfully!"
echo "ℹ️  The hook will automatically run 'yarn build' before each commit."