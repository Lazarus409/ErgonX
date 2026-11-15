<#
.SYNOPSIS
  Restores an ErgonX backup into a throwaway database and checks it.

.DESCRIPTION
  Starts a temporary PostgreSQL container, restores the dump into it, and reports
  how long that took and whether the key tables hold data (organisations, users,
  employees, payroll, ledger, audit trail, stored files) and the latest migration.
  The container is removed afterwards; nothing else is touched.

  Record the result in ErgonX as Super Admin under Restore tests, so the security
  overview shows when the backups were last proven.

.EXAMPLE
  .\scripts\restore-test.ps1 -DumpFile backups\ergonx-render-20261112T020000Z.dump
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$DumpFile,
    [string]$PostgresImage = "postgres:18"
)

$ErrorActionPreference = "Stop"

$dump = Resolve-Path $DumpFile
$folder = Split-Path -Parent $dump
$name = Split-Path -Leaf $dump
$container = "ergonx-restore-test-" + [guid]::NewGuid().ToString("N").Substring(0, 8)
$password = [guid]::NewGuid().ToString("N")

Write-Host "Starting a throwaway database ($container) ..."
docker run -d --name $container -e POSTGRES_PASSWORD=$password -e POSTGRES_DB=restore_test `
    --mount "type=bind,source=$folder,target=/backups,readonly" $PostgresImage | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Could not start $PostgresImage." }

try {
    $ready = $false
    for ($i = 0; $i -lt 60; $i++) {
        docker exec $container pg_isready -U postgres -d restore_test 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) { throw "The throwaway database did not start." }

    $watch = [System.Diagnostics.Stopwatch]::StartNew()
    docker exec $container pg_restore --no-owner --no-privileges -U postgres -d restore_test "/backups/$name"
    $restoreExit = $LASTEXITCODE
    $watch.Stop()

    $query = @"
SELECT 'organisations', count(*) FROM institutions_institution
UNION ALL SELECT 'users', count(*) FROM accounts_user
UNION ALL SELECT 'employees', count(*) FROM employees_employee
UNION ALL SELECT 'payroll records', count(*) FROM payroll_payrollrecord
UNION ALL SELECT 'journal entries', count(*) FROM accounting_journalentry
UNION ALL SELECT 'audit events', count(*) FROM audit_auditlog
UNION ALL SELECT 'stored files', count(*) FROM filestore_storedfile
UNION ALL SELECT 'latest migration: ' || (SELECT app || '.' || name FROM django_migrations ORDER BY applied DESC LIMIT 1), 1;
"@
    $rows = docker exec $container psql -U postgres -d restore_test -At -F " | " -c $query
    if ($LASTEXITCODE -ne 0) { throw "The restored database could not be queried; the restore is not usable." }

    Write-Host ""
    Write-Host ("Restored {0} in {1:N1} minutes (pg_restore exit {2})." -f $name, $watch.Elapsed.TotalMinutes, $restoreExit)
    $rows | ForEach-Object { Write-Host "  $_" }
    $empty = $rows | Where-Object { $_ -match "^(organisations|users) \| 0$" }
    if ($empty) {
        Write-Warning "Key tables are empty: treat this restore test as FAILED."
    } elseif ($restoreExit -ne 0) {
        Write-Warning "pg_restore reported errors (often harmless extension/ownership notices). Review them; record the test as PARTIAL if unsure."
    } else {
        Write-Host "Result: PASSED. Record it under Super Admin > Restore tests."
    }
}
finally {
    docker rm -f $container | Out-Null
}
