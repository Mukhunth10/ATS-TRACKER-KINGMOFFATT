# Starts the Next.js dev server directly via node, bypassing npm/npx's .cmd
# shims -- those break because this folder's path contains "&" (King &
# Moffatt), which cmd.exe misparses as a command separator.
#
# Usage: ./dev.ps1

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
node (Join-Path $root "node_modules\next\dist\bin\next") dev
