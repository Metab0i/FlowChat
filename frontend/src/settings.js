const PROVIDERS_KEY = "flowchat.providers";
const PROMPTS_KEY = "flowchat.prompts";
const ACTIVE_PROMPT_KEY = "flowchat.activePromptId";
const DEFAULT_MODEL_KEY = "flowchat.defaultModel";

const BUILTIN_PROMPT_ID = "builtin-default";

const ADJECTIVES = [
  "agile", "amber", "bold", "brave", "bright", "calm", "clever", "copper",
  "cosmic", "crimson", "cunning", "dapper", "eager", "emerald", "fearless",
  "gentle", "golden", "hidden", "honest", "jolly", "keen", "lively", "lunar",
  "mellow", "mighty", "nimble", "noble", "plucky", "quick", "quiet", "radiant",
  "rapid", "rusty", "silent", "silver", "slick", "steady", "swift", "valiant",
  "vivid", "witty", "zealous",
];

const ANIMALS = [
  "badger", "beaver", "bison", "boar", "cobra", "condor", "cougar", "coyote",
  "crane", "dolphin", "eagle", "falcon", "fox", "gecko", "gibbon", "heron",
  "ibex", "iguana", "jaguar", "kestrel", "koala", "lemur", "leopard", "lynx",
  "marmot", "mink", "mole", "moose", "narwhal", "ocelot", "osprey", "otter",
  "owl", "panda", "panther", "puma", "quokka", "raven", "seal", "shrew",
  "sparrow", "stoat", "swan", "tapir", "tiger", "toucan", "walrus", "wolf",
  "wombat", "yak", "zebra",
];

function readJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function loadProviders() {
  return readJSON(PROVIDERS_KEY, []);
}

export function saveProviders(list) {
  localStorage.setItem(PROVIDERS_KEY, JSON.stringify(list));
}

export function loadPrompts() {
  return readJSON(PROMPTS_KEY, []);
}

export function savePrompts(list) {
  localStorage.setItem(PROMPTS_KEY, JSON.stringify(list));
}

export function loadActivePromptId() {
  return localStorage.getItem(ACTIVE_PROMPT_KEY);
}

export function saveActivePromptId(id) {
  if (id) localStorage.setItem(ACTIVE_PROMPT_KEY, id);
  else localStorage.removeItem(ACTIVE_PROMPT_KEY);
}

export function loadDefaultModel() {
  return localStorage.getItem(DEFAULT_MODEL_KEY);
}

export function saveDefaultModel(id) {
  if (id) localStorage.setItem(DEFAULT_MODEL_KEY, id);
  else localStorage.removeItem(DEFAULT_MODEL_KEY);
}

export { BUILTIN_PROMPT_ID };

let seq = 0;
export function uid(prefix) {
  return `${prefix}-${Date.now()}-${seq++}`;
}

export function adjectiveAnimalId(existing) {
  const taken = new Set((existing || []).map((x) => x.label));
  let label;
  do {
    const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const n = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    label = `${a}-${n}`;
  } while (taken.has(label));
  return label;
}

export function uniquePromptName(name, prompts) {
  const taken = new Set((prompts || []).map((p) => p.name));
  if (!taken.has(name)) return name;
  let i = 2;
  while (taken.has(`${name} ${i}`)) i += 1;
  return `${name} ${i}`;
}

export function uniqueProviderLabel(label, providers) {
  const taken = new Set((providers || []).map((p) => p.label));
  if (!taken.has(label)) return label;
  let i = 2;
  while (taken.has(`${label}-${i}`)) i += 1;
  return `${label}-${i}`;
}
