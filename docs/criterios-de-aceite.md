AC1: Geração de Link e Validação
Cenário: Atendente gera um link de telemetria.
Dado que o atendente possui um protocolo de atendimento;
Quando ele solicita a geração do link;
Então o sistema deve gerar uma URL com um token único (UUID) e data de expiração de 60 minutos.
E o link não deve conter IDs de cliente ou dados sensíveis em texto claro.
AC2: Experiência do Cliente (Coleta)
Cenário: Cliente acessa o link de telemetria.
Dado que o cliente abriu o link válido;
Quando a página carrega;
Então deve ser exibida apenas uma barra de progresso e mensagens de status (ex: "Analisando hardware...", "Testando conexão...").
E ao final, deve exibir a mensagem: "Dados enviados ao atendente".
AC3: Integridade e Envio dos Dados
Cenário: Transmissão dos dados para o servidor.
Dado que a coleta terminou;
Quando os dados forem enviados via POST;
Então o servidor deve validar se o token é válido e se não expirou antes de salvar no banco de dados.
AC4: Visualização do Atendente
Cenário: Consulta de métricas no painel.
Dado que a coleta foi concluída;
Quando o atendente acessa o painel de protocolos;
Então ele deve ver uma tabela com: Modelo do Dispositivo, OS, RAM, CPU, Latência (RTT), Tipo de Conexão e Velocidade de Download.