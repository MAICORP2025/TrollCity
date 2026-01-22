# Apply all Supabase migrations
# This script reads your .env file and applies all migration files in order

Write-Host "=== Supabase Migration Runner ===" -ForegroundColor Cyan

# Load environment variables from .env
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)\s*=\s*(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
    Write-Host "✓ Loaded .env file" -ForegroundColor Green
} else {
    Write-Host "✗ .env file not found" -ForegroundColor Red
    exit 1
}

$supabaseUrl = $env:VITE_SUPABASE_URL
$supabaseKey = $env:VITE_SUPABASE_ANON_KEY

if (-not $supabaseUrl -or -not $supabaseKey) {
    Write-Host "✗ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Supabase URL: $supabaseUrl" -ForegroundColor Green

# Get all migration files sorted by name
$migrations = Get-ChildItem -Path "supabase\migrations" -Filter "*.sql" | Sort-Object Name

Write-Host "`nFound $($migrations.Count) migration files" -ForegroundColor Cyan

$successCount = 0
$errorCount = 0
$skippedCount = 0

foreach ($migration in $migrations) {
    Write-Host "`n--- Processing: $($migration.Name) ---" -ForegroundColor Yellow
    
    $sql = Get-Content $migration.FullName -Raw
    
    # Skip if empty
    if ([string]::IsNullOrWhiteSpace($sql)) {
        Write-Host "  ⊘ Skipped (empty file)" -ForegroundColor DarkGray
        $skippedCount++
        continue
    }
    
    try {
        # Use Supabase REST API to execute SQL
        $body = @{
            query = $sql
        } | ConvertTo-Json
        
        $headers = @{
            "apikey" = $supabaseKey
            "Authorization" = "Bearer $supabaseKey"
            "Content-Type" = "application/json"
        }
        
        $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/rpc/exec_sql" -Method Post -Headers $headers -Body $body -ErrorAction Stop
        
        Write-Host "  ✓ Applied successfully" -ForegroundColor Green
        $successCount++
    }
    catch {
        Write-Host "  ✗ Error: $($_.Exception.Message)" -ForegroundColor Red
        $errorCount++
        
        # Continue with next migration instead of stopping
    }
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Total: $($migrations.Count)" -ForegroundColor White
Write-Host "Success: $successCount" -ForegroundColor Green
Write-Host "Errors: $errorCount" -ForegroundColor Red
Write-Host "Skipped: $skippedCount" -ForegroundColor DarkGray
