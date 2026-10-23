const STORAGE_KEY = "diario-de-bordo-entries";
const form = document.querySelector("#entry-form");
const titleInput = document.querySelector("#entry-title");
const descriptionInput = document.querySelector("#entry-description");
const dateInput = document.querySelector("#entry-date");
const list = document.querySelector("#entries-list");
const count = document.querySelector("#entry-count");
const message = document.querySelector("#form-message");
const installButton = document.querySelector("#install-button");

let entries = [];
let installPrompt = null;

function setMessage(text) {
  message.textContent = text;
}

function isEntry(value) {
  return value !== null
    && typeof value === "object"
    && typeof value.id === "string"
    && typeof value.title === "string"
    && typeof value.description === "string"
    && typeof value.date === "string"
    && typeof value.createdAt === "number";
}

function loadEntries() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return [];

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || !parsed.every(isEntry)) {
      throw new Error("Os dados salvos não têm o formato esperado.");
    }
    return parsed;
  } catch (error) {
    console.error("Não foi possível carregar os registros:", error);
    form.querySelector("button[type=submit]").disabled = true;
    setMessage("Não foi possível ler seus registros salvos. O formulário foi desativado para proteger seus dados.");
    return [];
  }
}

function saveEntries(nextEntries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntries));
    entries = nextEntries;
    renderEntries();
    return true;
  } catch (error) {
    console.error("Não foi possível salvar os registros:", error);
    setMessage("Não foi possível salvar. Verifique o espaço disponível no navegador e tente novamente.");
    return false;
  }
}

function formatDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function renderEntries() {
  count.textContent = String(entries.length);
  list.replaceChildren();

  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "✧";
    const text = document.createElement("p");
    text.textContent = "Seu diário começa com um registro. Que tal guardar o dia de hoje?";
    empty.append(icon, text);
    list.append(empty);
    return;
  }

  const sortedEntries = [...entries].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    return byDate || b.createdAt - a.createdAt;
  });

  for (const entry of sortedEntries) {
    const card = document.createElement("article");
    card.className = "entry-card";

    const date = document.createElement("p");
    date.className = "entry-date";
    date.textContent = formatDate(entry.date);

    const title = document.createElement("h3");
    title.textContent = entry.title;

    const description = document.createElement("p");
    description.className = "entry-description";
    description.textContent = entry.description;

    const removeButton = document.createElement("button");
    removeButton.className = "delete-button";
    removeButton.type = "button";
    removeButton.textContent = "×";
    removeButton.setAttribute("aria-label", `Remover registro: ${entry.title}`);
    removeButton.addEventListener("click", () => {
      if (saveEntries(entries.filter((item) => item.id !== entry.id))) {
        setMessage("Registro removido.");
      }
    });

    card.append(date, title, description, removeButton);
    list.append(card);
  }
}

function setTodayAsDefault() {
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
  dateInput.value = localDate;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const entry = {
    id: crypto.randomUUID(),
    title: titleInput.value.trim(),
    description: descriptionInput.value.trim(),
    date: dateInput.value,
    createdAt: Date.now(),
  };

  if (!entry.title) {
    titleInput.setCustomValidity("Informe um título para o registro.");
    titleInput.reportValidity();
    titleInput.setCustomValidity("");
    return;
  }

  if (saveEntries([entry, ...entries])) {
    form.reset();
    setTodayAsDefault();
    setMessage("Registro guardado com sucesso.");
    titleInput.focus();
  }
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!installPrompt) return;

  installButton.disabled = true;
  try {
    await installPrompt.prompt();
    await installPrompt.userChoice;
  } catch (error) {
    console.error("Não foi possível iniciar a instalação:", error);
    setMessage("Não foi possível iniciar a instalação. Tente novamente pelo menu do navegador.");
  } finally {
    installPrompt = null;
    installButton.hidden = true;
    installButton.disabled = false;
  }
});

window.addEventListener("appinstalled", () => {
  installPrompt = null;
  installButton.hidden = true;
});

entries = loadEntries();
setTodayAsDefault();
renderEntries();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      .catch((error) => {
        console.error("Não foi possível registrar o service worker:", error);
        setMessage("Não foi possível ativar o modo offline neste navegador.");
      });
  });
}
