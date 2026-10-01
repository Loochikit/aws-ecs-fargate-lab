param (
    [string]$BaseUrl = "http://18.227.81.116"
)

Write-Host "Probando aplicacion en AWS: $BaseUrl" -ForegroundColor Yellow

$item1 = @{
    nombre = "Servidor Cloud ECS"
    descripcion = "Contenedor gestionado con Fargate en subred privada"
    precio = 45.50
} | ConvertTo-Json

$item2 = @{
    nombre = "Base de Datos RDS"
    descripcion = "Instancia relacional PostgreSQL en subred privada de datos"
    precio = 120.00
} | ConvertTo-Json

Write-Host "`n1. Insertando Item 1 en Amazon RDS..." -ForegroundColor Cyan
$res1 = Invoke-RestMethod -Uri "$BaseUrl/api/items" -Method Post -Body $item1 -ContentType "application/json"
$res1 | ConvertTo-Json -Depth 3

Write-Host "`n2. Insertando Item 2 en Amazon RDS..." -ForegroundColor Cyan
$res2 = Invoke-RestMethod -Uri "$BaseUrl/api/items" -Method Post -Body $item2 -ContentType "application/json"
$res2 | ConvertTo-Json -Depth 3

Write-Host "`n3. Consultando todos los registros almacenados (GET /api/items)..." -ForegroundColor Cyan
$resGet = Invoke-RestMethod -Uri "$BaseUrl/api/items" -Method Get
$resGet | ConvertTo-Json -Depth 4
