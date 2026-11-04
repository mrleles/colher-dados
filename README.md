# Colher Dados

Aplicação web para coletar informações técnicas de conexão e disponibilizá-las ao suporte.

## Aplicativo Android
O módulo Kotlin fica em `android/`. Consulte:
- [Arquitetura Android](docs/android-architecture.md)
- [Compilação e distribuição do APK](docs/android-build.md)
- [Migração Supabase](docs/migration-android-dns.sql)

O build Android requer a URL HTTPS real da aplicação via `apiBaseUrl`. Um APK de depuração pode ser gerado manualmente ou pelo workflow **Android debug APK** em Actions (execução manual).

A migração SQL deve ser aplicada antes de implantar os endpoints Android. O APK só poderá ser baixado após publicar um release com o asset `colher-dados.apk` ou configurar `ANDROID_APK_URL`.
