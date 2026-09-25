[CmdletBinding()]
param(
    [string]$RenderExternalDatabaseUrl
)

$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$dumpPath = Join-Path $workspaceRoot "ergonx-render.dump"
$mountArgument = "type=bind,source=$workspaceRoot,target=/backup,readonly"

if ([string]::IsNullOrWhiteSpace($RenderExternalDatabaseUrl)) {
    $RenderExternalDatabaseUrl = Read-Host "Paste the Render External Database URL"
}

if ([string]::IsNullOrWhiteSpace($RenderExternalDatabaseUrl)) {
    throw "A Render External Database URL is required."
}

if ($RenderExternalDatabaseUrl -notmatch "^postgres(ql)?://") {
    throw "Use the complete External Database URL copied from Render's Connect panel."
}

if ($RenderExternalDatabaseUrl -match "[\[\]\(\)\s]") {
    throw "The database URL contains spaces or Markdown characters. Copy it again using Render's copy button."
}

docker ps --filter "name=^/postgres16$" --format "{{.Names}}" | Select-String -Quiet "^postgres16$"
if (-not $?) {
    throw "The local postgres16 container is not running. Start Docker Desktop and run docker compose up -d."
}

Write-Host "Creating a local backup..."
docker exec postgres16 sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl --file=/tmp/ergonx-render.dump'
if ($LASTEXITCODE -ne 0) { throw "Local PostgreSQL export failed." }

docker cp postgres16:/tmp/ergonx-render.dump $dumpPath
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $dumpPath)) { throw "Could not copy the database export to the workspace." }

Write-Host "Restoring the backup to Render. This replaces the target database contents..."
docker run --rm --mount $mountArgument --env "TARGET_DATABASE_URL=$RenderExternalDatabaseUrl" postgres:18-alpine sh -c 'pg_restore --dbname="$TARGET_DATABASE_URL" --clean --if-exists --no-owner --no-privileges --verbose /backup/ergonx-render.dump'
if ($LASTEXITCODE -ne 0) { throw "Render restore failed. Do not remove the local dump; review the error above." }

Write-Host "Restore complete. Redeploy the Render backend, then sign in using the existing demo account."
