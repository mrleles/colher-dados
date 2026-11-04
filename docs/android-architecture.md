# Arquitetura da integração Android

O aplicativo Kotlin usa APIs nativas. O backend permanece no Next.js e Supabase.

- POST /api/telemetry/android/token: recebe sessionToken, valida sessão e emite autorização aleatória de uso único.
- POST /api/telemetry/android/collect: recebe token e métricas, valida com Zod e chama submit_android_telemetry.

Separação dos resultados:
- telemetry_metrics.dns_server: DNS observado pelo teste externo web.
- telemetry_android_metrics.dns_servers: DNS retornado por LinkProperties para o link ativo.
- private_dns_active/private_dns_server_name: estado e hostname Private DNS.
- Gateway, rotas e endereços locais em campos próprios.

O token Android tem 256 bits aleatórios; somente SHA-256 é persistido. A função PostgreSQL bloqueia e consome o token e insere a métrica na mesma transação. Nenhum segredo de backend fica no APK.
