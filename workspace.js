"use strict";

const workspaceMenu = $("mobileMenu");
const workspaceNav = $("workspaceNav");
const workspaceBackdrop = $("navBackdrop");

function setWorkspaceMenu(open, returnFocus = false) {
  workspaceNav.classList.toggle("mobile-open", open);
  workspaceBackdrop.hidden = !open;
  workspaceMenu.setAttribute("aria-expanded", String(open));
  workspaceMenu.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
  $("main-content").inert = open;
  if (open) workspaceNav.querySelector(".active").focus();
  if (returnFocus) workspaceMenu.focus();
}

window.toggleMobileMenu = () => setWorkspaceMenu(workspaceBackdrop.hidden, !workspaceBackdrop.hidden);
window.closeWorkspaceMenu = () => setWorkspaceMenu(false);
workspaceBackdrop.addEventListener("click", () => setWorkspaceMenu(false, true));
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !workspaceBackdrop.hidden) setWorkspaceMenu(false, true);
});
matchMedia("(max-width: 1120px)").addEventListener("change", () => setWorkspaceMenu(false));

const openWorkspacePage = window.go;
window.go = function (id, updateUrl = true) {
  if (!Object.hasOwn(pages, id)) return;
  if (updateUrl && location.hash !== "#" + id) history.pushState(null, "", "#" + id);
  openWorkspacePage(id);
  workspaceNav.querySelectorAll("[data-page]").forEach(button => {
    if (button.dataset.page === id) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
};

function visitWorkspacePage(id) {
  go(id);
  $("pageTitle").focus({ preventScroll: true });
}
workspaceNav.querySelectorAll("[data-page]").forEach(button => {
  button.onclick = () => visitWorkspacePage(button.dataset.page);
});
document.querySelectorAll("[data-open-page]").forEach(button => {
  button.addEventListener("click", () => visitWorkspacePage(button.dataset.openPage));
});
window.addEventListener("popstate", () => {
  const id = location.hash.slice(1);
  if (Object.hasOwn(pages, id)) go(id, false);
  else if (!id) go("dashboard", false);
});
const intro = window.enterApp;
window.enterApp = function () {
  intro();
  try { sessionStorage.setItem("bioprecis_intro_seen", "1"); } catch {}
  $("pageTitle").focus({ preventScroll: true });
};
try {
  if (Object.hasOwn(pages, location.hash.slice(1)) || sessionStorage.getItem("bioprecis_intro_seen")) intro();
} catch {}

$("dashboardScenario").addEventListener("change", event => {
  const field = event.currentTarget;
  if (!field.value) return;
  const scenario = field.selectedOptions[0].textContent;
  presetTwin(field.value);
  $("scenarioStatus").textContent = scenario + " aplicado à simulação.";
  field.selectedIndex = 0;
});

const chatLog = $("aiMessages");
const chatInput = $("aiInput");
const providerButton = $("aiProvider");
const providerStatus = $("aiProviderStatus");
const onlineHistory = [];
const commandButtons = document.querySelectorAll("[data-ai-command]");
let online = false;
let chatBusy = false;

function appendChat(author, content, user = false) {
  const message = document.createElement("div");
  message.className = user ? "ai-msg user" : "ai-msg bot";
  message.textContent = content;
  const caption = document.createElement("div");
  caption.className = "meta";
  caption.textContent = author;
  message.append(caption);
  chatLog.append(message);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function setOnlineMode(active) {
  online = active;
  providerButton.textContent = active ? "Voltar ao modo local" : "Conectar conta Puter";
  $("aiModeLabel").textContent = active ? "Modo online · resposta generativa" : "Modo local · comandos por regras";
  chatInput.placeholder = active ? "Ex.: Explique o cenário atual para um investidor" : "Ex.: Aumente a imunidade para 80";
  providerStatus.textContent = active ? "Conectado. Os atalhos abaixo da conversa continuam executando comandos locais." : "Modo local ativo.";
}

function loadPuter() {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.puter.com/v2/";
    script.onload = () => {
      if (window.puter?.auth && window.puter?.ai) resolve();
      else {
        script.remove();
        reject(new Error("SDK indisponível"));
      }
    };
    script.onerror = () => {
      script.remove();
      reject(new Error("Falha ao carregar o SDK"));
    };
    document.head.append(script);
  });
}

providerButton.addEventListener("click", async () => {
  if (online) {
    setOnlineMode(false);
    onlineHistory.length = 0;
    return;
  }
  providerButton.disabled = true;
  try {
    if (!window.puter?.auth) {
      providerStatus.textContent = "Carregando integração…";
      await loadPuter();
      providerButton.textContent = "Conectar conta Puter";
      providerStatus.textContent = "Clique em Conectar conta Puter para autorizar o modo online.";
      return;
    }
    if (!window.puter.auth.isSignedIn()) await window.puter.auth.signIn();
    setOnlineMode(true);
  } catch {
    providerStatus.textContent = "Conexão indisponível. Verifique a rede e as janelas pop-up ou continue no modo local.";
  } finally {
    providerButton.disabled = false;
  }
});

function syntheticContext() {
  const keys = ["immune", "micro", "metab", "inflam"];
  const names = ["imunidade", "microbioma", "metabolismo", "inflamação"];
  const values = keys.map((key, i) => names[i] + " " + Number($(key).value));
  return values.join(", ") + ", equilíbrio " + $("balance").textContent + "/100.";
}

async function sendChat(message, useOnline = online) {
  const question = message.trim().slice(0, 1200);
  if (!question || chatBusy) return;
  appendChat("Você", question, true);

  if (!useOnline) {
    appendChat("Assistente local", aiAnswer(question));
    return;
  }

  chatBusy = true;
  $("aiSendButton").disabled = true;
  $("aiClear").disabled = true;
  commandButtons.forEach(button => { button.disabled = true; });
  providerButton.disabled = true;
  providerStatus.textContent = "Gerando resposta…";
  try {
    const instructions = [
      "Você é o assistente da BioPrecis, um MVP de biotecnologia de precisão e pesquisa.",
      "Responda em português do Brasil, com clareza. Explique o Microbioma Imunológico de Precisão (MIP), o gêmeo digital e a multiômica usando apenas o contexto fornecido.",
      "Os indicadores são sintéticos e sem uso clínico. Não dê diagnóstico, prescrição ou orientação clínica individual. Não invente estudos, validações, parceiros ou resultados.",
      "Não execute ações e não afirme que modificou a plataforma. Para ações, oriente a usar os atalhos locais.",
      "Estado sintético atual: " + syntheticContext()
    ];
    const userTurn = { role: "user", content: question };
    const response = await window.puter.ai.chat([
      { role: "system", content: instructions.join(" ") },
      ...onlineHistory.slice(-6),
      userTurn
    ], { model: "gpt-5.4-nano", normalize: true });
    const content = response?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("Resposta sem texto");
    appendChat("BioPrecis AI · online", content);
    onlineHistory.push(userTurn, { role: "assistant", content });
    if (onlineHistory.length > 6) onlineHistory.splice(0, onlineHistory.length - 6);
    providerStatus.textContent = "Resposta recebida.";
  } catch {
    appendChat("BioPrecis AI · online", "Não consegui obter uma resposta. Verifique sua conexão e o acesso ou limite de uso da conta Puter.");
    providerStatus.textContent = "Falha na consulta. Você pode tentar de novo ou usar o modo local.";
    if (!chatInput.value) chatInput.value = question;
  } finally {
    chatBusy = false;
    $("aiSendButton").disabled = false;
    $("aiClear").disabled = false;
    commandButtons.forEach(button => { button.disabled = false; });
    providerButton.disabled = false;
  }
}

window.aiAsk = message => sendChat(message, false);
commandButtons.forEach(button => {
  button.addEventListener("click", () => window.aiAsk(button.dataset.aiCommand));
});
$("aiForm").addEventListener("submit", event => {
  event.preventDefault();
  if (chatBusy || !chatInput.value.trim()) return;
  const question = chatInput.value;
  chatInput.value = "";
  sendChat(question);
});
chatInput.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    $("aiForm").requestSubmit();
  }
});
$("aiClear").addEventListener("click", () => {
  chatLog.replaceChildren();
  onlineHistory.length = 0;
  appendChat("BioPrecis AI", "Conversa limpa. Como posso ajudar?");
  chatInput.focus();
});
