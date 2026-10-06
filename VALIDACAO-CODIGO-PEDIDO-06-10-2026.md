# Validação — código do pedido / acompanhamento

- Banco conferido: 824 pedidos existentes possuem `tracking_code`; nenhum pedido sem código.
- Confirmação normal: mostra número do pedido + código para acompanhar.
- Pagamento Pix: mostra o mesmo código para acompanhar.
- Recuperação de pedido já registrado: mostra o código sem criar novo pedido.
- Botão “Copiar código” incluído com fallback para navegadores sem Clipboard API.
- Tela “Acompanhar”: rótulo alterado para “Código do pedido” e mantém preenchimento automático do último código salvo.
- JavaScript validado com `node --check`.
- Service Worker atualizado para cache `caseirao-delivery-runtime-auto-v46`.
