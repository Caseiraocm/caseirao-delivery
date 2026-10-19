# O Caseirão Burger — Delivery Signature 5.0

Cardápio público, personalização, carrinho, checkout, Pix e acompanhamento de pedidos.

## Publicação

1. Substitua os arquivos do repositório `caseirao-delivery` pelos arquivos desta pasta, mantendo a estrutura.
2. Faça commit na branch publicada no GitHub Pages.
3. Abra o domínio do Caseirão e atualize a página uma vez. O service worker usa cache versionado (`signature-v50`).

## O que mudou

- Nova identidade de interface: cabeçalho claro, vitrine premium com **foto real de um produto do catálogo** (se existir), categorias, busca, cards e carrinho.
- Modais do cardápio, promoções, Pix, fidelidade e cashback com **contraste consistente**.
- Rastreamento totalmente renovado: código + WhatsApp legíveis, consulta, indicador de etapa, previsão, atualização manual e automática a cada 25 s enquanto a tela está aberta.
- Checkout guiado e responsivo preservado, com pagamento e adicionais. Correção do acionamento do botão **Continuar** para não apagar os dados salvos.
- Novo arquivo de tema `css/caseirao-signature-5.css` carregado após `app.css`, sem trocar o backend.
- Cache PWA atualizado para distribuir novos CSS/JS.

## Backend e observações

O frontend continua usando a URL e as funções Supabase que já constavam no projeto.
Não são necessárias novas chaves. O rastreamento mostra o **status realmente retornado** pela função `track-order`; o indicador de etapas é uma representação visual desse status. A atualização automática só consulta enquanto o painel estiver aberto e a aba visível.

A navegação e os fluxos foram testados em Chromium com respostas simuladas (catálogo, rastreamento e pedido). **Não houve envio de pedidos reais nem validação de pagamentos em produção.** Recomendado realizar um pedido de baixo valor ou teste operacional antes de usar o novo tema com clientes.

Arquivo de entrada: `index.html` (minúsculas).
