# Revisão profissional

## Correções aplicadas

- Remoção de CSS e JavaScript antigos que não eram utilizados pelo `index.html`.
- Carrinho continua salvo no aparelho.
- Tentativa de pedido passa a ser salva antes da chamada ao servidor.
- Reenvio preserva o mesmo `client_request_id`.
- Pedido confirmado no servidor é guardado antes da geração do Pix.
- Falha na geração do Pix recupera o pagamento do mesmo pedido.
- Confirmação do Pix encerra o estado pendente.
- Atualização do cache e dos arquivos essenciais do PWA.

## Resultado esperado

Fechar ou atualizar a página não remove um pedido já gravado. Uma falha depois da criação não orienta o cliente a criar outro pedido.
