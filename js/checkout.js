/*
 * Checkout em 3 etapas (identificação, entrega, pagamento) numa página só.
 * Mobile/tablet: uma coluna, só a etapa ativa aparece.
 * Desktop (>= 1080px): três colunas, etapas concluídas ficam visíveis com botão de editar.
 * Pagamento e pedido são simulados; os pontos de integração estão em CHECKOUT_CONFIG.hooks.
 */
(() => {
  "use strict";

  const C = window.CHECKOUT_CONFIG;
  const STORAGE_KEY = "checkout-state-v1";
  const desktop = window.matchMedia("(min-width: 1080px)");

  /* ---------- utilidades ---------- */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const digits = (v) => String(v || "").replace(/\D/g, "");
  const round2 = (v) => Math.round(v * 100) / 100;
  const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const esc = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const hash = (s) => {
    let h = 0;
    for (const ch of String(s)) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
    return h;
  };
  const initials = (name) =>
    String(name)
      .split(/\s+/)
      .filter((w) => w.length > 1)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");

  /* ---------- ícones ---------- */

  const svg = (paths, size = 20) =>
    `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const I = {
    lock: (s) => svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', s),
    check: (s) => svg('<path d="M20 6 9 17l-5-5"/>', s),
    pencil: (s) => svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>', s),
    trash: (s) => svg('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/>', s),
    chevronDown: (s) => svg('<path d="m6 9 6 6 6-6"/>', s),
    chevronLeft: (s) => svg('<path d="m15 18-6-6 6-6"/>', s),
    chevronRight: (s) => svg('<path d="m9 18 6-6-6-6"/>', s),
    user: (s) => svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', s),
    building: (s) =>
      svg('<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3"/>', s),
    truck: (s) =>
      svg('<path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>', s),
    store: (s) => svg('<path d="M4 10v10h16V10"/><path d="M3 4h18l-1 6H4z"/><path d="M10 20v-5h4v5"/>', s),
    card: (s) => svg('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>', s),
    pix: (s) => svg('<path d="M12 2.5 21.5 12 12 21.5 2.5 12z"/><path d="M8.5 12h7"/>', s),
    barcode: (s) => svg('<path d="M4 5v14M7 5v14M11 5v14M14 5v14M18 5v14M21 5v14"/>', s),
    info: (s) => svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', s),
    copy: (s) => svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>', s),
    shield: (s) => svg('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>', s),
    gift: (s) =>
      svg('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v9h14v-9"/><path d="M12 8c-2-4-6-4-6-1.5S9 8 12 8c3 0 6 0 6-1.5S14 4 12 8z"/>', s),
    coin: (s) =>
      svg('<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.6 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5V8M12 16v1.5"/>', s),
    plus: (s) => svg('<path d="M12 5v14M5 12h14"/>', s),
    minus: (s) => svg('<path d="M5 12h14"/>', s),
    clock: (s) => svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', s),
    alert: (s) => svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>', s),
    star: (s = 14) =>
      `<svg class="icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>`,
  };

  // Miniatura gerada quando o produto não tem imagem.
  const PALETTE = ["#c7d2fe", "#fde68a", "#bbf7d0", "#fecaca", "#bae6fd", "#ddd6fe", "#fed7aa"];
  const productImage = (item) => {
    if (item.image) return item.image;
    const bg = PALETTE[hash(item.id || item.name) % PALETTE.length];
    const text = initials(item.name);
    const art =
      `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" rx="18" fill="${bg}"/>` +
      `<text x="60" y="72" font-family="Inter,Arial,sans-serif" font-size="36" font-weight="700" fill="#1e293b" fill-opacity=".65" text-anchor="middle">${text}</text></svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(art);
  };

  /* ---------- máscaras e validações ---------- */

  const masks = {
    cpf: (v) =>
      digits(v)
        .slice(0, 11)
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2"),
    cnpj: (v) =>
      digits(v)
        .slice(0, 14)
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2"),
    phone: (v) => {
      const d = digits(v).slice(0, 11);
      if (d.length <= 10) return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
      return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
    },
    cep: (v) => digits(v).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2"),
    card: (v) => digits(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 "),
    expiry: (v) => digits(v).slice(0, 4).replace(/^(\d{2})(\d)/, "$1/$2"),
    cvv: (v) => digits(v).slice(0, 4),
    ie: (v) => digits(v).slice(0, 14),
  };

  const isTestDocument = (v) => !!C.demo && (C.testDocuments || []).includes(String(v).trim());

  function validCPF(v) {
    const d = digits(v);
    if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
    const check = (len) => {
      let sum = 0;
      for (let i = 0; i < len; i++) sum += +d[i] * (len + 1 - i);
      const r = (sum * 10) % 11;
      return r === 10 ? 0 : r;
    };
    return check(9) === +d[9] && check(10) === +d[10];
  }

  function validCNPJ(v) {
    const d = digits(v);
    if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
    const check = (len) => {
      let sum = 0;
      let weight = len - 7;
      for (let i = 0; i < len; i++) {
        sum += +d[i] * weight--;
        if (weight < 2) weight = 9;
      }
      const r = sum % 11;
      return r < 2 ? 0 : 11 - r;
    };
    return check(12) === +d[12] && check(13) === +d[13];
  }

  function luhn(v) {
    const d = digits(v);
    let sum = 0;
    for (let i = 0; i < d.length; i++) {
      let n = +d[d.length - 1 - i];
      if (i % 2 === 1) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
    }
    return d.length > 0 && sum % 10 === 0;
  }

  function validExpiry(v) {
    const d = digits(v);
    if (d.length !== 4) return false;
    const month = +d.slice(0, 2);
    const year = 2000 + +d.slice(2);
    if (month < 1 || month > 12) return false;
    const now = new Date();
    return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
  }

  const BRAND_NAMES = { visa: "Visa", mastercard: "Mastercard", elo: "Elo", amex: "Amex", hipercard: "Hipercard", diners: "Diners" };
  function cardBrand(v) {
    const d = digits(v);
    if (/^(4011(78|79)|43(1274|8935)|45(1416|7393|763[12])|50(4175|6699|67[0-7]\d|9\d{3})|627780|63(6297|6368)|650(4\d\d|5[0-2]\d)|6516(5[2-9]|[67]\d)|6550([01]\d))/.test(d))
      return "elo";
    if (/^(606282|3841)/.test(d)) return "hipercard";
    if (/^3[47]/.test(d)) return "amex";
    if (/^3(0[0-5]|[68])/.test(d)) return "diners";
    if (/^4/.test(d)) return "visa";
    if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(d)) return "mastercard";
    return null;
  }

  const REGION = {
    SP: "SE", RJ: "SE", MG: "SE", ES: "SE",
    PR: "S", SC: "S", RS: "S",
    DF: "CO", GO: "CO", MT: "CO", MS: "CO",
    BA: "NE", SE: "NE", AL: "NE", PE: "NE", PB: "NE", RN: "NE", CE: "NE", PI: "NE", MA: "NE",
    PA: "N", AP: "N", AM: "N", RR: "N", AC: "N", RO: "N", TO: "N",
  };

  const RULES = {
    name: (v) => v.trim().split(/\s+/).length >= 2 || "Informe nome e sobrenome",
    company: (v) => v.trim().length >= 3 || "Informe a razão social",
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || "Informe um e-mail válido",
    cpf: (v) => isTestDocument(v) || validCPF(v) || "CPF inválido",
    cnpj: (v) => isTestDocument(v) || validCNPJ(v) || "CNPJ inválido",
    ie: (v, form) =>
      (form && form.elements.ieExempt && form.elements.ieExempt.checked) ||
      digits(v).length >= 8 ||
      "Informe a inscrição estadual ou marque isento",
    phone: (v) => /^[1-9]{2}9?\d{8}$/.test(digits(v)) || "Informe um celular com DDD",
    zipcode: (v) => digits(v).length === 8 || "CEP inválido",
    street: (v) => v.trim().length >= 3 || "Informe o endereço",
    number: (v) => v.trim().length >= 1 || "Campo obrigatório",
    neighborhood: (v) => v.trim().length >= 2 || "Informe o bairro",
    city: (v) => v.trim().length >= 2 || "Informe a cidade",
    uf: (v) => !!REGION[v.trim().toUpperCase()] || "UF inválida",
    recipient: (v) => v.trim().length >= 3 || "Informe quem vai receber",
    card_number: (v) => (digits(v).length >= 13 && luhn(v) && !!cardBrand(v)) || "Número de cartão inválido",
    card_expiry: (v) => validExpiry(v) || "Validade inválida",
    card_cvv: (v) => /^\d{3,4}$/.test(digits(v)) || "Código inválido",
    card_holder: (v) => v.trim().split(/\s+/).length >= 2 || "Digite o nome como está no cartão",
    card_document: (v) => isTestDocument(v) || validCPF(v) || validCNPJ(v) || "Documento do titular inválido",
  };

  /* ---------- estado ---------- */

  const newState = () => ({
    active: 1,
    completed: [],
    customer: { type: "pf", name: "", email: "", cpf: "", phone: "", company: "", cnpj: "", ie: "", ieExempt: false, newsletter: true },
    addressMode: "cep", // cep | form | select
    addressDraft: null,
    addresses: [],
    selectedAddress: null,
    editingAddress: null,
    cepStatus: null, // null | loading | notfound | outside
    shippingId: null,
    payment: null,
    methodLoading: false,
    installments: 1,
    coupon: null,
    couponDraft: "",
    couponMsg: null,
    bumps: {},
    items: clone(C.cart),
    summaryOpen: true,
    exitShown: false,
  });

  function load() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? Object.assign(newState(), JSON.parse(raw), { methodLoading: false, cepStatus: null }) : null;
    } catch {
      return null;
    }
  }
  function save() {
    try {
      const { methodLoading, cepStatus, couponMsg, ...rest } = state;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
    } catch {
      /* navegação privada sem storage: segue sem salvar */
    }
  }

  let state = load() || newState();
  // Dados do cartão ficam só em memória: nunca vão para o storage.
  const card = { number: "", expiry: "", cvv: "", holder: "", document: "" };
  let orderPlaced = false;

  const customerName = () => (state.customer.type === "pf" ? state.customer.name : state.customer.company);

  /* ---------- carrinho, frete e totais ---------- */

  const bumpById = (id) => (C.orderBumps || []).find((b) => b.id === id);

  function allItems() {
    const bumps = Object.entries(state.bumps)
      .map(([id, sel]) => {
        const b = bumpById(id);
        if (!b) return null;
        const variant = sel.variant && b.variant ? `${b.variant.label}: ${sel.variant}` : "";
        return { id: "bump:" + id, bumpId: id, name: b.name, variant, price: b.price, qty: 1, bump: true, image: b.image };
      })
      .filter(Boolean);
    return state.items.concat(bumps);
  }

  const subtotal = () => round2(allItems().reduce((s, i) => s + i.price * i.qty, 0));
  const findCoupon = (code) => (C.coupons || []).find((c) => c.code.toUpperCase() === String(code || "").trim().toUpperCase());
  const currentAddress = () => state.addresses.find((a) => a.id === state.selectedAddress) || null;

  function shippingOptions(address) {
    if (!address) return [];
    const region = REGION[address.uf] || "SE";
    const sub = subtotal();
    const freeFrom = C.shipping.freeShippingFrom;
    const opts = C.shipping.options.map((o) => ({
      id: o.id,
      name: o.name,
      kind: "delivery",
      days: o.days[region],
      price: freeFrom && sub >= freeFrom && o.freeShippingEligible ? 0 : o.price[region],
    }));
    const p = C.shipping.pickup;
    if (p && p.enabled && (!p.states || p.states.includes(address.uf)))
      opts.push({ id: "pickup", name: p.name, kind: "pickup", days: p.days, price: 0, place: p.address });
    const delivery = opts.filter((o) => o.kind === "delivery");
    const cheapest = Math.min(...delivery.map((o) => o.price));
    const fastest = Math.min(...delivery.map((o) => o.days));
    delivery.forEach((o) => {
      o.cheapest = o.price === cheapest && delivery.filter((x) => x.price === cheapest).length === 1;
      o.fastest = o.days === fastest && delivery.filter((x) => x.days === fastest).length === 1;
    });
    return opts.sort((a, b) => a.price - b.price || a.days - b.days);
  }

  const currentShipping = () => shippingOptions(currentAddress()).find((o) => o.id === state.shippingId) || null;

  function defaultShipping() {
    const opts = shippingOptions(currentAddress());
    const pick = opts.find((o) => o.cheapest) || opts.find((o) => o.kind === "delivery") || opts[0];
    return pick ? pick.id : null;
  }

  function totals(method = state.payment) {
    const sub = subtotal();
    const coupon = state.coupon ? findCoupon(state.coupon) : null;
    let couponDiscount = 0;
    if (coupon && coupon.type === "percent") couponDiscount = round2((sub * coupon.value) / 100);
    if (coupon && coupon.type === "fixed") couponDiscount = Math.min(coupon.value, sub);
    const base = round2(sub - couponDiscount);
    const m = method && C.payments[method];
    const methodDiscount = m && m.discountPercent ? round2((base * m.discountPercent) / 100) : 0;
    const ship = currentShipping();
    let shipping = ship ? ship.price : null;
    if (ship && coupon && coupon.type === "shipping") shipping = 0;
    const total = round2(base - methodDiscount + (shipping || 0));
    const cashback = round2(((base - methodDiscount) * (C.cashbackPercent || 0)) / 100);
    const count = allItems().reduce((s, i) => s + i.qty, 0);
    return { sub, coupon, couponDiscount, methodDiscount, discount: round2(couponDiscount + methodDiscount), shipping, total, cashback, count, method: m };
  }

  function installmentPlan(total) {
    const cfg = C.payments.card;
    const plans = [];
    for (let n = 1; n <= cfg.maxInstallments; n++) {
      let value;
      let withInterest = false;
      if (n <= cfg.interestFree) value = total / n;
      else {
        const i = cfg.monthlyInterest / 100;
        value = (total * i) / (1 - Math.pow(1 + i, -n));
        withInterest = true;
      }
      if (n > 1 && value < cfg.minInstallment) break;
      plans.push({ n, value: round2(value), total: round2(value * n), withInterest });
    }
    return plans;
  }
  const planLabel = (p) =>
    p.withInterest ? `${p.n}x de ${brl(p.value)} (total ${brl(p.total)})` : `${p.n}x de ${brl(p.value)} sem juros`;

  function installmentOptions(total) {
    const plans = installmentPlan(total);
    if (state.installments > plans.length) state.installments = 1;
    return plans.map((p) => `<option value="${p.n}"${p.n === state.installments ? " selected" : ""}>${planLabel(p)}</option>`).join("");
  }

  /* ---------- datas de entrega ---------- */

  function addBusinessDays(from, n) {
    const d = new Date(from);
    let added = 0;
    while (added < n) {
      d.setDate(d.getDate() + 1);
      const wd = d.getDay();
      if (wd !== 0 && wd !== 6) added++;
    }
    return d;
  }

  function etaText(days, kind) {
    if (kind === "pickup") return days <= 1 ? "Pronto para retirada em 1 dia útil" : `Pronto para retirada em ${days} dias úteis`;
    const d = addBusinessDays(new Date(), days);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((day - today) / 86400000);
    if (diff === 1) return "Chega amanhã";
    if (diff <= 7) return `Chega até ${d.toLocaleDateString("pt-BR", { weekday: "long" }).replace("-feira", "")}, dia ${d.getDate()}`;
    return `Chega até ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
  }

  const addressLine1 = (a) => `${a.street}, ${a.number}${a.complement ? " · " + a.complement : ""}`;
  const addressLine2 = (a) => `${a.neighborhood} · ${a.city}/${a.uf} · CEP ${a.cep}`;

  /* ---------- eventos de rastreamento ---------- */

  window.dataLayer = window.dataLayer || [];
  function track(event, extra = {}) {
    const t = totals();
    const payload = {
      event,
      ecommerce: {
        currency: "BRL",
        value: t.total,
        items: allItems().map((i) => ({ item_id: i.id, item_name: i.name, item_variant: i.variant, price: i.price, quantity: i.qty })),
        ...extra,
      },
    };
    window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push(payload);
    if (C.hooks && C.hooks.onEvent) C.hooks.onEvent(event, payload);
  }

  /* ---------- tema e moldura da página ---------- */

  function applyTheme() {
    const t = C.theme || {};
    const vars = {
      primary: "--primary",
      primaryDark: "--primary-dark",
      primarySoft: "--primary-soft",
      success: "--success",
      trustBar: "--trust",
      bump: "--bump",
      bumpSoft: "--bump-soft",
      bumpLine: "--bump-line",
    };
    Object.entries(vars).forEach(([key, cssVar]) => {
      if (t[key]) document.documentElement.style.setProperty(cssVar, t[key]);
    });
  }

  function renderChrome() {
    const s = C.store;
    document.title = `Finalizar compra · ${s.name}`;
    const brand = $("#brand");
    brand.href = s.homeUrl || "#";
    brand.innerHTML = `<span class="brand__mark">${esc(s.logoInitial || s.name[0])}</span><span class="brand__name">${esc(s.name)}</span>`;
    $("#trustbar").innerHTML = `${I.shield(16)}<span>${s.trustMessage}</span>`;
    $("#demoBar").hidden = !C.demo;

    const p = C.payments;
    const chips = [...(p.card.enabled ? p.card.brands : []), ...(p.pix.enabled ? ["Pix"] : []), ...(p.boleto.enabled ? ["Boleto"] : [])];
    $("#footer").innerHTML = `
      <div class="footer__inner">
        <div class="seal">${I.shield(28)}<div><strong>${esc(s.reputation.title)}</strong><span>${esc(s.reputation.subtitle)}</span></div></div>
        <p class="footer__label">Formas de pagamento</p>
        <ul class="paychips">${chips.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
        <nav class="footer__links" aria-label="Informações da loja">
          <button type="button" class="link" data-action="modal" data-modal="payments">Formas de pagamento</button>
          <button type="button" class="link" data-action="modal" data-modal="contact">Atendimento</button>
          <button type="button" class="link" data-action="modal" data-modal="privacy">Privacidade</button>
        </nav>
        <p class="footer__legal">${esc(s.name)} · ${esc(s.domain)}<br>${esc(s.legalName)} · CNPJ ${esc(s.cnpj)}</p>
        <p class="footer__secure">${I.lock(14)} Pagamento 100% seguro</p>
      </div>`;
  }

  /* ---------- campos ---------- */

  function field(o) {
    const id = `f-${o.name}`;
    const attrs = [
      `id="${id}"`,
      `name="${o.name}"`,
      `type="${o.type || "text"}"`,
      'placeholder=" "',
      `value="${esc(o.value || "")}"`,
      `autocomplete="${o.autocomplete || "off"}"`,
      `aria-describedby="${id}-err"`,
      o.inputmode ? `inputmode="${o.inputmode}"` : "",
      o.mask ? `data-mask="${o.mask}"` : "",
      o.maxlength ? `maxlength="${o.maxlength}"` : "",
      o.disabled ? "disabled" : "",
    ].join(" ");
    return `<div class="field${o.cls ? " " + o.cls : ""}" data-field="${o.name}"><input ${attrs}><label for="${id}">${esc(o.label)}</label><p class="field__error" id="${id}-err" aria-live="polite"></p></div>`;
  }

  function validateInput(input) {
    const rule = RULES[input.name];
    if (!rule || input.disabled) return true;
    const result = rule(input.value, input.form);
    const ok = result === true;
    const wrap = input.closest(".field");
    if (wrap) {
      wrap.classList.toggle("is-invalid", !ok);
      const err = wrap.querySelector(".field__error");
      if (err) err.textContent = ok ? "" : result;
    }
    input.setAttribute("aria-invalid", String(!ok));
    return ok;
  }

  function validateForm(form) {
    const inputs = $$("input[name]", form).filter((i) => RULES[i.name] && !i.disabled);
    const results = inputs.map(validateInput);
    const firstBad = inputs[results.indexOf(false)];
    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  /* ---------- etapas ---------- */

  const STEP_TITLES = { 1: "Identificação", 2: "Entrega", 3: "Pagamento" };

  function stepStatus(n) {
    if (state.active === n) return "active";
    if (state.completed.includes(n)) return "done";
    return "locked";
  }

  function lockedMessage(n) {
    const pending = [1, 2].find((k) => k < n && !state.completed.includes(k) && state.active !== k);
    if (pending === 1 || (state.active === 1 && n > 1)) return "Preencha seus dados para continuar";
    if (pending === 2 || state.active === 2) return "Preencha as informações de entrega para continuar";
    return "Conclua a etapa em edição para continuar";
  }

  function renderStep(n) {
    const el = $(`#step-${n}`);
    const status = stepStatus(n);
    el.className = `card step is-${status}`;
    const back = status === "active" && n > 1 ? `<button type="button" class="link step__back" data-action="back">Voltar</button>` : "";
    const edit =
      status === "done"
        ? `<button type="button" class="step__edit" data-action="edit" data-step="${n}" aria-label="Editar ${STEP_TITLES[n]}">${I.pencil(16)}</button>`
        : "";
    const count = status === "done" ? "" : `<span class="step__count">${n} de 3</span>`;
    const ok = status === "done" ? `<span class="step__ok">${I.check(13)}</span>` : "";
    const perk =
      status === "active" && C.cashbackPercent
        ? `<p class="perk">${I.coin(16)}<span>Ganhe <strong data-bind="cashback">${brl(totals().cashback)}</strong> de cashback para a próxima compra</span></p>`
        : "";
    let body;
    if (status === "locked") body = `<p class="step__locked">${lockedMessage(n)}</p>`;
    else if (status === "done") body = doneSummary(n);
    else body = { 1: step1, 2: step2, 3: step3 }[n]();
    el.innerHTML = `${perk}<header class="step__head"><h2 class="step__title">${ok}${STEP_TITLES[n]}</h2><div class="step__meta">${back}${count}${edit}</div></header><div class="step__body">${body}</div>`;
  }

  const renderSteps = () => [1, 2, 3].forEach(renderStep);

  function doneSummary(n) {
    const c = state.customer;
    if (n === 1) {
      const doc = c.type === "pf" ? `CPF ${esc(c.cpf)}` : `CNPJ ${esc(c.cnpj)}`;
      return `<div class="done"><strong>${esc(customerName())}</strong><span>${esc(c.email)}</span><span>${doc}</span></div>`;
    }
    if (n === 2) {
      const a = currentAddress();
      const s = currentShipping();
      if (!a) return "";
      return `<div class="done">
        <span class="done__label">Endereço de entrega</span><span>${esc(addressLine1(a))}</span><span>${esc(addressLine2(a))}</span>
        ${s ? `<span class="done__label">Forma de entrega</span><span>${esc(s.name)} · ${s.price ? brl(s.price) : "Grátis"}</span><span class="muted">${esc(etaText(s.days, s.kind))}</span>` : ""}
      </div>`;
    }
    return "";
  }

  // Etapa 1 — identificação
  function step1() {
    const c = state.customer;
    const pf = c.type === "pf";
    const pix = C.payments.pix.enabled && C.payments.pix.discountPercent;
    return `
      <div class="segmented" role="group" aria-label="Tipo de cliente">
        <button type="button" data-action="person" data-value="pf" aria-pressed="${pf}">${I.user(16)} Pessoa física</button>
        <button type="button" data-action="person" data-value="pj" aria-pressed="${!pf}">${I.building(16)} Pessoa jurídica</button>
      </div>
      <form id="form-identification" novalidate>
        ${pf ? field({ name: "name", label: "Nome completo", value: c.name, autocomplete: "name" }) : field({ name: "company", label: "Razão social", value: c.company, autocomplete: "organization" })}
        ${field({ name: "email", label: "E-mail", value: c.email, type: "email", inputmode: "email", autocomplete: "email" })}
        ${pf ? field({ name: "cpf", label: "CPF", value: c.cpf, inputmode: "numeric", mask: "cpf" }) : field({ name: "cnpj", label: "CNPJ", value: c.cnpj, inputmode: "numeric", mask: "cnpj" })}
        ${
          pf
            ? ""
            : `<div class="row">${field({ name: "ie", label: "Inscrição estadual", value: c.ieExempt ? "" : c.ie, inputmode: "numeric", mask: "ie", disabled: c.ieExempt })}
               <label class="check check--inline"><input type="checkbox" name="ieExempt"${c.ieExempt ? " checked" : ""}><span>Isento</span></label></div>`
        }
        ${field({ name: "phone", label: "Celular / WhatsApp", value: c.phone, type: "tel", inputmode: "tel", mask: "phone", autocomplete: "tel-national" })}
        <label class="check"><input type="checkbox" name="newsletter"${c.newsletter ? " checked" : ""}><span>Quero receber ofertas e novidades por e-mail</span></label>
        ${pix ? `<p class="hint hint--success">${I.pix(16)}<span>Pagando com Pix você ganha <strong>${pix}% de desconto</strong></span></p>` : ""}
        <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button class="btn btn--primary btn--block" type="submit">Continuar para entrega</button>
        <p class="fineprint">Ao continuar, você concorda com a <button type="button" class="link" data-action="modal" data-modal="privacy">Política de Privacidade</button>.</p>
      </form>`;
  }

  function submitIdentification(form) {
    if (form.elements.website && form.elements.website.value) return; // armadilha anti-robô
    if (!validateForm(form)) return;
    const c = state.customer;
    const f = form.elements;
    ["name", "company", "email", "cpf", "cnpj", "ie", "phone"].forEach((k) => {
      if (f[k]) c[k] = f[k].value.trim();
    });
    c.ieExempt = !!(f.ieExempt && f.ieExempt.checked);
    c.newsletter = !!(f.newsletter && f.newsletter.checked);
    if (C.hooks && C.hooks.onLead) C.hooks.onLead({ customer: clone(c), items: allItems(), total: totals().total });
    track("generate_lead");
    completeStep(1);
  }

  // Etapa 2 — entrega
  function step2() {
    if (state.addressMode === "select" && state.addresses.length) return step2Select();
    if (state.addressMode === "form" && state.addressDraft) return step2Form();
    return step2Cep();
  }

  function step2Cep() {
    const d = state.addressDraft || {};
    let msg = "";
    if (state.cepStatus === "notfound")
      msg = `<p class="notice notice--error">${I.alert(18)}<span>Não encontramos esse CEP. Confira os números ou preencha o endereço manualmente.</span></p>
        <button type="button" class="link" data-action="address-manual">Preencher endereço manualmente</button>`;
    if (state.cepStatus === "outside")
      msg = `<p class="notice notice--error">${I.alert(18)}<span>Que pena! Ainda não entregamos na sua região.</span></p>`;
    return `
      <form id="form-cep" novalidate>
        <div class="row row--cep">
          ${field({ name: "zipcode", label: "CEP", value: d.cep || "", inputmode: "numeric", mask: "cep", autocomplete: "postal-code" })}
          <a class="link link--small" href="https://buscacepinter.correios.com.br/app/endereco/index.php" target="_blank" rel="noopener">Não sei meu CEP</a>
        </div>
        ${msg}
      </form>
      ${state.addresses.length ? `<button type="button" class="link" data-action="address-cancel">Usar um endereço salvo</button>` : ""}`;
  }

  function step2Form() {
    const a = state.addressDraft;
    return `
      <form id="form-address" novalidate>
        <div class="row row--cep">
          ${field({ name: "zipcode", label: "CEP", value: a.cep, inputmode: "numeric", mask: "cep", autocomplete: "postal-code" })}
          ${a.manual ? "" : `<p class="cep-city">${esc(a.city)} / ${esc(a.uf)}</p>`}
        </div>
        ${field({ name: "street", label: "Endereço", value: a.street, autocomplete: "address-line1" })}
        <div class="row">
          ${field({ name: "number", label: "Número", value: a.number, cls: "field--narrow" })}
          ${field({ name: "neighborhood", label: "Bairro", value: a.neighborhood })}
        </div>
        ${field({ name: "complement", label: "Complemento (opcional)", value: a.complement, autocomplete: "address-line2" })}
        ${
          a.manual
            ? `<div class="row">${field({ name: "city", label: "Cidade", value: a.city, autocomplete: "address-level2" })}${field({ name: "uf", label: "UF", value: a.uf, maxlength: 2, cls: "field--narrow", autocomplete: "address-level1" })}</div>`
            : ""
        }
        ${field({ name: "recipient", label: "Destinatário", value: a.recipient || customerName() })}
        <button class="btn btn--primary btn--block" type="submit">Salvar endereço</button>
        ${state.addresses.length ? `<button type="button" class="link link--center" data-action="address-cancel">Cancelar</button>` : ""}
      </form>`;
  }

  function freeShippingNudge() {
    const from = C.shipping.freeShippingFrom;
    if (!from) return "";
    const sub = subtotal();
    if (sub >= from) return `<p class="freebar freebar--done">${I.check(14)} Você ganhou frete grátis na entrega econômica</p>`;
    const pct = Math.min(100, Math.round((sub / from) * 100));
    return `<div class="freebar"><span>Faltam <strong>${brl(from - sub)}</strong> para ganhar frete grátis</span>
      <div class="freebar__track"><div class="freebar__fill" style="width:${pct}%"></div></div></div>`;
  }

  function step2Select() {
    const opts = shippingOptions(currentAddress());
    if (!opts.some((o) => o.id === state.shippingId)) state.shippingId = defaultShipping();
    return `
      <button type="button" class="link link--add" data-action="address-new">${I.plus(16)} Novo endereço</button>
      <div class="options" role="radiogroup" aria-label="Endereço de entrega">
        ${state.addresses
          .map((a) => {
            const sel = a.id === state.selectedAddress;
            return `<div class="option${sel ? " is-selected" : ""}" role="radio" tabindex="0" aria-checked="${sel}" data-action="address-select" data-id="${a.id}">
              <span class="radio"></span>
              <span class="option__main"><strong>${esc(addressLine1(a))}</strong><small>${esc(addressLine2(a))}</small><small>Para: ${esc(a.recipient)}</small></span>
              <span class="option__tools">
                <button type="button" class="tool" data-action="address-edit" data-id="${a.id}">${I.pencil(16)}<span>Editar</span></button>
                <button type="button" class="tool" data-action="address-remove" data-id="${a.id}">${I.trash(16)}<span>Excluir</span></button>
              </span>
            </div>`;
          })
          .join("")}
      </div>
      <h3 class="subhead">Como você quer receber?</h3>
      <div class="options" role="radiogroup" aria-label="Forma de entrega">
        ${opts
          .map((o) => {
            const sel = o.id === state.shippingId;
            return `<div class="option${sel ? " is-selected" : ""}" role="radio" tabindex="0" aria-checked="${sel}" data-action="shipping-select" data-id="${o.id}">
              <span class="radio"></span>
              <span class="option__main">
                <span class="option__title">${o.kind === "pickup" ? I.store(16) : I.truck(16)}<strong>${esc(o.name)}</strong>${o.cheapest ? '<span class="badge badge--cheap">Mais econômico</span>' : ""}${o.fastest ? '<span class="badge badge--fast">Mais rápido</span>' : ""}</span>
                <small>${esc(etaText(o.days, o.kind))}</small>${o.place ? `<small>${esc(o.place)}</small>` : ""}
              </span>
              <span class="option__price${o.price === 0 ? " is-free" : ""}">${o.price === 0 ? "Grátis" : brl(o.price)}</span>
            </div>`;
          })
          .join("")}
      </div>
      ${freeShippingNudge()}
      <button type="button" class="btn btn--primary btn--block" data-action="goto-payment">Ir para pagamento</button>`;
  }

  let cepRequest = 0;
  function toggleCepSpinner(on) {
    const wrap = $('[data-field="zipcode"]');
    if (!wrap) return;
    const sp = wrap.querySelector(".spinner");
    if (on && !sp) wrap.insertAdjacentHTML("beforeend", '<span class="spinner spinner--field" role="status" aria-label="Buscando CEP"></span>');
    if (!on && sp) sp.remove();
  }

  async function lookupCep(raw) {
    const cep = digits(raw);
    const req = ++cepRequest;
    const draft = state.addressDraft || {};
    toggleCepSpinner(true);
    let data = null;
    let failed = false;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 7000);
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: ctrl.signal });
      clearTimeout(timer);
      data = await res.json();
    } catch {
      failed = true;
    }
    if (req !== cepRequest) return;
    toggleCepSpinner(false);
    state.cepStatus = null;
    const recipient = draft.recipient || customerName();
    if (failed) {
      // Sem internet ou serviço fora: deixa preencher tudo à mão.
      state.addressDraft = { ...draft, cep: masks.cep(cep), cepLooked: cep, manual: true, recipient };
      state.addressMode = "form";
    } else if (data.erro) {
      state.cepStatus = "notfound";
      state.addressDraft = { ...draft, cep: masks.cep(cep) };
      state.addressMode = "cep";
    } else if (C.shipping.servedStates && !C.shipping.servedStates.includes(data.uf)) {
      state.cepStatus = "outside";
      state.addressDraft = { cep: masks.cep(cep) };
      state.addressMode = "cep";
    } else {
      state.addressDraft = {
        ...draft,
        cep: masks.cep(cep),
        cepLooked: cep,
        street: data.logradouro || "",
        neighborhood: data.bairro || "",
        city: data.localidade,
        uf: data.uf,
        manual: false,
        number: draft.number || "",
        complement: draft.complement || "",
        recipient,
      };
      state.addressMode = "form";
    }
    save();
    renderStep(2);
    if (state.addressMode === "form") {
      const target = state.addressDraft.street ? $("#f-number") : $("#f-street");
      if (target) target.focus();
    }
  }

  function submitAddress(form) {
    if (!validateForm(form)) return;
    const f = form.elements;
    const d = state.addressDraft;
    const addr = {
      id: state.editingAddress || "a" + Date.now(),
      cep: masks.cep(f.zipcode.value),
      street: f.street.value.trim(),
      number: f.number.value.trim(),
      neighborhood: f.neighborhood.value.trim(),
      complement: f.complement.value.trim(),
      city: d.manual ? f.city.value.trim() : d.city,
      uf: (d.manual ? f.uf.value : d.uf).trim().toUpperCase(),
      recipient: f.recipient.value.trim(),
    };
    const i = state.addresses.findIndex((a) => a.id === addr.id);
    if (i >= 0) state.addresses[i] = addr;
    else state.addresses.push(addr);
    state.selectedAddress = addr.id;
    state.editingAddress = null;
    state.addressDraft = null;
    state.addressMode = "select";
    state.shippingId = defaultShipping();
    save();
    renderStep(2);
    refreshTotals();
  }

  // Etapa 3 — pagamento
  function step3() {
    const order = (C.payments.order || ["card", "pix", "boleto"]).filter((k) => C.payments[k] && C.payments[k].enabled);
    const t = totals();
    const ready = state.payment && !state.methodLoading;
    return `
      <div class="methods" role="radiogroup" aria-label="Forma de pagamento">${order.map((k) => methodBlock(k, t)).join("")}</div>
      ${
        ready
          ? `${bumpsBlock()}<button type="button" class="btn btn--primary btn--block btn--lg" data-action="finalize">${I.lock(18)} Finalizar compra</button>
             <p class="secure-note">${I.shield(14)} Ambiente seguro. Seus dados são criptografados.</p>`
          : `<p class="step__hint">Escolha uma forma de pagamento para continuar.</p>`
      }`;
  }

  function methodBlock(key, t) {
    const m = C.payments[key];
    const selected = state.payment === key;
    const loading = selected && state.methodLoading;
    const icon = { card: I.card(20), pix: I.pix(20), boleto: I.barcode(20) }[key];
    const badge = m.discountPercent ? `<span class="badge badge--discount">${m.discountPercent}% de desconto</span>` : "";
    const brands = key === "card" ? `<span class="brands">${m.brands.map((b) => `<span class="brandchip">${esc(b)}</span>`).join("")}</span>` : "";
    const panel = { card: cardPanel, pix: pixPanel, boleto: boletoPanel }[key];
    return `
      <div class="method${selected ? " is-selected" : ""}${loading ? " is-loading" : ""}">
        <button type="button" class="method__head" role="radio" aria-checked="${selected}" data-action="method" data-id="${key}">
          <span class="radio"></span>${icon}<span class="method__name">${esc(m.label)}${brands}</span>${badge}${loading ? '<span class="spinner"></span>' : ""}
        </button>
        ${selected && !loading ? `<div class="method__panel">${panel(t)}</div>` : ""}
      </div>`;
  }

  const previewNumber = (v) => digits(v).padEnd(16, "•").slice(0, 19).replace(/(.{4})(?=.)/g, "$1 ");

  function cardPanel(t) {
    const brand = cardBrand(card.number);
    const valid = RULES.card_number(card.number) === true;
    return `
      <div class="card-preview" data-brand="${brand || ""}" aria-hidden="true">
        <div class="card-preview__top"><span class="card-preview__chip"></span><span class="card-preview__brand" data-bind="card-brand">${brand ? BRAND_NAMES[brand] : ""}</span></div>
        <div class="card-preview__number" data-bind="card-number">${esc(previewNumber(card.number))}</div>
        <div class="card-preview__bottom">
          <span><small>Titular</small><b data-bind="card-holder">${esc(card.holder.trim() || "Nome do titular")}</b></span>
          <span><small>Validade</small><b data-bind="card-expiry">${esc(card.expiry || "MM/AA")}</b></span>
        </div>
      </div>
      <form id="form-card" novalidate>
        ${field({ name: "card_number", label: "Número do cartão", value: card.number, inputmode: "numeric", mask: "card", autocomplete: "cc-number" })}
        <div class="row">
          ${field({ name: "card_expiry", label: "Validade (MM/AA)", value: card.expiry, inputmode: "numeric", mask: "expiry", autocomplete: "cc-exp" })}
          ${field({ name: "card_cvv", label: "Cód. de segurança", value: card.cvv, inputmode: "numeric", mask: "cvv", autocomplete: "cc-csc" })}
        </div>
        ${field({ name: "card_holder", label: "Nome impresso no cartão", value: card.holder, autocomplete: "cc-name" })}
        ${field({ name: "card_document", label: "CPF do titular", value: card.document, inputmode: "numeric", mask: "cpf" })}
        <div class="field field--select${valid ? "" : " is-disabled"}">
          <select id="f-installments" name="installments"${valid ? "" : " disabled"}>${installmentOptions(t.total)}</select>
          <label for="f-installments">Parcelas</label>
        </div>
        <p class="field__help" data-bind="installments-help">${valid ? "" : "Preencha o número do cartão para ver as parcelas"}</p>
      </form>`;
  }

  function pixPanel(t) {
    const m = C.payments.pix;
    return `<div class="pay-info">
      <p>O código Pix aparece assim que você finalizar. A aprovação é imediata e o pedido é liberado na hora.</p>
      <ul class="ticks">
        <li>${I.check(14)} Pague pelo app do seu banco, com QR Code ou copia e cola</li>
        <li>${I.clock(14)} O código vale por ${m.expiresMinutes} minutos</li>
      </ul>
      <p class="pay-total">Total no Pix: <strong data-bind="method-total">${brl(t.total)}</strong>
        <span class="saving" data-bind="method-saving"${t.methodDiscount ? "" : " hidden"}>você economiza ${brl(t.methodDiscount)}</span></p>
    </div>`;
  }

  function boletoPanel(t) {
    const m = C.payments.boleto;
    return `<div class="pay-info">
      <p>O boleto vence em ${m.dueDays} dias úteis. O pedido é liberado depois da compensação, que leva até 2 dias úteis.</p>
      <ul class="ticks"><li>${I.check(14)} Pague no app do banco, internet banking ou lotérica</li></ul>
      <p class="pay-total">Total no boleto: <strong data-bind="method-total">${brl(t.total)}</strong>
        <span class="saving" data-bind="method-saving"${t.methodDiscount ? "" : " hidden"}>você economiza ${brl(t.methodDiscount)}</span></p>
    </div>`;
  }

  function updateCardUI() {
    const preview = $(".card-preview");
    if (!preview) return;
    const brand = cardBrand(card.number);
    preview.dataset.brand = brand || "";
    $('[data-bind="card-brand"]').textContent = brand ? BRAND_NAMES[brand] : "";
    $('[data-bind="card-number"]').textContent = previewNumber(card.number);
    $('[data-bind="card-holder"]').textContent = card.holder.trim() || "Nome do titular";
    $('[data-bind="card-expiry"]').textContent = card.expiry || "MM/AA";
    const valid = RULES.card_number(card.number) === true;
    const sel = $("#f-installments");
    sel.disabled = !valid;
    sel.closest(".field").classList.toggle("is-disabled", !valid);
    $('[data-bind="installments-help"]').textContent = valid ? "" : "Preencha o número do cartão para ver as parcelas";
  }

  // Order bump: ofertas dentro do pagamento
  function bumpsBlock() {
    const list = C.orderBumps || [];
    if (!list.length) return "";
    const many = list.length > 1;
    return `
      <section class="bumps" aria-label="Ofertas para adicionar ao pedido">
        <div class="bumps__head">
          <span class="bumps__pill">${I.gift(14)} ${many ? `Você tem ${list.length} ofertas` : "Oferta especial pra você"}</span>
          ${many ? `<span class="bumps__nav"><button type="button" data-action="carousel" data-target="bumpTrack" data-dir="-1" aria-label="Oferta anterior">${I.chevronLeft(16)}</button><button type="button" data-action="carousel" data-target="bumpTrack" data-dir="1" aria-label="Próxima oferta">${I.chevronRight(16)}</button></span>` : ""}
        </div>
        <div class="bumps__track" id="bumpTrack">${list.map(bumpCard).join("")}</div>
        ${many ? `<div class="dots" data-dots-for="bumpTrack">${list.map((_, i) => `<span class="dot${i === 0 ? " is-active" : ""}"></span>`).join("")}</div>` : ""}
      </section>`;
  }

  function bumpCard(b) {
    const sel = state.bumps[b.id];
    const added = !!sel;
    const off = b.compareAt ? Math.round((1 - b.price / b.compareAt) * 100) : 0;
    const variant = b.variant
      ? `<label class="mini-select"><span>${esc(b.variant.label)}</span><select data-bump-variant="${b.id}">${b.variant.options
          .map((o) => `<option${sel && sel.variant === o ? " selected" : ""}>${esc(o)}</option>`)
          .join("")}</select></label>`
      : "";
    return `
      <article class="bump${added ? " is-added" : ""}" data-bump="${b.id}">
        <div class="bump__top">
          <img src="${productImage(b)}" alt="" width="64" height="64">
          <div>
            <h4>${esc(b.name)}</h4>
            <p class="bump__price">${b.compareAt ? `<s>${brl(b.compareAt)}</s>` : ""}<strong>${brl(b.price)}</strong>${off ? `<span class="bump__off">-${off}%</span>` : ""}</p>
            ${variant}
          </div>
        </div>
        <p class="bump__headline">${esc(b.headline)}</p>
        <p class="bump__text">${esc(b.description)}</p>
        <button type="button" class="bump__toggle" data-action="bump-toggle" data-id="${b.id}" aria-pressed="${added}">
          <span class="bump__check">${added ? I.check(14) : ""}</span>${added ? "Adicionado ao pedido" : `Sim, quero adicionar${off ? ` com ${off}% OFF` : ""}`}
        </button>
      </article>`;
  }

  function toggleBump(id) {
    const b = bumpById(id);
    if (!b) return;
    if (state.bumps[id]) delete state.bumps[id];
    else {
      const sel = $(`[data-bump-variant="${id}"]`);
      state.bumps[id] = { variant: b.variant ? (sel ? sel.value : b.variant.options[0]) : null };
      track("add_to_cart", { source: "order_bump", item_id: id });
    }
    const art = $(`[data-bump="${id}"]`);
    if (art) art.outerHTML = bumpCard(b);
    save();
    refreshTotals();
  }

  function selectMethod(key) {
    if (state.payment === key) return;
    state.payment = key;
    state.methodLoading = true;
    if (key === "card" && !card.document && state.customer.type === "pf") card.document = state.customer.cpf;
    save();
    renderStep(3);
    refreshTotals();
    setTimeout(() => {
      state.methodLoading = false;
      renderStep(3);
      refreshTotals();
      track("add_payment_info", { payment_type: key });
    }, 450);
  }

  /* ---------- navegação entre etapas ---------- */

  function completeStep(n) {
    if (!state.completed.includes(n)) state.completed.push(n);
    state.active = [1, 2, 3].find((k) => !state.completed.includes(k)) || 3;
    if (!desktop.matches) state.summaryOpen = false;
    save();
    renderSteps();
    renderSummary();
    focusActive();
  }

  function goTo(n) {
    if (n < 1) return;
    state.active = n;
    state.completed = state.completed.filter((k) => k !== n);
    save();
    renderSteps();
    renderSummary();
    focusActive();
  }

  function focusActive() {
    const el = $(`#step-${state.active}`);
    if (!desktop.matches) {
      const top = el.getBoundingClientRect().top + window.scrollY - 12;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      return; // no celular não abre o teclado sozinho
    }
    const first = $('input:not([type="hidden"]):not(.hp):not([disabled]), [role="radio"]', el);
    if (first) first.focus({ preventScroll: true });
  }

  /* ---------- resumo do pedido ---------- */

  function discountTip(t) {
    const lines = [];
    if (t.couponDiscount) lines.push(`Cupom ${t.coupon.code}: −${brl(t.couponDiscount)}`);
    if (t.methodDiscount) lines.push(`Desconto no ${t.method.label}: −${brl(t.methodDiscount)}`);
    return lines.join("\n");
  }

  function itemRow(i) {
    const controls = i.bump
      ? `<button type="button" class="link link--small" data-action="bump-toggle" data-id="${i.bumpId}">Remover</button>`
      : `<div class="qty">
          <button type="button" data-action="qty" data-id="${i.id}" data-delta="-1" aria-label="Diminuir quantidade"${i.qty <= 1 ? " disabled" : ""}>${I.minus(14)}</button>
          <span aria-live="polite">${i.qty}</span>
          <button type="button" data-action="qty" data-id="${i.id}" data-delta="1" aria-label="Aumentar quantidade">${I.plus(14)}</button>
        </div>${state.items.length > 1 ? `<button type="button" class="link link--small link--muted" data-action="remove-item" data-id="${i.id}">Remover</button>` : ""}`;
    return `<li class="item">
      <img src="${productImage(i)}" alt="" width="56" height="56">
      <div class="item__info">
        <p class="item__name">${esc(i.name)}${i.bump ? ' <span class="tag">Oferta</span>' : ""}</p>
        ${i.variant ? `<p class="item__variant">${esc(i.variant)}</p>` : ""}
        <div class="item__row"><div class="item__controls">${controls}</div><strong class="item__price">${brl(i.price * i.qty)}</strong></div>
      </div>
    </li>`;
  }

  function renderSummary() {
    const t = totals();
    const el = $("#summary");
    const open = state.summaryOpen || desktop.matches;
    el.classList.toggle("is-open", open);
    const pixTease =
      C.payments.pix.enabled && C.payments.pix.discountPercent && state.payment !== "pix"
        ? `<p class="pix-tease">${I.pix(14)} No Pix sai por <strong>${brl(totals("pix").total)}</strong></p>`
        : "";
    el.innerHTML = `
      <button type="button" class="summary__toggle" data-action="summary-toggle" aria-expanded="${open}">
        <span class="summary__title">Resumo do pedido <span class="muted">(${t.count})</span></span>
        <span class="summary__total">${brl(t.total)} ${I.chevronDown(18)}</span>
      </button>
      <div class="summary__body">
        ${
          t.coupon
            ? `<div class="coupon-chip">${I.check(14)}<span><strong>${esc(t.coupon.code)}</strong> · ${esc(t.coupon.label)}</span><button type="button" class="link link--small" data-action="coupon-remove">Remover</button></div>`
            : `<form id="form-coupon" class="coupon" novalidate>
                <div class="field field--compact"><input id="f-coupon" name="coupon" placeholder=" " value="${esc(state.couponDraft)}" autocomplete="off" autocapitalize="characters"><label for="f-coupon">Cupom de desconto</label></div>
                <button class="btn btn--ghost" type="submit">Aplicar</button>
              </form>`
        }
        ${state.couponMsg ? `<p class="coupon-msg is-${state.couponMsg.type}" role="status">${esc(state.couponMsg.text)}</p>` : ""}
        <dl class="lines">
          <div><dt>Produtos (${t.count})</dt><dd>${brl(t.sub)}</dd></div>
          ${t.discount ? `<div class="is-discount"><dt>Descontos <button type="button" class="tip" data-tip="${esc(discountTip(t))}" aria-label="${esc(discountTip(t))}">${I.info(14)}</button></dt><dd>− ${brl(t.discount)}</dd></div>` : ""}
          <div><dt>Frete</dt><dd>${t.shipping === null ? '<span class="muted">calculado na entrega</span>' : t.shipping === 0 ? '<span class="free">Grátis</span>' : "+ " + brl(t.shipping)}</dd></div>
          <div class="lines__total"><dt>Total</dt><dd>${brl(t.total)}</dd></div>
        </dl>
        ${pixTease}
        ${t.cashback ? `<p class="perk perk--summary">${I.coin(16)}<span>Você ganha <strong>${brl(t.cashback)}</strong> de cashback nesta compra</span></p>` : ""}
        <ul class="items">${allItems().map(itemRow).join("")}</ul>
      </div>`;
  }

  // Recalcula tudo que depende do total sem apagar o que o cliente está digitando.
  function refreshTotals() {
    const c = state.coupon ? findCoupon(state.coupon) : null;
    if (c && c.minSubtotal && subtotal() < c.minSubtotal) {
      state.coupon = null;
      state.couponMsg = { type: "error", text: `Cupom removido: compra mínima de ${brl(c.minSubtotal)}` };
    }
    const t = totals();
    renderSummary();
    $$('[data-bind="cashback"]').forEach((el) => (el.textContent = brl(t.cashback)));
    $$('[data-bind="method-total"]').forEach((el) => (el.textContent = brl(t.total)));
    $$('[data-bind="method-saving"]').forEach((el) => {
      el.hidden = !t.methodDiscount;
      el.textContent = `você economiza ${brl(t.methodDiscount)}`;
    });
    const sel = $("#f-installments");
    if (sel) sel.innerHTML = installmentOptions(t.total);
    if (state.addressMode === "select" && (state.active === 2 || state.completed.includes(2))) renderStep(2);
    save();
  }

  function applyCoupon(code) {
    const c = findCoupon(code);
    if (!String(code).trim()) state.couponMsg = { type: "error", text: "Digite o código do cupom" };
    else if (!c) state.couponMsg = { type: "error", text: "Cupom inválido ou expirado" };
    else if (c.minSubtotal && subtotal() < c.minSubtotal)
      state.couponMsg = { type: "error", text: `Válido para compras a partir de ${brl(c.minSubtotal)}` };
    else {
      state.coupon = c.code;
      state.couponDraft = "";
      state.couponMsg = { type: "success", text: "Cupom aplicado!" };
      track("select_promotion", { coupon: c.code });
    }
    refreshTotals();
  }

  function changeQty(id, delta) {
    const item = state.items.find((i) => i.id === id);
    if (!item) return;
    item.qty = Math.max(1, Math.min(99, item.qty + delta));
    refreshTotals();
  }

  function removeItem(id) {
    if (state.items.length <= 1) return;
    state.items = state.items.filter((i) => i.id !== id);
    refreshTotals();
  }

  /* ---------- avaliações ---------- */

  function renderReviews() {
    const list = C.reviews || [];
    const el = $("#reviews");
    if (!list.length) {
      el.hidden = true;
      return;
    }
    const stars = (n) =>
      `<span class="stars" aria-label="${n} de 5 estrelas">${Array.from({ length: 5 }, (_, i) => `<span class="${i < n ? "on" : ""}">${I.star(14)}</span>`).join("")}</span>`;
    el.innerHTML = `
      <div class="reviews__track" id="reviewTrack">
        ${list
          .map(
            (r) => `<figure class="review">
              <div class="review__head"><span class="avatar">${esc(initials(r.name))}</span><div><figcaption>${esc(r.name)}</figcaption><small>${esc(r.city || "")}</small></div>${stars(r.stars)}</div>
              <blockquote>${esc(r.text)}</blockquote>
            </figure>`,
          )
          .join("")}
      </div>
      <div class="dots" data-dots-for="reviewTrack">${list.map((_, i) => `<span class="dot${i === 0 ? " is-active" : ""}"></span>`).join("")}</div>`;
  }

  function startReviewRotation() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let paused = false;
    const track = $("#reviewTrack");
    if (!track) return;
    ["pointerenter", "touchstart", "focusin"].forEach((ev) => track.addEventListener(ev, () => (paused = true), { passive: true }));
    track.addEventListener("pointerleave", () => (paused = false));
    setInterval(() => {
      if (paused || orderPlaced) return;
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      if (atEnd) track.scrollTo({ left: 0, behavior: "smooth" });
      else scrollCarousel(track, 1);
    }, 6000);
  }

  function scrollCarousel(track, dir) {
    if (!track || !track.firstElementChild) return;
    const step = track.firstElementChild.getBoundingClientRect().width + 12;
    track.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  function syncDots(track) {
    const dots = $(`[data-dots-for="${track.id}"]`);
    if (!dots || !track.firstElementChild) return;
    const step = track.firstElementChild.getBoundingClientRect().width + 12;
    const i = Math.round(track.scrollLeft / step);
    $$(".dot", dots).forEach((d, k) => d.classList.toggle("is-active", k === i));
  }

  /* ---------- janelas (modais) ---------- */

  let lastFocus = null;
  function openModal(html) {
    lastFocus = document.activeElement;
    $("#modalBody").innerHTML = html;
    $("#modal").hidden = false;
    document.body.classList.add("no-scroll");
    $(".modal__close").focus();
  }
  function closeModal() {
    $("#modal").hidden = true;
    document.body.classList.remove("no-scroll");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  const MODALS = {
    privacy: () => `<h2>Política de privacidade</h2><p>${esc(C.store.privacy)}</p>`,
    contact: () => {
      const s = C.store;
      return `<h2>Atendimento</h2><ul class="modal-list">
        <li>E-mail: ${esc(s.email)}</li><li>WhatsApp: ${esc(s.whatsapp)}</li><li>Telefone: ${esc(s.phone)}</li><li>${esc(s.hours)}</li></ul>`;
    },
    payments: () => {
      const p = C.payments;
      const plans = installmentPlan(totals("card").total);
      return `<h2>Formas de pagamento</h2><ul class="modal-list">
        ${p.card.enabled ? `<li><strong>Cartão de crédito</strong> (${esc(p.card.brands.join(", "))}): até ${plans.length}x${p.card.interestFree > 1 ? `, sendo até ${p.card.interestFree}x sem juros` : ""}.</li>` : ""}
        ${p.pix.enabled ? `<li><strong>Pix</strong>: aprovação na hora${p.pix.discountPercent ? ` e ${p.pix.discountPercent}% de desconto` : ""}.</li>` : ""}
        ${p.boleto.enabled ? `<li><strong>Boleto</strong>: vence em ${p.boleto.dueDays} dias úteis; o pedido é liberado após a compensação.</li>` : ""}
      </ul>`;
    },
  };

  function setupExitIntent() {
    const cfg = C.exitIntent;
    if (!cfg || !cfg.enabled || !findCoupon(cfg.coupon)) return;
    document.addEventListener("mouseout", (e) => {
      if (!desktop.matches || state.exitShown || state.coupon || orderPlaced || e.relatedTarget || e.clientY > 0) return;
      if (!$("#modal").hidden) return;
      state.exitShown = true;
      save();
      openModal(`<div class="exit">${I.gift(32)}<h2>${esc(cfg.title)}</h2><p>${esc(cfg.text)}</p>
        <div class="exit__code">${esc(cfg.coupon)}</div>
        <button type="button" class="btn btn--primary btn--block" data-action="exit-apply">Aplicar cupom</button>
        <button type="button" class="link link--center" data-action="modal-close">Não, obrigado</button></div>`);
    });
  }

  /* ---------- finalização ---------- */

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function finalize() {
    if (!state.payment || state.methodLoading) return;
    if (state.payment === "card" && !validateForm($("#form-card"))) return;
    $("#processing").hidden = false;
    await sleep(1600);
    $("#processing").hidden = true;
    if (state.payment === "card" && C.demo && digits(card.number) === digits(C.payments.card.testDeclineNumber)) {
      track("payment_declined", { payment_type: "card" });
      const pix = C.payments.pix;
      openModal(`<div class="decline">${I.alert(36)}<h2>Pagamento não aprovado</h2>
        <p>O banco emissor recusou a transação. Confira os dados do cartão ou escolha outra forma de pagamento.</p>
        <button type="button" class="btn btn--primary btn--block" data-action="retry-card">Tentar novamente</button>
        ${pix.enabled ? `<button type="button" class="btn btn--ghost btn--block" data-action="pay-pix">Pagar com Pix${pix.discountPercent ? ` e ganhar ${pix.discountPercent}% OFF` : ""}</button>` : ""}
      </div>`);
      return;
    }
    placeOrder();
  }

  function placeOrder() {
    orderPlaced = true;
    const t = totals();
    const order = {
      id: String(Math.floor(100000 + Math.random() * 900000)),
      createdAt: new Date().toISOString(),
      customer: clone(state.customer),
      address: clone(currentAddress()),
      shipping: clone(currentShipping()),
      payment: state.payment,
      installments: state.payment === "card" ? state.installments : null,
      coupon: state.coupon,
      items: allItems(),
      totals: t,
    };
    if (C.hooks && C.hooks.onOrder) C.hooks.onOrder(order);
    track("purchase", { transaction_id: order.id, shipping: t.shipping || 0, coupon: state.coupon || undefined });
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* sem storage */
    }
    renderThanks(order);
  }

  function fakeQr(seed) {
    let a = hash(seed) || 1;
    const rnd = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const n = 25;
    const inFinder = (x, y) => (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
    let cells = "";
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!inFinder(x, y) && rnd() > 0.5) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    const finder = (x, y) =>
      `<rect x="${x}" y="${y}" width="7" height="7"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`;
    return `<svg viewBox="-2 -2 29 29" width="200" height="200" shape-rendering="crispEdges" role="img" aria-label="QR Code do Pix"><rect x="-2" y="-2" width="29" height="29" fill="#fff"/><g fill="#0f172a">${cells}${finder(0, 0)}${finder(n - 7, 0)}${finder(0, n - 7)}</g></svg>`;
  }

  function pixBox(order) {
    const code = `${C.demo ? "DEMONSTRACAO-" : ""}PIX-${order.id}-${Math.random().toString(36).slice(2, 12).toUpperCase()}`;
    return `<div class="pixbox">
      <div class="pixbox__qr">${fakeQr(order.id)}${C.demo ? "<small>QR Code ilustrativo (demonstração)</small>" : ""}</div>
      <div class="pixbox__side">
        <p class="pixbox__value">${brl(order.totals.total)}</p>
        <p class="pixbox__timer">${I.clock(16)} Expira em <strong id="pixTimer">${String(C.payments.pix.expiresMinutes).padStart(2, "0")}:00</strong></p>
        <label class="copybox"><span>Pix copia e cola</span><input id="pixCode" readonly value="${esc(code)}"></label>
        <button type="button" class="btn btn--primary btn--block" data-action="copy" data-target="pixCode">${I.copy(16)} Copiar código</button>
        <ol class="howto"><li>Abra o app do seu banco e escolha Pix</li><li>Escaneie o QR Code ou cole o código</li><li>Confirme: a aprovação é na hora</li></ol>
      </div>
    </div>`;
  }

  function boletoBox(order) {
    const due = addBusinessDays(new Date(), C.payments.boleto.dueDays).toLocaleDateString("pt-BR");
    const line = C.demo ? "00000.00000 00000.000000 00000.000000 0 00000000000000" : "";
    return `<div class="pixbox pixbox--boleto">
      <div class="pixbox__side">
        <p class="pixbox__value">${brl(order.totals.total)}</p>
        <p class="pixbox__timer">${I.clock(16)} Vence em <strong>${due}</strong></p>
        <label class="copybox"><span>Linha digitável${C.demo ? " (demonstração)" : ""}</span><input id="boletoCode" readonly value="${line}"></label>
        <button type="button" class="btn btn--primary btn--block" data-action="copy" data-target="boletoCode">${I.copy(16)} Copiar linha digitável</button>
      </div>
    </div>`;
  }

  function upsellBox() {
    const u = C.upsell;
    if (!u || !u.enabled) return "";
    const off = u.compareAt ? Math.round((1 - u.price / u.compareAt) * 100) : 0;
    return `<div class="upsell" id="upsell">
      <span class="bumps__pill">${I.gift(14)} ${esc(u.headline)}</span>
      <div class="upsell__body">
        <img src="${productImage({ id: "upsell", ...u })}" alt="" width="88" height="88">
        <div><h3>${esc(u.name)}</h3>
          <p class="bump__price">${u.compareAt ? `<s>${brl(u.compareAt)}</s>` : ""}<strong>${brl(u.price)}</strong>${off ? `<span class="bump__off">-${off}%</span>` : ""}</p>
          <p class="muted">${esc(u.description)}</p></div>
      </div>
      <div class="upsell__actions">
        <button type="button" class="btn btn--primary" data-action="upsell-accept">Adicionar com 1 clique</button>
        <button type="button" class="link" data-action="upsell-decline">Não, obrigado</button>
      </div>
    </div>`;
  }

  let pixInterval = null;
  function startPixTimer() {
    let left = C.payments.pix.expiresMinutes * 60;
    clearInterval(pixInterval);
    pixInterval = setInterval(() => {
      left -= 1;
      const el = $("#pixTimer");
      if (!el) return clearInterval(pixInterval);
      if (left <= 0) {
        clearInterval(pixInterval);
        el.textContent = "expirado";
        return;
      }
      el.textContent = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
    }, 1000);
  }

  function renderThanks(order) {
    $("#checkout").hidden = true;
    const el = $("#thanks");
    el.hidden = false;
    const t = order.totals;
    const s = order.shipping;
    const head = {
      card: [I.check(32), "Pagamento aprovado!", `Seu pedido #${order.id} foi confirmado. Enviamos os detalhes para ${order.customer.email}.`],
      pix: [I.pix(32), "Falta pouco: pague o Pix", `Seu pedido #${order.id} está reservado. Assim que o pagamento cair, você recebe a confirmação por e-mail.`],
      boleto: [I.barcode(32), "Boleto gerado", `Seu pedido #${order.id} será confirmado depois da compensação do boleto (até 2 dias úteis).`],
    }[order.payment];
    const payLabel = { card: `Cartão de crédito · ${order.installments}x`, pix: "Pix", boleto: "Boleto bancário" }[order.payment];
    el.innerHTML = `
      <div class="card thanks__card">
        <div class="thanks__icon thanks__icon--${order.payment}">${head[0]}</div>
        <h1>${head[1]}</h1>
        <p class="muted thanks__lead">${esc(head[2])}</p>
        ${order.payment === "pix" ? pixBox(order) : ""}
        ${order.payment === "boleto" ? boletoBox(order) : ""}
        ${upsellBox()}
        <div class="thanks__grid">
          <section><h3>Entrega</h3><p>${esc(addressLine1(order.address))}<br>${esc(addressLine2(order.address))}</p><p class="muted">${esc(s.name)} · ${esc(etaText(s.days, s.kind))}</p></section>
          <section><h3>Pagamento</h3><p>${payLabel}</p><p class="muted">Total ${brl(t.total)}</p></section>
        </div>
        <ul class="items items--thanks">${order.items
          .map(
            (i) => `<li class="item"><img src="${productImage(i)}" alt="" width="48" height="48"><div class="item__info"><p class="item__name">${esc(i.name)}</p><p class="item__variant">${i.qty}x · ${brl(i.price * i.qty)}</p></div></li>`,
          )
          .join("")}</ul>
        ${t.cashback ? `<p class="perk perk--summary">${I.coin(16)}<span><strong>${brl(t.cashback)}</strong> de cashback reservados para a sua próxima compra</span></p>` : ""}
        ${C.demo ? `<button type="button" class="link link--center" data-action="restart">Recomeçar demonstração</button>` : ""}
      </div>`;
    window.scrollTo({ top: 0 });
    if (order.payment === "pix") startPixTimer();
  }

  /* ---------- utilidades de interface ---------- */

  let toastTimer = null;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("is-visible"), 2200);
  }

  async function copyFrom(id) {
    const input = document.getElementById(id);
    if (!input) return;
    try {
      await navigator.clipboard.writeText(input.value);
    } catch {
      input.select();
      document.execCommand("copy");
    }
    toast("Código copiado!");
  }

  /* ---------- eventos ---------- */

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const id = el.dataset.id;
    switch (el.dataset.action) {
      case "person":
        state.customer.type = el.dataset.value;
        save();
        renderStep(1);
        break;
      case "back":
        goTo(state.active - 1);
        break;
      case "edit":
        goTo(+el.dataset.step);
        break;
      case "summary-toggle":
        if (desktop.matches) break;
        state.summaryOpen = !state.summaryOpen;
        save();
        renderSummary();
        break;
      case "qty":
        changeQty(id, +el.dataset.delta);
        break;
      case "remove-item":
        removeItem(id);
        break;
      case "coupon-remove":
        state.coupon = null;
        state.couponMsg = null;
        refreshTotals();
        break;
      case "address-new":
        state.editingAddress = null;
        state.addressDraft = { recipient: customerName() };
        state.cepStatus = null;
        state.addressMode = "cep";
        save();
        renderStep(2);
        break;
      case "address-manual":
        state.addressDraft = { cep: (state.addressDraft && state.addressDraft.cep) || "", manual: true, street: "", neighborhood: "", city: "", uf: "", recipient: customerName() };
        state.cepStatus = null;
        state.addressMode = "form";
        save();
        renderStep(2);
        break;
      case "address-cancel":
        state.addressMode = "select";
        state.addressDraft = null;
        state.editingAddress = null;
        state.cepStatus = null;
        save();
        renderStep(2);
        break;
      case "address-edit": {
        const a = state.addresses.find((x) => x.id === id);
        if (!a) break;
        state.editingAddress = id;
        state.addressDraft = { ...a, manual: false, cepLooked: digits(a.cep) };
        state.addressMode = "form";
        save();
        renderStep(2);
        break;
      }
      case "address-remove":
        state.addresses = state.addresses.filter((x) => x.id !== id);
        if (state.selectedAddress === id) state.selectedAddress = state.addresses[0] ? state.addresses[0].id : null;
        if (!state.addresses.length) {
          state.addressMode = "cep";
          state.addressDraft = { recipient: customerName() };
          state.shippingId = null;
        } else state.shippingId = defaultShipping();
        renderStep(2);
        refreshTotals();
        break;
      case "address-select":
        if (state.selectedAddress === id) break;
        state.selectedAddress = id;
        state.shippingId = defaultShipping();
        renderStep(2);
        refreshTotals();
        break;
      case "shipping-select":
        state.shippingId = id;
        renderStep(2);
        refreshTotals();
        break;
      case "goto-payment": {
        const s = currentShipping();
        if (!currentAddress() || !s) break;
        track("add_shipping_info", { shipping_tier: s.name });
        completeStep(2);
        break;
      }
      case "method":
        selectMethod(id);
        break;
      case "bump-toggle":
        toggleBump(id);
        break;
      case "carousel":
        scrollCarousel(document.getElementById(el.dataset.target), +el.dataset.dir);
        break;
      case "finalize":
        finalize();
        break;
      case "modal":
        openModal(MODALS[el.dataset.modal]());
        break;
      case "modal-close":
        closeModal();
        break;
      case "copy":
        copyFrom(el.dataset.target);
        break;
      case "exit-apply":
        closeModal();
        state.summaryOpen = true;
        applyCoupon(C.exitIntent.coupon);
        break;
      case "retry-card": {
        closeModal();
        const n = $("#f-card_number");
        if (n) {
          n.focus();
          n.select();
        }
        break;
      }
      case "pay-pix":
        closeModal();
        selectMethod("pix");
        break;
      case "upsell-accept": {
        const box = $("#upsell");
        $("#processing").hidden = false;
        setTimeout(() => {
          $("#processing").hidden = true;
          box.innerHTML = `<p class="upsell__done">${I.check(18)} Pronto! ${esc(C.upsell.name)} entrou no seu pedido e vai no mesmo pacote.</p>`;
          track("upsell_accepted", { item_name: C.upsell.name, upsell_value: C.upsell.price });
        }, 1100);
        break;
      }
      case "upsell-decline":
        $("#upsell").remove();
        break;
      case "restart":
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {
          /* sem storage */
        }
        location.reload();
        break;
    }
  });

  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.mask && masks[t.dataset.mask]) t.value = masks[t.dataset.mask](t.value);
    if (t.closest(".field.is-invalid")) validateInput(t);
    const form = t.form ? t.form.id : "";
    if (form === "form-identification" && t.type !== "checkbox" && t.name in state.customer) {
      state.customer[t.name] = t.value;
      save();
    }
    if (form === "form-cep" && t.name === "zipcode") {
      state.cepStatus = null;
      if (digits(t.value).length === 8) lookupCep(t.value);
    }
    if (form === "form-address" && state.addressDraft) {
      const key = t.name === "zipcode" ? "cep" : t.name;
      state.addressDraft[key] = t.value;
      if (t.name === "zipcode" && digits(t.value).length === 8 && digits(t.value) !== state.addressDraft.cepLooked) lookupCep(t.value);
      save();
    }
    if (form === "form-card") {
      const key = t.name.replace("card_", "");
      if (key in card) card[key] = t.value;
      updateCardUI();
    }
    if (t.id === "f-coupon") state.couponDraft = t.value;
  });

  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.name === "ieExempt") {
      state.customer.ieExempt = t.checked;
      const ie = $("#f-ie");
      if (ie) {
        ie.disabled = t.checked;
        if (t.checked) {
          ie.value = "";
          const wrap = ie.closest(".field");
          wrap.classList.remove("is-invalid");
          wrap.querySelector(".field__error").textContent = "";
        }
      }
      save();
    }
    if (t.name === "newsletter") {
      state.customer.newsletter = t.checked;
      save();
    }
    if (t.name === "installments") {
      state.installments = +t.value;
      save();
    }
    if (t.dataset.bumpVariant) {
      const id = t.dataset.bumpVariant;
      if (state.bumps[id]) {
        state.bumps[id].variant = t.value;
        save();
        renderSummary();
      }
    }
  });

  // Valida ao sair do campo, só se já tiver algo digitado (sem bronca em campo vazio).
  document.addEventListener("focusout", (e) => {
    const t = e.target;
    if (t.matches && t.matches("input[name]") && RULES[t.name] && t.value) validateInput(t);
  });

  document.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.id === "form-identification") submitIdentification(f);
    else if (f.id === "form-cep") {
      const z = f.elements.zipcode;
      if (validateInput(z)) lookupCep(z.value);
    } else if (f.id === "form-address") submitAddress(f);
    else if (f.id === "form-coupon") applyCoupon(f.elements.coupon.value);
    else if (f.id === "form-card") finalize();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#modal").hidden) closeModal();
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches('div[role="radio"]')) {
      e.preventDefault();
      e.target.click();
    }
  });

  // Eventos de rolagem não sobem pela árvore: escuta na captura para os carrosséis.
  document.addEventListener(
    "scroll",
    (e) => {
      const t = e.target;
      if (t && t.id && (t.id === "bumpTrack" || t.id === "reviewTrack")) syncDots(t);
    },
    true,
  );

  desktop.addEventListener("change", renderSummary);

  /* ---------- início ---------- */

  applyTheme();
  renderChrome();
  renderSteps();
  renderSummary();
  renderReviews();
  startReviewRotation();
  setupExitIntent();
  track("begin_checkout");
})();
