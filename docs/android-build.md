# Aplicativo Android — Colher Dados

## Requisitos
- Android Studio ou JDK 17 + Android SDK
- Android SDK Platform 35
- URL HTTPS pública da aplicação Next.js

## Configurar a API
A URL é compilada no APK. Na pasta android/, configure local.properties:
```properties
apiBaseUrl=https://SEU-DOMINIO
```
Também é possível usar -PapiBaseUrl=https://SEU-DOMINIO ou a variável COLHER_DADOS_API_BASE_URL. O build rejeita URLs HTTP.

## APK de depuração
Na pasta android/: `gradle assembleDebug -PapiBaseUrl=https://SEU-DOMINIO`
Saída: `app/build/outputs/apk/debug/app-debug.apk`.

## APK de produção
Configure assinatura release e mantenha keystore/senhas fora do repositório. Em seguida: `gradle assembleRelease -PapiBaseUrl=https://SEU-DOMINIO`.
Publique o APK release no GitHub Releases com o nome `colher-dados.apk`. A rota /api/telemetry/download redireciona para esse asset. Use ANDROID_APK_URL para outro endereço HTTPS.

## Limitações
LinkProperties.getDnsServers() informa os DNS disponibilizados para o link ativo, sem provar origem DHCP ou configuração manual. Private DNS pode estar ativo sem hostname exposto no modo oportunista. Com VPN, os dados são da rede ativa VPN e não necessariamente da rede física. Gateway local não revela o upstream do roteador. Não há root, localização ou coleta de SSID.

Testar Android 9, 10, 11, 13 e 15; Wi-Fi/DNS manual, Private DNS, rede móvel, IPv6, VPN, sem conectividade e tokens expirados/reutilizados.
