Telemetria Web de Conexão
Este documento detalha as APIs do navegador e as técnicas de coleta de dados que serão implementadas no frontend para a extração de métricas técnicas.

1. Coleta de Dispositivo (Hardware/OS)
Para obter informações do hardware sem requerer permissões invasivas, utilizaremos as seguintes propriedades:

User Agent: navigator.userAgent para identificar o Sistema Operacional e o navegador.
CPU Cores: navigator.hardwareConcurrency para obter o número de núcleos lógicos da CPU.
RAM Estimada: navigator.deviceMemory (retorna a memória em GB, arredondada para proteger a privacidade).
Resolução de Tela: window.screen.width e window.screen.height.
2. Coleta de Rede Passiva
Utilizaremos a Network Information API (navigator.connection), que fornece estimativas baseadas na conexão atual:

effectiveType: Indica se a conexão é 'slow-2g', '2g', '3g' ou '4g'.
rtt: Estimativa do Round Trip Time (latência).
saveData: Booleano indicando se o modo de economia de dados está ativo.
3. Coleta de Rede Sintética (Ativa)
Para evitar imprecisões de APIs passivas, realizaremos testes reais:

Ping (Latência):
Execução de 5 requisições fetch() para um arquivo pequeno (1px ou texto vazio) em um endpoint do servidor.
Cálculo do tempo decorrido entre a requisição e a resposta.
A métrica final será a mediana desses 5 valores para descartar picos (outliers).
Download Speed:
Download de um arquivo binário de 1MB via fetch().
Cálculo: Tamanho do Arquivo / Tempo de Download.
Conversão do resultado para Mbps (Megabits por segundo).