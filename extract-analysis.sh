#!/bin/bash

# Extract analysis log from act output
echo "Extracting complete analysis log from act output..."
echo "This will take ~2 minutes to run the full test..."

# Run act, capture ALL output (including stderr), continue even if job "fails"
yarn test:act 2>&1 > full_output.log || true

echo "Test completed, extracting analysis content..."

# Extract the analysis content - look for lines that contain the analysis output
grep "\[Local Test/test\]   | " full_output.log | sed 's/.*\[Local Test\/test\]   | //' > raw-analysis.txt

# Extract just the clean analysis report (not the code)
grep -A 1000 "=== AI Code Review Analysis ===" raw-analysis.txt | tail -n +2 > analysis-log.txt

if [ -f analysis-log.txt ] && [ -s analysis-log.txt ]; then
    echo "✅ Clean analysis log extracted to analysis-log.txt"
    echo "File size: $(wc -c < analysis-log.txt) bytes"
    echo "Lines: $(wc -l < analysis-log.txt)"
    echo ""
    echo "Preview (first 20 lines):"
    head -20 analysis-log.txt
    echo ""
    echo "Last 10 lines:"
    tail -10 analysis-log.txt
    
    # Clean up intermediate file
    rm -f raw-analysis.txt
else
    echo "❌ Failed to extract analysis log"
    echo "Checking what we captured (first 20 lines):"
    head -20 raw-analysis.txt
    echo ""
    echo "Looking for analysis content in output:"
    grep -n "=== AI Code Review Analysis ===" raw-analysis.txt || echo "No analysis header found"
fi

echo ""
echo "Full output saved to full_output.log for debugging"