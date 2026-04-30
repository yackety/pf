#!/usr/bin/env bash
# update-tasks.sh — PostToolUse hook (Linux/macOS)
# Reads tool use info from stdin; injects a systemMessage if a file was written.

input=$(cat)

tool=$(echo "$input" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null)

case "$tool" in
  create_file|replace_string_in_file|multi_replace_string_in_file|edit_notebook_file)
    echo '{"systemMessage":"A file was just written. Check docs/tasks.md — if the work you just completed matches a task, mark it [x] by editing that file now."}'
    ;;
esac
