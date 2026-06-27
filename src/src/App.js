import { optionGroups } from "./data/examOptions.js";
import { medications } from "./data/medications.js";
import { fetchCep } from "./services/cepService.js";
import { exportTextAsPdf } from "./services/pdfService.js";
import { loadState, saveState, uid } from "./services/storageService.js";

const app = document.querySelector("#app");
let state = loadState();
let view = "dashboard";
let selectedPatientId = state.patients[0]?.id || "";
let draft = {};
let consultationPage = "anamnese";
let returnPage = "evolucao-retorno";
let modal = null;
let pendingViewAfterPatient = "";
const consultationPages = [
  ["anamnese", "Anamnese"],
  ["antecedentes", "Antecedentes"],
  ["psiquico", "Exame psiquico"],
  ["neurologico", "Exame neurologico"],
  ["diagnostico", "Diagnostico"],
  ["tratamento", "Tratamento"],
  ["medicamentos", "Medicamentos"],
  ["evolucao", "Evolucao"]
];
const returnPages = [
  ["evolucao-retorno", "Evolucao"],
  ["diagnostico", "Diagnostico"],
  ["tratamento", "Tratamento"],
  ["medicamentos", "Medicamentos"],
  ["texto-retorno", "Texto final"]
];
const aiDiagnosticAgents = [
  "ChatGPT",
  "Claude",
  "Gemini",
  "Perplexity",
  "Mistral",
  "Llama"
];

const icons = {
  patient: personIcon(),
  consult: clipboardIcon(),
  return: repeatIcon(),
  record: folderIcon(),
  exit: lockIcon()
};

render();

function render() {
  document.body.classList.toggle("light", state.theme === "light");
  app.innerHTML = `
    <div class="app-shell">
      ${topbar()}
      <main class="container">${view === "dashboard" ? dashboard() : workspace()}</main>
      <footer class="footer-note">Sistema de prontuario clinico. localStorage apenas para prototipo; usar backend seguro/LGPD em producao.</footer>
      ${modal || ""}
    </div>
  `;
  bindGlobalEvents();
  bindViewEvents();
}

function topbar() {
  return `
    <header class="topbar">
      <div class="brand">
        <h1>Regis Braga Psiquiatria - Prontuario Psiquiatrico</h1>
        <p>Evolucao clinica | Prontuario longitudinal</p>
      </div>
      <div class="top-actions">
        ${view === "dashboard" ? "" : `<button class="secondary" data-action="dashboard">Inicio</button>`}
        <button class="secondary" data-action="toggle-theme">${state.theme === "light" ? "Modo escuro" : "Modo claro"}</button>
      </div>
    </header>
  `;
}

function dashboard() {
  const cards = [
    ["patient", "Novo Paciente", "Identificacao, contato e CEP.", "patient"],
    ["consult", "Nova Consulta", "Anamnese, exame e evolucao.", "consultation"],
    ["return", "Retorno", "Seguimento comparativo.", "return"],
    ["record", "Prontuario", "Linha do tempo e busca.", "record"],
    ["exit", "Sair do Sistema", "Confirmacao e seguranca.", "exit"]
  ];
  return `<section class="dashboard">${cards.map(([icon, title, desc, target]) => `
    <button class="dash-button" data-view="${target}">
      <span class="dash-icon">${icons[icon]}</span>
      <span><strong>${title}</strong><span>${desc}</span></span>
    </button>`).join("")}</section>`;
}

function workspace() {
  return `
    <div class="layout">
      <aside class="side">
        ${navButton("patient", "Paciente", "patient")}
        ${navButton("consultation", "Consulta", "consult")}
        ${navButton("return", "Retorno", "return")}
        ${navButton("record", "Prontuario", "record")}
        ${navButton("exit", "Sair", "exit")}
      </aside>
      <section class="panel">${renderView()}</section>
    </div>
  `;
}

function navButton(target, label, icon) {
  return `<button class="nav-button ${view === target ? "active" : ""}" data-view="${target}"><span class="icon">${icons[icon]}</span>${label}</button>`;
}

function renderView() {
  if (view === "patient") return patientForm();
  if (view === "consultation") return consultationForm();
  if (view === "return") return returnForm();
  if (view === "record") return medicalRecord();
  if (view === "exit") return exitPanel();
  return dashboard();
}

function patientForm() {
  const patient = draft.patient || {};
  return `
    <div class="panel-title">
      <div><h2>Novo Paciente</h2><p>Identificacao editavel para consultas futuras.</p></div>
      ${patientSelector("edit-patient")}
    </div>
    <form id="patient-form">
      <div class="grid">
        ${field("nome", "Nome completo", patient.nome)}
        ${selectField("sexo", "Sexo", optionGroups.sexo, patient.sexo)}
        ${field("nascimento", "Data de nascimento", patient.nascimento, "date")}
        ${selectField("estadoCivil", "Estado civil", optionGroups.estadoCivil, patient.estadoCivil)}
        ${field("filhos", "Numero de filhos", patient.filhos, "number")}
        ${field("ocupacao", "Ocupacao", patient.ocupacao)}
        ${selectField("moradia", "Moradia", optionGroups.moradia, patient.moradia)}
        ${field("procedencia", "Procedencia", patient.procedencia)}
        ${selectField("escolaridade", "Escolaridade", optionGroups.escolaridade, patient.escolaridade)}
        ${selectField("religiao", "Religiao", optionGroups.religiao, patient.religiao)}
        ${field("telefone", "Telefone", patient.telefone, "tel")}
        ${field("email", "E-mail", patient.email, "email")}
        ${field("acompanhante", "Nome de acompanhante, se houver", patient.acompanhante)}
        ${field("emergencia", "Contato de emergencia", patient.emergencia)}
        ${field("cep", "CEP", patient.cep)}
        ${field("endereco", "Endereco", patient.endereco)}
        ${field("numero", "Numero", patient.numero)}
        ${field("complemento", "Complemento", patient.complemento)}
        ${field("bairro", "Bairro", patient.bairro)}
        ${field("cidade", "Cidade", patient.cidade)}
        ${field("estado", "Estado", patient.estado)}
      </div>
      <div class="warning" id="cep-status">Digite o CEP com 8 digitos para preencher endereco automaticamente.</div>
      <div class="actions">
        <button class="primary" type="submit">Salvar Paciente</button>
        <button class="secondary" type="button" data-action="clear-patient">Novo cadastro em branco</button>
        ${patient.id ? `<button class="danger" type="button" data-action="delete-patient">Excluir paciente</button>` : ""}
      </div>
    </form>
  `;
}

function patientSelector(action = "select-patient") {
  return `
    <label>Paciente
      <select data-action="${action}">
        <option value="">Selecionar paciente</option>
        ${state.patients.map(patient => `<option value="${patient.id}" ${selectedPatientId === patient.id ? "selected" : ""}>${escapeHtml(patient.nome || "Sem nome")}</option>`).join("")}
      </select>
    </label>
  `;
}

function consultationForm() {
  const patient = getPatient();
  if (!patient) return emptyPatientMessage("Nova Consulta");
  const form = draft.consultation || defaultConsultation();
  return `
    <div class="panel-title">
      <div><h2>${form.label}</h2><p>${escapeHtml(patient.nome)} | consulta numerada automaticamente.</p></div>
      ${patientSelector()}
    </div>
    <form id="consult-form">
      ${formPageTabs("consultation")}
      ${consultationPageBody(form, patient)}
    </form>
  `;
}

function returnForm() {
  const patient = getPatient();
  if (!patient) return emptyPatientMessage("Retorno");
  const form = draft.return || defaultReturn();
  const previous = latestEntry(patient.id);
  return `
    <div class="panel-title">
      <div><h2>${form.label}</h2><p>${escapeHtml(patient.nome)} | comparacao com consulta anterior.</p></div>
      ${patientSelector()}
    </div>
    <form id="return-form">
      <div class="warning">Resumo anterior: ${previous ? escapeHtml(previous.label) + " - " + escapeHtml((previous.evolution || previous.queixa || "").slice(0, 180)) : "sem registros anteriores."}</div>
      ${formPageTabs("return")}
      ${returnPageBody(form, patient, previous)}
    </form>
  `;
}

function formPageTabs(scope) {
  const pages = pagesForScope(scope);
  const active = scope === "consultation" ? consultationPage : returnPage;
  return `<nav class="page-tabs" aria-label="Paginas do formulario">${pages.map(([key, label]) => `
    <button type="button" class="${active === key ? "active" : ""}" data-action="form-page" data-scope="${scope}" data-page="${key}">${label}</button>
  `).join("")}</nav>`;
}

function clinicalPage(title, body, scope = "") {
  return `<section class="clinical-page"><div class="clinical-page-title"><h3>${title}</h3></div>${body}${pageStepActions(scope)}</section>`;
}

function consultationPageBody(form, patient) {
  if (consultationPage === "anamnese") return clinicalPage("A. Anamnese", `
    ${voiceTextarea("queixa", "Queixa principal nas palavras do paciente", form.queixa)}
    ${voiceTextarea("historia", "Historia do problema principal", form.historia, "Registrar cronologia dos sintomas, relacao temporal com eventos vitais, sintomas fisicos associados, fatores desencadeantes, fatores de melhora/piora, uso de substancias, sintomas positivos e negativos, impacto funcional e tratamentos previos.")}
    <div class="grid">
      ${selectFieldWithOther("inicio", "Inicio", optionGroups.inicio, form.inicio)}
      ${selectFieldWithOther("curso", "Curso", optionGroups.curso, form.curso)}
    </div>
    ${chips("fatores", "Fatores desencadeantes", optionGroups.fatores, form.fatores)}
    ${chips("fatoresMelhora", "Fatores de melhora", optionGroups.fatoresMelhora, form.fatoresMelhora)}
    ${chips("fatoresPiora", "Fatores de piora", optionGroups.fatoresPiora, form.fatoresPiora)}
    ${chips("impacto", "Impacto funcional", optionGroups.impacto, form.impacto)}
  `, "consultation");
  if (consultationPage === "antecedentes") return clinicalPage("Antecedentes", `
    ${chips("psiPrevios", "Diagnosticos psiquiatricos previos", optionGroups.psiPrevios, form.psiPrevios)}
    ${chips("tratamentos", "Tratamentos previos", optionGroups.tratamentos, form.tratamentos)}
    ${chips("medicos", "Antecedentes medicos", optionGroups.medicos, form.medicos)}
    ${chips("familiares", "Antecedentes familiares", optionGroups.familiares, form.familiares)}
    ${chips("substancias", "Habitos e substancias", optionGroups.substancias, form.substancias)}
  `, "consultation");
  if (consultationPage === "psiquico") return clinicalPage("B. Exame psiquico", mentalExamBody(form), "consultation");
  if (consultationPage === "neurologico") return clinicalPage("C. Exame fisico e neurologico", neurologicExamBody(form), "consultation");
  if (consultationPage === "diagnostico") return clinicalPage("D. Diagnostico e diferenciais", diagnosisModule(form), "consultation");
  if (consultationPage === "tratamento") return clinicalPage("E. Tratamento e orientacoes", treatmentModule(form), "consultation");
  if (consultationPage === "medicamentos") return clinicalPage("Medicamentos", medicationBody(form), "consultation");
  return clinicalPage("F. Evolucao do Paciente", evolutionBody(form, patient), "consultation");
}

function returnPageBody(form, patient, previous) {
  if (returnPage === "evolucao-retorno") return clinicalPage("Avaliacao de evolucao", returnAssessmentBody(form), "return");
  if (returnPage === "diagnostico") return clinicalPage("Diagnostico e diferenciais", diagnosisModule(form), "return");
  if (returnPage === "tratamento") return clinicalPage("Tratamento e orientacoes", treatmentModule(form), "return");
  if (returnPage === "medicamentos") return clinicalPage("Medicamentos", medicationBody(form), "return");
  return clinicalPage("Evolucao do Retorno", evolutionBody(form, patient, previous, true), "return");
}

function returnAssessmentBody(form) {
  return `
    <div class="grid">
      ${selectField("estadoGeral", "Estado geral desde a ultima consulta", optionGroups.retorno, form.estadoGeral)}
      ${selectField("sintomasPrincipais", "Sintomas principais", ["Remissao completa", "Melhora importante", "Melhora parcial", "Sem alteracao", "Piora", "Novos sintomas"], form.sintomasPrincipais)}
      ${selectField("sonoRetorno", "Sono", ["Melhorou", "Sem mudanca", "Piorou", "Insonia inicial", "Insonia intermediaria", "Despertar precoce", "Hipersonia", "Reducao da necessidade de sono"], form.sonoRetorno)}
      ${selectField("humorRetorno", "Humor", ["Eutimico", "Deprimido", "Ansioso", "Irritavel", "Euforico", "Disforico", "Oscilante"], form.humorRetorno)}
      ${selectField("ansiedadeRetorno", "Ansiedade", ["Ausente", "Leve", "Moderada", "Grave", "Crises de panico", "Evitacao"], form.ansiedadeRetorno)}
      ${selectField("funcionalidade", "Funcionalidade", ["Preservada", "Parcialmente prejudicada", "Muito prejudicada", "Incapacidade laboral", "Incapacidade academica", "Prejuizo social", "Prejuizo familiar"], form.funcionalidade)}
      ${selectField("adesao", "Adesao ao tratamento", ["Regular", "Parcial", "Irregular", "Interrompeu medicacao", "Uso em dose diferente da prescrita", "Esquecimentos frequentes", "Nao iniciou tratamento"], form.adesao)}
    </div>
    ${chips("efeitos", "Efeitos colaterais", ["Nenhum", "Sonolencia", "Insonia", "Nauseas", "Tremores", "Boca seca", "Constipacao", "Diarreia", "Disfuncao sexual", "Ganho de peso", "Perda de peso", "Acatisia", "Rigidez", "Discinesia", "Tontura", "Cefaleia", "Outro"], form.efeitos)}
    ${chips("eventos", "Eventos relevantes", ["Conflito familiar", "Conflito conjugal", "Problemas profissionais", "Problemas academicos", "Luto", "Internamento", "Urgencia/emergencia", "Uso de alcool/drogas", "Ideacao suicida", "Tentativa de suicidio", "Autoagressao", "Sintomas psicoticos", "Episodio de agitacao", "Outro"], form.eventos)}
    ${textarea("observacoesRetorno", "Observacoes clinicas do retorno", form.observacoesRetorno)}
  `;
}

function mentalExam(form) {
  return section("B. Exame psiquico", mentalExamBody(form), false);
}

function mentalExamBody(form) {
  const groups = [
    ["apresentacao", "Apresentacao"], ["consciencia", "Consciencia / Orientacao / Atencao"],
    ["memoria", "Memoria"], ["sensopercepcao", "Sensopercepcao"], ["pensamento", "Pensamento"],
    ["linguagem", "Linguagem"], ["juizo", "Juizo / Critica"], ["afetividade", "Afetividade"],
    ["humor", "Humor"], ["vontade", "Vontade"], ["psicomotricidade", "Psicomotricidade"], ["inteligencia", "Inteligencia"]
  ];
  return groups.map(([key, label]) => `
    ${chips(key, label, optionGroups[key], form[key])}
  `).join("");
}

function neurologicExamBody(form) {
  return `
    <div class="grid three">
      ${field("pa", "PA", form.pa)}${field("fc", "FC", form.fc)}${field("fr", "FR", form.fr)}
      ${field("temperatura", "Temperatura", form.temperatura)}${field("peso", "Peso", form.peso)}${field("altura", "Altura", form.altura)}
      ${field("imc", "IMC", form.imc)}${field("cintura", "Circunferencia abdominal", form.cintura)}
    </div>
    ${textarea("fisico", "Achados fisicos e neurologicos relevantes", form.fisico)}
  `;
}

function diagnosisTreatment(form) {
  return `
    ${section("D. Diagnostico e diferenciais", diagnosisModule(form))}
    ${section("E. Tratamento e orientacoes", treatmentModule(form))}
  `;
}

function diagnosisModule(form) {
  return `
    <div class="diagnosis-ai-panel">
      <div class="grid">
        ${selectField("aiDiagnosticAgent", "Agente de IA para gerar diagnosticos", aiDiagnosticAgents, form.aiDiagnosticAgent || "ChatGPT")}
        <label>Modelo/versao
          <input name="aiDiagnosticModel" value="${escapeAttr(form.aiDiagnosticModel || "")}" placeholder="Ex.: GPT-4.1, Claude Sonnet, Gemini Pro" />
        </label>
      </div>
      <div class="actions">
        <button class="primary" type="button" data-action="generate-diagnosis">Gerar diagnosticos por IA</button>
      </div>
      <div class="warning">Sugestoes geradas a partir da anamnese e do exame psiquico preenchidos. Revisao e decisao final permanecem do medico.</div>
    </div>
    ${textarea("diagnosticoManual", "Hipotese diagnostica principal gerada por IA, com CID-11 e DSM-5-TR", form.diagnosticoManual, "Clique em gerar diagnosticos por IA.")}
    ${textarea("diferenciais", "Diagnosticos diferenciais gerados por IA, com CID-11 e DSM-5-TR", form.diferenciais, "Clique em gerar diagnosticos por IA.")}
    <div class="info-box doctor-note">
      ${textarea("diagnosticoObservacaoMedica", "Observacao adicional do medico", form.diagnosticoObservacaoMedica, "Acrescente observacoes, ressalvas, hipoteses alternativas ou plano de investigacao.")}
    </div>
  `;
}

function treatmentModule(form) {
  return `
    ${textarea("conduta", "Plano terapeutico editavel: estilo de vida, sono, substancias, psicoterapia, exames, prescricao, risco e retorno", form.conduta)}
  `;
}

function medicationModule(form) {
  return section("Medicamentos", medicationBody(form));
}

function medicationBody(form) {
  const selected = medications.find(med => med.generic === form.medicationGeneric);
  return `
    <div class="grid">
      <label>Pesquisar medicamento
        <input list="med-list" name="medicationGeneric" value="${escapeAttr(form.medicationGeneric || "")}" placeholder="Digite o nome generico" />
        <datalist id="med-list">${medications.map(med => `<option value="${escapeAttr(med.generic)}"></option>`).join("")}</datalist>
      </label>
      ${field("manualPrice", "Preco/farmacia/observacao manual em Fortaleza", form.manualPrice)}
    </div>
    <div class="warning">Modulo de farmacias preparado para APIs publicas, scraping autorizado ou insercao manual. Nao viola termos de sites de farmacias.</div>
    ${selected ? `<div class="info-box">
      <h4>${selected.generic} - ${selected.className}</h4>
      <p><strong>Comerciais:</strong> ${selected.brands}</p>
      <p><strong>Mecanismo:</strong> ${selected.mechanism}</p>
      <p><strong>Receptores:</strong> ${selected.receptors}</p>
      <p><strong>Indicacoes:</strong> ${selected.indications}</p>
      <p><strong>Melhor indicacao clinica:</strong> ${selected.bestUse}</p>
      <p><strong>Dose inicial/usual:</strong> ${selected.initialDose} | ${selected.usualDose}</p>
      <p><strong>Efeitos comuns/graves:</strong> ${selected.commonEffects} ${selected.severeEffects}</p>
      <p><strong>Contraindicacoes/interacoes:</strong> ${selected.contraindications} ${selected.interactions}</p>
      <p><strong>Cuidados:</strong> idosos: ${selected.elderly}; gravidez: ${selected.pregnancy}; renal/hepatica: ${selected.renalHepatic}</p>
      <p><strong>Monitorizacao:</strong> ${selected.monitoring}</p>
    </div>` : ""}
  `;
}

function evolutionModule(form, patient, previous = null, isReturn = false) {
  return section(isReturn ? "Evolucao do Retorno" : "F. Evolucao do Paciente", evolutionBody(form, patient, previous, isReturn), true);
}

function evolutionBody(form, patient, previous = null, isReturn = false) {
  const evolution = form.evolution || "";
  return `
    <div class="actions">
      <button class="primary" type="submit">${isReturn ? "Salvar retorno" : "Salvar consulta"}</button>
      <button class="secondary" type="button" data-action="copy-evolution">Copiar texto da evolucao</button>
      <button class="secondary" type="button" data-action="print-evolution">Imprimir</button>
      <button class="secondary" type="button" data-action="pdf-evolution">Exportar evolucao em PDF</button>
    </div>
    ${textarea("evolution", "Evolucao medica editavel", evolution)}
  `;
}

function medicalRecord() {
  const patient = getPatient();
  if (!patient) return emptyPatientMessage("Prontuario");
  const query = (draft.recordQuery || "").toLowerCase();
  const all = entriesForPatient(patient.id).filter(entry => JSON.stringify(entry).toLowerCase().includes(query));
  return `
    <div class="panel-title">
      <div><h2>Prontuario Longitudinal</h2><p>${escapeHtml(patient.nome)} | consultas, retornos, diagnosticos e evolucoes.</p></div>
      ${patientSelector()}
    </div>
    <div class="record-grid">
      <div>
        ${field("recordSearch", "Busca por palavra-chave, diagnostico, medicamento ou data", draft.recordQuery || "")}
        <div class="section" style="padding:14px;margin-top:12px">
          <h3>Identificacao</h3>
          <p>${escapeHtml(patient.nome || "")}, ${escapeHtml(calculateAge(patient.nascimento) || "idade nao calculada")} anos, ${escapeHtml(patient.sexo || "")}</p>
          <p>${escapeHtml(patient.telefone || "")} | ${escapeHtml(patient.email || "")}</p>
          <p>${escapeHtml([patient.endereco, patient.numero, patient.bairro, patient.cidade, patient.estado].filter(Boolean).join(", "))}</p>
          <div class="actions"><button class="secondary" data-action="edit-current-patient">Editar identificacao</button></div>
        </div>
      </div>
      <div class="timeline">
        ${all.length ? all.map(entry => `
          <article class="timeline-item">
            <h4>${escapeHtml(entry.label)} - ${new Date(entry.createdAt).toLocaleString("pt-BR")}</h4>
            <p>${escapeHtml((entry.evolution || entry.queixa || entry.observacoesRetorno || "Registro sem evolucao.").slice(0, 420))}</p>
            <div class="actions">
              <button class="secondary" data-action="open-entry" data-id="${entry.id}" data-type="${entry.type}">Abrir/Revisar</button>
              <button class="secondary" data-action="pdf-entry" data-id="${entry.id}" data-type="${entry.type}">Exportar PDF</button>
              <button class="danger" data-action="delete-entry" data-id="${entry.id}" data-type="${entry.type}">Excluir</button>
            </div>
          </article>`).join("") : `<div class="warning">Nenhum registro encontrado para os filtros atuais.</div>`}
      </div>
    </div>
  `;
}

function exitPanel() {
  return `
    <div class="panel-title"><div><h2>Sair do Sistema</h2><p>Os dados deste prototipo sao salvos localmente neste navegador.</p></div></div>
    <div class="warning">Antes de sair, revise se ha evolucoes em edicao. O sistema tenta salvar automaticamente ao submeter formularios, mas dados sensiveis exigem backend seguro em producao.</div>
    <div class="actions"><button class="danger" data-action="confirm-exit">Sair do Sistema</button><button class="secondary" data-action="dashboard">Cancelar</button></div>
  `;
}

function emptyPatientMessage(title) {
  return `<div class="panel-title"><div><h2>${title}</h2><p>Selecione ou cadastre um paciente para continuar.</p></div>${patientSelector()}</div><div class="actions"><button class="primary" data-view="patient">Novo Paciente</button></div>`;
}

function section(title, body, open = false) {
  return `<details class="section" ${open ? "open" : ""}><summary><strong>${title}</strong></summary><div class="section-body">${body}</div></details>`;
}

function field(name, labelText, value = "", type = "text") {
  return `<label>${labelText}<input name="${name}" type="${type}" value="${escapeAttr(value || "")}" /></label>`;
}

function selectField(name, labelText, options, value = "") {
  return `<label>${labelText}<select name="${name}"><option value="">Selecionar</option>${options.map(option => `<option value="${escapeAttr(option)}" ${value === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select></label>`;
}

function selectFieldWithOther(name, labelText, options, value = "") {
  const otherValue = currentClinicalDraft()?.[`${name}Outro`] || "";
  const otherBox = value === "Outro" ? `
    <div class="other-card narrow">
      <label>Descrever outro
        <input name="${name}Outro" value="${escapeAttr(otherValue)}" placeholder="Especifique aqui" />
      </label>
    </div>
  ` : "";
  return `<div>${selectField(name, labelText, options, value)}${otherBox}</div>`;
}

function textarea(name, labelText, value = "", placeholder = "") {
  return `<label>${labelText}<textarea name="${name}" placeholder="${escapeAttr(placeholder)}">${escapeHtml(value || "")}</textarea></label>`;
}

function voiceTextarea(name, labelText, value = "", placeholder = "") {
  return `<div>${textarea(name, labelText, value, placeholder)}<div class="actions"><button class="secondary" type="button" data-action="voice" data-target="${name}">Transcrever por voz</button></div></div>`;
}

function chips(name, labelText, options, values = []) {
  const normalizedValues = Array.isArray(values) ? values : values ? [values] : [];
  const set = new Set(normalizedValues);
  const otherValue = currentClinicalDraft()?.[`${name}Outro`] || "";
  const otherBox = options.includes("Outro") && set.has("Outro") ? `
    <div class="other-card">
      <label>Descrever outro
        <input name="${name}Outro" value="${escapeAttr(otherValue)}" placeholder="Especifique aqui" />
      </label>
    </div>
  ` : "";
  return `<div><label>${labelText}</label><div class="chips">${options.map(option => `<label class="chip"><input type="checkbox" name="${name}" value="${escapeAttr(option)}" ${set.has(option) ? "checked" : ""}>${escapeHtml(option)}</label>`).join("")}</div>${otherBox}</div>`;
}

function pagesForScope(scope) {
  return scope === "consultation" ? consultationPages : returnPages;
}

function currentPageForScope(scope) {
  return scope === "consultation" ? consultationPage : returnPage;
}

function nextPageForScope(scope) {
  const pages = pagesForScope(scope);
  const current = currentPageForScope(scope);
  const index = pages.findIndex(([key]) => key === current);
  return index >= 0 ? pages[index + 1]?.[0] || "" : "";
}

function pageStepActions(scope) {
  if (!scope || !nextPageForScope(scope)) return "";
  return `<div class="actions page-actions"><button class="primary" type="button" data-action="save-next-page" data-scope="${scope}">Salvar pagina e avancar</button></div>`;
}

function bindGlobalEvents() {
  app.querySelectorAll("[data-view]").forEach(button => {
    button.addEventListener("click", () => {
      if ((button.dataset.view === "consultation" || button.dataset.view === "return" || button.dataset.view === "record") && !selectedPatientId) {
        pendingViewAfterPatient = button.dataset.view;
        view = "patient";
        draft.patient = draft.patient || {};
        render();
        return;
      }
      view = button.dataset.view;
      if (view === "consultation" && selectedPatientId) draft.consultation = draft.consultation || defaultConsultation();
      if (view === "return" && selectedPatientId) draft.return = draft.return || defaultReturn();
      render();
    });
  });
  app.querySelectorAll("[data-action='dashboard']").forEach(button => button.addEventListener("click", () => { view = "dashboard"; render(); }));
  app.querySelector("[data-action='toggle-theme']")?.addEventListener("click", () => {
    state.theme = state.theme === "light" ? "dark" : "light";
    persist();
    render();
  });
  app.querySelectorAll("[data-action='select-patient']").forEach(select => select.addEventListener("change", event => {
    selectedPatientId = event.target.value;
    draft.consultation = selectedPatientId ? defaultConsultation() : {};
    draft.return = selectedPatientId ? defaultReturn() : {};
    consultationPage = "anamnese";
    returnPage = "evolucao-retorno";
    render();
  }));
  app.querySelectorAll("[data-action='edit-patient']").forEach(select => select.addEventListener("change", event => {
    selectedPatientId = event.target.value;
    draft.patient = structuredClone(getPatient() || {});
    render();
  }));
}

function bindViewEvents() {
  bindAutoDraft();
  bindPatientForm();
  bindConsultForm();
  bindReturnForm();
  bindRecord();
  bindActions();
}

function bindAutoDraft() {
  const forms = app.querySelectorAll("form");
  forms.forEach(form => {
    form.addEventListener("input", () => updateDraftFromForm(form));
    form.addEventListener("change", event => {
      updateDraftFromForm(form);
      if (event.target?.matches?.("input[type='checkbox'][value='Outro'], select")) render();
    });
  });
}

function bindPatientForm() {
  const form = app.querySelector("#patient-form");
  if (!form) return;
  form.querySelector("[name='cep']")?.addEventListener("blur", async event => {
    const status = app.querySelector("#cep-status");
    try {
      const address = await fetchCep(event.target.value);
      Object.assign(draft.patient || {}, formToObject(form), address);
      status.textContent = "Endereco preenchido automaticamente pelo CEP.";
      render();
    } catch (error) {
      status.textContent = error.message;
    }
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    const data = { ...(draft.patient || {}), ...formToObject(form) };
    if (!data.nome?.trim()) return alert("Informe o nome completo.");
    if (data.id) {
      state.patients = state.patients.map(patient => patient.id === data.id ? { ...patient, ...data, updatedAt: new Date().toISOString() } : patient);
    } else {
      data.id = uid("patient");
      data.createdAt = new Date().toISOString();
      state.patients.push(data);
    }
    selectedPatientId = data.id;
    draft.patient = structuredClone(data);
    persist();
    view = pendingViewAfterPatient || "consultation";
    if (view === "consultation") draft.consultation = defaultConsultation();
    if (view === "return") draft.return = defaultReturn();
    pendingViewAfterPatient = "";
    render();
  });
}

function bindConsultForm() {
  const form = app.querySelector("#consult-form");
  if (!form) return;
  form.addEventListener("submit", event => {
    event.preventDefault();
    const data = { ...draft.consultation, ...formToObject(form), patientId: selectedPatientId, type: "consultation" };
    if (!data.id) data.id = uid("consultation");
    data.updatedAt = new Date().toISOString();
    data.createdAt = data.createdAt || data.updatedAt;
    upsert("consultations", data);
    draft.consultation = defaultConsultation();
    persist();
    view = "record";
    render();
  });
}

function bindReturnForm() {
  const form = app.querySelector("#return-form");
  if (!form) return;
  form.addEventListener("submit", event => {
    event.preventDefault();
    const previous = latestEntry(selectedPatientId);
    const data = { ...draft.return, ...formToObject(form), patientId: selectedPatientId, type: "return" };
    if (!data.id) data.id = uid("return");
    data.updatedAt = new Date().toISOString();
    data.createdAt = data.createdAt || data.updatedAt;
    upsert("returns", data);
    draft.return = defaultReturn();
    persist();
    view = "record";
    render();
  });
}

function bindRecord() {
  app.querySelector("[name='recordSearch']")?.addEventListener("input", event => {
    draft.recordQuery = event.target.value;
    render();
  });
}

function bindActions() {
  app.querySelectorAll("[data-action]").forEach(element => {
    element.addEventListener("click", async event => {
      const action = element.dataset.action;
      if (["dashboard", "toggle-theme", "select-patient", "edit-patient"].includes(action)) return;
      if (action === "form-page") switchFormPage(element);
      if (action === "save-next-page") saveCurrentPageAndAdvance(element);
      if (action === "generate-diagnosis") generateDiagnosisFromClinicalData(element);
      if (action === "clear-patient") { draft.patient = {}; render(); }
      if (action === "delete-patient") deletePatient();
      if (action === "copy-evolution") copyEvolution();
      if (action === "print-evolution" || action === "pdf-evolution") printEvolution();
      if (action === "voice") startVoice(element.dataset.target);
      if (action === "edit-current-patient") { view = "patient"; draft.patient = structuredClone(getPatient()); render(); }
      if (action === "open-entry") openEntry(element.dataset.id, element.dataset.type);
      if (action === "pdf-entry") pdfEntry(element.dataset.id, element.dataset.type);
      if (action === "delete-entry") deleteEntry(element.dataset.id, element.dataset.type);
      if (action === "confirm-exit") showExitModal();
      if (action === "close-modal") { modal = null; render(); }
      if (action === "exit-now") { modal = null; view = "dashboard"; render(); }
    });
  });
}

function switchFormPage(element) {
  const form = element.closest("form");
  if (form) updateDraftFromForm(form);
  if (element.dataset.scope === "consultation") consultationPage = element.dataset.page;
  if (element.dataset.scope === "return") returnPage = element.dataset.page;
  render();
}

function saveCurrentPageAndAdvance(element) {
  const form = element.closest("form");
  if (form) updateDraftFromForm(form);
  const scope = element.dataset.scope;
  const nextPage = nextPageForScope(scope);
  if (scope === "consultation" && nextPage) consultationPage = nextPage;
  if (scope === "return" && nextPage) returnPage = nextPage;
  render();
}

function generateDiagnosisFromClinicalData(element) {
  const formElement = element.closest("form");
  if (formElement) updateDraftFromForm(formElement);
  const scope = view === "return" ? "return" : "consultation";
  const target = scope === "return" ? draft.return : draft.consultation;
  const suggestion = buildDiagnosticSuggestion(target || {});
  if (scope === "return") draft.return = { ...(draft.return || {}), ...suggestion };
  else draft.consultation = { ...(draft.consultation || {}), ...suggestion };
  render();
}

function buildDiagnosticSuggestion(form) {
  const sourceText = [
    form.queixa, form.historia, form.inicio, form.curso, form.fatoresOutro,
    joinValues(form.fatores), joinValues(form.fatoresMelhora), joinValues(form.fatoresPiora), joinValues(form.impacto),
    joinValues(form.psiPrevios), joinValues(form.tratamentos), joinValues(form.medicos), joinValues(form.familiares), joinValues(form.substancias),
    joinValues(form.apresentacao), joinValues(form.consciencia), joinValues(form.memoria), joinValues(form.sensopercepcao),
    joinValues(form.pensamento), joinValues(form.linguagem), joinValues(form.juizo), joinValues(form.afetividade),
    joinValues(form.humor), joinValues(form.vontade), joinValues(form.psicomotricidade), joinValues(form.inteligencia),
    form.observacoesRetorno
  ].filter(Boolean).join(" | ");
  const text = normalizeText(sourceText);
  const agent = form.aiDiagnosticAgent || "ChatGPT";
  const model = form.aiDiagnosticModel?.trim() ? ` (${form.aiDiagnosticModel.trim()})` : "";
  const matches = diagnosticRules()
    .map(rule => ({ ...rule, score: rule.terms.reduce((sum, term) => sum + (text.includes(term) ? 1 : 0), 0) }))
    .filter(rule => rule.score > 0)
    .sort((a, b) => b.score - a.score);
  const primary = matches[0] || diagnosticRules()[0];
  const differentials = matches.slice(1, 5);
  const fallbackDifferentials = diagnosticRules().filter(rule => rule.name !== primary.name).slice(0, 4);
  const selectedDifferentials = differentials.length ? differentials : fallbackDifferentials;
  const evidence = summarizeEvidence(form);
  return {
    aiDiagnosticAgent: agent,
    diagnosticoManual: [
      `Sugestao gerada por ${agent}${model}: ${primary.name}.`,
      `CID-11: ${primary.cid11}.`,
      `DSM5 TR: ${primary.dsm5tr}.`,
      `Elementos utilizados: ${evidence || "anamnese e exame psiquico ainda insuficientes; completar dados clinicos antes de concluir."}`,
      "Conduta: confirmar criterios diagnosticos, duracao, prejuizo funcional, exclusoes clinicas/substancias e risco antes de registrar o diagnostico definitivo."
    ].join("\n"),
    diferenciais: selectedDifferentials.map((item, index) => [
      `${index + 1}. ${item.name}`,
      `CID-11: ${item.cid11}.`,
      `DSM5 TR: ${item.dsm5tr}.`,
      `Diferenciar por: ${item.differential}.`
    ].join("\n")).join("\n\n"),
    diagnosticoObservacaoMedica: form.diagnosticoObservacaoMedica || ""
  };
}

function diagnosticRules() {
  return [
    {
      name: "Transtorno depressivo, episodio depressivo",
      cid11: "6A70 - Episodio depressivo",
      dsm5tr: "Transtorno depressivo maior, episodio depressivo maior",
      terms: ["hipotimia", "anedonia", "deprim", "lentificacao", "hipobulia", "despertar precoce", "ideacao suicida"],
      differential: "luto, transtorno bipolar, uso de substancias, hipotireoidismo e transtorno de ajustamento."
    },
    {
      name: "Transtorno de ansiedade generalizada",
      cid11: "6B00 - Transtorno de ansiedade generalizada",
      dsm5tr: "Transtorno de ansiedade generalizada",
      terms: ["humor ansioso", "ansios", "preocupacoes excessivas", "inquietude", "tensao", "panico"],
      differential: "transtorno do panico, ansiedade social, TOC, hipertireoidismo e uso de estimulantes."
    },
    {
      name: "Transtorno bipolar ou relacionado",
      cid11: "6A60/6A61 - Transtorno bipolar tipo I/tipo II",
      dsm5tr: "Transtorno bipolar I ou II",
      terms: ["hipertimia", "euforia", "reducao da necessidade de sono", "fuga de ideias", "logorreia", "aceleracao", "hiperbulia"],
      differential: "TDAH, uso de substancias, transtorno de personalidade borderline e episodio depressivo unipolar."
    },
    {
      name: "Transtorno obsessivo-compulsivo",
      cid11: "6B20 - Transtorno obsessivo-compulsivo",
      dsm5tr: "Transtorno obsessivo-compulsivo",
      terms: ["obsessoes", "compulsividade", "toc", "rituais", "intrusivos"],
      differential: "ansiedade generalizada, transtornos relacionados a trauma, tiques e transtorno de personalidade obsessivo-compulsiva."
    },
    {
      name: "Transtorno psicotico primario ou secundario",
      cid11: "6A20-6A2Z - Espectro da esquizofrenia e outros transtornos psicoticos primarios",
      dsm5tr: "Espectro da esquizofrenia e outros transtornos psicoticos",
      terms: ["alucinacao", "delirio", "juizo prejudicado", "critica prejudicada", "desconfianca", "afrouxamento", "descarrilamento"],
      differential: "transtorno bipolar com sintomas psicoticos, depressao psicotica, delirium, epilepsia e substancias."
    },
    {
      name: "Transtorno relacionado a trauma ou estresse",
      cid11: "6B40/6B43 - TEPT ou transtorno de ajustamento",
      dsm5tr: "TEPT ou transtorno de ajustamento",
      terms: ["tept", "trauma", "luto", "separacao", "estresse", "conflito", "ajustamento"],
      differential: "depressao maior, ansiedade generalizada, luto prolongado e transtorno de personalidade."
    },
    {
      name: "Transtorno por uso de substancias",
      cid11: "6C40-6C4Z - Transtornos por uso de substancias",
      dsm5tr: "Transtornos relacionados a substancias e transtornos aditivos",
      terms: ["alcool", "cannabis", "cocaina", "crack", "opioides", "benzodiazepinicos", "substancias"],
      differential: "transtornos primarios do humor, ansiedade, psicose induzida por substancias e abstinencia/intoxicacao."
    }
  ];
}

function summarizeEvidence(form) {
  return [
    form.queixa && `queixa: ${form.queixa}`,
    form.historia && `historia: ${form.historia}`,
    form.inicio && `inicio ${form.inicio}`,
    form.curso && `curso ${form.curso}`,
    joinValues(form.humor) && `humor: ${joinValues(form.humor)}`,
    joinValues(form.pensamento) && `pensamento: ${joinValues(form.pensamento)}`,
    joinValues(form.sensopercepcao) && `sensopercepcao: ${joinValues(form.sensopercepcao)}`,
    joinValues(form.juizo) && `juizo/critica: ${joinValues(form.juizo)}`,
    joinValues(form.impacto) && `impacto: ${joinValues(form.impacto)}`
  ].filter(Boolean).join("; ");
}

function joinValues(value) {
  return Array.isArray(value) ? value.filter(Boolean).join(", ") : value || "";
}

function normalizeText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function updateDraftFromForm(form) {
  if (form.id === "patient-form") draft.patient = { ...(draft.patient || {}), ...formToObject(form) };
  if (form.id === "consult-form") draft.consultation = { ...(draft.consultation || {}), ...formToObject(form) };
  if (form.id === "return-form") draft.return = { ...(draft.return || {}), ...formToObject(form) };
}

function currentClinicalDraft() {
  if (view === "return") return draft.return || {};
  if (view === "consultation") return draft.consultation || {};
  return {};
}

function formToObject(form) {
  const data = {};
  new FormData(form).forEach((value, key) => {
    if (data[key]) data[key] = Array.isArray(data[key]) ? [...data[key], value] : [data[key], value];
    else data[key] = value;
  });
  form.querySelectorAll("input[type='checkbox']").forEach(box => {
    if (!data[box.name]) data[box.name] = [];
  });
  return data;
}

function defaultConsultation() {
  const count = state.consultations.filter(item => item.patientId === selectedPatientId).length + 1;
  return { patientId: selectedPatientId, label: `Consulta ${count}`, type: "consultation" };
}

function defaultReturn() {
  const count = state.returns.filter(item => item.patientId === selectedPatientId).length + 1;
  return { patientId: selectedPatientId, label: `Retorno ${count}`, type: "return" };
}

function getPatient() {
  return state.patients.find(patient => patient.id === selectedPatientId);
}

function entriesForPatient(patientId) {
  return [...state.consultations, ...state.returns]
    .filter(entry => entry.patientId === patientId)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function latestEntry(patientId) {
  return entriesForPatient(patientId)[0];
}

function upsert(collection, data) {
  const list = state[collection];
  const index = list.findIndex(item => item.id === data.id);
  if (index >= 0) list[index] = data;
  else list.push(data);
}

function persist() {
  saveState(state);
}

async function copyEvolution() {
  const text = app.querySelector("[name='evolution']")?.value || "";
  await navigator.clipboard?.writeText(text);
  alert("Evolucao copiada.");
}

function printEvolution() {
  const text = app.querySelector("[name='evolution']")?.value || "";
  exportTextAsPdf("Evolucao medica", text);
}

function pdfEntry(id, type) {
  const entry = findEntry(id, type);
  exportTextAsPdf(entry?.label || "Evolucao", entry?.evolution || "");
}

function openEntry(id, type) {
  const entry = findEntry(id, type);
  if (!entry) return;
  selectedPatientId = entry.patientId;
  if (type === "consultation") {
    draft.consultation = structuredClone(entry);
    view = "consultation";
  } else {
    draft.return = structuredClone(entry);
    view = "return";
  }
  render();
}

function deleteEntry(id, type) {
  if (!confirm("Excluir este registro do prontuario?")) return;
  const collection = type === "consultation" ? "consultations" : "returns";
  state[collection] = state[collection].filter(item => item.id !== id);
  persist();
  render();
}

function deletePatient() {
  const patient = getPatient();
  if (!patient || !confirm("Excluir paciente e todos os registros vinculados?")) return;
  state.patients = state.patients.filter(item => item.id !== patient.id);
  state.consultations = state.consultations.filter(item => item.patientId !== patient.id);
  state.returns = state.returns.filter(item => item.patientId !== patient.id);
  selectedPatientId = state.patients[0]?.id || "";
  draft.patient = {};
  persist();
  view = "dashboard";
  render();
}

function findEntry(id, type) {
  return (type === "consultation" ? state.consultations : state.returns).find(item => item.id === id);
}

function showExitModal() {
  modal = `<div class="modal-backdrop"><div class="modal"><h2>Deseja realmente sair do sistema?</h2><p>Dados ja salvos permanecem neste navegador. Revise campos em edicao antes de sair.</p><div class="actions"><button class="secondary" data-action="close-modal">Cancelar</button><button class="danger" data-action="exit-now">Sair</button></div></div></div>`;
  render();
}

function startVoice(targetName) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return alert("Transcricao por voz nao suportada neste navegador.");
  const recognition = new SpeechRecognition();
  recognition.lang = "pt-BR";
  recognition.interimResults = false;
  recognition.onresult = event => {
    const text = event.results[0][0].transcript;
    const fieldElement = app.querySelector(`[name='${targetName}']`);
    fieldElement.value = `${fieldElement.value ? fieldElement.value + " " : ""}${text}`;
    const form = fieldElement.closest("form");
    updateDraftFromForm(form);
  };
  recognition.start();
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function calculateAge(dateValue) {
  if (!dateValue) return "";
  const birth = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hadBirthday = today.getMonth() > birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hadBirthday) age -= 1;
  return age >= 0 ? age : "";
}

function personIcon() {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
}
function clipboardIcon() {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 4h6l1 2h3v15H5V6h3l1-2Z" stroke="currentColor" stroke-width="2"/><path d="M9 11h6M9 15h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
}
function repeatIcon() {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function folderIcon() {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 6h7l2 2h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" stroke="currentColor" stroke-width="2"/></svg>`;
}
function lockIcon() {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5V10Z" stroke="currentColor" stroke-width="2"/></svg>`;
}
