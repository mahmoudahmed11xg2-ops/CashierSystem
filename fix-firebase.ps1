# fix-firebase.ps1
# شغّل السكريبت ده من داخل مجلد الإضافة نفسه (Acumatica-Injector)
# بيحمّل نسخة firebase-auth الصحيحة (web-extension) المخصصة لـ Service Worker
# وبيصحح روابط الاستيراد الداخلية جوه الملفات من رابط مطلق (gstatic) لرابط نسبي (./)

$version = "10.8.0"
$base = "https://www.gstatic.com/firebasejs/$version"
$folder = $PSScriptRoot

Write-Host "جاري تحميل firebase-app.js ..."
Invoke-WebRequest "$base/firebase-app.js" -OutFile "$folder\firebase-app.js"

Write-Host "جاري تحميل نسخة Auth الخاصة بالإضافات (web-extension) ..."
Invoke-WebRequest "$base/firebase-auth-web-extension.js" -OutFile "$folder\firebase-auth.js"

Write-Host "جاري تحميل firebase-firestore.js ..."
Invoke-WebRequest "$base/firebase-firestore.js" -OutFile "$folder\firebase-firestore.js"

Write-Host "جاري تصحيح روابط الاستيراد الداخلية (من gstatic إلى ملفات محلية) ..."
foreach ($f in @("firebase-app.js", "firebase-auth.js", "firebase-firestore.js")) {
    $path = Join-Path $folder $f
    $content = Get-Content $path -Raw
    $fixed = $content -replace [regex]::Escape("$base/"), "./"
    Set-Content -Path $path -Value $fixed -NoNewline
    Write-Host "  تم تصحيح $f"
}

Write-Host ""
Write-Host "تم بنجاح. الآن:"
Write-Host "1) روح على chrome://extensions واعمل Reload للإضافة"
Write-Host "2) اعمل Hard Refresh (Ctrl+Shift+R) لصفحة Acumatica"
