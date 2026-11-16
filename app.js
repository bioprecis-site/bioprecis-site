import { classify } from "./guide.js";

const get = (id) => document.getElementById(id);
const tabs = [...document.querySelectorAll('[role="tab"]')];
const tabName = (tab) => tab.id.slice(4);

function activateTab(selected) {
  for (const tab of tabs) {
    const isActive = tab === selected;
    tab.setAttribute("aria-selected", isActive);
    tab.tabIndex = isActive ? 0 : -1;
    get(tab.getAttribute("aria-controls")).hidden = !isActive;
  }
}

function openTabFromLink(name) {
  const tab = get("tab-" + name);
  if (!tab) return;
  activateTab(tab);
  tab.focus({ preventScroll: true });
  get("explorar").scrollIntoView();
}

const platformModules = new Set([
  "dashboard", "twin", "multiomics", "compare", "labs", "reports",
  "projects", "databases", "assistant", "security", "about", "founder",
]);

function followHash() {
  const target = location.hash.slice(1);
  if (platformModules.has(target)) {
    location.replace("plataforma.html" + location.hash);
    return;
  }
  if (tabs.some((tab) => tabName(tab) === target)) openTabFromLink(target);
  if (["pesquisa", "laboratorios", "parcerias"].includes(target)) get(target).open = true;
}

for (const [index, tab] of tabs.entries()) {
  tab.addEventListener("click", () => {
    activateTab(tab);
    if (tabs.some((item) => "#" + tabName(item) === location.hash)) {
      history.replaceState(null, "", "#" + tabName(tab));
    }
  });
  tab.addEventListener("keydown", (event) => {
    const positions = {
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      ArrowRight: (index + 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };
    if (!Object.hasOwn(positions, event.key)) return;
    event.preventDefault();
    const next = tabs[positions[event.key]];
    next.click();
    next.focus();
  });
}
window.addEventListener("hashchange", followHash);
document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href^='#']");
  if (link?.hash === location.hash) followHash();
});

const profiles = {
  equilibrado: { label: "Equilibrado", values: [65, 72, 68, 32] },
  inflamatorio: { label: "Inflamatório", values: [58, 46, 51, 81] },
  imunidade: { label: "Baixa imunidade", values: [30, 52, 49, 50] },
};

const signals = [
  { id: "immune", label: "imunidade", weight: .28 },
  { id: "micro", label: "microbioma", weight: .30 },
  { id: "metab", label: "metabolismo", weight: .24 },
  { id: "inflam", label: "inflamação", weight: .18, inverse: true },
];
for (const signal of signals) {
  signal.input = get("range-" + signal.id);
  signal.output = get("value-" + signal.id);
}

const scenarioButtons = [...document.querySelectorAll("[data-scenario]")];
const baseline = profiles.equilibrado.values;

function calculateScore(values) {
  return Math.round(signals.reduce((sum, signal, index) => {
    const value = values[index];
    return sum + signal.weight * (signal.inverse ? 100 - value : value);
  }, 0));
}

const baseScore = calculateScore(baseline);
let activeScore = baseScore;
let activeValues = baseline;
let selectedScenario = "equilibrado";
let latestTopic;

function renderSimulation() {
  activeValues = signals.map((signal) => Number(signal.input.value));
  activeScore = calculateScore(activeValues);
  for (const [index, signal] of signals.entries()) {
    signal.output.textContent = activeValues[index];
  }

  const delta = activeScore - baseScore;
  let comparison = "Mesmo índice do cenário equilibrado";
  if (selectedScenario === "equilibrado") comparison = "Cenário equilibrado de referência";
  if (delta > 0) comparison = "+" + delta + " pontos em relação à referência";
  if (delta < 0) comparison = "−" + Math.abs(delta) + " pontos em relação à referência";

  get("score").textContent = activeScore;
  get("dial").style.setProperty("--score", activeScore + "%");
  get("comparison").textContent = comparison;
  get("score-summary").textContent = "Índice simulado: " + activeScore + " de 100. " + comparison + ".";
  for (const button of scenarioButtons) {
    button.setAttribute("aria-pressed", button.dataset.scenario === selectedScenario);
  }
  if (latestTopic === "scenario") renderGuide("scenario");
}

function applyProfile(name) {
  selectedScenario = name;
  for (const [index, signal] of signals.entries()) {
    signal.input.value = profiles[name].values[index];
  }
  renderSimulation();
}

for (const button of scenarioButtons) {
  button.addEventListener("click", () => applyProfile(button.dataset.scenario));
}
for (const signal of signals) {
  signal.input.addEventListener("input", () => {
    selectedScenario = Object.keys(profiles).find((key) =>
      profiles[key].values.every((value, index) => value === Number(signals[index].input.value)));
    renderSimulation();
  });
}

const layers = [
  { title: "Microbioma", copy: "Descreve a diversidade e a abundância relativa de microrganismos no intestino. Ajuda a investigar associações entre comunidades microbianas e outros dados biológicos." },
  { title: "Genômica", copy: "Observa variações no DNA. No MIP, essa camada oferece contexto para hipóteses sobre diferenças entre perfis de pesquisa." },
  { title: "Proteômica", copy: "Observa proteínas e suas variações. Ajuda a investigar relações entre sinais moleculares e outros dados de um mesmo perfil." },
  { title: "Metabolômica", copy: "Observa pequenas moléculas ligadas ao metabolismo. Seu papel é ajudar a conectar a atividade do organismo e da microbiota a outros sinais biológicos." },
  { title: "Imunidade", copy: "Reúne indicadores da resposta imune. Na proposta do MIP, eles podem ser examinados em conjunto com dados do microbioma e do metabolismo." },
  { title: "RNA e transcriptômica", copy: "Observa a expressão de genes por meio do RNA. Acrescenta informação sobre quais genes estão mais ou menos ativos em determinado contexto." },
];

function makeText(tagName, value, className) {
  const node = document.createElement(tagName);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}

function makeButton(value) {
  const button = makeText("button", value);
  button.type = "button";
  return button;
}

function renderDetail(container, label, title, copy) {
  container.replaceChildren(
    makeText("p", label, "eyebrow"),
    makeText("h4", title),
    makeText("p", copy),
  );
}

const layerPanel = get("layer-options");
const layerButtons = layers.map((layer, index) => {
  const button = makeButton(layer.title);
  button.addEventListener("click", () => showLayer(index));
  layerPanel.append(button);
  return button;
});

function showLayer(index) {
  const layer = layers[index];
  renderDetail(get("layer-detail"), "Camada de dados", layer.title, layer.copy);
  for (const [position, button] of layerButtons.entries()) {
    button.setAttribute("aria-pressed", position === index);
  }
}

const steps = [
  { title: "Coleta", copy: "Uma amostra fictícia entra no fluxo com um identificador e informações de contexto. O registro acompanha a amostra pelas próximas etapas." },
  { title: "Análise", copy: "Os dados sintéticos passam por uma leitura inicial. Essa etapa representa as checagens que ajudam a identificar informações incompletas ou inconsistentes." },
  { title: "Integração", copy: "As camadas são reunidas em um perfil. A comparação no mesmo contexto permite investigar relações entre os sinais que cada camada descreve." },
  { title: "IA", copy: "Na arquitetura proposta, modelos podem ajudar a destacar padrões nos dados integrados. Os padrões geram perguntas para avaliação por pesquisadores." },
  { title: "Hipóteses", copy: "O perfil integrado apoia a formulação de uma hipótese e o registro de seus limites. Estudos de validação são necessários para avaliar a hipótese." },
];

let currentStep = 0;
const nextStep = get("next-step");
const stepButtons = steps.map((step, index) => {
  const number = makeText("span", String(index + 1).padStart(2, "0"), "step-dot");
  number.setAttribute("aria-hidden", "true");
  const button = makeButton(step.title);
  button.prepend(number);
  button.addEventListener("click", () => showStep(index));
  const item = document.createElement("li");
  item.append(button);
  get("flow-steps").append(item);
  return button;
});

function showStep(index) {
  currentStep = index;
  const step = steps[index];
  renderDetail(get("flow-detail"), "Amostra fictícia BP-8042 · Etapa " + (index + 1) + " de " + steps.length, step.title, step.copy);
  for (const [position, button] of stepButtons.entries()) {
    button.setAttribute("aria-current", position === index ? "step" : "false");
  }
  nextStep.disabled = index === steps.length - 1;
  get("reset-step").disabled = index === 0;
}

nextStep.addEventListener("click", () => {
  showStep(currentStep + 1);
  if (nextStep.disabled) stepButtons[currentStep].focus();
});
get("reset-step").addEventListener("click", () => {
  showStep(0);
  stepButtons[0].focus();
});

const responses = {
  mip: ["O que é o MIP", "O MIP é um projeto de pesquisa da BioPrecis sobre a relação entre os microrganismos do intestino, as defesas do corpo e o metabolismo. Ao observar dados dessas três áreas em conjunto, o projeto busca formular perguntas para futuras pesquisas.", "Entender o projeto", "#projeto"],
  omics: ["As seis camadas do MIP", "A demonstração reúne microbioma, genômica, proteômica, metabolômica, imunidade e RNA. Cada camada responde a uma pergunta diferente sobre o perfil biológico.", "Abrir multiômica", "#multiomica"],
  flow: ["O fluxo MIP", "O módulo demonstra como uma amostra fictícia passa por coleta, análise, integração multiômica, identificação de padrões e formulação de hipóteses.", "Acompanhar as etapas", "#fluxo"],
  partnership: ["Parcerias e colaboração", "A BioPrecis busca colaboração para validação científica e técnica. Universidades, laboratórios e empresas de biotecnologia podem contribuir em estudos, governança e interoperabilidade.", "Ver a frente de parcerias", "#parcerias"],
  founder: ["Quem criou a BioPrecis", "Jair Armando Viana de Sousa é o fundador e idealizador da BioPrecis. Sua trajetória reúne Ciências Biológicas, pesquisa, escrita, experiência laboratorial e desenvolvimento de tecnologia.", "Conhecer o fundador", "#sobre"],
  stage: ["Estágio de desenvolvimento", "A BioPrecis apresenta um demonstrador com dados sintéticos. Infraestrutura segura, estudos de validação e colaboração institucional estão entre os marcos previstos. Os dados do simulador servem para fins demonstrativos.", "Ver próximos marcos", "#marcos"],
};

function explainCurrentScenario() {
  const difference = activeScore - baseScore;
  const subject = selectedScenario ? "cenário " + profiles[selectedScenario].label.toLowerCase() : "ajuste personalizado";
  let relation = "igual ao cenário equilibrado de referência";
  if (difference) relation = Math.abs(difference) + " pontos " + (difference > 0 ? "acima" : "abaixo") + " da referência";
  const changes = signals
    .map((signal, index) => {
      const delta = activeValues[index] - baseline[index];
      return { label: signal.label, delta, effect: Math.abs(delta * signal.weight) };
    })
    .filter(({ delta }) => delta !== 0)
    .sort((left, right) => right.effect - left.effect);

  const mainChanges = changes.slice(0, 2).map(({ label, delta }) =>
    label + " " + (delta > 0 ? "subiu" : "caiu") + " " + Math.abs(delta) + " pontos");
  const details = mainChanges.length ? " Maiores contribuições para a mudança no índice: " + mainChanges.join(" e ") + "." : "";
  return ["Leitura do cenário simulado", "O índice do " + subject + " está em " + activeScore + "/100, " + relation + "." + details + " O cálculo é ilustrativo.", "Voltar ao gêmeo digital", "#gemeo"];
}

function renderGuide(topic) {
  latestTopic = topic;
  const result = get("guide-result");
  const entry = topic === "scenario" ? explainCurrentScenario() : responses[topic];
  if (!entry) {
    result.replaceChildren(makeText("p", "Não encontrei um tópico correspondente. Tente perguntar sobre o MIP, a simulação, a multiômica, os laboratórios, a validação, as parcerias ou o fundador."));
    return;
  }
  const [title, description, linkLabel, target] = entry;
  const link = makeText("a", linkLabel, "text-link");
  const arrow = makeText("span", "", "arrow arrow-up");
  arrow.setAttribute("aria-hidden", "true");
  link.append(arrow);
  link.href = target;
  result.replaceChildren(makeText("h3", title), makeText("p", description), link);
}

const question = get("question");

function answer(value) {
  question.value = value;
  renderGuide(classify(value));
}

get("guide-form").addEventListener("submit", (event) => {
  event.preventDefault();
  answer(question.value.trim());
});
for (const button of document.querySelectorAll("[data-question]")) {
  button.addEventListener("click", () => answer(button.dataset.question));
}
get("explain-scenario").addEventListener("click", () => {
  question.value = "O que mudou na simulação?";
  renderGuide("scenario");
  location.hash = "guia";
  question.focus({ preventScroll: true });
  get("guia").scrollIntoView();
});

renderSimulation();
showLayer(0);
showStep(0);
followHash();
