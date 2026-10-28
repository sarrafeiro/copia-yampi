# Checkout em uma página

Checkout de 3 etapas (Identificação → Entrega → Pagamento) em HTML, CSS e JavaScript puros, sem build.
Uma página só, pensada para o comprador brasileiro: PF/PJ, CEP automático, Pix com desconto, parcelas,
order bump, upsell, cashback e cupom.

## Abrir

Dê dois cliques em `index.html` (abre no navegador) ou publique a pasta inteira na Cloudflare Pages.
A busca de CEP usa a API pública do ViaCEP; sem internet, o cliente preenche o endereço à mão.

## Personalizar

Tudo que muda de loja para loja fica em `js/config.js`:

| Bloco | O que controla |
| --- | --- |
| `store` | nome, logo (inicial), domínio, razão social, CNPJ, contatos, faixa de confiança, selo, política de privacidade |
| `theme` | cores (principal, sucesso, faixa do topo, cor das ofertas) |
| `cart` | itens que chegam no checkout (nome, variação, preço, quantidade, imagem opcional) |
| `coupons` | cupons de % , valor fixo (com mínimo) e frete grátis |
| `shipping` | opções de frete por região (preço e prazo em dias úteis), frete grátis a partir de X, retirada na loja |
| `payments` | cartão (parcelas, juros, parcela mínima), Pix (desconto, validade), boleto (vencimento) |
| `orderBumps` | ofertas dentro da etapa de pagamento |
| `upsell` | oferta de 1 clique na página de obrigado |
| `exitIntent` | janela de cupom quando o cliente ameaça sair (desktop) |
| `reviews` | avaliações do carrossel |
| `hooks` | `onLead`, `onOrder`, `onEvent` — pontos para ligar back-end, CRM e pixels |

## Comportamento

- **Mobile e tablet (até 1079 px):** uma coluna, resumo recolhível no topo, só a etapa ativa aparece, link "Voltar".
- **Desktop (1080 px ou mais):** três colunas — etapas 1 e 2 · etapa 3 · resumo e avaliações.
  Etapas concluídas ficam verdes com botão de editar; as futuras aparecem bloqueadas.
- O progresso fica salvo na aba (sessionStorage): recarregar a página não perde nada.
  **Dados de cartão nunca são salvos.**
- Eventos vão para `window.dataLayer` (GTM): `begin_checkout`, `generate_lead`, `add_shipping_info`,
  `add_payment_info`, `add_to_cart` (order bump), `select_promotion` (cupom), `payment_declined`,
  `purchase`, `upsell_accepted`.

## Testar (modo demonstração)

Com `demo: true` no config:

| Campo | Valor de teste |
| --- | --- |
| CPF | `000.000.000-00` (CNPJ: `00.000.000/0000-00`) |
| Cartão aprovado | `4111 1111 1111 1111`, validade futura, código `123` |
| Cartão recusado | `4000 0000 0000 0002` → abre a janela de recusa com "Tentar novamente" e "Pagar com Pix" |
| Cupons | `BEMVINDO10`, `MENOS15` (compra mínima R$ 120), `FRETEGRATIS` |

O botão "Recomeçar" na faixa amarela limpa o progresso.

### Teste automático

```bash
node tests/run.mjs
```

Abre um Chrome headless descartável, faz o fluxo inteiro (validações, PF/PJ, CEP, frete, cartão,
order bump, cupom, Pix, cartão recusado, página de obrigado) em mobile e desktop e salva os prints em
`tests/output/`. Precisa de Node 22+ e Chrome (ou `CHROME_PATH`). Sai com código 1 se algo falhar.

## Usar em outro projeto

Este repositório é a **base**. Em cada projeto:

1. Copie a base para a pasta `checkout/` do projeto (sem a pasta `.git`) e anote a versão usada
   (`git rev-parse --short HEAD`) em `checkout/BASE_VERSION`.
2. Altere **só** `js/config.js` (e imagens do projeto). `index.html`, `css/` e `js/checkout.js` são da base.
3. Precisa de algo novo no checkout? Faça na base, de forma configurável pelo `config.js`, rode o teste,
   faça commit e push. Depois atualize os projetos copiando de novo os arquivos da base —
   **nunca sobrescreva o `js/config.js` do projeto**.

## Antes de vender de verdade

O pagamento é **simulado**. Para produção:

1. Coloque `demo: false` (some a faixa e os documentos de teste deixam de valer).
2. Ligue um gateway (Mercado Pago, Pagar.me, etc.) no `finalize()` de `js/checkout.js`:
   tokenize o cartão com o SDK do gateway no navegador e crie a cobrança no seu servidor —
   nunca envie número de cartão para o seu back-end.
3. Troque o QR Code ilustrativo e o código "copia e cola" pelos que o gateway devolver.
4. Calcule frete e valide cupons no servidor (o navegador só mostra; quem cobra é o back-end).
5. Use `hooks.onLead` para gravar o carrinho abandonado e disparar a recuperação.
