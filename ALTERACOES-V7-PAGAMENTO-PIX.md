# O Caseirão Burger — Delivery V7 (21/10/2026)

## Aviso ao cliente sobre Pix

O checkout destaca, quando a forma Pix está selecionada, que o pedido somente será encaminhado ao preparo **depois da confirmação do pagamento**. A tela do QR Code / Pix copia e cola reforça essa informação. A tela de acompanhamento também mostra Pix pendente e eventuais complementos pendentes gerados por acréscimos feitos na Central.

Para gerar o QR Code, o sistema continua registrando internamente a solicitação com pagamento **pendente**. Isso NÃO libera a produção. O fluxo normal do Mercado Pago confirma o pagamento no servidor e só então o pedido fica liberado para preparo.

A versão do cache PWA foi alterada. Depois de publicar este conteúdo no repositório/site delivery, atualize o PWA e, se necessário, feche e reabra o aplicativo.

**Importante:** a alteração não modifica as credenciais do Mercado Pago, não cria pagamentos falsos e não marca Pix como pago sem verificação.
