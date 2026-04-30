# update-tasks.ps1 — PostToolUse hook (Windows)
# Reads tool use info from stdin; injects a systemMessage if a file was written.

$inputJson = $input | Out-String
try {
    $data = $inputJson | ConvertFrom-Json
    $toolName = $data.tool_name
} catch {
    exit 0
}

$fileWriteTools = @(
    'create_file',
    'replace_string_in_file',
    'multi_replace_string_in_file',
    'edit_notebook_file'
)

if ($fileWriteTools -contains $toolName) {
    @{
        systemMessage = "A file was just written. Check docs/tasks.md — if the work you just completed matches a task, mark it [x] by editing that file now."
    } | ConvertTo-Json -Compress
}
