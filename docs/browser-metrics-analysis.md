# Análise das métricas de dispositivo e Wi-Fi

## Decisão

A coleta continua baseada em APIs Web reais e progressive enhancement. Quando o navegador não fornece um dado, o valor enviado é null.

### Dispositivo

- **Marca:** Apple pode ser identificada quando o navegador informa iOS ou macOS. Para Android/Windows/Linux, a aplicação não tenta inferir o fabricante.
- **Modelo:** usa navigator.userAgentData.getHighEntropyValues(["model"]) quando disponível. Como fallback, em Android é usado apenas o token de modelo presente no User-Agent quando ele não é o valor reduzido K. Em iOS o modelo exato permanece null.
- **Sistema operacional:** prioriza navigator.userAgentData.platform e usa o User-Agent como fallback.
- **RAM:** mantém navigator.deviceMemory quando disponível.

User-Agent Client Hints são suportados principalmente por Chrome/Edge e não por Firefox/Safari; o valor de modelo é de alta entropia e pode ser omitido pelo navegador. A aplicação não trata o nome do navegador como marca do aparelho.

### Wi-Fi

Uma página web comum não possui API padronizada e interoperável para obter:

- SSID;
- frequência/canal (2,4/5/6 GHz);
- RSSI/intensidade em dBm.

A Network Information API fornece informações gerais de conexão, como effectiveType, rtt e saveData e, quando type está disponível, o tipo geral da conexão. Ela não entrega SSID, frequência ou RSSI.

Por isso, nesta etapa os três campos Wi-Fi são armazenados como null, sem estimativas.

### HTTPS e permissões

A produção usa HTTPS. User-Agent Client Hints são destinados a conexões seguras, e o método de alta entropia pode ser restringido por Permissions Policy. A coleta implementada não solicita permissões adicionais ao cliente.

Para obter SSID/RSSI/frequência seria necessário sair do modelo de site comum e usar um aplicativo nativo, uma extensão com permissões específicas ou uma solução assistida localmente. Isso mudaria a arquitetura e não será feito nesta etapa.

### Privacidade

SSID, modelo do dispositivo, User-Agent e métricas de rede podem contribuir para identificar ou localizar indiretamente uma pessoa quando combinados com outros dados. Eles não são automaticamente dados pessoais sensíveis pela definição da LGPD, mas podem ser dados pessoais dependendo do contexto.

A aplicação deve informar claramente a finalidade da coleta e aplicar minimização e retenção adequada. Consentimento não é automaticamente a única base legal possível; a base legal adequada deve ser definida pelo controlador com orientação jurídica/DPO. Para diagnóstico técnico, não se deve coletar SSID apenas porque seria possível em um ambiente nativo.

## Removido

- cpu_cores
- screen_res

Esses campos foram removidos do cliente, API, banco/RPC e Dashboard.
