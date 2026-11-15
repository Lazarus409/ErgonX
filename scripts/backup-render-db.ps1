<#
.SYNOPSIS
  Takes an off-site backup of the live ErgonX database on Render.

.DESCRIPTION
  Render keeps its own backups of paid databases; this script adds a copy you hold
  yourself. It runs pg_dump from a postgres:18 container (the live database is
  PostgreSQL 18), writes backups\ergonx-render-<UTC time>.dump, checks the file can be
  read back with pg_restore --list, and prints its size and table count.

  Read-only on the live database. The URL is only passed to the container as an
  environment variable; it is never written to disk.

.EXAMPLE
  .\scripts\backup-render-db.ps1
  (paste the External Database URL from Render's Connect panel when asked)
#>
[CmdletBinding()]
param(
    [string]$RenderExternalDatabaseUrl,
    [string]$PostgresImage = "postgres:18"
)

$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$backupDir = Join-Path $workspaceRoot "backups"
New-Item -ItemType Directory -Force $backupDir | Out-Null

if ([string]::IsNullOrWhiteSpace($RenderExternalDatabaseUrl)) {
    $RenderExternalDatabaseUrl = Read-Host "Paste the Render External Database URL"
}
if ($RenderExternalDatabaseUrl -notmatch "^postgres(ql)?://") {
    throw "Use the complete External Database URL copied from Render's Connect panel."
}

$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$fileName = "ergonx-render-$stamp.dump"
$mount = "type=bind,source=$backupDir,target=/backups"

$env:ERGONX_BACKUP_URL = $RenderExternalDatabaseUrl
try {
    Write-Host "Dumping the live database to backups\$fileName ..."
    docker run --rm -e ERGONX_BACKUP_URL --mount $mount $PostgresImage `
        sh -c "pg_dump --format=custom --no-owner --no-privileges --dbname=`"`$ERGONX_BACKUP_URL`" --file=/backups/$fileName"
    if ($LASTEXITCODE -ne 0) { throw "pg_dump failed (exit $LASTEXITCODE)." }

    $tables = docker run --rm --mount $mount $PostgresImage sh -c "pg_restore --list /backups/$fileName | grep -c ' TABLE DATA '"
    if ($LASTEXITCODE -ne 0) { throw "The dump could not be read back with pg_restore." }
}
finally {
    Remove-Item Env:\ERGONX_BACKUP_URL -ErrorAction SilentlyContinue
}

$size = (Get-Item (Join-Path $backupDir $fileName)).Length / 1MB
Write-Host ("Backup OK: backups\{0} ({1:N1} MB, {2} tables with data)." -f $fileName, $size, $tables.Trim())
Write-Host "Copy it somewhere other than this computer, and test a restore with .\scripts\restore-test.ps1 -DumpFile backups\$fileName"
