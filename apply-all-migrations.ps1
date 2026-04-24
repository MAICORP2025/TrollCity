# Apply all Supabase migrations
Write-Host "=== Supabase Migration Runner ==="

if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)\s*=\s*(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
    Write-Host "Loaded .env file"
} else {
    Write-Host ".env file not found"
    exit 1
}

$supabaseUrl = $env:VITE_SUPABASE_URL
$supabaseKey = $env:VITE_SUPABASE_ANON_KEY

if (-not $supabaseUrl -or -not $supabaseKey) {
    Write-Host "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env"
    exit 1
}

Write-Host "Supabase URL: $supabaseUrl"

$migrations = Get-ChildItem -Path "supabase\migrations" -Filter "*.sql" | Sort-Object Name
Write-Host "Found $($migrations.Count) migration files"

$successCount = 0
$errorCount = 0
$skippedCount = 0

foreach ($migration in $migrations) {
    Write-Host "--- Processing: $($migration.Name) ---"
    
    $sql = Get-Content $migration.FullName -Raw
    
    if ([string]::IsNullOrWhiteSpace($sql)) {
        Write-Host "Skipped (empty file)"
        $skippedCount++
        continue
    }
    
    try {
        $body = @{
            query = $sql
        } | ConvertTo-Json
        
        $headers = @{
            "apikey" = $supabaseKey
            "Authorization" = "Bearer $supabaseKey"
            "Content-Type" = "application/json"
        }
        
        $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/rpc/exec_sql" -Method Post -Headers $headers -Body $body -ErrorAction Stop
        
        Write-Host "Applied successfully"
        $successCount++
    }
    catch {
        Write-Host "Error: $($_.Exception.Message)"
        $errorCount++
    }
}

Write-Host "=== Summary ==="
Write-Host "Total: $($migrations.Count)"
Write-Host "Success: $successCount"
Write-Host "Errors: $errorCount"
Write-Host "Skipped: $skippedCount"
