// Teste de ponta a ponta do checkout num Chrome headless descartável (sem dependências: Node 22+ e Chrome).
//   node tests/run.mjs            → roda tudo e salva prints em tests/output/
//   CHROME_PATH=/caminho/chrome    → usa outro Chrome/Chromium
// Usa só dados de teste do modo demonstração (CPF 000.000.000-00, e-mail em exemplo.com,
// CEP público, cartões de teste das bandeiras). Precisa de internet para a busca de CEP (ViaCEP).
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const PAGE_URL = new URL("../index.html", import.meta.url).href;
const OUT_DIR = fileURLToPath(new URL("./output/", import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error("Chrome não encontrado. Defina CHROME_PATH.");
  return found;
}

const port = 9400 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), "checkout-test-"));
const chrome = spawn(
  findChrome(),
  ["--headless=new", `--remote-debugging-port=${port}`, "--remote-debugging-address=127.0.0.1", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "about:blank"],
  { stdio: "ignore" },
);

let ws;
let failures = 0;
const problems = [];

try {
  let target;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250);
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === "page");
    } catch {
      /* Chrome ainda subindo */
    }
  }
  if (!target) throw new Error("Chrome não abriu a porta de depuração.");
  mkdirSync(OUT_DIR, { recursive: true });

  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
    if (m.method === "Runtime.exceptionThrown") problems.push("EXCEÇÃO " + JSON.stringify(m.params.exceptionDetails).slice(0, 400));
    if (m.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(m.params.type))
      problems.push(`CONSOLE ${m.params.type}: ` + m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300));
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error") problems.push("LOG " + m.params.entry.text.slice(0, 300));
  });
  const send = (method, params = {}) =>
    new Promise((r) => {
      const i = ++id;
      pending.set(i, r);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const js = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error("falha ao avaliar: " + JSON.stringify(r.result.exceptionDetails).slice(0, 300));
    return r.result?.result?.value;
  };
  const viewport = (w, h, mobile) => send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile });
  const shot = async (name) => {
    await sleep(350);
    const m = await send("Page.getLayoutMetrics");
    const { width, height } = m.result.cssContentSize;
    const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: Math.min(height, 4000), scale: 1 } });
    writeFileSync(join(OUT_DIR, name + ".png"), Buffer.from(r.result.data, "base64"));
  };
  // Digita como um usuário: troca o valor e dispara "input" (máscaras e estado rodam nesse evento).
  const type = (sel, value) =>
    js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return 'faltando ${sel}'; el.focus(); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', { bubbles: true })); el.blur(); return el.value; })()`);
  const click = (sel) => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return 'faltando'; el.click(); return 'ok'; })()`);
  const text = (sel) => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); return el ? el.innerText.replace(/\\s+/g, ' ').trim() : null; })()`);
  const check = (label, cond, detail = "") => {
    if (!cond) failures++;
    console.log(`${cond ? "OK  " : "FALHA"} ${label}${!cond && detail ? " — " + detail : ""}`);
  };
  const visibleSteps = () => js("[1,2,3].map(n => getComputedStyle(document.getElementById('step-'+n)).display !== 'none').join()");

  await send("Runtime.enable");
  await send("Log.enable");
  await send("Page.enable");

  // Início limpo, no celular
  await viewport(390, 844, true);
  await send("Page.navigate", { url: PAGE_URL });
  await sleep(1500);
  await js("sessionStorage.clear(); location.reload(); 'ok'");
  await sleep(1500);
  check("faixa de demonstração visível", await js("!document.getElementById('demoBar').hidden"));
  check("mobile: só a etapa 1 aparece", (await visibleSteps()) === "true,false,false");
  await shot("01-mobile-identificacao");

  await viewport(1440, 900, false);
  await sleep(300);
  check("desktop: as 3 etapas aparecem", (await visibleSteps()) === "true,true,true");
  check("desktop: 3 colunas", (await js("getComputedStyle(document.getElementById('checkout')).gridTemplateColumns.split(' ').length")) === 3);
  await shot("02-desktop-identificacao");

  // Etapa 1: validação, PF/PJ, máscaras
  await click("#form-identification button[type=submit]");
  await sleep(200);
  const errs = await js("[...document.querySelectorAll('.field.is-invalid')].map(f => f.dataset.field).join(',')");
  check("envio vazio marca os obrigatórios", errs === "name,email,cpf,phone", errs);
  await type("#f-cpf", "12345678900");
  await click("#form-identification button[type=submit]");
  check("CPF inválido recusado", (await text("#f-cpf-err")) === "CPF inválido");
  await type("#f-name", "Cliente Teste");
  await type("#f-email", "cliente@exemplo.com");
  await click("[data-action=person][data-value=pj]");
  check("PJ mostra CNPJ e inscrição estadual", await js("!!document.getElementById('f-cnpj') && !!document.getElementById('f-ie')"));
  await click("[data-action=person][data-value=pf]");
  check("PF mantém o nome digitado", (await js("document.getElementById('f-name').value")) === "Cliente Teste");
  await type("#f-cpf", "000.000.000-00");
  check("máscara de celular", (await type("#f-phone", "11900000000")) === "(11) 90000-0000");
  await click("#form-identification button[type=submit]");
  await sleep(400);
  check("etapa 1 concluída, etapa 2 ativa", (await js("document.getElementById('step-2').classList.contains('is-active') && document.getElementById('step-1').classList.contains('is-done')")) === true);

  // Etapa 2: CEP, endereço, frete
  check("máscara de CEP", (await type("#f-zipcode", "01310100")) === "01310-100");
  await sleep(3000);
  check("CEP preenche o endereço (ViaCEP)", !!(await js("document.getElementById('f-street')?.value")), "sem internet o formulário fica manual");
  check("destinatário vem da etapa 1", (await js("document.getElementById('f-recipient')?.value")) === "Cliente Teste");
  await click("#form-address button[type=submit]");
  await sleep(200);
  check("número obrigatório", (await text("#f-number-err")) === "Campo obrigatório");
  await type("#f-number", "1000");
  await click("#form-address button[type=submit]");
  await sleep(400);
  check("3 opções de frete (2 entregas + retirada em SP)", (await js("document.querySelectorAll('[data-action=shipping-select]').length")) === 3);
  check("mais barato já marcado", await js("!!document.querySelector('[data-action=shipping-select].is-selected')?.textContent.includes('Mais econômico')"));
  check("resumo mostra o frete", ((await text("#summary .lines")) || "").includes("Frete + R$"));
  await shot("03-desktop-frete");
  await viewport(390, 844, true);
  await sleep(300);
  await shot("04-mobile-frete");
  await viewport(1440, 900, false);

  // Etapa 3: cartão, order bump, cupom, Pix
  await click("[data-action=goto-payment]");
  await sleep(400);
  check("etapa 3 ativa", await js("document.getElementById('step-3').classList.contains('is-active')"));
  check("nenhuma forma de pagamento marcada", (await js("document.querySelectorAll('.method.is-selected').length")) === 0);
  await click("[data-action=method][data-id=card]");
  await sleep(150);
  check("carregamento ao trocar forma", await js("!!document.querySelector('.method.is-loading .spinner')"));
  await sleep(700);
  check("parcelas travadas antes do cartão", await js("document.getElementById('f-installments').disabled"));
  await type("#f-card_number", "4111111111111111");
  check("bandeira detectada", (await js("document.querySelector('[data-bind=card-brand]').textContent")) === "Visa");
  check("parcelas liberadas", !(await js("document.getElementById('f-installments').disabled")));
  await type("#f-card_expiry", "1230");
  await type("#f-card_cvv", "123");
  await type("#f-card_holder", "CLIENTE TESTE");
  check("ofertas aparecem depois da forma de pagamento", (await js("document.querySelectorAll('.bump').length")) === 3);
  const before = await text("#summary .lines__total dd");
  await click("[data-action=bump-toggle][data-id=kit-meias]");
  await sleep(200);
  check("oferta soma no total", before !== (await text("#summary .lines__total dd")));
  check("dados do cartão mantidos após a oferta", (await js("document.getElementById('f-card_number').value")) === "4111 1111 1111 1111");
  await shot("05-desktop-cartao-oferta");
  await viewport(390, 844, true);
  await sleep(300);
  await shot("06-mobile-cartao");
  await viewport(1440, 900, false);
  await type("#f-coupon", "naoexiste");
  await click("#form-coupon button[type=submit]");
  check("cupom inválido avisa", (await text(".coupon-msg")) === "Cupom inválido ou expirado");
  await type("#f-coupon", "bemvindo10");
  await click("#form-coupon button[type=submit]");
  await sleep(200);
  check("cupom aplicado", ((await text(".coupon-chip")) || "").includes("BEMVINDO10"));
  await click("[data-action=method][data-id=pix]");
  await sleep(700);
  check("desconto do Pix no resumo", ((await text("#summary .lines")) || "").includes("Descontos"));
  check("total do Pix igual ao do resumo", (await text("[data-bind=method-total]")) === (await text("#summary .lines__total dd")));
  await shot("07-desktop-pix");

  // Recusa → Pix → obrigado
  await click("[data-action=method][data-id=card]");
  await sleep(700);
  await type("#f-card_number", "4000000000000002");
  await type("#f-card_expiry", "1230");
  await type("#f-card_cvv", "123");
  await type("#f-card_holder", "CLIENTE TESTE");
  await click("[data-action=finalize]");
  await sleep(2200);
  check("janela de cartão recusado", (await text("#modalBody h2")) === "Pagamento não aprovado");
  await click("[data-action=pay-pix]");
  await sleep(800);
  await click("[data-action=finalize]");
  await sleep(2200);
  check("página de obrigado do Pix", ((await text("#thanks h1")) || "").includes("Pix"));
  check("código copia e cola de demonstração", ((await js("document.getElementById('pixCode')?.value")) || "").startsWith("DEMONSTRACAO-PIX-"));
  check("progresso limpo após o pedido", (await js("sessionStorage.getItem('checkout-state-v1')")) === null);
  check("evento purchase no dataLayer", await js("window.dataLayer.some(e => e && e.event === 'purchase')"));
  await shot("08-desktop-obrigado");
  await viewport(390, 844, true);
  await sleep(300);
  await shot("09-mobile-obrigado");

  if (problems.length) console.log("\nErros no console:\n" + problems.join("\n"));
  console.log(`\n${failures ? `${failures} falha(s)` : "Tudo certo"} · erros no console: ${problems.length} · prints em ${OUT_DIR}`);
} catch (err) {
  failures++;
  console.error("Teste interrompido:", err.message);
} finally {
  if (ws) ws.close();
  chrome.kill();
  await sleep(800);
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  } catch {
    /* perfil temporário: o sistema limpa depois */
  }
  process.exitCode = failures || problems.length ? 1 : 0;
}
