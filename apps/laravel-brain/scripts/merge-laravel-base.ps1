#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Mescla o projeto Laravel base criado pelo Composer com os arquivos customizados
    do laravel-brain (Models, Services, Controllers, Migrations, rotas).

.DESCRIPTION
    Executa após o Composer criar o projeto em apps/laravel-base.
    Copia a estrutura Laravel para laravel-brain, preservando os arquivos
    customizados já existentes (não sobrescreve).

.USAGE
    cd apps
    .\laravel-brain\scripts\merge-laravel-base.ps1
#>

param(
    [string]$BasePath  = "$PSScriptRoot\..\..\laravel-base",
    [string]$BrainPath = "$PSScriptRoot\.."
)

$base  = Resolve-Path $BasePath
$brain = Resolve-Path $BrainPath

Write-Host "Mesclando $base --> $brain" -ForegroundColor Cyan

# Arquivos/pastas que NÃO devem ser sobrescritas (já foram customizadas)
$protected = @(
    "app\Models\TenantExternalModule.php",
    "app\Services\ErpNextService.php",
    "app\Http\Controllers\ErpNext",
    "app\Http\Middleware\ErpNextModuleAccess.php",
    "database\migrations\2026_04_30_000001_create_tenant_external_modules_table.php",
    "routes\api.php",
    "config\services.php",
    ".env.example",
    "docker-compose.dev.yml",
    "Dockerfile.dev",
    "docker\nginx\nginx.dev.conf",
    "frappe-apps"
)

# Itens do laravel-base que precisam ir para laravel-brain
$toCopy = @(
    "app\Console",
    "app\Exceptions",
    "app\Http\Kernel.php",
    "app\Http\Middleware\Authenticate.php",
    "app\Http\Middleware\RedirectIfAuthenticated.php",
    "app\Http\Middleware\TrustProxies.php",
    "app\Models\User.php",
    "app\Providers",
    "bootstrap",
    "config\app.php",
    "config\auth.php",
    "config\broadcasting.php",
    "config\cache.php",
    "config\cors.php",
    "config\database.php",
    "config\filesystems.php",
    "config\logging.php",
    "config\mail.php",
    "config\queue.php",
    "config\sanctum.php",
    "config\session.php",
    "database\factories",
    "database\migrations\2014_10_12_000000_create_users_table.php",
    "database\migrations\2014_10_12_100000_create_password_reset_tokens_table.php",
    "database\migrations\2019_08_19_000000_create_failed_jobs_table.php",
    "database\migrations\2019_12_14_000001_create_personal_access_tokens_table.php",
    "database\seeders",
    "lang",
    "public",
    "resources",
    "routes\web.php",
    "routes\console.php",
    "routes\channels.php",
    "storage",
    "tests",
    "vendor",
    "artisan",
    "composer.json",
    "composer.lock"
)

$copied = 0
$skipped = 0

foreach ($item in $toCopy) {
    $src  = Join-Path $base  $item
    $dest = Join-Path $brain $item

    # Não sobrescreve arquivos protegidos
    $isProtected = $protected | Where-Object { $dest -like "*$_*" }
    if ($isProtected -and (Test-Path $dest)) {
        Write-Host "  [SKIP]   $item (protegido)" -ForegroundColor Yellow
        $skipped++
        continue
    }

    if (-not (Test-Path $src)) {
        Write-Host "  [MISS]   $item (não encontrado no base)" -ForegroundColor DarkGray
        continue
    }

    $destDir = Split-Path $dest -Parent
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }

    if (Test-Path $src -PathType Container) {
        Copy-Item -Recurse -Force -Path $src -Destination $dest
    } else {
        Copy-Item -Force -Path $src -Destination $dest
    }

    Write-Host "  [OK]     $item" -ForegroundColor Green
    $copied++
}

Write-Host ""
Write-Host "Concluido: $copied copiados, $skipped ignorados (protegidos)." -ForegroundColor Cyan
Write-Host ""
Write-Host "Proximo passo:" -ForegroundColor White
Write-Host "  cd laravel-brain"
Write-Host "  copy .env.example .env"
Write-Host "  # Editar .env com APP_KEY e ERPNEXT_SSO_SECRET"
Write-Host "  docker compose -f docker-compose.dev.yml up -d"
