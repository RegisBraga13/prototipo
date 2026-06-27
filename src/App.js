import { optionGroups } from "./data/examOptions.js";
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
    ["diagnostico", "Diagnostico"],
  ["tratamento", "Tratamento"],
  ["medicamentos", "Medicamentos"],
  ["evolucao", "Evolucao"]
];
const returnPages = [
  ["evolucao-retorno", "Evolucao"],
  ["texto-retorno", "Texto final"]
];
const aiDiagnosticAgents = [
  "ChatGPT",
  "Claude",
  "Gemini",
];
const aiTreatmentOptions = [
  { agent: "ChatGPT", model: "GPT-4.1" },
  { agent: "ChatGPT", model: "GPT-4o" },
  { agent: "Claude", model: "Sonnet 4" },
  { agent: "Gemini", model: "2.5 Pro" },
  { agent: "Perplexity", model: "Sonar Pro" },
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
        ${field("ocupacao", "Ocupacao", patient.ocupacao)}
        ${selectField("escolaridade", "Escolaridade", optionGroups.escolaridade, patient.escolaridade)}
        ${selectField("religiao", "Religiao", optionGroups.religiao, patient.religiao)}
        ${field("telefone", "Telefone", patient.telefone, "tel")}
        ${field("email", "E-mail", patient.email, "email")}
        ${field("acompanhante", "Nome de acompanhante, se houver", patient.acompanhante)}
        ${field("emergencia", "Contato de emergencia", patient.emergencia)}
      </div>
      <div class="address-card">
        <h3>Endereco automatico por CEP</h3>
        <div class="grid">
          ${field("cep", "CEP", patient.cep)}
          ${field("endereco", "Endereco", patient.endereco)}
          ${field("bairro", "Bairro", patient.bairro)}
          <div class="inline-fields">
            ${field("numero", "Numero", patient.numero)}
            ${field("complemento", "Complemento", patient.complemento)}
          </div>
          <div class="inline-fields city-state">
            ${field("cidade", "Cidade", patient.cidade)}
            ${field("estado", "UF", patient.estado)}
          </div>
        </div>
        <div class="warning" id="cep-status">Digite o CEP com 8 digitos para preencher endereco, bairro, cidade e estado automaticamente.</div>
      </div>
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
  const isSavedEntry = Boolean(form.id);
  return `
    <div class="panel-title">
      <div><h2>${form.label}</h2><p>${escapeHtml(patient.nome)} | consulta numerada automaticamente.</p></div>
      ${patientSelector()}
    </div>
    <form id="consult-form">
      ${isSavedEntry ? recordReturnAction("Consulta anterior aberta para revisao") : ""}
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
  const isSavedEntry = Boolean(form.id);
  return `
    <div class="panel-title">
      <div><h2>${form.label}</h2><p>${escapeHtml(patient.nome)} | comparacao com consulta anterior.</p></div>
      ${patientSelector()}
    </div>
    <form id="return-form">
      ${isSavedEntry ? recordReturnAction("Retorno anterior aberto para revisao") : ""}
      <div class="warning">Resumo anterior: ${previous ? escapeHtml(previous.label) + " - " + escapeHtml((previous.evolution || anamnesisText(previous)).slice(0, 180)) : "sem registros anteriores."}</div>
      ${formPageTabs("return")}
      ${returnPageBody(form, patient, previous)}
    </form>
  `;
}

function recordReturnAction(label) {
  return `
    <div class="warning record-opened">
      ${escapeHtml(label)}.
      <button class="secondary inline-action" type="button" data-action="back-to-record">Voltar ao prontuario</button>
    </div>
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
  const qphda = form.qphda || [form.queixa && `QP: ${form.queixa}`, form.historia && `HDA: ${form.historia}`].filter(Boolean).join("\n\n");
  if (consultationPage === "anamnese") return clinicalPage("A. Anamnese", `
    <div class="clinical-card qphda-card">
      <h4>QP e HDA</h4>
      ${voiceTextarea("qphda", "Queixa principal (QP) e historia da doenca atual (HDA)", qphda, "Registrar QP nas palavras do paciente e HDA com cronologia dos sintomas, relacao temporal com eventos vitais, sintomas fisicos associados, fatores desencadeantes, fatores de melhora/piora, uso de substancias, sintomas positivos e negativos, impacto funcional e tratamentos previos.")}
    </div>
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
    ${section("E. Tratamento e orientacoes com auxilio de IA", treatmentModule(form))}
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
    <div class="diagnosis-ai-panel">
      <div class="ai-toolbar">
        ${selectField("aiTreatmentOption", "Agente e modelo de IA", aiTreatmentOptions.map(aiOptionLabel), form.aiTreatmentOption || aiOptionLabel(aiTreatmentOptions[0]))}
        <button class="primary" type="button" data-action="generate-treatment">Gerar tratamento e orientacoes por IA</button>
      </div>
      <div class="warning">Sugestao de apoio clinico. Ajuste dose, exames, encaminhamentos, risco, consentimento e retorno conforme avaliacao medica.</div>
    </div>
    <div class="treatment-card-grid">
      <div class="treatment-card">
        <h4>1. Tratamento medicamentoso</h4>
        ${textarea("tratamentoMedicamentoso", "Drogas sugeridas, alternativas, dose inicial e progressao", form.tratamentoMedicamentoso || form.conduta)}
      </div>
      <div class="treatment-card">
        <h4>2. Outras abordagens terapeuticas</h4>
        ${textarea("abordagensTerapeuticas", "Psicoterapia, psicoeducacao, sono, rotina, familia, substancias e outras intervencoes", form.abordagensTerapeuticas)}
      </div>
      <div class="treatment-card">
        <h4>3. Exames laboratoriais sugeridos</h4>
        ${textarea("examesLaboratoriais", "Exames sugeridos conforme diagnostico, comorbidades e medicacoes", form.examesLaboratoriais)}
      </div>
      <div class="treatment-card">
        <h4>4. Preenchimento pelo medico</h4>
        ${textarea("condutaMedica", "Conduta final, ajustes clinicos, riscos, consentimento, encaminhamentos e retorno", form.condutaMedica)}
      </div>
    </div>
  `;
}

function medicationModule(form) {
  return section("Medicamentos", medicationBody(form));
}

function medicationBody(form) {
  const medicationName = form.medicationGeneric || "";
  return `
    <div class="diagnosis-ai-panel">
      <div class="ai-toolbar">
        <label>Pesquisar medicamento
          <input name="medicationGeneric" value="${escapeAttr(form.medicationGeneric || "")}" placeholder="Digite o nome generico ou comercial" />
        </label>
        <button class="primary" type="button" data-action="fill-medication-info">Pesquisar online e preencher</button>
      </div>
      <div class="warning">Precos online variam por CEP, estoque, convenio, PBM e exigencia de receita. Use os links de pesquisa para confirmar valores atuais em Fortaleza antes de orientar o paciente.</div>
      ${form.medicationOnlineStatus ? `<p class="online-status">${escapeHtml(form.medicationOnlineStatus)}</p>` : ""}
    </div>
    <div class="medication-card-grid">
      <div class="treatment-card">
        <h4>Apresentacao e posologia</h4>
        ${textarea("medicationPresentation", "Apresentacoes, dose inicial, dose usual e progressao", form.medicationPresentation)}
      </div>
      <div class="treatment-card">
        <h4>Melhores indicacoes</h4>
        ${textarea("medicationBestUse", "Indicacoes, melhor perfil clinico e observacoes", form.medicationBestUse)}
      </div>
      <div class="treatment-card">
        <h4>Efeitos colaterais e cuidados</h4>
        ${textarea("medicationSafety", "Efeitos comuns, graves, interacoes, contraindicacoes e monitorizacao", form.medicationSafety)}
      </div>
      <div class="treatment-card">
        <h4>Precos em Fortaleza</h4>
        ${textarea("medicationPriceResearch", "Links e observacoes de pesquisa de preco", form.medicationPriceResearch || medicationPriceResearchText(medicationName))}
        ${field("manualPrice", "Preco/farmacia/observacao manual em Fortaleza", form.manualPrice)}
      </div>
    </div>
    ${medicationName ? medicationSearchLinks(medicationName) : ""}
  `;
}

function evolutionModule(form, patient, previous = null, isReturn = false) {
  return section(isReturn ? "Evolucao do Retorno" : "F. Evolucao do Paciente", evolutionBody(form, patient, previous, isReturn), true);
}

function evolutionBody(form, patient, previous = null, isReturn = false) {
  const evolution = form.evolution || "";
  return `
    <div class="diagnosis-ai-panel">
      <div class="ai-toolbar">
        ${selectField("aiEvolutionOption", "Agente e modelo de IA", aiTreatmentOptions.map(aiOptionLabel), form.aiEvolutionOption || aiOptionLabel(aiTreatmentOptions[0]))}
        <button class="primary" type="button" data-action="generate-evolution">Gerar evolucao com ChatGPT/IA</button>
      </div>
      <div class="warning">Rascunho narrativo baseado nos dados preenchidos na consulta, incluindo achados positivos e negativos registrados. Revise linguagem, risco, sigilo e decisao final antes de salvar.</div>
    </div>
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
            <p>${escapeHtml((entry.evolution || anamnesisText(entry) || entry.observacoesRetorno || "Registro sem evolucao.").slice(0, 420))}</p>
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
      if (action === "generate-treatment") generateTreatmentFromClinicalData(element);
      if (action === "generate-evolution") generateEvolutionFromClinicalData(element);
      if (action === "fill-medication-info") await fillMedicationInfo(element);
      if (action === "clear-patient") { draft.patient = {}; render(); }
      if (action === "delete-patient") deletePatient();
      if (action === "copy-evolution") copyEvolution();
      if (action === "print-evolution" || action === "pdf-evolution") printEvolution();
      if (action === "voice") startVoice(element.dataset.target);
      if (action === "edit-current-patient") { view = "patient"; draft.patient = structuredClone(getPatient()); render(); }
      if (action === "open-entry") openEntry(element.dataset.id, element.dataset.type);
      if (action === "back-to-record") { view = "record"; render(); }
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

function generateTreatmentFromClinicalData(element) {
  const formElement = element.closest("form");
  if (formElement) updateDraftFromForm(formElement);
  const scope = view === "return" ? "return" : "consultation";
  const target = scope === "return" ? draft.return : draft.consultation;
  const suggestion = buildTreatmentSuggestion(target || {});
  if (scope === "return") draft.return = { ...(draft.return || {}), ...suggestion };
  else draft.consultation = { ...(draft.consultation || {}), ...suggestion };
  render();
}

function generateEvolutionFromClinicalData(element) {
  const formElement = element.closest("form");
  if (formElement) updateDraftFromForm(formElement);
  const scope = view === "return" ? "return" : "consultation";
  const target = scope === "return" ? draft.return : draft.consultation;
  const previous = scope === "return" ? latestEntry(selectedPatientId) : null;
  const patient = getPatient() || {};
  const suggestion = {
    aiEvolutionOption: target?.aiEvolutionOption || aiOptionLabel(aiTreatmentOptions[0]),
    evolution: buildEvolutionNarrative(target || {}, patient, previous, scope === "return")
  };
  if (scope === "return") draft.return = { ...(draft.return || {}), ...suggestion };
  else draft.consultation = { ...(draft.consultation || {}), ...suggestion };
  render();
}

async function fillMedicationInfo(element) {
  const formElement = element.closest("form");
  if (formElement) updateDraftFromForm(formElement);
  const scope = view === "return" ? "return" : "consultation";
  const target = scope === "return" ? draft.return : draft.consultation;
  const medicationName = target?.medicationGeneric || "";
  if (!medicationName.trim()) return alert("Digite o nome do medicamento para pesquisar online.");
  const loading = {
    medicationOnlineStatus: `Pesquisando online: ${medicationName}...`,
    medicationPriceResearch: medicationPriceResearchText(medicationName)
  };
  if (scope === "return") draft.return = { ...(draft.return || {}), ...loading };
  else draft.consultation = { ...(draft.consultation || {}), ...loading };
  render();

  const suggestion = await buildMedicationAutofill(medicationName);
  if (scope === "return") draft.return = { ...(draft.return || {}), ...suggestion };
  else draft.consultation = { ...(draft.consultation || {}), ...suggestion };
  render();
}

function buildDiagnosticSuggestion(form) {
  const qphdaText = anamnesisText(form);
  const sourceText = [
    qphdaText, form.inicio, form.curso, form.fatoresOutro,
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

async function buildMedicationAutofill(typedName = "") {
  const rxnav = await fetchRxNavMedication(typedName);
  const searchName = typedName.trim();
  const label = await fetchOpenFdaLabel(searchName) || (rxnav.name ? await fetchOpenFdaLabel(rxnav.name) : null);
  const sourceStatus = [
    rxnav.name ? `RxNav: ${rxnav.name}${rxnav.rxcui ? ` (RxCUI ${rxnav.rxcui})` : ""}` : "RxNav: sem correspondencia direta",
    label ? "openFDA: bula/rotulagem encontrada" : "openFDA: sem correspondencia direta"
  ].join(" | ");

  return {
    medicationGeneric: searchName,
    medicationPresentation: medicationOnlinePresentationText(searchName, rxnav, label),
    medicationBestUse: medicationOnlineBestUseText(searchName, label),
    medicationSafety: medicationOnlineSafetyText(label),
    medicationPriceResearch: medicationPriceResearchText(searchName),
    medicationOnlineStatus: sourceStatus
  };
}

async function fetchRxNavMedication(term) {
  try {
    const url = `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(term)}`;
    const response = await fetch(url);
    if (!response.ok) return fetchRxNavApproximateMedication(term);
    const data = await response.json();
    const candidate = data?.drugGroup?.conceptGroup
      ?.flatMap(group => group.conceptProperties || [])
      ?.find(item => item.name && item.rxcui);
    if (!candidate) return fetchRxNavApproximateMedication(term);
    return {
      name: candidate?.name || "",
      rxcui: candidate?.rxcui || ""
    };
  } catch {
    return fetchRxNavApproximateMedication(term);
  }
}

async function fetchRxNavApproximateMedication(term) {
  try {
    const url = `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(term)}&maxEntries=1`;
    const response = await fetch(url);
    if (!response.ok) return {};
    const data = await response.json();
    const candidate = data?.approximateGroup?.candidate?.[0];
    return {
      name: candidate?.name || "",
      rxcui: candidate?.rxcui || ""
    };
  } catch {
    return {};
  }
}

async function fetchOpenFdaLabel(term) {
  const queries = [
    `openfda.generic_name:"${term}"`,
    `openfda.brand_name:"${term}"`,
    `openfda.substance_name:"${term}"`
  ];
  for (const query of queries) {
    try {
      const url = `https://api.fda.gov/drug/label.json?search=${encodeURIComponent(query)}&limit=1`;
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      if (data?.results?.[0]) return data.results[0];
    } catch {
      continue;
    }
  }
  return null;
}

function medicationOnlinePresentationText(name, rxnav, label) {
  return [
    `Medicamento pesquisado online: ${name}.`,
    rxnav.rxcui ? `Identificador RxNav/RxCUI: ${rxnav.rxcui}.` : "RxNav nao retornou identificador para o termo digitado.",
    `Apresentacoes/formas: ${fieldFromLabel(label, "dosage_forms_and_strengths") || "confirmar em bula brasileira atualizada e farmacia local."}`,
    `Posologia da rotulagem encontrada: ${fieldFromLabel(label, "dosage_and_administration") || "sem posologia automatica disponivel na fonte online consultada."}`,
    "Dose inicial e progressao devem ser definidas pelo medico conforme diagnostico, idade, comorbidades, interacoes, funcao renal/hepatica, gestacao/lactacao e tolerabilidade."
  ].join("\n");
}

function medicationOnlineBestUseText(name, label) {
  return [
    `Medicamento: ${name}.`,
    `Indicacoes descritas na fonte online: ${fieldFromLabel(label, "indications_and_usage") || "nao encontradas automaticamente para este termo."}`,
    "Melhor indicacao clinica: preencher/ajustar pelo medico conforme diagnostico, gravidade, historico de resposta, efeitos adversos esperados, custo e preferencia do paciente."
  ].join("\n");
}

function medicationOnlineSafetyText(label) {
  return [
    `Efeitos adversos: ${fieldFromLabel(label, "adverse_reactions") || "nao encontrados automaticamente."}`,
    `Alertas/cuidados: ${fieldFromLabel(label, "warnings_and_cautions") || fieldFromLabel(label, "warnings") || "nao encontrados automaticamente."}`,
    `Contraindicacoes: ${fieldFromLabel(label, "contraindications") || "nao encontradas automaticamente."}`,
    `Interacoes: ${fieldFromLabel(label, "drug_interactions") || "nao encontradas automaticamente."}`,
    "Conferir sempre bula brasileira, anamnese medicamentosa, alergias, risco suicida, risco de mania/psicose, uso de substancias e necessidade de exames antes da prescricao."
  ].join("\n");
}

function fieldFromLabel(label, key) {
  const value = label?.[key];
  const text = Array.isArray(value) ? value.join("\n") : value || "";
  return compactText(text, 900);
}

function compactText(value, maxLength = 900) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function medicationPriceResearchText(medicationName = "") {
  if (!medicationName) return "";
  const links = medicationPriceLinks(medicationName);
  return [
    `Pesquisa de preco em Fortaleza para: ${medicationName}.`,
    "Confirmar valor final com CEP/localizacao, estoque, desconto, PBM/convenio e apresentacao exata.",
    "",
    ...links.map(link => `- ${link.label}: ${link.url}`)
  ].join("\n");
}

function medicationPriceLinks(medicationName = "") {
  const query = encodeURIComponent(`${medicationName} preco Fortaleza`);
  const pharmacyQuery = encodeURIComponent(medicationName);
  return [
    { label: "Google", url: `https://www.google.com/search?q=${query}` },
    { label: "Consulta Remedios", url: `https://consultaremedios.com.br/busca?termo=${pharmacyQuery}` },
    { label: "Drogasil", url: `https://www.drogasil.com.br/search?w=${pharmacyQuery}` },
    { label: "Drogaria Sao Paulo/Pacheco", url: `https://www.drogariasaopaulo.com.br/search?w=${pharmacyQuery}` },
    { label: "Pague Menos", url: `https://www.paguemenos.com.br/search?q=${pharmacyQuery}` }
  ];
}

function medicationSearchLinks(medicationName) {
  const links = medicationPriceLinks(medicationName);
  return `<div class="internet-links" aria-label="Links de pesquisa de preco">${links.map(link => `<a href="${escapeAttr(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`).join("")}</div>`;
}

function buildTreatmentSuggestion(form) {
  const selectedOption = selectedAiTreatmentOption(form.aiTreatmentOption);
  const agentModel = aiOptionLabel(selectedOption);
  const evidence = summarizeEvidence(form);
  const diagnosisText = normalizeText([
    form.diagnosticoManual,
    form.diferenciais,
    form.diagnosticoObservacaoMedica,
  ].filter(Boolean).join(" | "));
  const plan = treatmentPlanForDiagnosis(diagnosisText);
  const riskTerms = normalizeText([
    anamnesisText(form),
    joinValues(form.eventos),
    joinValues(form.pensamento),
    form.observacoesRetorno,
  ].filter(Boolean).join(" | "));
  const hasRisk = ["ideacao suicida", "tentativa de suicidio", "autoagressao", "risco", "morte"].some(term => riskTerms.includes(term));

  return {
    aiTreatmentOption: agentModel,
    tratamentoMedicamentoso: [
      `Sugestao gerada por ${agentModel}, baseada no diagnostico informado.`,
      `Hipotese usada: ${plan.label}.`,
      "",
      ...plan.medications,
      "",
      "Cuidados antes de prescrever:",
      "- Conferir diagnostico, comorbidades, medicamentos em uso, alergias, idade, gestacao/lactacao, funcao hepatica/renal, risco de interacoes e preferencias do paciente.",
      "- Registrar dose inicial, alvo, ritmo de titulacao, efeitos adversos esperados, sinais de alarme e plano de contato."
    ].join("\n"),
    abordagensTerapeuticas: [
      `Base clinica utilizada: ${evidence || "dados clinicos ainda insuficientes; completar anamnese, exame psiquico e avaliacao de risco antes de finalizar."}`,
      "",
      ...plan.therapies,
      "- Psicoeducacao sobre diagnostico, adesao, sinais de alerta, sono, rotina, atividade fisica progressiva e reducao/abstinencia de alcool e outras substancias conforme o caso.",
      hasRisk
        ? "- Risco identificado nos dados informados: realizar estratificacao formal, plano de seguranca, rede de apoio e considerar urgencia/emergencia se risco atual."
        : "- Reavaliar ideacao suicida, autoagressao, sintomas psicoticos, impulsividade, uso de substancias e suporte familiar em cada contato."
    ].join("\n"),
    examesLaboratoriais: [
      ...plan.exams,
      "- Considerar exames adicionais conforme idade, comorbidades, sinais fisicos, uso de psicofarmacos e risco metabolico/cardiovascular."
    ].join("\n"),
    condutaMedica: [
      "Conduta final do medico:",
      "- Confirmar criterios diagnosticos, gravidade, duracao, prejuizo funcional e exclusoes clinicas/substancias.",
      "- Ajustar escolha terapeutica ao perfil do paciente e documentar decisao compartilhada.",
      "- Definir retorno conforme gravidade, tolerabilidade, adesao e necessidade de monitorizacao."
    ].join("\n"),
    conduta: [
      `Sugestao gerada por ${agentModel}.`,
      `Hipotese usada: ${plan.label}.`,
      "",
      "Plano medicamentoso:",
      ...plan.medications,
      "",
      "Outras abordagens:",
      ...plan.therapies,
      "",
      "Exames:",
      ...plan.exams
    ].join("\n")
  };
}

function treatmentPlanForDiagnosis(diagnosisText) {
  if (diagnosisText.includes("bipolar") || diagnosisText.includes("mania") || diagnosisText.includes("hipomania")) {
    return {
      label: "Transtorno bipolar ou relacionado",
      medications: [
        "- Opcao 1: litio 300 mg a noite ou 300 mg 12/12 h; titular gradualmente conforme resposta, tolerabilidade, funcao renal/tireoidiana e litemia.",
        "- Opcao 2: valproato 250-500 mg a noite ou 12/12 h; progredir conforme resposta e nivel serico quando indicado, evitando em gestacao/risco gestacional.",
        "- Opcao 3: quetiapina 25-50 mg a noite; titular progressivamente conforme alvo clinico, sedacao, peso e parametros metabolicos.",
        "- Evitar antidepressivo isolado quando houver suspeita bipolar."
      ],
      therapies: [
        "- Psicoterapia com foco em ritmo social, adesao, reconhecimento precoce de recaida e prevencao de privacao de sono.",
        "- Envolver familia/rede de apoio quando possivel e orientar sinais de mania, depressao e risco."
      ],
      exams: [
        "- Hemograma, TGO/TGP, GGT, bilirrubinas, ureia, creatinina, sodio, potassio, TSH/T4 livre, glicemia ou HbA1c, perfil lipidico.",
        "- Beta-HCG quando aplicavel, ECG conforme idade/risco, peso, IMC, circunferencia abdominal e pressao arterial.",
        "- Para litio: litemia apos estabilizacao/titulacao, funcao renal, tireoide e calcio conforme seguimento.",
        "- Para valproato: funcao hepatica, plaquetas e nivel serico quando indicado."
      ]
    };
  }
  if (diagnosisText.includes("ansiedade") || diagnosisText.includes("panico")) {
    return {
      label: "Transtorno de ansiedade ou panico",
      medications: [
        "- Opcao 1: sertralina 25 mg/dia por 7 dias, depois 50 mg/dia; titular gradualmente conforme resposta e efeitos adversos.",
        "- Opcao 2: escitalopram 5 mg/dia por 7 dias, depois 10 mg/dia; considerar progressao conforme resposta.",
        "- Opcao 3: venlafaxina XR 37,5 mg/dia, depois 75 mg/dia se indicado; monitorar pressao arterial e tolerabilidade.",
        "- Benzodiazepinico apenas se necessario, por curto prazo, avaliando risco de dependencia, sedacao, quedas e uso de substancias."
      ],
      therapies: [
        "- Terapia cognitivo-comportamental com psicoeducacao, exposicao gradual, manejo de preocupacao e treino respiratorio quando indicado.",
        "- Orientar reducao de cafeina/estimulantes, higiene do sono, atividade fisica e plano para crises."
      ],
      exams: [
        "- Hemograma, TSH/T4 livre, glicemia ou HbA1c, funcao renal/hepatica e B12 conforme contexto.",
        "- ECG se houver sintomas cardiacos, idade/risco cardiovascular ou medicacoes que justifiquem.",
        "- Avaliar uso de substancias, cafeina, estimulantes e causas clinicas de sintomas autonomicos."
      ]
    };
  }
  if (diagnosisText.includes("obsessivo") || diagnosisText.includes("toc")) {
    return {
      label: "Transtorno obsessivo-compulsivo",
      medications: [
        "- Opcao 1: sertralina 25-50 mg/dia; titular gradualmente, podendo necessitar doses maiores conforme resposta e tolerabilidade.",
        "- Opcao 2: fluoxetina 10-20 mg/dia; progredir gradualmente conforme resposta.",
        "- Opcao 3: fluvoxamina 25-50 mg/noite; titular progressivamente observando interacoes e sedacao.",
        "- Em casos resistentes, considerar potencializacao somente apos reavaliar diagnostico, adesao e dose/duracao adequadas."
      ],
      therapies: [
        "- TCC com exposicao e prevencao de resposta como abordagem central.",
        "- Mapear compulsões, evitacoes, acomodacao familiar e prejuizo funcional."
      ],
      exams: [
        "- Hemograma, TSH/T4 livre, funcao renal/hepatica, glicemia ou HbA1c e perfil lipidico conforme medicacao e comorbidades.",
        "- ECG se houver uso de triciclico, risco cardiaco ou associacoes medicamentosas relevantes."
      ]
    };
  }
  if (diagnosisText.includes("psicot") || diagnosisText.includes("esquiz")) {
    return {
      label: "Transtorno psicotico ou sintomas psicoticos",
      medications: [
        "- Opcao 1: risperidona 0,5-1 mg/noite; titular gradualmente conforme resposta, sintomas extrapiramidais e prolactina.",
        "- Opcao 2: olanzapina 2,5-5 mg/noite; titular conforme resposta, monitorando peso, glicemia e lipidios.",
        "- Opcao 3: aripiprazol 5 mg/dia; ajustar conforme resposta, acatisia e tolerabilidade.",
        "- Avaliar necessidade de urgencia, contencao ambiental, rede de apoio e adesao supervisionada."
      ],
      therapies: [
        "- Psicoeducacao, intervencoes familiares, reducao de estresse, manejo de substancias e plano de crise.",
        "- Avaliar funcionalidade, risco, autocuidado e necessidade de acompanhamento intensivo."
      ],
      exams: [
        "- Hemograma, eletrólitos, funcao renal/hepatica, TSH/T4 livre, B12/folato conforme contexto, glicemia ou HbA1c e perfil lipidico.",
        "- Triagem toxicológica quando indicado, beta-HCG quando aplicavel, ECG conforme risco/medicacao.",
        "- Peso, IMC, circunferencia abdominal e pressao arterial antes e durante antipsicotico."
      ]
    };
  }
  return {
    label: diagnosisText ? "Diagnostico informado no prontuario" : "Diagnostico ainda nao preenchido",
    medications: [
      "- Opcao 1: sertralina 25 mg/dia por 7 dias, depois 50 mg/dia, se quadro depressivo/ansioso for confirmado e nao houver sinais de bipolaridade.",
      "- Opcao 2: escitalopram 5 mg/dia por 7 dias, depois 10 mg/dia, se indicado pelo perfil clinico.",
      "- Opcao 3: mirtazapina 15 mg/noite quando insonia/perda ponderal forem relevantes, avaliando sedacao e ganho de peso.",
      "- Se houver suspeita bipolar, psicose, alto risco suicida, gestacao ou comorbidade clinica importante, individualizar e considerar outra classe/encaminhamento."
    ],
    therapies: [
      "- Psicoterapia conforme formulacao do caso: TCC, terapia interpessoal, terapia familiar ou abordagem de apoio.",
      "- Intervencoes de sono, rotina, atividade fisica, manejo de estressores, rede de apoio e reducao de substancias."
    ],
    exams: [
      "- Hemograma, TSH/T4 livre, glicemia ou HbA1c, perfil lipidico, funcao renal/hepatica, sodio, potassio, B12 e vitamina D conforme contexto.",
      "- ECG conforme idade, risco cardiovascular, sintomas, interacoes ou medicacoes com risco de QT.",
      "- Beta-HCG quando aplicavel e exames adicionais conforme achados clinicos."
    ]
  };
}

function buildEvolutionNarrative(form, patient = {}, previous = null, isReturn = false) {
  const agentModel = form.aiEvolutionOption || aiOptionLabel(aiTreatmentOptions[0]);
  const identification = patientIdentificationText(patient);
  const clinicalStory = isReturn ? returnStoryText(form, previous) : consultationStoryText(form);
  const history = historyText(form);
  const mentalState = mentalStateText(form);
  const negatives = relevantNegativeText(form);
  const complementary = complementaryText(form);
  const diagnosis = diagnosisText(form);
  const plan = planText(form);
  const closing = isReturn
    ? "Mantem-se acompanhamento longitudinal, com orientacao para retorno antecipado em caso de piora clinica, efeitos adversos relevantes, risco ou duvidas quanto ao tratamento."
    : "Paciente orientado(a) quanto a hipoteses diagnosticas, opcoes terapeuticas, sinais de alerta, necessidade de seguimento e revisao do plano conforme evolucao clinica.";

  return [
    `Evolucao medica auxiliada por IA (${agentModel}) - rascunho para revisao medica.`,
    "",
    `${identification} ${clinicalStory}`.trim(),
    history,
    mentalState,
    negatives,
    complementary,
    diagnosis,
    plan,
    closing
  ].filter(Boolean).join("\n\n");
}

function patientIdentificationText(patient = {}) {
  const age = calculateAge(patient.nascimento);
  const fragments = [
    patient.nome || "Paciente",
    age ? `${age} anos` : "",
    patient.sexo || "",
    patient.estadoCivil ? patient.estadoCivil.toLowerCase() : "",
    patient.ocupacao ? `ocupacao: ${patient.ocupacao}` : ""
  ].filter(Boolean);
  return `${fragments.join(", ")}.`;
}

function consultationStoryText(form) {
  const qphdaText = anamnesisText(form);
  const parts = [
    qphdaText ? `Comparece para avaliacao psiquiatrica. Registro de QP e HDA: ${qphdaText}` : "Comparece para avaliacao psiquiatrica.",
    form.inicio ? `O inicio foi caracterizado como ${form.inicio.toLowerCase()}.` : "",
    form.curso ? `O curso referido foi ${form.curso.toLowerCase()}.` : "",
    joinValues(form.fatores) ? `Fatores associados ou desencadeantes registrados: ${joinValues(form.fatores)}${form.fatoresOutro ? ` (${form.fatoresOutro})` : ""}.` : "",
    joinValues(form.fatoresPiora) ? `Refere piora com ${joinValues(form.fatoresPiora)}${form.fatoresPioraOutro ? ` (${form.fatoresPioraOutro})` : ""}.` : "",
    joinValues(form.fatoresMelhora) ? `Aponta melhora com ${joinValues(form.fatoresMelhora)}${form.fatoresMelhoraOutro ? ` (${form.fatoresMelhoraOutro})` : ""}.` : "",
    joinValues(form.impacto) ? `Ha impacto funcional descrito como: ${joinValues(form.impacto)}.` : ""
  ].filter(Boolean);
  return parts.join(" ");
}

function returnStoryText(form, previous) {
  const parts = [
    previous ? `Retorna apos registro previo de ${new Date(previous.createdAt || Date.now()).toLocaleDateString("pt-BR")}.` : "Comparece para retorno psiquiatrico.",
    form.estadoGeral ? `Desde a ultima avaliacao, refere evolucao global: ${form.estadoGeral.toLowerCase()}.` : "",
    form.sintomasPrincipais ? `Quanto aos sintomas principais, informa: ${form.sintomasPrincipais.toLowerCase()}.` : "",
    form.sonoRetorno ? `Sono: ${form.sonoRetorno.toLowerCase()}.` : "",
    form.humorRetorno ? `Humor predominante: ${form.humorRetorno.toLowerCase()}.` : "",
    form.ansiedadeRetorno ? `Ansiedade: ${form.ansiedadeRetorno.toLowerCase()}.` : "",
    form.funcionalidade ? `Funcionalidade: ${form.funcionalidade.toLowerCase()}.` : "",
    form.adesao ? `Adesao ao tratamento: ${form.adesao.toLowerCase()}.` : "",
    joinValues(form.efeitos) ? `Efeitos colaterais registrados: ${joinValues(form.efeitos)}.` : "",
    joinValues(form.eventos) ? `Eventos relevantes no periodo: ${joinValues(form.eventos)}.` : "",
    form.observacoesRetorno ? `Observacoes clinicas adicionais: ${form.observacoesRetorno}` : ""
  ].filter(Boolean);
  return parts.join(" ");
}

function historyText(form) {
  const parts = [
    joinValues(form.psiPrevios) ? `Antecedentes psiquiatricos: ${joinValues(form.psiPrevios)}${form.psiPreviosOutro ? ` (${form.psiPreviosOutro})` : ""}.` : "",
    joinValues(form.tratamentos) ? `Tratamentos previos: ${joinValues(form.tratamentos)}${form.tratamentosOutro ? ` (${form.tratamentosOutro})` : ""}.` : "",
    joinValues(form.medicos) ? `Antecedentes clinicos: ${joinValues(form.medicos)}${form.medicosOutro ? ` (${form.medicosOutro})` : ""}.` : "",
    joinValues(form.familiares) ? `Antecedentes familiares: ${joinValues(form.familiares)}${form.familiaresOutro ? ` (${form.familiaresOutro})` : ""}.` : "",
    joinValues(form.substancias) ? `Habitos/substancias: ${joinValues(form.substancias)}${form.substanciasOutro ? ` (${form.substanciasOutro})` : ""}.` : ""
  ].filter(Boolean);
  return parts.length ? `Antecedentes e contexto: ${parts.join(" ")}` : "";
}

function mentalStateText(form) {
  const groups = [
    ["apresentacao", "apresentacao"],
    ["consciencia", "consciencia, orientacao e atencao"],
    ["memoria", "memoria"],
    ["sensopercepcao", "sensopercepcao"],
    ["pensamento", "pensamento"],
    ["linguagem", "linguagem"],
    ["juizo", "juizo, critica e insight"],
    ["afetividade", "afetividade"],
    ["humor", "humor"],
    ["vontade", "vontade/pragmatismo"],
    ["psicomotricidade", "psicomotricidade"],
    ["inteligencia", "funcionamento intelectual"]
  ];
  const findings = groups
    .map(([key, label]) => joinValues(form[key]) ? `${label}: ${joinValues(form[key])}${form[`${key}Outro`] ? ` (${form[`${key}Outro`]})` : ""}` : "")
    .filter(Boolean);
  return findings.length ? `Ao exame psiquico, observou-se ${findings.join("; ")}.` : "";
}

function relevantNegativeText(form) {
  const negativeFindings = [
    ...negativeValues("impacto", form.impacto),
    ...negativeValues("sensopercepcao", form.sensopercepcao),
    ...negativeValues("pensamento", form.pensamento),
    ...negativeValues("juizo", form.juizo),
    ...negativeValues("apresentacao", form.apresentacao),
    ...negativeValues("consciencia", form.consciencia),
    ...negativeValues("memoria", form.memoria),
    ...negativeValues("linguagem", form.linguagem),
    ...negativeValues("afetividade", form.afetividade),
    ...negativeValues("vontade", form.vontade),
    ...negativeValues("psicomotricidade", form.psicomotricidade),
    ...negativeValues("efeitos", form.efeitos),
    ...negativeValues("ansiedadeRetorno", form.ansiedadeRetorno)
  ];
  return negativeFindings.length ? `Achados negativos ou preservados registrados: ${uniqueValues(negativeFindings).join("; ")}.` : "";
}

function negativeValues(label, value) {
  return valueList(value).filter(item => {
    const text = normalizeText(item);
    return text.startsWith("sem ") || text.includes("preservad") || text === "nenhum" || text === "ausente";
  }).map(item => `${label}: ${item}`);
}

function diagnosisText(form) {
  const parts = [
    form.diagnosticoManual ? `Hipotese diagnostica principal: ${form.diagnosticoManual}` : "",
    form.diferenciais ? `Diagnosticos diferenciais considerados: ${form.diferenciais}` : "",
    form.diagnosticoObservacaoMedica ? `Observacao medica: ${form.diagnosticoObservacaoMedica}` : ""
  ].filter(Boolean);
  return parts.join("\n");
}

function planText(form) {
  const parts = [
    form.tratamentoMedicamentoso ? `Tratamento medicamentoso proposto/discutido: ${form.tratamentoMedicamentoso}` : "",
    form.medicationGeneric ? `Medicamento pesquisado: ${form.medicationGeneric}.` : "",
    form.medicationPresentation ? `Apresentacao/posologia pesquisada: ${form.medicationPresentation}` : "",
    form.abordagensTerapeuticas ? `Outras abordagens terapeuticas: ${form.abordagensTerapeuticas}` : "",
    form.examesLaboratoriais ? `Exames complementares sugeridos: ${form.examesLaboratoriais}` : "",
    form.condutaMedica ? `Conduta medica registrada: ${form.condutaMedica}` : "",
    form.manualPrice ? `Observacao de preco/farmacia: ${form.manualPrice}` : ""
  ].filter(Boolean);
  return parts.length ? `Plano e orientacoes: ${parts.join("\n")}` : "";
}

function complementaryText(form) {
  const vitals = [
    form.pa ? `PA ${form.pa}` : "",
    form.fc ? `FC ${form.fc}` : "",
    form.fr ? `FR ${form.fr}` : "",
    form.temperatura ? `temperatura ${form.temperatura}` : "",
    form.peso ? `peso ${form.peso}` : "",
    form.altura ? `altura ${form.altura}` : "",
    form.imc ? `IMC ${form.imc}` : "",
    form.cintura ? `cintura ${form.cintura}` : ""
  ].filter(Boolean);
  const parts = [
    vitals.length ? `Dados fisicos/vitais registrados: ${vitals.join(", ")}.` : "",
    form.fisico ? `Achados fisicos e neurologicos relevantes: ${form.fisico}` : ""
  ].filter(Boolean);
  return parts.join(" ");
}

function valueList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function lowerFirst(value = "") {
  const text = String(value).trim();
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : "";
}

function aiOptionLabel(option) {
  return `${option.agent} - ${option.model}`;
}

function selectedAiTreatmentOption(value) {
  return aiTreatmentOptions.find(option => aiOptionLabel(option) === value) || aiTreatmentOptions[0];
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
  const qphdaText = anamnesisText(form);
  return [
    qphdaText && `QP/HDA: ${qphdaText}`,
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

function anamnesisText(form = {}) {
  return form.qphda || [form.queixa && `QP: ${form.queixa}`, form.historia && `HDA: ${form.historia}`].filter(Boolean).join("\n");
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
    consultationPage = "evolucao";
    view = "consultation";
  } else {
    draft.return = structuredClone(entry);
    returnPage = "texto-retorno";
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
