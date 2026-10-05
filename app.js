'use strict';

// ---------- dados ----------
// Tudo fica no localStorage deste aparelho. Valores sempre em centavos (inteiro).
const CHAVE = 'financas.v1';
const CHAVE_TEMA = 'financas.tema';
const CATEGORIAS_PADRAO = {
  despesa: ['Mercado', 'Casa', 'Alimentação', 'Transporte', 'Saúde', 'Lazer', 'Assinaturas', 'Educação', 'Outros'],
  receita: ['Salário', 'Clientes', 'Freela', 'Investimentos', 'Outros'],
  investimento: ['Reserva de emergência', 'Renda fixa', 'Tesouro Direto', 'Ações', 'Fundos imobiliários', 'Cripto', 'Outros'],
};
// aporte: disponível -> investido · resgate: investido -> disponível · rendimento: investido cresce
const INVEST = ['aporte', 'resgate', 'rendimento'];
const grupoDe = (tipo) => (INVEST.includes(tipo) ? 'investimento' : tipo);

function estadoInicial() {
  return {
    lancamentos: [], categorias: structuredClone(CATEGORIAS_PADRAO), orcamentos: {}, fixas: [],
    metas: [], inicial: { disponivel: 0, investido: {}, mes: null }, ultimoBackup: null,
  };
}

// Completa dados antigos com os campos novos, sem mexer no que já existe.
function normalizar(d) {
  const base = estadoInicial();
  const r = { ...base, ...d };
  r.categorias = { ...base.categorias, ...(d.categorias || {}) };
  r.inicial = { ...base.inicial, ...(d.inicial || {}) };
  if (!r.inicial.investido || typeof r.inicial.investido !== 'object') r.inicial.investido = {};
  if (!Array.isArray(r.metas)) r.metas = [];
  return r;
}

function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) return normalizar(JSON.parse(bruto));
  } catch (e) { /* começa vazio */ }
  return estadoInicial();
}

function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(db)); }
  catch (e) { toast('Não consegui salvar. Exporte um backup.', 'erro'); }
}

let db = carregar();

// ---------- utilidades ----------
const $ = (s, el = document) => el.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const brl = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const mesDe = (data) => data.slice(0, 7);
const mesAtual = () => mesDe(hoje());
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const nomeMes = (m) => `${MESES[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`;
const mesCurto = (m) => MESES_CURTOS[+m.slice(5, 7) - 1];
const ultimoDia = (m) => new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate();
const fimDoMes = (m) => `${m}-${pad(ultimoDia(m))}`;
// Data de referência do mês: hoje no mês atual, último dia nos outros.
const dataRef = (m) => (m === mesAtual() ? hoje() : fimDoMes(m));
const soma = (lista) => lista.reduce((t, l) => t + l.valor, 0);
const total = (lista, tipo) => soma(lista.filter((l) => l.tipo === tipo));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function somaMes(m, delta) {
  let [a, mm] = m.split('-').map(Number);
  mm += delta;
  while (mm > 12) { mm -= 12; a++; }
  while (mm < 1) { mm += 12; a--; }
  return `${a}-${pad(mm)}`;
}
const difMeses = (de, ate) => (+ate.slice(0, 4) - +de.slice(0, 4)) * 12 + (+ate.slice(5, 7) - +de.slice(5, 7));

function addDias(data, n) {
  const [a, m, d] = data.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}
const diaCurto = (data) => `${+data.slice(8, 10)} ${mesCurto(data)}`;

function dataLonga(data) {
  const [a, m, d] = data.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
}

function dataTooltip(data) {
  const [a, m, d] = data.split('-').map(Number);
  const op = { weekday: 'short', day: 'numeric', month: 'short' };
  if (a !== new Date().getFullYear()) op.year = 'numeric';
  return new Date(a, m - 1, d).toLocaleDateString('pt-BR', op);
}

function dataRelativa(data) {
  const h = hoje();
  if (data === h) return 'Hoje';
  if (data === addDias(h, -1)) return 'Ontem';
  if (data === addDias(h, 1)) return 'Amanhã';
  return diaCurto(data) + (data.slice(0, 4) !== h.slice(0, 4) ? ` ${data.slice(0, 4)}` : '');
}

function dataHoje() {
  const s = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function compacto(c) {
  const v = c / 100, a = Math.abs(v), s = v < 0 ? '−' : '';
  if (a >= 1e6) return `${s}R$ ${(a / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (a >= 1e3) return `${s}R$ ${(a / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: a >= 1e4 ? 0 : 1 })} mil`;
  return `${s}R$ ${Math.round(a)}`;
}

// Aceita "12,50", "1.234,56", "12.5", "1234"
function parseValor(s) {
  s = String(s || '').trim().replace(/[^\d.,]/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/\.\d{3}$/.test(s) || (s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
const centavosParaCampo = (c) => (c ? (c / 100).toFixed(2).replace('.', ',') : '');

const reduzMov = matchMedia('(prefers-reduced-motion: reduce)');

let toastTimer;
function toast(msg, tipo = 'ok') {
  const t = $('#toast');
  t.className = `toast ${tipo}`;
  const icone = { erro: 'x', entrada: 'entrada', saida: 'saida', invest: 'sobe', meta: 'alvo' }[tipo] || 'ok';
  t.innerHTML = `<span class="toast-icone">${ic(icone)}</span><span>${esc(msg)}</span>`;
  requestAnimationFrame(() => t.classList.add('visivel'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('visivel'), 2600);
}

const ICONES = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/>',
  lista: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  menos: '<path d="M5 12h14"/>',
  alvo: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  engrenagem: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  grafico: '<path d="M3 3v18h18"/><path d="M8 16v-4M13 16V8M18 16v-7"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  esq: '<path d="m15 6-6 6 6 6"/>',
  dir: '<path d="m9 6 6 6-6 6"/>',
  ok: '<path d="m5 12 5 5 9-10"/>',
  alerta: '<path d="M12 5v9M12 19h.01"/>',
  estouro: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  lua: '<path d="M20.5 13.5A8.5 8.5 0 1 1 10.5 3.5a6.5 6.5 0 0 0 10 10z"/>',
  carteira: '<path d="M20 7V6a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15v12H5a2 2 0 0 1-2-2V6"/><path d="M16 14h.01"/>',
  tendencia: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  brilho: '<path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.5l-1.9-5.7-5.6-1.9L10.1 9z"/>',
  fluxo: '<path d="M7 20V4M3 8l4-4 4 4"/><path d="M17 4v16M21 16l-4 4-4-4"/>',
  sobe: '<path d="M7 17 17 7M8 7h9v9"/>',
  desce: '<path d="m7 7 10 10M17 8v9H8"/>',
  entrada: '<path d="M12 5v14M5 12h14"/>',
  saida: '<path d="M5 12h14"/>',
  resgate: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  carro: '<path d="M5 16h14M4 12l1.6-4.5A2 2 0 0 1 7.5 6h9a2 2 0 0 1 1.9 1.5L20 12v5H4z"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/>',
  casa: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  globo: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  escudo: '<path d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  livro: '<path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2z"/>',
  estrela: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>',
};
const ic = (nome) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONES[nome] || ICONES.alvo}</svg>`;
const LOGO = '<img src="logo.svg" alt="" width="34" height="34">';
const ICONES_META = ['alvo', 'carro', 'casa', 'globo', 'escudo', 'livro', 'estrela'];

// ---------- contas fixas ----------
// Gera o lançamento de cada conta fixa em todo mês, do início até o mês atual.
// Mês já gerado não volta: se apagar o lançamento daquele mês, ele fica apagado.
function gerarFixas() {
  const atual = mesAtual();
  let mudou = false;
  for (const f of db.fixas) {
    for (let m = f.inicio; m <= atual; m = somaMes(m, 1)) {
      if (f.geradas.includes(m)) continue;
      const dia = Math.min(f.dia, ultimoDia(m));
      db.lancamentos.push({ id: uid(), tipo: f.tipo, valor: f.valor, categoria: f.categoria, descricao: f.descricao, data: `${m}-${pad(dia)}`, fixaId: f.id });
      f.geradas.push(m);
      mudou = true;
    }
  }
  if (mudou) salvar();
}

// Meses futuros ainda não têm as fixas geradas: projeta lançamentos virtuais (não salvos) pra previsão.
function projetarFixas(m) {
  if (m <= mesAtual()) return [];
  const ultimo = ultimoDia(m);
  return db.fixas.filter((f) => f.inicio <= m).map((f) => ({
    id: `v-${f.id}-${m}`, virtual: true, tipo: f.tipo, valor: f.valor, categoria: f.categoria,
    descricao: f.descricao, data: `${m}-${pad(Math.min(f.dia, ultimo))}`, fixaId: f.id,
  }));
}

const doMes = (m) => db.lancamentos.filter((l) => mesDe(l.data) === m).concat(projetarFixas(m));
// Do mês, só o que já aconteceu (no mês atual, até hoje). Lançamento futuro é "previsto".
const efetivosDoMes = (m) => { const lim = dataRef(m); return doMes(m).filter((l) => l.data <= lim); };

// Tudo até o fim do mês m, incluindo as fixas projetadas dos meses futuros.
function ateMes(m) {
  const lista = db.lancamentos.filter((l) => mesDe(l.data) <= m);
  for (let x = somaMes(mesAtual(), 1); x <= m; x = somaMes(x, 1)) lista.push(...projetarFixas(x));
  return lista;
}

const ordenar = (lista) => lista.slice().sort((a, b) => (b.data > a.data ? 1 : b.data < a.data ? -1 : b.id > a.id ? 1 : -1));

function porCategoria(lista, tipo) {
  const mapa = new Map();
  for (const l of lista) if (l.tipo === tipo) mapa.set(l.categoria, (mapa.get(l.categoria) || 0) + l.valor);
  return mapa;
}

// ---------- patrimônio ----------
// Posição numa data: dinheiro disponível + investido (por categoria) + rendimentos.
function posicao(lim) {
  const inv = new Map(Object.entries(db.inicial.investido).filter(([, v]) => v));
  const rendCat = new Map();
  const somar = (mapa, c, v) => mapa.set(c, (mapa.get(c) || 0) + v);
  let disp = db.inicial.disponivel || 0, rend = 0;
  for (const l of ateMes(mesDe(lim))) {
    if (l.data > lim) continue;
    if (l.tipo === 'receita') disp += l.valor;
    else if (l.tipo === 'despesa') disp -= l.valor;
    else if (l.tipo === 'aporte') { disp -= l.valor; somar(inv, l.categoria, l.valor); }
    else if (l.tipo === 'resgate') { disp += l.valor; somar(inv, l.categoria, -l.valor); }
    else if (l.tipo === 'rendimento') { somar(inv, l.categoria, l.valor); somar(rendCat, l.categoria, l.valor); rend += l.valor; }
  }
  let investido = 0;
  for (const v of inv.values()) investido += v;
  return { disp, inv, rendCat, investido, rend, total: disp + investido };
}

// Dia anterior ao primeiro registro: ponto de partida dos gráficos.
function inicioHistorico() {
  let ini = db.inicial.mes ? `${db.inicial.mes}-01` : hoje();
  for (const l of db.lancamentos) if (l.data < ini) ini = l.data;
  return addDias(ini, -1);
}

const PERIODOS = [['7d', '7D'], ['1m', '1M'], ['3m', '3M'], ['6m', '6M'], ['1a', '1A'], ['tudo', 'Tudo']];
const DIAS_PERIODO = { '7d': 7, '1m': 30, '3m': 91, '6m': 182, '1a': 365 };
const ROT_PERIODO = { '7d': 'em 7 dias', '1m': 'em 30 dias', '3m': 'em 3 meses', '6m': 'em 6 meses', '1a': 'em 12 meses', tudo: 'desde o início' };

// Patrimônio e investido dia a dia, até hoje.
function serieDiaria(periodo) {
  const fim = hoje(), hist = inicioHistorico();
  let ini = DIAS_PERIODO[periodo] ? addDias(fim, -DIAS_PERIODO[periodo]) : hist;
  if (ini < hist) ini = hist;
  if (ini >= fim) ini = addDias(fim, -1);
  const p = posicao(ini);
  let tot = p.total, inv = p.investido;
  const porDia = new Map();
  for (const l of db.lancamentos) {
    if (l.data > ini && l.data <= fim) { if (!porDia.has(l.data)) porDia.set(l.data, []); porDia.get(l.data).push(l); }
  }
  const out = [{ data: ini, total: tot, investido: inv }];
  for (let d = addDias(ini, 1); d <= fim; d = addDias(d, 1)) {
    for (const l of porDia.get(d) || []) {
      if (l.tipo === 'receita') tot += l.valor;
      else if (l.tipo === 'despesa') tot -= l.valor;
      else if (l.tipo === 'aporte') inv += l.valor;
      else if (l.tipo === 'resgate') inv -= l.valor;
      else if (l.tipo === 'rendimento') { tot += l.valor; inv += l.valor; }
    }
    out.push({ data: d, total: tot, investido: inv });
  }
  return out;
}

// Categorias de investimento com saldo, cor fixa pela ordem da categoria (não pelo tamanho).
function distribuicao(pos) {
  const base = db.categorias.investimento;
  const ordem = [...base, ...[...pos.inv.keys()].filter((c) => !base.includes(c))];
  return ordem.map((c, i) => ({ nome: c, v: pos.inv.get(c) || 0, rend: pos.rendCat.get(c) || 0, slot: Math.min(i, 7) + 1 })).filter((it) => it.v > 0);
}

// Aura de luz atrás do valor principal (pulsa devagar; reage quando o valor muda).
const AURA = '<div class="aura" aria-hidden="true"><span class="aura-1"></span><span class="aura-2"></span><span class="aura-3"></span></div>';

// Novo recorde: patrimônio de hoje acima de todos os dias anteriores registrados.
function ehRecorde(totalHoje) {
  const s = serieDiaria('tudo');
  if (s.length < 3 || totalHoje <= 0) return false;
  let max = -Infinity;
  for (let i = 0; i < s.length - 1; i++) if (s[i].total > max) max = s[i].total;
  return totalHoje > max;
}

function rentabilidade(pos) {
  const capital = pos.investido - pos.rend;
  return capital > 0 ? (pos.rend / capital) * 100 : null;
}

// ---------- animação de números, barras e seletores ----------
// Guarda o último valor mostrado: ao atualizar, anima do valor antigo pro novo.
const ultimos = new Map();
const FMT = {
  brl: (v) => brl(Math.round(v)),
  brlSinal: (v) => `${v > 0 ? '+ ' : v < 0 ? '− ' : ''}${brl(Math.abs(Math.round(v)))}`,
  pct: (v) => `${Math.round(v)}%`,
  pct1: (v) => `${(Math.round(v * 10) / 10).toFixed(1).replace('.', ',')}%`,
  pctSinal: (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1).replace('.', ',')}%`,
  hero: (v) => {
    const s = brl(Math.round(v));
    const [int, cent] = s.replace(/^-?R\$\s?/, '').split(',');
    return `<span class="moeda">${s.startsWith('-') ? '−' : ''}R$</span>${int}<span class="cent">,${cent}</span>`;
  },
};
const num = (v, key, fmt = 'brl') => `<span class="contador" data-num="${v}" data-key="${key}" data-fmt="${fmt}">${FMT[fmt](v)}</span>`;
const barra = (frac, key, cor = '', cls = '') => `<div class="trilho"><span class="preench ${cls}" data-fill="${clamp(frac, 0, 1)}" data-key="${key}" style="width:${clamp(frac, 0, 1) * 100}%${cor ? `;--cor:${cor}` : ''}"></span></div>`;
const easeOut = (p) => 1 - Math.pow(1 - p, 4);

function animarNumeros(root, modo) {
  root.querySelectorAll('[data-num]').forEach((el) => {
    const alvo = +el.dataset.num, key = el.dataset.key, fmt = FMT[el.dataset.fmt];
    const de = modo === 'tela' ? 0 : (ultimos.has(key) ? ultimos.get(key) : alvo);
    ultimos.set(key, alvo);
    if (reduzMov.matches || de === alvo) { el.innerHTML = fmt(alvo); return; }
    const dur = modo === 'tela' ? 1200 : 700, t0 = performance.now();
    el.innerHTML = fmt(de);
    const passo = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.innerHTML = fmt(de + (alvo - de) * easeOut(p));
      if (p < 1 && el.isConnected) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  });
}

function animarBarras(root, modo) {
  const els = [...root.querySelectorAll('[data-fill]')];
  if (reduzMov.matches || !els.length) return;
  els.forEach((el) => {
    const key = 'b:' + el.dataset.key;
    const de = modo === 'tela' ? 0 : (ultimos.has(key) ? ultimos.get(key) : +el.dataset.fill);
    ultimos.set(key, +el.dataset.fill);
    el.style.transition = 'none';
    el.style.width = `${de * 100}%`;
  });
  root.getBoundingClientRect(); // aplica a largura inicial antes de animar
  requestAnimationFrame(() => els.forEach((el, i) => {
    el.style.transition = '';
    el.style.transitionDelay = modo === 'tela' ? `${200 + i * 45}ms` : '0ms';
    el.style.width = `${el.dataset.fill * 100}%`;
  }));
}

// Indicador que desliza até o botão ativo nos seletores (período, abas do formulário...).
const posSeg = new Map();
function indicadores(root, animar) {
  root.querySelectorAll('[data-seg]').forEach((seg) => {
    const ind = $('.seg-ind', seg), ativo = $('button.ativo', seg);
    if (!ind) return;
    if (!ativo || !ativo.offsetWidth) { ind.style.opacity = 0; return; }
    const novo = { x: ativo.offsetLeft, w: ativo.offsetWidth };
    const ant = posSeg.get(seg.dataset.seg);
    posSeg.set(seg.dataset.seg, novo);
    ind.style.opacity = 1;
    const animado = animar && ant && !reduzMov.matches;
    // parte da posição anterior (deslizando) ou já aparece no lugar certo
    const de = animado ? ant : novo;
    ind.style.transition = 'none';
    ind.style.transform = `translateX(${de.x}px)`;
    ind.style.width = `${de.w}px`;
    ind.getBoundingClientRect();
    ind.style.transition = '';
    ind.style.transform = `translateX(${novo.x}px)`;
    ind.style.width = `${novo.w}px`;
  });
}

// ---------- gráficos (SVG desenhado depois de montar a tela, na largura real) ----------
const graficos = new Map();
const curvas = new Map(); // última curva desenhada de cada gráfico, pra transição entre períodos
let gid = 0;
function grafico(spec) {
  const id = `g${++gid}`;
  graficos.set(id, spec);
  return `<div class="grafico" data-grafico="${id}" style="height:${spec.altura}px"></div>`;
}

function desenharGraficos(root, modo) {
  root.querySelectorAll('[data-grafico]').forEach((el) => {
    const s = graficos.get(el.dataset.grafico);
    if (!s) return;
    (s.tipo === 'area' ? desenharArea : desenharBarras)(el, s, modo);
  });
}

function ticksBonitos(lo, hi, alvo = 3) {
  const passoBruto = (hi - lo) / alvo || 1;
  const exp = Math.pow(10, Math.floor(Math.log10(Math.abs(passoBruto))));
  const f = passoBruto / exp;
  const passo = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
  const ticks = [];
  for (let t = Math.ceil(lo / passo) * passo; t <= hi + 1e-9; t += passo) ticks.push(t);
  return ticks;
}

// Tangentes monotônicas (Fritsch–Carlson): curva suave que não "passa do ponto".
function tangentes(xs, ys) {
  const n = xs.length, d = [], m = [];
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return m;
}

// Reamostra a curva em posições fixas: todo gráfico vira o mesmo número de pontos,
// o que permite transformar a linha de um período no outro.
function amostrar(xs, ys, sx) {
  const n = xs.length;
  if (n === 1) return sx.map(() => ys[0]);
  const m = tangentes(xs, ys);
  let i = 0;
  return sx.map((x) => {
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], s = clamp((x - xs[i]) / h, 0, 1), s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * ys[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * ys[i + 1] + (s3 - s2) * h * m[i + 1];
  });
}
const linhaD = (sx, sy) => 'M' + sx.map((x, j) => `${x.toFixed(1)},${sy[j].toFixed(1)}`).join('L');
const areaD = (sx, sy, base) => `${linhaD(sx, sy)}L${sx[sx.length - 1].toFixed(1)},${base}L${sx[0].toFixed(1)},${base}Z`;

function mostrarTooltip(el, html, px, py) {
  const tt = $('.tooltip', el), inner = tt.firstElementChild;
  inner.innerHTML = html;
  const W = el.clientWidth, w = tt.offsetWidth, h = tt.offsetHeight;
  const tx = clamp(px - w / 2, -4, W - w + 4);
  let ty = py - h - 14;
  if (ty < -40) ty = py + 16;
  const pos = `translate(${tx}px, ${ty}px)`;
  if (!el.classList.contains('ativo')) {
    tt.style.transition = 'none';
    tt.style.transform = pos;
    tt.getBoundingClientRect();
    tt.style.transition = '';
    el.classList.add('ativo');
  } else tt.style.transform = pos;
}

function ligarHover(el, aoMover) {
  let timer;
  const mover = (e) => {
    clearTimeout(timer);
    const r = el.getBoundingClientRect();
    aoMover(e.clientX - r.left);
  };
  el.onpointermove = mover;
  el.onpointerdown = mover;
  el.onpointerleave = () => el.classList.remove('ativo');
  el.onpointerup = (e) => { if (e.pointerType !== 'mouse') timer = setTimeout(() => el.classList.remove('ativo'), 1800); };
}

function desenharArea(el, s, modo) {
  const W = el.clientWidth, H = s.altura;
  if (!W) return;
  const P = s.pontos, n = P.length, topo = 16, base = H - 24, padX = 8;
  const vals = P.map((p) => p.valor);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { const d = Math.abs(hi) * 0.2 || 10000; lo -= d; hi += d; }
  else { const r = hi - lo; lo -= r * 0.2; hi += r * 0.12; }
  const y = (v) => base - ((v - lo) / (hi - lo)) * (base - topo);
  const xs = P.map((p, i) => (n === 1 ? W / 2 : padX + (i * (W - padX * 2)) / (n - 1)));
  const ys = P.map((p) => y(p.valor));
  const M = clamp(Math.round(W / 2), 60, 400);
  const sx = Array.from({ length: M }, (_, j) => padX + (j * (W - padX * 2)) / (M - 1));
  const sy = amostrar(xs, ys, sx);
  const id = el.dataset.grafico;

  const grade = ticksBonitos(lo, hi).map((t) => {
    const yy = y(t);
    if (yy < topo - 2 || yy > base) return '';
    return `<line class="g-grade" x1="0" x2="${W}" y1="${yy}" y2="${yy}"/><text class="g-eixo" x="2" y="${yy - 5}">${compacto(t)}</text>`;
  }).join('');
  const longo = n > 400;
  const qtd = clamp(Math.floor(W / 80), 2, 6);
  const marcas = [...new Set(Array.from({ length: qtd }, (_, k) => Math.round((k * (n - 1)) / (qtd - 1))))];
  // pontos que surgem um a um depois que a linha termina de se desenhar
  const pontos = n > 1 ? marcas.filter((i) => i < n - 1).map((i, k) => `<circle class="g-ponto" cx="${xs[i]}" cy="${ys[i]}" r="3.5" style="fill:${s.cor};--d:${1.1 + k * 0.12}s"/>`).join('') : '';
  const traco = s.cor2 ? `url(#lg-${id})` : s.cor;
  const rotulos = marcas.map((i, k, arr) => {
    const d = P[i].data;
    const txt = longo ? `${mesCurto(d)}/${d.slice(2, 4)}` : diaCurto(d);
    const anc = k === 0 ? 'start' : k === arr.length - 1 ? 'end' : 'middle';
    return `<text class="g-eixo" text-anchor="${anc}" x="${xs[i]}" y="${H - 5}">${txt}</text>`;
  }).join('');

  el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(s.titulo || '')}">
    <defs>
      <linearGradient id="gr-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${s.cor};stop-opacity:.3"/><stop offset=".55" style="stop-color:${s.cor2 || s.cor};stop-opacity:.08"/><stop offset="1" style="stop-color:${s.cor};stop-opacity:0"/></linearGradient>
      <linearGradient id="lg-${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style="stop-color:${s.cor2 || s.cor}"/><stop offset="1" style="stop-color:${s.cor}"/></linearGradient>
      <filter id="gl-${id}" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="5"/></filter>
    </defs>
    <g class="g-fundo">${grade}${rotulos}</g>
    <path class="g-area" d="${areaD(sx, sy, base)}" fill="url(#gr-${id})"/>
    ${s.brilho ? `<path class="g-brilho" d="${linhaD(sx, sy)}" style="stroke:${traco}" filter="url(#gl-${id})"/>` : ''}
    <path class="g-linha g-real" d="${linhaD(sx, sy)}" style="stroke:${traco}"/>
    ${pontos}
    <line class="g-cruz" x1="0" x2="0" y1="${topo - 6}" y2="${base}"/>
    <circle class="g-halo" cx="${xs[n - 1]}" cy="${ys[n - 1]}" r="4.5" style="fill:${s.cor}"/>
    <circle class="g-fim" cx="${xs[n - 1]}" cy="${ys[n - 1]}" r="4.5" style="fill:${s.cor}"/>
    <circle class="g-hover-brilho" cx="0" cy="0" r="13" style="fill:${s.cor}" filter="url(#gl-${id})"/>
    <circle class="g-hover" cx="0" cy="0" r="5" style="fill:${s.cor}"/>
  </svg><div class="tooltip"><div class="tt-in"></div></div>`;

  const cruz = $('.g-cruz', el), hov = $('.g-hover', el), hovBrilho = $('.g-hover-brilho', el);
  ligarHover(el, (mx) => {
    const i = n === 1 ? 0 : clamp(Math.round(((mx - padX) / (W - padX * 2)) * (n - 1)), 0, n - 1);
    cruz.setAttribute('x1', xs[i]); cruz.setAttribute('x2', xs[i]);
    hov.setAttribute('cx', xs[i]); hov.setAttribute('cy', ys[i]);
    hovBrilho.setAttribute('cx', xs[i]); hovBrilho.setAttribute('cy', ys[i]);
    mostrarTooltip(el, s.tooltip(i), xs[i], ys[i]);
  });

  const ant = s.chave && curvas.get(s.chave);
  if (s.chave) curvas.set(s.chave, { sy, M });
  if (reduzMov.matches || modo === 'estatico') return;
  const linha = $('.g-real', el), area = $('.g-area', el), fim = $('.g-fim', el), halo = $('.g-halo', el);
  const brilhoL = $('.g-brilho', el);

  // troca de período: a linha antiga se transforma na nova
  if (modo === 'morph' && ant && ant.M === M) {
    $('.g-fundo', el).classList.add('fade-in');
    const fimAnt = { y: ant.sy[M - 1] }, t0 = performance.now();
    const passo = (t) => {
      const p = Math.min(1, (t - t0) / 700), e = easeOut(p);
      const cy = sy.map((v, j) => ant.sy[j] + (v - ant.sy[j]) * e);
      const dLinha = linhaD(sx, cy);
      linha.setAttribute('d', dLinha);
      if (brilhoL) brilhoL.setAttribute('d', dLinha);
      area.setAttribute('d', areaD(sx, cy, base));
      const yf = fimAnt.y + (ys[n - 1] - fimAnt.y) * e;
      fim.setAttribute('cy', yf); halo.setAttribute('cy', yf);
      if (p < 1 && el.isConnected) requestAnimationFrame(passo);
    };
    passo(t0);
    return;
  }
  if (modo === 'suave' || modo === 'morph') { el.classList.remove('fade'); el.getBoundingClientRect(); el.classList.add('fade'); return; }

  // entrada: a linha se desenha, área e ponto final aparecem em seguida
  const len = linha.getTotalLength();
  const tracos = [linha, brilhoL].filter(Boolean);
  tracos.forEach((p) => { p.style.strokeDasharray = len; p.style.strokeDashoffset = len; });
  area.style.opacity = 0;
  fim.style.opacity = 0;
  el.getBoundingClientRect();
  requestAnimationFrame(() => {
    tracos.forEach((p) => { p.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(.22,1,.36,1) .15s'; p.style.strokeDashoffset = 0; });
    area.style.transition = 'opacity 1s ease .6s';
    area.style.opacity = 1;
    fim.style.transition = 'opacity .4s ease 1.3s';
    fim.style.opacity = 1;
  });
}

function desenharBarras(el, s, modo) {
  const W = el.clientWidth, H = s.altura;
  if (!W) return;
  const G = s.grupos, n = G.length, k = s.series.length, topo = 10, base = H - 24;
  const max = Math.max(1, ...G.flatMap((g) => g.valores));
  const ticks = ticksBonitos(0, max);
  const hi = Math.max(max, ticks[ticks.length - 1]);
  const y = (v) => base - (v / hi) * (base - topo);
  const esq = 46, slot = (W - esq) / n, gap = 2;
  const bw = clamp((slot * 0.5 - gap * (k - 1)) / k, 4, 16);
  const gw = bw * k + gap * (k - 1);

  const grade = ticks.map((t) => `<line class="g-grade" x1="0" x2="${W}" y1="${y(t)}" y2="${y(t)}"/>${t ? `<text class="g-eixo" x="2" y="${y(t) - 5}">${compacto(t)}</text>` : ''}`).join('');
  let ordem = 0;
  const grupos = G.map((g, i) => {
    const x0 = esq + slot * i + (slot - gw) / 2;
    const barras = g.valores.map((v, j) => {
      if (v <= 0) return '';
      const x = x0 + j * (bw + gap), yt = y(v), h = base - yt, r = Math.min(4, bw / 2, h);
      const dPath = `M${x},${base}V${yt + r}Q${x},${yt} ${x + r},${yt}H${x + bw - r}Q${x + bw},${yt} ${x + bw},${yt + r}V${base}Z`;
      return `<path class="g-barra" d="${dPath}" style="fill:${s.series[j].cor};transition-delay:${(ordem++) * 45}ms"/>`;
    }).join('');
    return `<g class="g-grupo${i !== n - 1 ? ' fora' : ''}" data-i="${i}">${barras}</g>
      <text class="g-eixo" text-anchor="middle" x="${esq + slot * i + slot / 2}" y="${H - 5}">${g.rotulo}</text>`;
  }).join('');

  el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(s.titulo || '')}">${grade}${grupos}</svg><div class="tooltip"><div class="tt-in"></div></div>`;

  const gs = [...el.querySelectorAll('.g-grupo')];
  ligarHover(el, (mx) => {
    const i = clamp(Math.floor((mx - esq) / slot), 0, n - 1);
    gs.forEach((g, j) => g.classList.toggle('ativo', j === i));
    mostrarTooltip(el, s.tooltip(i), esq + slot * i + slot / 2, y(Math.max(...G[i].valores)));
  });

  if (reduzMov.matches || modo === 'estatico') return;
  if (modo !== 'animar') { el.classList.remove('fade'); el.getBoundingClientRect(); el.classList.add('fade'); return; }
  const bs = [...el.querySelectorAll('.g-barra')];
  bs.forEach((b) => { b.style.transition = 'none'; b.style.transform = 'scaleY(0)'; });
  el.getBoundingClientRect();
  requestAnimationFrame(() => bs.forEach((b) => { b.style.transition = ''; b.style.transform = ''; }));
}

function ttDia(pontos, i) {
  const p = pontos[i], b = pontos[0];
  const d = p.valor - b.valor, pc = b.valor > 0 ? (d / b.valor) * 100 : null;
  return `<div class="tt-titulo">${dataTooltip(p.data)}</div><div class="tt-valor">${brl(p.valor)}</div>
    ${i ? `<div class="tt-delta ${d > 0 ? 'sobe' : d < 0 ? 'desce' : ''}">${FMT.brlSinal(d)}${pc !== null ? ` (${FMT.pctSinal(pc)})` : ''} no período</div>` : '<div class="tt-delta">início do período</div>'}`;
}

// ---------- estado da tela ----------
const ABAS = ['inicio', 'extrato', 'carteira', 'metas', 'relatorios', 'ajustes'];
const NOMES = { inicio: 'Minha carteira', extrato: 'Movimentações', carteira: 'Investimentos', metas: 'Metas', relatorios: 'Relatórios', ajustes: 'Configurações' };
const estado = { aba: 'inicio', mes: mesAtual(), filtro: 'todos', busca: '', periodo: '1m' };

function topo() {
  const add = { extrato: ['novo', 'Nova movimentação'], carteira: ['novo-invest', 'Novo investimento'], metas: ['nova-meta', 'Nova meta'] }[estado.aba];
  return `<div class="topo-linha">
    <div class="topo-marca"><span class="logo">${LOGO}</span><div><span class="topo-sub">${estado.aba === 'inicio' ? dataHoje() : 'Finanças'}</span><h1 class="titulo">${NOMES[estado.aba]}</h1></div></div>
    <div class="topo-acoes">
      ${add ? `<button class="icone-btn icone-acento" data-acao="${add[0]}" aria-label="${add[1]}">${ic('mais')}</button>` : ''}
      <button class="icone-btn tema-btn" data-acao="tema" aria-label="Alternar tema claro e escuro">${ic(temaEfetivo() === 'dark' ? 'sol' : 'lua')}</button>
      ${estado.aba !== 'ajustes' ? `<button class="icone-btn so-mobile" data-acao="aba" data-aba="ajustes" aria-label="Configurações">${ic('engrenagem')}</button>` : ''}
    </div>
  </div>`;
}

function seletorMes() {
  const atual = mesAtual();
  return `<div class="mes-pill">
    <button class="mes-seta" data-acao="mes" data-delta="-1" aria-label="Mês anterior">${ic('esq')}</button>
    <button class="mes-nome" data-acao="mes-hoje">${nomeMes(estado.mes)}${estado.mes !== atual ? '<span class="mes-hoje">voltar pra hoje</span>' : ''}</button>
    <button class="mes-seta" data-acao="mes" data-delta="1" aria-label="Próximo mês">${ic('dir')}</button>
  </div>`;
}

const seletorPeriodo = () => `<div class="periodos" data-seg="periodo" role="group" aria-label="Período do gráfico"><span class="seg-ind"></span>${PERIODOS.map(([v, t]) => `<button class="${estado.periodo === v ? 'ativo' : ''}" data-acao="periodo" data-v="${v}">${t}</button>`).join('')}</div>`;
const acaoRapida = (icone, rot, acao, destaque) => `<button class="acao${destaque ? ' destaque' : ''}" data-acao="${acao}"><span class="acao-ic">${ic(icone)}</span>${rot}</button>`;
const kpi = (icone, cls, rot, valor, sub) => `<div class="kpi ${cls}"><div class="kpi-topo"><span class="kpi-icone">${ic(icone)}</span><span class="kpi-rotulo">${rot}</span></div><strong class="kpi-valor">${valor}</strong><small>${sub}</small></div>`;
const secao = (titulo, link, corpo) => `<section class="secao"><div class="secao-topo"><h2>${titulo}</h2>${link || ''}</div>${corpo}</section>`;

function heroDelta(delta, pct) {
  const dir = delta > 0 ? 'sobe' : delta < 0 ? 'desce' : 'neutro';
  return `<div class="delta ${dir}">
    ${dir !== 'neutro' ? `<span class="delta-icone">${ic(dir)}</span>` : ''}
    <span>${num(delta, 'hd-' + estado.aba, 'brlSinal')}</span>
    ${pct !== null ? `<span>(${num(pct, 'hp-' + estado.aba, 'pct1')})</span>` : ''}
    <span class="delta-quando">${ROT_PERIODO[estado.periodo]}</span>
  </div>`;
}

const TIPO_INFO = {
  receita: { icone: 'entrada', nome: 'Entrada', sinal: '+ ' },
  despesa: { icone: 'saida', nome: 'Saída', sinal: '− ' },
  aporte: { icone: 'sobe', nome: 'Aporte', sinal: '' },
  resgate: { icone: 'resgate', nome: 'Resgate', sinal: '' },
  rendimento: { icone: 'brilho', nome: 'Rendimento', sinal: '+ ' },
};

function itemHTML(l, relativa = false) {
  const t = TIPO_INFO[l.tipo];
  const sub = [INVEST.includes(l.tipo) ? `${t.nome} · ${esc(l.categoria)}` : esc(l.categoria)];
  const tags = (l.fixaId ? '<span class="tag">fixa</span>' : '') + (l.data > hoje() ? '<span class="tag">previsto</span>' : '');
  // Fixa projetada (mês futuro) não é editável: muda-se a conta fixa em Configurações.
  return `<button class="item" ${l.virtual ? 'tabindex="-1" style="cursor:default"' : `data-acao="editar" data-id="${l.id}"`}>
    <span class="item-icone t-${l.tipo}">${ic(t.icone)}</span>
    <span class="item-txt"><strong>${esc(l.descricao || l.categoria)}</strong><small>${sub.join(' · ')}${tags}</small></span>
    <span class="item-dir"><span class="item-valor v-${l.tipo}">${t.sinal}${brl(l.valor)}</span>${relativa ? `<small>${dataRelativa(l.data)}</small>` : ''}</span>
  </button>`;
}

function metaInfo(meta) {
  const frac = meta.alvo ? meta.guardado / meta.alvo : 0;
  const falta = Math.max(0, meta.alvo - meta.guardado);
  let prazo = '';
  if (meta.prazo && falta) {
    const meses = difMeses(mesAtual(), meta.prazo) + 1;
    prazo = meses > 0 ? `${brl(Math.ceil(falta / meses))}/mês até ${mesCurto(meta.prazo)}/${meta.prazo.slice(2, 4)}` : 'prazo vencido';
  }
  return { frac, pct: Math.min(100, frac * 100), falta, prazo, ok: frac >= 1 };
}

function metaMini(mt) {
  const inf = metaInfo(mt);
  return `<button class="meta-mini${inf.ok ? ' concluida' : ''}" data-acao="meta" data-id="${mt.id}">
    <span class="meta-icone">${ic(inf.ok ? 'ok' : mt.icone)}</span>
    <span><span class="mm-linha"><strong>${esc(mt.nome)}</strong><span>${num(inf.pct, 'mmp-' + mt.id, 'pct1')}</span></span>
    ${barra(inf.frac, 'mmb-' + mt.id, '', 'brilha')}<small>${brl(mt.guardado)} / ${brl(mt.alvo)}</small></span>
  </button>`;
}

// Uma dica por vez, sempre levando a uma ação.
function insight(ent, sai, aPagar) {
  const quase = db.metas.map((mt) => ({ mt, inf: metaInfo(mt) })).filter((x) => !x.inf.ok && x.inf.frac >= 0.75).sort((a, b) => b.inf.frac - a.inf.frac)[0];
  if (quase) return { icone: quase.mt.icone, titulo: `Faltam ${brl(quase.inf.falta)} para "${quase.mt.nome}"`, sub: `${FMT.pct1(quase.inf.pct)} concluído. Você está quase lá.`, attrs: `data-acao="meta" data-id="${quase.mt.id}"` };
  if (ent > 0 && ent > sai) return { icone: 'tendencia', titulo: `Você guardou ${Math.round(((ent - sai) / ent) * 100)}% da renda este mês`, sub: 'Que tal investir uma parte?', attrs: 'data-acao="novo-invest"' };
  if (aPagar > 0) return { icone: 'relogio', titulo: `${brl(aPagar)} a pagar até o fim do mês`, sub: 'Contas previstas nas movimentações', attrs: 'data-acao="aba" data-aba="extrato"' };
  return null;
}

// ---------- telas ----------
function viewInicio() {
  const h = hoje(), m = mesAtual();
  const pos = posicao(h);
  const serie = serieDiaria(estado.periodo);
  const base = serie[0].total, delta = pos.total - base, pct = base > 0 ? (delta / base) * 100 : null;
  const movs = efetivosDoMes(m);
  const ent = total(movs, 'receita'), sai = total(movs, 'despesa'), rendMes = total(movs, 'rendimento');
  const futuros = doMes(m).filter((l) => l.data > h);
  const aReceber = total(futuros, 'receita'), aPagar = total(futuros, 'despesa');
  const vazio = !db.lancamentos.length && !db.fixas.length && !pos.total && !db.metas.length;
  const pts = serie.map((p) => ({ data: p.data, valor: p.total }));

  const hero = `<section class="hero ${delta < 0 ? 'desce' : 'sobe'}" id="hero">
    ${AURA}
    <span class="hero-rotulo">Patrimônio total</span>
    <div class="hero-num" id="hero-num">${num(pos.total, 'patr', 'hero')}</div>
    ${heroDelta(delta, pct)}
    ${ehRecorde(pos.total) ? `<span class="recorde">${ic('brilho')}Novo recorde</span>` : ''}
  </section>`;
  const graf = `<section class="card grafico-card">${seletorPeriodo()}
    ${grafico({ tipo: 'area', chave: 'patr', altura: 170, cor: 'var(--s-patr)', cor2: 'var(--ciano)', brilho: delta > 0, titulo: 'Evolução do patrimônio', pontos: pts, tooltip: (i) => ttDia(pts, i) })}</section>`;
  const acoes = `<div class="acoes-rapidas">
    ${acaoRapida('entrada', 'Entrada', 'novo-receita')}${acaoRapida('saida', 'Saída', 'novo-despesa')}${acaoRapida('sobe', 'Investir', 'novo-invest', true)}${acaoRapida('alvo', 'Nova meta', 'nova-meta')}
  </div>`;

  if (vazio) {
    return `${hero}${graf}${acoes}<section class="card boas-vindas">
      <h2>Comece a construir seu patrimônio</h2>
      <p>Três passos e o painel ganha vida.</p>
      <div class="passos">
        <button class="passo" data-acao="inicial"><b>1</b>Informe quanto você tem hoje${ic('dir')}</button>
        <button class="passo" data-acao="novo-receita"><b>2</b>Registre uma entrada ou saída${ic('dir')}</button>
        <button class="passo" data-acao="nova-meta"><b>3</b>Crie sua primeira meta${ic('dir')}</button>
      </div>
    </section>`;
  }

  const dica = insight(ent, sai, aPagar);
  const blocoDica = dica ? `<button class="insight" ${dica.attrs}><span class="insight-ic">${ic(dica.icone)}</span><span><strong>${esc(dica.titulo)}</strong><small>${dica.sub}</small></span>${ic('dir')}</button>` : '';

  const parte = (v) => (pos.total > 0 && v > 0 ? `${Math.round((v / pos.total) * 100)}% do patrimônio` : '&nbsp;');
  const kpis = `<div class="kpis">
    ${kpi('carteira', 'k-disp', '<span class="rot-largo">Dinheiro </span>disponível', num(pos.disp, 'disp'), parte(pos.disp))}
    ${kpi('tendencia', 'k-inv', 'Investimentos', num(pos.investido, 'inv'), parte(pos.investido))}
    ${kpi('brilho', 'k-rend', 'Rendimentos', `<span class="${pos.rend > 0 ? 'cor-sobe' : ''}">${num(pos.rend, 'rend', 'brlSinal')}</span>`, `${FMT.brlSinal(rendMes)} este mês`)}
    ${kpi('relogio', 'k-rec', 'A receber', num(aReceber, 'arec'), aPagar ? `${brl(aPagar)} a pagar` : 'até o fim do mês')}
  </div>`;

  const res = ent - sai, taxa = ent > 0 ? Math.round((res / ent) * 100) : null;
  const mesCard = `<section class="card">
    <div class="card-topo"><h2>${MESES[+m.slice(5, 7) - 1]}</h2><button class="link" data-acao="aba" data-aba="relatorios">Ver relatório</button></div>
    <div class="mes-grid">
      <div><span class="mini-rot"><i style="background:var(--s-ent)"></i>Entrou</span><strong>${num(ent, 'ent')}</strong></div>
      <div><span class="mini-rot"><i style="background:var(--s-sai)"></i>Saiu</span><strong>${num(sai, 'sai')}</strong></div>
      <div><span class="mini-rot">Resultado</span><strong class="${res > 0 ? 'cor-sobe' : res < 0 ? 'cor-desce' : ''}">${num(res, 'res', 'brlSinal')}</strong></div>
    </div>
    ${ent || sai ? `<div class="razao" aria-hidden="true"><span style="flex:${ent} 1 0;background:var(--s-ent)"></span><span style="flex:${sai} 1 0;background:var(--s-sai)"></span></div>` : '<div style="height:12px"></div>'}
    <span class="card-sub">${taxa === null ? 'Nenhuma entrada ainda este mês.' : taxa >= 0 ? `Você guardou ${taxa}% do que entrou.` : 'Saiu mais do que entrou este mês.'}</span>
  </section>`;

  const recentes = ordenar(db.lancamentos.filter((l) => l.data <= h)).slice(0, 5);
  const blocoMovs = secao('Movimentações', '<button class="link" data-acao="aba" data-aba="extrato">Ver todas</button>',
    `<div class="card lista-card">${recentes.length ? `<div class="lista">${recentes.map((l) => itemHTML(l, true)).join('')}</div>` : '<p class="vazio">Nenhuma movimentação ainda.</p>'}</div>`);

  const metas = db.metas.slice().sort((a, b) => { const x = metaInfo(a), y = metaInfo(b); return x.ok - y.ok || y.frac - x.frac; }).slice(0, 3);
  const blocoMetas = secao('Metas', db.metas.length ? '<button class="link" data-acao="aba" data-aba="metas">Ver todas</button>' : '',
    `<div class="card lista-card">${metas.length ? metas.map(metaMini).join('') : '<p class="vazio">Defina um objetivo e acompanhe cada real até chegar lá.</p>'}</div>`);

  const dist = distribuicao(pos), rent = rentabilidade(pos), somaInv = dist.reduce((t, it) => t + it.v, 0);
  const blocoInv = secao('Investimentos', '<button class="link" data-acao="aba" data-aba="carteira">Ver carteira</button>',
    `<button class="card inv-mini" data-acao="aba" data-aba="carteira">
      <div class="inv-mini-topo">
        <div><span class="kpi-rotulo">Total investido</span><strong>${num(pos.investido, 'inv-mini')}</strong></div>
        <div class="dir"><span class="kpi-rotulo">Rentabilidade</span><strong class="${rent > 0 ? 'cor-sobe' : ''}">${rent !== null ? num(rent, 'rent-mini', 'pctSinal') : '—'}</strong></div>
      </div>
      ${somaInv ? `<div class="dist-barra">${dist.map((it) => `<span style="flex:${it.v} 1 0;background:var(--s-${it.slot})"></span>`).join('')}</div>
      <div class="legenda" style="margin-top:10px">${dist.slice(0, 4).map((it) => `<span><i style="background:var(--s-${it.slot})"></i>${esc(it.nome)}</span>`).join('')}</div>`
      : '<p class="vazio" style="padding:4px 0">Nenhum investimento registrado.</p>'}
    </button>`);

  return `${hero}${graf}${acoes}${blocoDica}${kpis}<div class="desk-2">${mesCard}${blocoInv}</div><div class="desk-2">${blocoMovs}${blocoMetas}</div>`;
}

function viewCarteira() {
  const h = hoje(), pos = posicao(h), serie = serieDiaria(estado.periodo);
  const pts = serie.map((p) => ({ data: p.data, valor: p.investido }));
  const base = pts[0].valor, delta = pos.investido - base, pct = base > 0 ? (delta / base) * 100 : null;
  const rent = rentabilidade(pos);
  const movs = efetivosDoMes(mesAtual());
  const rendMes = total(movs, 'rendimento'), aportMes = total(movs, 'aporte') - total(movs, 'resgate');
  const dist = distribuicao(pos), somaInv = dist.reduce((t, it) => t + it.v, 0);
  const temInvest = pos.investido > 0 || db.lancamentos.some((l) => INVEST.includes(l.tipo));

  const hero = `<section class="hero hero-roxo ${delta < 0 ? 'desce' : 'sobe'}" id="hero">
    ${AURA}
    <span class="hero-rotulo">Total investido</span>
    <div class="hero-num" id="hero-num">${num(pos.investido, 'invh', 'hero')}</div>
    ${heroDelta(delta, pct)}
  </section>`;
  const acoes = `<div class="acoes-rapidas tres">
    ${acaoRapida('sobe', 'Aporte', 'novo-aporte', true)}${acaoRapida('resgate', 'Resgate', 'novo-resgate')}${acaoRapida('brilho', 'Rendimento', 'novo-rendimento')}
  </div>`;

  if (!temInvest) {
    return `${hero}${acoes}<section class="card vazio-grande">
      <span class="meta-icone">${ic('tendencia')}</span>
      <h2>Comece a investir</h2>
      <p>Registre aportes e rendimentos pra ver sua carteira crescer. Se você já tem investimentos, informe em Configurações → Patrimônio inicial.</p>
      <button class="btn btn-primario" data-acao="novo-aporte" style="width:100%">Registrar aporte</button>
    </section>`;
  }

  const graf = `<section class="card grafico-card">${seletorPeriodo()}
    ${grafico({ tipo: 'area', chave: 'inv', altura: 170, cor: 'var(--s-inv)', cor2: 'var(--azul)', brilho: delta > 0, titulo: 'Evolução dos investimentos', pontos: pts, tooltip: (i) => ttDia(pts, i) })}</section>`;
  const kpis = `<div class="kpis">
    ${kpi('tendencia', 'k-rend', 'Rentabilidade', `<span class="${rent > 0 ? 'cor-sobe' : ''}">${rent !== null ? num(rent, 'rent', 'pctSinal') : '—'}</span>`, 'sobre o valor aplicado')}
    ${kpi('brilho', 'k-rend', 'Rendimentos', `<span class="${pos.rend > 0 ? 'cor-sobe' : ''}">${num(pos.rend, 'rend-t', 'brlSinal')}</span>`, 'acumulados')}
    ${kpi('relogio', 'k-inv', 'Rendeu este mês', num(rendMes, 'rend-m', 'brlSinal'), MESES[new Date().getMonth()].toLowerCase())}
    ${kpi('sobe', 'k-disp', 'Aportes no mês', num(aportMes, 'aport-m'), 'aportes − resgates')}
  </div>`;

  const blocoDist = secao('Distribuição', '', `<div class="card">
    ${somaInv ? `<div class="dist-barra">${dist.map((it) => `<span style="flex:${it.v} 1 0;background:var(--s-${it.slot})"></span>`).join('')}</div>
    ${dist.map((it) => `<div class="ativo-linha">
      <span class="ativo-ic" style="--cor:var(--s-${it.slot})">${esc(it.nome.charAt(0).toUpperCase())}</span>
      <div><strong>${esc(it.nome)}</strong><small>${num((it.v / somaInv) * 100, 'dp-' + it.nome, 'pct1')} da carteira</small></div>
      <div class="dir"><strong>${brl(it.v)}</strong>${it.rend ? `<small class="cor-sobe">${FMT.brlSinal(it.rend)}</small>` : '<small>&nbsp;</small>'}</div>
    </div>`).join('')}` : '<p class="vazio">Sem saldo investido no momento.</p>'}
  </div>`);

  const ult = ordenar(db.lancamentos.filter((l) => INVEST.includes(l.tipo) && l.data <= h)).slice(0, 6);
  const blocoMovs = secao('Movimentações da carteira', '', `<div class="card lista-card">${ult.length ? `<div class="lista">${ult.map((l) => itemHTML(l, true)).join('')}</div>` : '<p class="vazio">Nenhuma movimentação ainda.</p>'}</div>`);

  return `${hero}${graf}${acoes}${kpis}<div class="desk-2">${blocoDist}${blocoMovs}</div>`;
}

function listaExtrato() {
  const termo = estado.busca.trim().toLowerCase();
  const lista = ordenar(doMes(estado.mes)).filter((l) =>
    (estado.filtro === 'todos' || grupoDe(l.tipo) === estado.filtro) &&
    (!termo || `${l.descricao} ${l.categoria}`.toLowerCase().includes(termo)));
  if (!lista.length) return '<p class="vazio">Nada por aqui.</p>';

  const resultado = (arr) => total(arr, 'receita') + total(arr, 'rendimento') - total(arr, 'despesa');
  const dias = new Map();
  for (const l of lista) { if (!dias.has(l.data)) dias.set(l.data, []); dias.get(l.data).push(l); }

  let html = `<div class="resumo-filtro"><span>${lista.length} movimentaç${lista.length > 1 ? 'ões' : 'ão'}</span><span class="num">Resultado: ${FMT.brlSinal(resultado(lista))}</span></div><section class="card lista-card"><div class="lista">`;
  for (const [data, itens] of dias) {
    const rel = dataRelativa(data);
    html += `<div class="dia"><span>${/^\d/.test(rel) ? dataLonga(data) : `${rel} · ${dataLonga(data)}`}</span><span class="num">${FMT.brlSinal(resultado(itens))}</span></div>${itens.map((l) => itemHTML(l)).join('')}`;
  }
  return html + '</div></section>';
}

function viewExtrato() {
  const chip = (v, txt) => `<button class="chip${estado.filtro === v ? ' ativo' : ''}" data-acao="filtro" data-v="${v}">${txt}</button>`;
  return `${seletorMes()}<div class="conteudo">
    <input class="busca" id="busca" type="search" placeholder="Buscar por descrição ou categoria" value="${esc(estado.busca)}">
    <div class="chips">${chip('todos', 'Todas')}${chip('receita', 'Entradas')}${chip('despesa', 'Saídas')}${chip('investimento', 'Investimentos')}</div>
    <div id="lista-extrato" style="display:grid;gap:10px">${listaExtrato()}</div>
  </div>`;
}

function viewMetas() {
  if (!db.metas.length) {
    return `<section class="card vazio-grande">
      <span class="meta-icone">${ic('alvo')}</span>
      <h2>Defina seu primeiro objetivo</h2>
      <p>Carro, viagem, reserva de emergência. Acompanhe cada real até chegar lá.</p>
      <button class="btn btn-primario" data-acao="nova-meta" style="width:100%">Criar meta</button>
    </section>`;
  }
  const guardado = db.metas.reduce((t, mt) => t + Math.min(mt.guardado, mt.alvo), 0);
  const alvo = db.metas.reduce((t, mt) => t + mt.alvo, 0);
  const concluidas = db.metas.filter((mt) => metaInfo(mt).ok).length;
  const resumo = `<section class="hero">
    <span class="hero-rotulo">Guardado para as metas</span>
    <div class="hero-num">${num(guardado, 'metas-g', 'hero')}</div>
    <div class="delta"><span class="delta-quando">de ${brl(alvo)} · ${num(alvo ? (guardado / alvo) * 100 : 0, 'metas-p', 'pct1')} · ${concluidas} de ${db.metas.length} concluída${db.metas.length > 1 ? 's' : ''}</span></div>
    <div style="margin-top:14px">${barra(alvo ? guardado / alvo : 0, 'metas-b', '', 'brilha')}</div>
  </section>`;

  const ordenadas = db.metas.slice().sort((a, b) => { const x = metaInfo(a), y = metaInfo(b); return x.ok - y.ok || y.frac - x.frac; });
  const cards = ordenadas.map((mt) => {
    const inf = metaInfo(mt);
    const rodape = inf.ok
      ? `<span class="meta-selo">${ic('ok')} Meta concluída</span>`
      : `${ic('alvo')}<span>Faltam ${brl(inf.falta)}${inf.prazo ? ` · ${inf.prazo}` : ''}</span>`;
    return `<button class="card meta-card${inf.ok ? ' concluida' : ''}" data-acao="meta" data-id="${mt.id}" data-meta-card="${mt.id}">
      <div class="meta-topo">
        <span class="meta-icone">${ic(inf.ok ? 'ok' : mt.icone)}</span>
        <div><strong>${esc(mt.nome)}</strong><small>${mt.prazo ? `até ${mesCurto(mt.prazo)}/${mt.prazo.slice(0, 4)}` : 'sem prazo'}</small></div>
        <span class="meta-pct">${num(inf.pct, 'mp-' + mt.id, 'pct1')}</span>
      </div>
      <div class="meta-valores"><strong>${num(mt.guardado, 'mg-' + mt.id)}</strong> / ${brl(mt.alvo)}</div>
      ${barra(inf.frac, 'mb-' + mt.id, '', 'brilha')}
      <div class="meta-rodape">${rodape}</div>
    </button>`;
  });
  const metade = Math.ceil(cards.length / 2);
  return `${resumo}<div class="desk-2"><div class="conteudo">${cards.slice(0, metade).join('')}</div><div class="conteudo">${cards.slice(metade).join('')}</div></div>
    <button class="btn" data-acao="nova-meta">Nova meta</button>`;
}

function viewRelatorios() {
  const m = estado.mes, movs = efetivosDoMes(m);
  const ent = total(movs, 'receita'), sai = total(movs, 'despesa'), res = ent - sai;
  const taxa = ent > 0 ? Math.round((res / ent) * 100) : null;

  const resumo = `<section class="card">
    <div class="mes-grid">
      <div><span class="mini-rot"><i style="background:var(--s-ent)"></i>Entrou</span><strong>${num(ent, 'r-ent')}</strong></div>
      <div><span class="mini-rot"><i style="background:var(--s-sai)"></i>Saiu</span><strong>${num(sai, 'r-sai')}</strong></div>
      <div><span class="mini-rot">Resultado</span><strong class="${res > 0 ? 'cor-sobe' : res < 0 ? 'cor-desce' : ''}">${num(res, 'r-res', 'brlSinal')}</strong></div>
    </div>
    ${ent || sai ? `<div class="razao" aria-hidden="true"><span style="flex:${ent} 1 0;background:var(--s-ent)"></span><span style="flex:${sai} 1 0;background:var(--s-sai)"></span></div>` : '<div style="height:12px"></div>'}
    <span class="card-sub">${taxa === null ? 'Sem entradas neste mês.' : taxa >= 0 ? `Taxa de poupança: ${taxa}% da renda.` : 'Saiu mais do que entrou neste mês.'}</span>
  </section>`;

  const fl = [];
  for (let k = 5; k >= 0; k--) {
    const mm = somaMes(m, -k), ms = efetivosDoMes(mm);
    fl.push({ m: mm, ent: total(ms, 'receita'), sai: total(ms, 'despesa') });
  }
  const temFluxo = fl.some((g) => g.ent || g.sai);
  const blocoFluxo = secao('Entradas x saídas', '<span class="card-sub">últimos 6 meses</span>', `<div class="card">
    <div class="legenda"><span><i style="background:var(--s-ent)"></i>Entradas</span><span><i style="background:var(--s-sai)"></i>Saídas</span></div>
    ${temFluxo ? grafico({
      tipo: 'barras', altura: 170, titulo: 'Entradas e saídas por mês',
      series: [{ nome: 'Entradas', cor: 'var(--s-ent)' }, { nome: 'Saídas', cor: 'var(--s-sai)' }],
      grupos: fl.map((g) => ({ rotulo: mesCurto(g.m), valores: [g.ent, g.sai] })),
      tooltip: (i) => { const g = fl[i]; return `<div class="tt-titulo">${nomeMes(g.m)}</div>
        <div class="tt-linha"><i style="background:var(--s-ent)"></i>Entradas<b>${brl(g.ent)}</b></div>
        <div class="tt-linha"><i style="background:var(--s-sai)"></i>Saídas<b>${brl(g.sai)}</b></div>
        <div class="tt-linha tt-total">Resultado<b>${FMT.brlSinal(g.ent - g.sai)}</b></div>`; },
    }) : '<p class="vazio">O gráfico aparece quando houver entradas ou saídas.</p>'}
  </div>`);

  const cats = [...porCategoria(movs, 'despesa')].sort((a, b) => b[1] - a[1]);
  const maior = cats.length ? cats[0][1] : 1;
  const blocoCats = secao('Para onde foi o dinheiro', '', `<div class="card">${cats.length ? `<div class="barras">${cats.map(([c, v]) => `<div>
      <div class="barra-linha"><span>${esc(c)}</span><span class="num"><strong>${brl(v)}</strong><small>${num((v / sai) * 100, 'cp-' + c, 'pct')}</small></span></div>
      ${barra(v / maior, 'cb-' + c, 'var(--s-sai)')}
    </div>`).join('')}</div>` : '<p class="vazio">Nenhuma saída neste mês.</p>'}</div>`);

  return `${seletorMes()}<div class="conteudo">${resumo}${blocoFluxo}<div class="desk-2">${blocoCats}${viewOrcamento()}</div></div>`;
}

function viewOrcamento() {
  const gastos = porCategoria(efetivosDoMes(estado.mes), 'despesa');
  const nomes = [...new Set([...db.categorias.despesa, ...Object.keys(db.orcamentos), ...gastos.keys()])];
  const com = nomes.filter((c) => db.orcamentos[c]);
  const sem = nomes.filter((c) => !db.orcamentos[c]);
  const totLim = com.reduce((t, c) => t + db.orcamentos[c], 0);
  const totGasto = com.reduce((t, c) => t + (gastos.get(c) || 0), 0);

  const linhas = com
    .map((c) => ({ c, g: gastos.get(c) || 0, lim: db.orcamentos[c] }))
    .sort((a, b) => b.g / b.lim - a.g / a.lim)
    .map(({ c, g, lim }) => {
      const p = g / lim;
      const [cls, icone, txt] = p > 1
        ? ['st-critico', 'estouro', `Passou ${brl(g - lim)} do limite`]
        : p >= 0.8
          ? ['st-atencao', 'alerta', `Perto do limite · sobra ${brl(lim - g)}`]
          : ['st-ok', 'ok', `Dentro do limite · sobra ${brl(lim - g)}`];
      return `<button class="orc ${cls}" data-acao="limite" data-cat="${esc(c)}">
        <div class="orc-linha"><strong>${esc(c)}</strong><span class="num">${brl(g)} <span class="muted">de ${brl(lim)}</span></span></div>
        ${barra(p, 'orc-' + c)}
        <div class="orc-status">${ic(icone)}<span>${txt}</span></div>
      </button>`;
    }).join('');

  return secao('Orçamento', com.length ? `<span class="card-sub">${brl(totGasto)} de ${brl(totLim)}</span>` : '', `<div class="card">
    ${linhas || '<p class="vazio" style="padding-top:4px">Toque numa categoria abaixo pra definir um limite mensal.</p>'}
    ${sem.length ? `<div class="divisor" style="margin:8px 0"></div>${sem.map((c) => `
      <button class="orc" data-acao="limite" data-cat="${esc(c)}">
        <div class="orc-linha" style="margin:0"><strong>${esc(c)}</strong><span class="num">${brl(gastos.get(c) || 0)}</span></div>
        <span class="sem-limite">Definir limite</span>
      </button>`).join('')}` : ''}
  </div>`);
}

function viewAjustes() {
  const pref = lerTemaPref();
  const temaSeg = `<div class="seg" data-seg="tema"><span class="seg-ind"></span>${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']].map(([v, t]) => `<button class="${pref === v ? 'ativo' : ''}" data-acao="tema-pref" data-v="${v}">${t}</button>`).join('')}</div>`;

  const ini = db.inicial;
  const iniInv = Object.values(ini.investido).reduce((t, v) => t + (v || 0), 0);

  const fixas = db.fixas.length
    ? db.fixas.map((f) => `<div class="linha-ajuste">
        <div><strong>${esc(f.descricao || f.categoria)}</strong><small>${TIPO_INFO[f.tipo].nome} · ${esc(f.categoria)} · todo dia ${f.dia}</small></div>
        <div style="display:flex;align-items:center;gap:10px"><span class="num">${brl(f.valor)}</span>
        <button class="icone-btn" data-acao="rm-fixa" data-id="${f.id}" aria-label="Parar de repetir">${ic('x')}</button></div>
      </div>`).join('')
    : '<p class="vazio">Marque "Repetir todo mês" ao criar uma movimentação (aluguel, salário, aporte mensal).</p>';

  const blocoCats = (tipo, titulo) => `<section class="card"><div class="card-topo"><h2>${titulo}</h2></div>
    <div class="chips">${db.categorias[tipo].map((c) => `<button class="chip chip-rm" data-acao="rm-cat" data-tipo="${tipo}" data-cat="${esc(c)}" aria-label="Remover ${esc(c)}">${esc(c)} ${ic('x')}</button>`).join('')}</div>
    <form class="add-cat" data-form="add-cat" data-tipo="${tipo}"><input name="nome" maxlength="30" placeholder="Nova categoria"><button class="btn btn-p" type="submit">Adicionar</button></form>
  </section>`;

  const backup = db.ultimoBackup ? `Último backup: ${db.ultimoBackup.split('-').reverse().join('/')}.` : 'Você ainda não fez nenhum backup.';

  return `
    <div class="desk-2">
      <div class="conteudo">
        <section class="card"><div class="card-topo"><h2>Aparência</h2></div>${temaSeg}</section>
        <section class="card"><div class="card-topo"><h2>Patrimônio inicial</h2></div>
          <button class="linha-ajuste" data-acao="inicial">
            <div><strong>${brl((ini.disponivel || 0) + iniInv)}</strong><small>Disponível ${brl(ini.disponivel || 0)} · investido ${brl(iniInv)}</small></div>
            <span class="link">Editar</span>
          </button>
        </section>
        <section class="card"><div class="card-topo"><h2>Contas fixas</h2></div>${fixas}</section>
        <section class="card"><div class="card-topo"><h2>Backup</h2></div>
          <p class="texto-ajuda">${backup} Os dados ficam só neste aparelho, então exporte de vez em quando.</p>
          <div class="acoes"><button class="btn btn-primario" data-acao="exportar">Exportar</button><button class="btn" data-acao="importar">Importar</button></div>
        </section>
      </div>
      <div class="conteudo">
        ${blocoCats('despesa', 'Categorias de saída')}
        ${blocoCats('receita', 'Categorias de entrada')}
        ${blocoCats('investimento', 'Tipos de investimento')}
      </div>
    </div>
    <button class="btn btn-perigo" data-acao="apagar">Apagar todos os dados</button>
    <p class="rodape">Finanças · funciona offline · ${db.lancamentos.length} movimentações salvas</p>`;
}

const TELAS = { inicio: viewInicio, extrato: viewExtrato, carteira: viewCarteira, metas: viewMetas, relatorios: viewRelatorios, ajustes: viewAjustes };

// modo: 'tela' (entrada, conta do zero) · 'periodo' (troca de mês) · 'morph' (troca de período do gráfico) · 'suave' (dados mudaram)
function render(modo = 'tela', dir = 0) {
  graficos.clear();
  const topoEl = $('#topo'), v = $('#view');
  topoEl.innerHTML = topo();
  topoEl.classList.toggle('anima', modo === 'tela');
  v.innerHTML = TELAS[estado.aba]();
  v.removeAttribute('aria-busy');
  atualizarNav(modo === 'tela');

  if (!reduzMov.matches) {
    if (modo === 'tela') {
      const blocos = [];
      const coletar = (el) => { for (const c of el.children) { if (c.classList.contains('conteudo') || c.classList.contains('desk-2')) coletar(c); else blocos.push(c); } };
      coletar(v);
      blocos.forEach((el, i) => { el.style.setProperty('--i', Math.min(i, 10)); el.style.setProperty('--dir', dir); el.classList.add('entra'); });
    } else if (modo === 'periodo') {
      const c = $('.conteudo', v);
      if (c) { c.style.setProperty('--dir', dir || 1); c.classList.add('entra-periodo'); }
    }
  }
  const mn = modo === 'tela' ? 'tela' : 'suave';
  animarNumeros(v, mn);
  animarBarras(v, mn);
  desenharGraficos(v, modo === 'tela' || modo === 'periodo' ? 'animar' : modo);
  indicadores(v, modo !== 'tela');
  if (efeitoPendente) {
    const ef = efeitoPendente;
    efeitoPendente = null;
    requestAnimationFrame(() => aplicarEfeito(ef));
  }
}

function atualizarNav(saltar, aba = estado.aba) {
  const ind = $('.nav-indicador');
  document.querySelectorAll('.nav [data-aba]').forEach((b) => {
    const ativo = b.dataset.aba === aba;
    b.classList.toggle('ativo', ativo);
    if (ativo) {
      if (!b.offsetWidth) { ind.style.opacity = 0; return; } // Configurações fica fora da barra no celular
      ind.style.width = `${b.offsetWidth}px`;
      ind.style.height = `${b.offsetHeight}px`;
      ind.style.transform = `translate(${b.offsetLeft}px, ${b.offsetTop}px)`;
      ind.style.opacity = 1;
      if (saltar) { b.classList.remove('salta'); void b.offsetWidth; b.classList.add('salta'); }
    }
  });
}

// ---------- tema ----------
// O escuro é o modo principal: sem preferência salva, abre escuro.
function lerTemaPref() { try { return localStorage.getItem(CHAVE_TEMA) || 'dark'; } catch (e) { return 'dark'; } }
function aplicarTema(pref) {
  const r = document.documentElement;
  if (pref === 'auto') r.removeAttribute('data-theme'); else r.dataset.theme = pref;
}
const temaEfetivo = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

function definirTema(pref, ev) {
  try { localStorage.setItem(CHAVE_TEMA, pref); } catch (e) { /* só nesta sessão */ }
  const trocar = () => {
    aplicarTema(pref);
    $('#topo').classList.remove('anima'); // o título não repete a entrada ao trocar o tema
    $('#topo').innerHTML = topo();
    $('.tema-btn').classList.add('gira'); // o ícone gira só quando o tema muda
    if (estado.aba === 'ajustes') {
      $('#view').querySelectorAll('[data-acao="tema-pref"]').forEach((b) => b.classList.toggle('ativo', b.dataset.v === pref));
      indicadores($('#view'), true);
    }
  };
  if (reduzMov.matches) { trocar(); return; }
  // Revelação circular a partir do botão (View Transitions); sem suporte, as cores deslizam.
  if (document.startViewTransition) {
    const alvo = ev && ev.target.closest('button');
    const r = alvo ? alvo.getBoundingClientRect() : { left: innerWidth / 2, top: 0, width: 0, height: 0 };
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const raio = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.startViewTransition(trocar).ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${raio}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)' });
    }).catch(() => {});
  } else {
    const r = document.documentElement;
    r.classList.add('tema-anim');
    trocar();
    setTimeout(() => r.classList.remove('tema-anim'), 500);
  }
}

// ---------- sheet (painel/modal) ----------
function abrirSheet(html) {
  const s = $('#sheet');
  $('#sheet-corpo').innerHTML = html;
  s.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => s.classList.add('aberto')));
}

function fecharSheet() {
  const s = $('#sheet');
  s.classList.remove('aberto');
  setTimeout(() => { if (!s.classList.contains('aberto')) { s.hidden = true; $('#sheet-corpo').innerHTML = ''; } }, 380);
}

const cabecalhoSheet = (titulo) => `<div class="sheet-topo"><h2>${titulo}</h2><button type="button" class="icone-btn" data-acao="fechar" aria-label="Fechar">${ic('x')}</button></div>`;

const DICAS = {
  aporte: 'Sai do dinheiro disponível e vai para os investimentos. O patrimônio não muda.',
  resgate: 'Volta dos investimentos para o dinheiro disponível.',
  rendimento: 'Quanto o investimento rendeu. Aumenta o patrimônio.',
};

function abrirLancamento(l, grupoInicial = 'despesa', opInicial = 'aporte') {
  const novo = !l;
  let grupo = l ? grupoDe(l.tipo) : grupoInicial;
  let op = l && INVEST.includes(l.tipo) ? l.tipo : opInicial;
  let cat = l ? l.categoria : null;
  const dataPadrao = estado.aba === 'extrato' && estado.mes !== mesAtual() ? `${estado.mes}-01` : hoje();

  abrirSheet(`<form class="form" id="f-lanc" autocomplete="off">
    ${cabecalhoSheet(novo ? 'Nova movimentação' : 'Editar movimentação')}
    <div class="seg" data-seg="f-grupo"><span class="seg-ind"></span><button type="button" data-grupo="receita">Entrada</button><button type="button" data-grupo="despesa">Saída</button><button type="button" data-grupo="investimento">Investimento</button></div>
    <div class="seg" id="f-op" data-seg="f-op"><span class="seg-ind"></span><button type="button" data-op="aporte">Aporte</button><button type="button" data-op="resgate">Resgate</button><button type="button" data-op="rendimento">Rendimento</button></div>
    <p class="dica" id="f-dica"></p>
    <label class="valor-campo"><span>R$</span><input name="valor" inputmode="decimal" placeholder="0,00" value="${l ? centavosParaCampo(l.valor) : ''}" aria-label="Valor"></label>
    <div><div class="rotulo" id="f-rot-cat" style="margin-bottom:8px">Categoria</div><div class="chips" id="f-cats"></div></div>
    <label class="campo"><span>Descrição</span><input name="descricao" maxlength="80" placeholder="Opcional" value="${l ? esc(l.descricao || '') : ''}"></label>
    <label class="campo"><span>Data</span><input type="date" name="data" required value="${l ? l.data : dataPadrao}"></label>
    ${novo ? '<label class="check"><input type="checkbox" name="fixa"><span>Repetir todo mês</span></label>' : ''}
    <button class="btn btn-primario" type="submit">Salvar</button>
    ${novo ? '' : '<button class="btn btn-perigo" type="button" id="f-excluir">Excluir movimentação</button>'}
  </form>`);

  const f = $('#f-lanc');
  let primeira = true;
  const pintar = () => {
    f.querySelectorAll('[data-grupo]').forEach((b) => b.classList.toggle('ativo', b.dataset.grupo === grupo));
    f.querySelectorAll('[data-op]').forEach((b) => b.classList.toggle('ativo', b.dataset.op === op));
    $('#f-op').hidden = grupo !== 'investimento';
    $('#f-dica').hidden = grupo !== 'investimento';
    $('#f-dica').textContent = DICAS[op];
    $('#f-rot-cat').textContent = grupo === 'investimento' ? 'Onde está investido' : 'Categoria';
    const lista = [...db.categorias[grupo]];
    if (l && grupoDe(l.tipo) === grupo && !lista.includes(l.categoria)) lista.push(l.categoria);
    if (!lista.length) lista.push('Outros');
    if (!lista.includes(cat)) cat = lista[0];
    $('#f-cats').innerHTML = lista.map((c) => `<button type="button" class="chip${c === cat ? ' ativo' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
    indicadores(f, !primeira);
    primeira = false;
  };
  // o painel ainda está entrando: mede o indicador no quadro seguinte
  requestAnimationFrame(pintar);
  pintar();

  f.addEventListener('click', (e) => {
    const g = e.target.closest('[data-grupo]');
    if (g) { grupo = g.dataset.grupo; pintar(); return; }
    const o = e.target.closest('[data-op]');
    if (o) { op = o.dataset.op; pintar(); return; }
    const c = e.target.closest('[data-cat]');
    if (c) { cat = c.dataset.cat; pintar(); }
  });

  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(f);
    const valor = parseValor(fd.get('valor'));
    if (valor <= 0) { toast('Informe o valor', 'erro'); f.valor.focus(); return; }
    const data = fd.get('data');
    const descricao = String(fd.get('descricao') || '').trim();
    const tipo = grupo === 'investimento' ? op : grupo;

    if (novo) {
      const antes = posicao(hoje());
      const recordeAntes = ehRecorde(antes.total);
      const lanc = { id: uid(), tipo, valor, categoria: cat, descricao, data };
      efeitoPendente = { tipo, valor, id: lanc.id, hoje: data <= hoje(), patrAntes: antes.total, invAntes: antes.investido, recordeAntes };
      if (fd.get('fixa')) {
        const fixa = { id: uid(), tipo, valor, categoria: cat, descricao, dia: +data.slice(8, 10), inicio: mesDe(data), geradas: [mesDe(data)] };
        db.fixas.push(fixa);
        lanc.fixaId = fixa.id;
      }
      db.lancamentos.push(lanc);
    } else {
      Object.assign(l, { tipo, valor, categoria: cat, descricao, data });
    }
    salvar();
    gerarFixas();
    fecharSheet();
    render('suave');
    toast(novo ? `${TIPO_INFO[tipo].nome} registrada` : 'Alterações salvas', novo ? TOAST_TIPO[tipo] : 'ok');
  });

  const excluir = $('#f-excluir');
  if (excluir) excluir.addEventListener('click', () => {
    if (!confirm('Excluir esta movimentação?')) return;
    db.lancamentos = db.lancamentos.filter((x) => x.id !== l.id);
    salvar();
    fecharSheet();
    render('suave');
    toast('Movimentação excluída');
  });

  if (novo) setTimeout(() => f.valor.focus(), 300);
}

function abrirLimite(cat) {
  const atual = db.orcamentos[cat];
  abrirSheet(`<form class="form" id="f-lim" autocomplete="off">
    ${cabecalhoSheet(`Limite de ${esc(cat)}`)}
    <p class="texto-ajuda" style="margin:0">Quanto você quer gastar no máximo por mês nessa categoria.</p>
    <label class="valor-campo"><span>R$</span><input name="valor" inputmode="decimal" placeholder="0,00" value="${centavosParaCampo(atual)}" aria-label="Limite mensal"></label>
    <button class="btn btn-primario" type="submit">Salvar limite</button>
    ${atual ? '<button class="btn btn-perigo" type="button" id="f-rm-lim">Remover limite</button>' : ''}
  </form>`);
  const f = $('#f-lim');
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = parseValor(f.valor.value);
    if (v <= 0) { toast('Informe o limite', 'erro'); return; }
    db.orcamentos[cat] = v;
    salvar(); fecharSheet(); render('suave');
  });
  const rm = $('#f-rm-lim');
  if (rm) rm.addEventListener('click', () => { delete db.orcamentos[cat]; salvar(); fecharSheet(); render('suave'); });
  setTimeout(() => f.valor.focus(), 300);
}

function abrirMeta(meta) {
  const nova = !meta;
  let icone = meta ? meta.icone : 'alvo';
  abrirSheet(`<form class="form" id="f-meta" autocomplete="off">
    ${cabecalhoSheet(nova ? 'Nova meta' : esc(meta.nome))}
    ${nova ? '' : `<div>
      <div class="rotulo" style="margin-bottom:4px">Guardado: ${brl(meta.guardado)} de ${brl(meta.alvo)}</div>
      <label class="valor-campo"><span>R$</span><input name="mov" inputmode="decimal" placeholder="0,00" aria-label="Valor a guardar ou retirar"></label>
    </div>
    <div class="acoes"><button type="button" class="btn" id="m-retirar">Retirar</button><button type="button" class="btn btn-primario" id="m-guardar">Guardar</button></div>
    <div class="divisor"></div>`}
    <label class="campo"><span>Nome da meta</span><input name="nome" maxlength="40" required placeholder="Ex.: Comprar um carro" value="${nova ? '' : esc(meta.nome)}"></label>
    <div><div class="rotulo" style="margin-bottom:8px">Ícone</div><div class="icones-meta" id="m-icones"></div></div>
    <label class="campo"><span>Valor da meta</span><input name="alvo" inputmode="decimal" placeholder="0,00" value="${nova ? '' : centavosParaCampo(meta.alvo)}"></label>
    ${nova ? '<label class="campo"><span>Já tenho guardado</span><input name="guardado" inputmode="decimal" placeholder="0,00"></label>' : ''}
    <label class="campo"><span>Prazo (opcional)</span><input type="month" name="prazo" value="${nova ? '' : meta.prazo || ''}"></label>
    <button class="btn ${nova ? 'btn-primario' : ''}" type="submit">${nova ? 'Criar meta' : 'Salvar alterações'}</button>
    ${nova ? '' : '<button class="btn btn-perigo" type="button" id="m-excluir">Excluir meta</button>'}
  </form>`);

  const f = $('#f-meta');
  const pintar = () => {
    $('#m-icones').innerHTML = ICONES_META.map((n) => `<button type="button" class="${n === icone ? 'ativo' : ''}" data-icone-meta="${n}" aria-label="${n}">${ic(n)}</button>`).join('');
  };
  pintar();
  f.addEventListener('click', (e) => {
    const b = e.target.closest('[data-icone-meta]');
    if (b) { icone = b.dataset.iconeMeta; pintar(); }
  });

  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const nome = f.nome.value.trim();
    const alvo = parseValor(f.alvo.value);
    if (!nome) { toast('Dê um nome pra meta', 'erro'); return; }
    if (alvo <= 0) { toast('Informe o valor da meta', 'erro'); return; }
    const prazo = f.prazo.value || null;
    if (nova) {
      const id = uid();
      db.metas.push({ id, nome, icone, alvo, guardado: parseValor(f.guardado.value), prazo, criada: hoje() });
      efeitoPendente = { tipo: 'meta-nova', id };
      salvar(); fecharSheet(); render('suave');
      toast('Meta criada', 'meta');
    } else {
      const antes = meta.guardado < meta.alvo;
      Object.assign(meta, { nome, icone, alvo, prazo });
      salvar(); fecharSheet(); render('suave');
      if (antes && meta.guardado >= meta.alvo) celebrar(meta); else toast('Meta atualizada');
    }
  });

  if (!nova) {
    const mover = (sinal) => {
      const v = parseValor(f.mov.value);
      if (v <= 0) { toast('Informe o valor', 'erro'); f.mov.focus(); return; }
      const antes = meta.guardado;
      meta.guardado = Math.max(0, meta.guardado + sinal * v);
      salvar(); fecharSheet(); render('suave');
      if (antes < meta.alvo && meta.guardado >= meta.alvo) celebrar(meta);
      else toast(sinal > 0 ? `${brl(v)} guardados` : `${brl(v)} retirados`);
    };
    $('#m-guardar').addEventListener('click', () => mover(1));
    $('#m-retirar').addEventListener('click', () => mover(-1));
    $('#m-excluir').addEventListener('click', () => {
      if (!confirm(`Excluir a meta "${meta.nome}"?`)) return;
      db.metas = db.metas.filter((x) => x.id !== meta.id);
      salvar(); fecharSheet(); render('suave');
      toast('Meta excluída');
    });
    setTimeout(() => f.mov.focus(), 300);
  }
}

// Meta chegou a 100%: pulso dourado, brilho varrendo o card, selo se desenhando e partículas.
function celebrar(meta) {
  toast(`Meta concluída: ${meta.nome}`, 'meta');
  const card = document.querySelector(`[data-meta-card="${meta.id}"]`) || document.querySelector(`.meta-mini[data-id="${meta.id}"]`);
  if (!card) return;
  card.classList.add('celebra');
  estouro($('.meta-icone', card) || card, 'var(--ouro)', 20);
  setTimeout(() => card.classList.remove('celebra'), 2200);
}

// ---------- efeitos de estado ----------
// Depois de salvar algo, a tela é redesenhada e o efeito correspondente roda por cima.
let efeitoPendente = null;
const TOAST_TIPO = { receita: 'entrada', rendimento: 'entrada', despesa: 'saida', aporte: 'invest', resgate: 'invest' };

function temporario(pai, el, ms) { pai.appendChild(el); setTimeout(() => el.remove(), ms); }

function centroDoValor(hero) {
  const c = $('#hero-num .contador', hero) || $('#hero-num', hero);
  const rh = hero.getBoundingClientRect(), rc = c.getBoundingClientRect();
  return { x: rc.left - rh.left + rc.width / 2, y: rc.top - rh.top + rc.height / 2, topo: rc.top - rh.top, dir: rc.right - rh.left };
}

// onda de energia saindo do valor
function onda(hero, cor) {
  const c = centroDoValor(hero);
  for (let k = 0; k < 2; k++) {
    const o = document.createElement('span');
    o.className = 'onda';
    o.style.cssText = `--ox:${c.x}px;--oy:${c.y}px;--cor-onda:${cor};animation-delay:${k * 0.22}s`;
    temporario(hero, o, 1900);
  }
}

// "+ R$ 450,00" subindo (entrada) ou "− R$ 80,00" descendo (saída) perto do valor
function flutuar(hero, texto, cls) {
  const c = centroDoValor(hero);
  const f = document.createElement('span');
  f.className = `flutua ${cls}`;
  f.textContent = texto;
  f.style.cssText = `--ox:${clamp(c.dir - 50, 90, hero.clientWidth - 90)}px;--oy:${c.topo - 26}px`;
  temporario(hero, f, 2400);
}

// partículas saindo de um elemento (fixas na tela, pra não serem cortadas pelo card)
function estouro(alvo, cor, qtd = 16) {
  if (!alvo || reduzMov.matches) return;
  const r = alvo.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  for (let i = 0; i < qtd; i++) {
    const p = document.createElement('span');
    p.className = 'estouro-part';
    p.style.cssText = `position:fixed;--ox:${x}px;--oy:${y}px;--ang:${(360 / qtd) * i + Math.random() * 14}deg;--dist:${36 + Math.random() * 34}px;--cor-part:${cor}`;
    temporario(document.body, p, 1100);
  }
}

function reagir(hero, cls) {
  hero.classList.remove('cresce', 'cai');
  void hero.offsetWidth;
  hero.classList.add(cls);
  const n = $('#hero-num', hero);
  n.classList.remove('reage'); void n.offsetWidth; n.classList.add('reage');
  setTimeout(() => hero.classList.remove(cls), 3400);
}

function aplicarEfeito(ef) {
  if (!ef || reduzMov.matches) return;
  const v = $('#view'), hero = $('#hero', v);
  if (ef.id) v.querySelectorAll(`.item[data-id="${ef.id}"]`).forEach((el) => { el.classList.remove('novo'); void el.offsetWidth; el.classList.add('novo'); });

  if (ef.tipo === 'meta-nova') {
    const card = v.querySelector(`[data-meta-card="${ef.id}"]`) || v.querySelector(`.meta-mini[data-id="${ef.id}"]`);
    if (card) { card.classList.add('criada'); estouro($('.meta-icone', card) || card, 'var(--verde)', 12); }
    return;
  }
  if (!hero || !ef.hoje) return; // lançamento com data futura ainda não mexe no patrimônio

  const carteira = estado.aba === 'carteira', pos = posicao(hoje());
  const antes = carteira ? ef.invAntes : ef.patrAntes, depois = carteira ? pos.investido : pos.total;
  if (depois > antes) reagir(hero, 'cresce'); else if (depois < antes) reagir(hero, 'cai');

  if (ef.tipo === 'receita' || ef.tipo === 'rendimento') {
    onda(hero, 'var(--verde)');
    flutuar(hero, FMT.brlSinal(ef.valor), 'entra-dinheiro');
  } else if (ef.tipo === 'despesa') {
    flutuar(hero, FMT.brlSinal(-ef.valor), 'sai-dinheiro');
  } else {
    flutuar(hero, `${ef.tipo === 'aporte' ? 'Investido' : 'Resgatado'} ${brl(ef.valor)}`, 'investe');
    if (carteira) onda(hero, 'var(--roxo)');
    const k = $('.k-inv', v);
    if (k) { k.classList.add('confirma'); setTimeout(() => k.classList.remove('confirma'), 1500); }
  }

  // passou do maior patrimônio já registrado
  const rec = $('.recorde', hero);
  if (rec && !ef.recordeAntes) {
    rec.classList.add('estoura');
    setTimeout(() => estouro(rec, 'var(--ouro)', 16), 250);
    toast('Novo recorde de patrimônio', 'meta');
  }
}

function abrirInicial() {
  const ini = db.inicial;
  abrirSheet(`<form class="form" id="f-ini" autocomplete="off">
    ${cabecalhoSheet('Patrimônio inicial')}
    <p class="texto-ajuda" style="margin:0">Quanto você já tinha antes de começar a usar o app. É o ponto de partida do seu patrimônio.</p>
    <div><div class="rotulo" style="margin-bottom:4px">Dinheiro disponível hoje (conta, carteira)</div>
    <label class="valor-campo"><span>R$</span><input name="disp" inputmode="decimal" placeholder="0,00" value="${centavosParaCampo(ini.disponivel)}"></label></div>
    <div><div class="rotulo" style="margin-bottom:10px">Já investido</div>
      <div style="display:grid;gap:8px">${db.categorias.investimento.map((c, i) => `<label class="linha-inicial"><span>${esc(c)}</span><input data-cat-ini="${i}" inputmode="decimal" placeholder="0,00" value="${centavosParaCampo(ini.investido[c])}"></label>`).join('')}</div>
    </div>
    <button class="btn btn-primario" type="submit">Salvar</button>
  </form>`);
  const f = $('#f-ini');
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const investido = {};
    f.querySelectorAll('[data-cat-ini]').forEach((inp) => {
      const v = parseValor(inp.value);
      if (v) investido[db.categorias.investimento[+inp.dataset.catIni]] = v;
    });
    db.inicial = { disponivel: parseValor(f.disp.value), investido, mes: ini.mes || mesAtual() };
    salvar(); fecharSheet(); render('suave');
    toast('Patrimônio inicial salvo');
  });
  setTimeout(() => f.disp.focus(), 300);
}

// ---------- backup ----------
async function exportar() {
  const nome = `financas-backup-${hoje()}.json`;
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const arquivo = new File([blob], nome, { type: 'application/json' });
  // No iPhone, download dentro do app instalado é instável: usa a folha de compartilhar
  // (Salvar em Arquivos, WhatsApp, e-mail...).
  if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
    try { await navigator.share({ files: [arquivo], title: nome }); }
    catch (e) { if (e.name === 'AbortError') return; toast('Não consegui exportar', 'erro'); return; }
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  db.ultimoBackup = hoje();
  salvar();
  render('suave');
  toast('Backup exportado');
}

$('#arquivo').addEventListener('change', async (e) => {
  const arq = e.target.files[0];
  e.target.value = '';
  if (!arq) return;
  try {
    const dados = JSON.parse(await arq.text());
    if (!Array.isArray(dados.lancamentos)) throw new Error('formato');
    if (!confirm(`Substituir os dados atuais por esse backup (${dados.lancamentos.length} movimentações)?`)) return;
    db = normalizar(dados);
    salvar();
    gerarFixas();
    render('tela');
    toast('Backup importado');
  } catch (err) {
    toast('Arquivo de backup inválido', 'erro');
  }
});

// ---------- eventos ----------
// A tela atual sai (fade + slide + blur sutil) e a nova entra em sequência.
let trocandoTela = false;
function irPara(aba) {
  if (aba === estado.aba) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  if (trocandoTela) return;
  const dir = Math.sign(ABAS.indexOf(aba) - ABAS.indexOf(estado.aba));
  const v = $('#view');
  const entrar = () => {
    trocandoTela = false;
    v.classList.remove('saindo');
    estado.aba = aba;
    render('tela', dir);
    window.scrollTo(0, 0);
  };
  if (reduzMov.matches) { entrar(); return; }
  trocandoTela = true;
  atualizarNav(true, aba); // o indicador da navegação já desliza no clique
  v.style.setProperty('--dir', dir);
  v.classList.add('saindo');
  setTimeout(entrar, 170);
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-acao]');
  if (!el) return;
  const d = el.dataset;
  switch (d.acao) {
    case 'aba': irPara(d.aba); break;
    case 'mes': estado.mes = somaMes(estado.mes, +d.delta); render('periodo', +d.delta); break;
    case 'mes-hoje': {
      const dir = Math.sign(difMeses(estado.mes, mesAtual()));
      if (!dir) break;
      estado.mes = mesAtual(); render('periodo', dir);
      break;
    }
    case 'periodo': if (estado.periodo !== d.v) { estado.periodo = d.v; render('morph'); } break;
    case 'tema': definirTema(temaEfetivo() === 'dark' ? 'light' : 'dark', e); break;
    case 'tema-pref': definirTema(d.v, e); break;
    case 'novo': abrirLancamento(); break;
    case 'novo-receita': abrirLancamento(null, 'receita'); break;
    case 'novo-despesa': abrirLancamento(null, 'despesa'); break;
    case 'novo-invest': case 'novo-aporte': abrirLancamento(null, 'investimento', 'aporte'); break;
    case 'novo-resgate': abrirLancamento(null, 'investimento', 'resgate'); break;
    case 'novo-rendimento': abrirLancamento(null, 'investimento', 'rendimento'); break;
    case 'editar': { const l = db.lancamentos.find((x) => x.id === d.id); if (l) abrirLancamento(l); break; }
    case 'nova-meta': abrirMeta(); break;
    case 'meta': { const m = db.metas.find((x) => x.id === d.id); if (m) abrirMeta(m); break; }
    case 'inicial': abrirInicial(); break;
    case 'filtro': estado.filtro = d.v; render('suave'); break;
    case 'limite': abrirLimite(d.cat); break;
    case 'fechar': fecharSheet(); break;
    case 'exportar': exportar(); break;
    case 'importar': $('#arquivo').click(); break;
    case 'rm-fixa':
      if (!confirm('Parar de repetir essa conta? As movimentações já feitas continuam no extrato.')) return;
      db.fixas = db.fixas.filter((f) => f.id !== d.id);
      salvar(); render('suave'); toast('Conta fixa removida');
      break;
    case 'rm-cat':
      db.categorias[d.tipo] = db.categorias[d.tipo].filter((c) => c !== d.cat);
      salvar(); render('suave');
      break;
    case 'apagar':
      if (!confirm('Apagar TODAS as movimentações, metas, contas fixas e limites deste aparelho?')) return;
      if (!confirm('Tem certeza? Sem backup, não dá pra recuperar.')) return;
      db = estadoInicial();
      salvar(); estado.aba = 'inicio'; render('tela'); toast('Dados apagados');
      break;
  }
});

document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-form="add-cat"]');
  if (!f) return;
  e.preventDefault();
  const nome = f.nome.value.trim();
  const lista = db.categorias[f.dataset.tipo];
  if (!nome) return;
  if (lista.some((c) => c.toLowerCase() === nome.toLowerCase())) { toast('Essa categoria já existe', 'erro'); return; }
  lista.push(nome);
  salvar(); render('suave');
});

document.addEventListener('input', (e) => {
  if (e.target.id !== 'busca') return;
  estado.busca = e.target.value;
  $('#lista-extrato').innerHTML = listaExtrato();
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden) fecharSheet(); });

// onda no ponto do clique
const COM_ONDA = '.btn, .acao, .chip, .icone-btn, .insight, .passo, .periodos button, .seg button, .nav button';
document.addEventListener('pointerdown', (e) => {
  if (reduzMov.matches) return;
  const el = e.target.closest(COM_ONDA);
  if (!el) return;
  const r = el.getBoundingClientRect(), s = document.createElement('span');
  s.className = 'ripple';
  s.style.cssText = `--rx:${e.clientX - r.left}px;--ry:${e.clientY - r.top}px;--rs:${Math.max(r.width, r.height) / 4}`;
  temporario(el, s, 650);
});

// luz que acompanha o cursor dentro dos cards (só em quem tem mouse)
if (matchMedia('(hover: hover)').matches) {
  let ultimoMov = null, quadro = 0;
  document.addEventListener('pointermove', (e) => {
    ultimoMov = e;
    if (quadro) return;
    quadro = requestAnimationFrame(() => {
      quadro = 0;
      const el = ultimoMov.target.closest && ultimoMov.target.closest('.card, .kpi, .acao, .insight');
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${ultimoMov.clientX - r.left}px`);
      el.style.setProperty('--my', `${ultimoMov.clientY - r.top}px`);
    });
  }, { passive: true });
}

// pontos de luz do fundo, bem discretos
(function criarParticulas() {
  const caixa = $('#particulas');
  if (!caixa || reduzMov.matches) return;
  const qtd = innerWidth < 700 ? 18 : 30, r = () => Math.random();
  caixa.innerHTML = Array.from({ length: qtd }, () => `<span class="particula" style="--x:${(r() * 100).toFixed(1)}%;--y:${(r() * 100).toFixed(1)}%;--t:${(1 + r() * 2).toFixed(1)}px;--op:${(0.15 + r() * 0.45).toFixed(2)};--dur:${(9 + r() * 12).toFixed(1)}s;--atraso:${(-r() * 20).toFixed(1)}s;--dx:${Math.round(r() * 40 - 20)}px"></span>`).join('');
})();

// ícones da navegação
document.querySelectorAll('[data-icone]').forEach((el) => { el.outerHTML = ic(el.dataset.icone); });
document.querySelectorAll('[data-logo]').forEach((el) => { el.innerHTML = LOGO; });

// Ao voltar pro app em outro dia, gera as fixas do mês novo.
document.addEventListener('visibilitychange', () => { if (!document.hidden) { gerarFixas(); render('suave'); } });

let resizeTimer;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { desenharGraficos($('#view'), 'estatico'); atualizarNav(false); indicadores(document, false); }, 150);
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { $('#topo').innerHTML = topo(); });

// ---------- início ----------
gerarFixas();
$('#topo').innerHTML = topo();
// Skeleton por um instante enquanto a fonte carrega; depois a tela entra animada.
Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 900))])
  .then(() => setTimeout(() => render('tela'), reduzMov.matches ? 0 : 280));

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
