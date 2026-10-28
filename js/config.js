/*
 * Configuração da loja. Tudo que muda de uma loja para outra fica aqui:
 * marca, cores, produtos do carrinho, cupons, frete, pagamentos, ofertas e avaliações.
 * O checkout.js lê este objeto e monta a página.
 */
window.CHECKOUT_CONFIG = {
  // Mostra a faixa de demonstração e aceita os documentos de teste abaixo.
  // Desligue (false) quando ligar um gateway de pagamento de verdade.
  demo: true,
  testDocuments: ["000.000.000-00", "00.000.000/0000-00"],

  store: {
    name: "Sua Loja",
    logoInitial: "S",
    homeUrl: "#",
    domain: "sualoja.com.br",
    legalName: "Sua Loja Comércio de Artigos LTDA",
    cnpj: "00.000.000/0001-00",
    email: "atendimento@sualoja.com.br",
    phone: "(11) 4000-0000",
    whatsapp: "(11) 90000-0000",
    hours: "Segunda a sexta, das 9h às 18h",
    // Aceita HTML simples (<strong>) — é texto da própria loja.
    trustMessage: "Compra protegida: <strong>mais de 50 mil pedidos entregues</strong> em todo o Brasil.",
    reputation: { title: "Loja verificada", subtitle: "Nota 9,4 de satisfação dos clientes" },
    privacy:
      "Usamos seus dados apenas para processar o pedido, emitir a nota fiscal e enviar atualizações de entrega. " +
      "Não vendemos suas informações. Compartilhamos somente o necessário com os parceiros de pagamento e de entrega " +
      "que concluem a sua compra. Você pode pedir a exclusão dos seus dados a qualquer momento pelo e-mail de atendimento.",
  },

  theme: {
    primary: "#4338ca",
    primaryDark: "#3730a3",
    primarySoft: "#eef2ff",
    success: "#15803d",
    trustBar: "#111827",
    bump: "#ea580c",
    bumpSoft: "#fff7ed",
    bumpLine: "#fdba74",
  },

  // Itens que chegam no checkout. "image" é opcional (URL); sem ela é gerada uma miniatura.
  cart: [
    { id: "camiseta-organica", name: "Camiseta Algodão Orgânico", variant: "Off-white · M", price: 89.9, qty: 1 },
    { id: "bone-classico", name: "Boné Clássico de Sarja", variant: "Preto · Único", price: 59.9, qty: 1 },
  ],

  cashbackPercent: 5,

  // type: "percent" (value = %), "fixed" (value = R$) ou "shipping" (frete grátis).
  coupons: [
    { code: "BEMVINDO10", type: "percent", value: 10, label: "10% de desconto" },
    { code: "MENOS15", type: "fixed", value: 15, minSubtotal: 120, label: "R$ 15 de desconto" },
    { code: "FRETEGRATIS", type: "shipping", label: "Frete grátis" },
  ],

  shipping: {
    servedStates: null, // ex.: ["SP", "RJ"] para limitar a entrega; null = Brasil todo
    freeShippingFrom: 299, // frete grátis nas opções marcadas com freeShippingEligible
    // Preço e prazo (dias úteis) por região: SE, S, CO, NE, N.
    options: [
      {
        id: "economica",
        name: "Entrega Econômica",
        freeShippingEligible: true,
        price: { SE: 12.9, S: 16.9, CO: 19.9, NE: 24.9, N: 29.9 },
        days: { SE: 6, S: 7, CO: 8, NE: 10, N: 12 },
      },
      {
        id: "expressa",
        name: "Entrega Expressa",
        price: { SE: 24.9, S: 29.9, CO: 34.9, NE: 39.9, N: 49.9 },
        days: { SE: 2, S: 3, CO: 4, NE: 5, N: 6 },
      },
    ],
    pickup: {
      enabled: true,
      name: "Retirar na loja",
      address: "Rua Exemplo, 100 · Centro · São Paulo/SP",
      days: 1,
      states: ["SP"], // só aparece para endereços desses estados
    },
  },

  payments: {
    order: ["card", "pix", "boleto"],
    card: {
      enabled: true,
      label: "Cartão de crédito",
      brands: ["Visa", "Mastercard", "Elo", "Amex", "Hipercard"],
      maxInstallments: 12,
      interestFree: 6,
      monthlyInterest: 1.99,
      minInstallment: 10,
      // No modo demonstração este número simula um cartão recusado.
      testDeclineNumber: "4000 0000 0000 0002",
    },
    pix: { enabled: true, label: "Pix", discountPercent: 5, expiresMinutes: 30 },
    boleto: { enabled: true, label: "Boleto bancário", discountPercent: 0, dueDays: 3 },
  },

  // Ofertas mostradas dentro da etapa de pagamento (order bump).
  orderBumps: [
    {
      id: "kit-meias",
      name: "Kit 3 Pares de Meias Cano Médio",
      price: 39.9,
      compareAt: 69.9,
      variant: { label: "Tamanho", options: ["34–38", "39–43"] },
      headline: "Leve junto e economize",
      description: "Algodão penteado com reforço no calcanhar. Vai no mesmo pacote, sem frete extra.",
    },
    {
      id: "ecobag",
      name: "Ecobag de Algodão Cru",
      price: 29.9,
      compareAt: 44.9,
      variant: { label: "Estampa", options: ["Lisa", "Logo"] },
      headline: "A sacola que acompanha tudo",
      description: "Alça reforçada e costura dupla. Cabe no dia a dia e dobra no bolso da mochila.",
    },
    {
      id: "sabao-neutro",
      name: "Sabão Neutro para Roupas Delicadas",
      price: 19.9,
      compareAt: 27.9,
      headline: "Suas peças duram mais",
      description: "Fórmula sem corantes para lavar à mão ou na máquina. Frasco de 500 ml.",
    },
  ],

  // Oferta pós-compra (upsell de 1 clique) na página de obrigado.
  upsell: {
    enabled: true,
    name: "Moletom Canguru Algodão Orgânico",
    price: 149.9,
    compareAt: 219.9,
    headline: "Oferta só para quem acabou de comprar",
    description: "Adicione ao mesmo pedido com 1 clique, sem digitar nada de novo. Enviamos junto, sem frete extra.",
  },

  // Janela de cupom quando o cliente ameaça sair (desktop).
  exitIntent: {
    enabled: true,
    coupon: "BEMVINDO10",
    title: "Espera! Tem um presente pra você",
    text: "Use o cupom abaixo e ganhe 10% de desconto na sua primeira compra.",
  },

  reviews: [
    { name: "Juliana R.", city: "Campinas/SP", stars: 5, text: "Chegou antes do prazo e muito bem embalado. O tecido é ótimo!" },
    { name: "Rafael M.", city: "Curitiba/PR", stars: 5, text: "Paguei no Pix e foi aprovado na hora. Atendimento rápido no WhatsApp." },
    { name: "Patrícia L.", city: "Recife/PE", stars: 4, text: "Gostei bastante do caimento. Já estou de olho na próxima compra." },
    { name: "Carlos E.", city: "Belo Horizonte/MG", stars: 5, text: "Compra simples, tudo em uma página só. Recomendo." },
  ],

  // Ganchos para integrar com o seu back-end, CRM e pixels.
  hooks: {
    // Chamado quando a etapa 1 é concluída (base para recuperação de carrinho).
    onLead: function (lead) {
      console.info("[checkout] lead", lead);
    },
    // Chamado quando o pedido é criado.
    onOrder: function (order) {
      console.info("[checkout] pedido", order);
    },
    // Todos os eventos também vão para window.dataLayer (Google Tag Manager).
    onEvent: function (name, payload) {},
  },
};
