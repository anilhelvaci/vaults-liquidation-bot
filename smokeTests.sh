#!/bin/bash

# Create a log file
LOG_FILE="$(dirname "$0")/smoke-test-logs.txt"
touch "$LOG_FILE"

# Check if the OS is macOS
if [[ $(uname) == "Darwin" ]]; then
    # Open Console app with the log file
    open -a /System/Applications/Utilities/Console.app "$LOG_FILE"
fi

# Run the JavaScript script to generate logs
node test/smokeTests/main.js >>"$LOG_FILE" 2>&1