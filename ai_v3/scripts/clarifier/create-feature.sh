#!/bin/bash

# Usage: ./create-feature.sh "dark mode"
# Output: 001-dark-mode (or next available number)

SPECS_DIR="specs"
FEATURE_DESC="$1"

# Create specs directory if it doesn't exist
mkdir -p "$SPECS_DIR"

# Find next available number
get_next_number() {
    local highest=$(ls -1 "$SPECS_DIR" 2>/dev/null | \
                   grep -E '^[0-9]{3}-' | \
                   sed 's/-.*//' | \
                   sort -n | \
                   tail -1)
    
    if [ -z "$highest" ]; then
        echo "001"
    else
        printf "%03d" $((10#$highest + 1))
    fi
}

# Generate feature name from description
generate_feature_name() {
    local desc="$1"
    
    # Convert to lowercase and remove common words
    local name=$(echo "$desc" | \
                tr '[:upper:]' '[:lower:]' | \
                sed 's/\b\(add\|create\|implement\|fix\|update\)\b/\1-/g' | \
                sed 's/\b\(the\|a\|an\)\b//g' | \
                sed 's/[^a-z0-9-]/-/g' | \
                sed 's/--*/-/g' | \
                sed 's/^-//;s/-$//')
    
    # Limit to 4 words
    echo "$name" | cut -d'-' -f1-4
}

# Get components
NEXT_NUM=$(get_next_number)
FEATURE_NAME=$(generate_feature_name "$FEATURE_DESC")
FEATURE_DIR="${SPECS_DIR}/${NEXT_NUM}-${FEATURE_NAME}"

# Create directory
mkdir -p "$FEATURE_DIR"

# Output JSON for agent to parse
cat << EOF
{
  "feature_number": "${NEXT_NUM}",
  "feature_name": "${FEATURE_NAME}",
  "feature_dir": "${FEATURE_DIR}",
  "success": true
}
EOF