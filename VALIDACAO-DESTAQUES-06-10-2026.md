# Validação — Carrossel de Destaques

- Delivery usa `products.featured` recebido pela função `catalog`.
- Produtos destacados ativos e não esgotados aparecem primeiro no carrossel (máximo 8).
- Se nenhum produto estiver marcado, o carrossel cai automaticamente para os mais vendidos.
- Carrossel desliza automaticamente, aceita gesto horizontal e pausa durante interação.
- Botão Adicionar reaproveita o mesmo `openProduct`, carrinho, adicionais e regras atuais.
- Service worker atualizado para network-first/no-store, chaves normalizadas e atualização automática ao reabrir o app.
