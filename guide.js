const examples = {
  mip: [
    "O que é o MIP", "Qual a proposta da BioPrecis", "O que a plataforma faz",
    "Qual é o objetivo do projeto", "Para que serve o Microbioma Imunológico de Precisão",
    "O que significa a sigla", "Por que integrar dados biológicos",
  ],
  scenario: [
    "O que mudou na simulação", "O que aconteceu com meu cenário", "Explique o resultado do gêmeo digital",
    "Qual o estado atual da demonstração", "Como interpretar meu resultado", "Como funciona o índice de equilíbrio",
    "Por que a pontuação diminuiu", "O que acontece se aumentar a inflamação",
    "Como comparar com o cenário de referência", "O que acontece com baixa imunidade",
  ],
  omics: [
    "Quais são as seis camadas da multiômica", "O que é multiômica", "Quais dados são integrados",
    "Qual a diferença entre genômica e transcriptômica", "Como explorar RNA e proteômica",
    "O que é metabolômica", "O que é transcriptômica", "Qual o papel do microbioma e da imunidade",
  ],
  flow: [
    "Quais são as etapas do fluxo MIP", "Como funciona a análise de uma amostra", "Como o laboratório participa",
    "Que papel a inteligência artificial tem na análise", "O que vem da coleta até o relatório",
    "Como os dados do laboratório entram", "Como a API integra equipamentos",
  ],
  partnership: [
    "Como colaborar", "Como ser parceiro", "Como iniciar uma parceria de pesquisa",
    "Como apoiar o projeto", "Como investir na BioPrecis", "A quem se destina a parceria",
    "Como universidades ou empresas podem participar", "Como funciona a captação",
  ],
  founder: [
    "Quem é o fundador", "Quem criou a BioPrecis", "Quem é o idealizador do MIP",
    "Quem é Jair Armando Viana de Sousa", "Quem está por trás do projeto", "Qual a trajetória do fundador",
  ],
  stage: [
    "Em que estágio está o projeto", "Quais são os próximos marcos", "O projeto já foi validado",
    "Existe validação clínica", "Posso usar isso para diagnóstico", "Isso é um exame real",
    "O MIP já está disponível para pacientes", "Dá para prescrever tratamento",
    "Quais resultados reais estão disponíveis", "Qual é o plano de desenvolvimento",
  ],
};

const stopWords = new Set("a ao as com da das de do dos e em essa esse esta eu me meu minha na no o os para pela pelo por pra que se so um uma voce".split(" "));
const tokenize = (value) => (value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").match(/[a-z0-9]+/g) ?? [])
  .filter((word) => word.length > 1 && !stopWords.has(word));

function features(value) {
  const result = new Map();
  for (const word of tokenize(value)) {
    result.set(word, 1.5);
    if (word.length < 4) continue;
    for (let i = 0; i <= word.length - 3; i += 1) {
      result.set("~" + word.slice(i, i + 3), 0.5);
    }
  }
  return result;
}

const corpus = Object.entries(examples).flatMap(([topic, phrases]) =>
  phrases.map((phrase) => ({ topic, features: features(phrase) })));
const frequencies = new Map();
for (const example of corpus) {
  for (const feature of example.features.keys()) {
    frequencies.set(feature, (frequencies.get(feature) ?? 0) + 1);
  }
}

function vector(raw) {
  const weighted = new Map();
  for (const [term, count] of raw) {
    const frequency = frequencies.get(term) ?? 0;
    weighted.set(term, count * (1 + Math.log((1 + corpus.length) / (1 + frequency))));
  }
  const length = Math.hypot(...weighted.values());
  for (const [term, weight] of weighted) {
    weighted.set(term, weight / length);
  }
  return weighted;
}

const model = corpus.map((example) => ({ topic: example.topic, vector: vector(example.features) }));

// A compact supervised classifier compares a question with labeled examples.
// Replies come from the site's curated content and the active simulation.
export function classify(question) {
  const query = vector(features(question));
  const scores = new Map();
  for (const example of model) {
    let similarity = 0;
    for (const [term, weight] of query) {
      similarity += weight * (example.vector.get(term) ?? 0);
    }
    scores.set(example.topic, Math.max(scores.get(example.topic) ?? 0, similarity));
  }
  const [best, next] = [...scores.entries()].sort((left, right) => right[1] - left[1]);
  return best[1] >= .27 && best[1] - next[1] >= .035 ? best[0] : null;
}
