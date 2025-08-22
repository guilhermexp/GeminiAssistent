/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI} from '@google/genai';
import {
  getYouTubeVideoId,
  getYouTubeVideoTitle,
  getYoutubeEmbedUrl,
  isValidUrl,
} from './youtube-utils';
import {scrapeUrl} from './firecrawl-utils';
import {fetchWithRetry} from './utils';
import type {Analysis, AnalysisCallbacks, AnalysisResult} from './types';

// =================================================================
// ANALYSIS SERVICE
// Encapsulates all logic for fetching and analyzing content.
// =================================================================
export class AnalysisService {
  private client: GoogleGenAI;

  constructor(client: GoogleGenAI) {
    this.client = client;
  }

  public async analyze(
    urlOrTopic: string,
    file: File | null,
    analysisMode: 'default' | 'vibecode' | 'workflow',
    callbacks: AnalysisCallbacks,
  ): Promise<AnalysisResult> {
    if (file) {
      const result = await this.analyzeFile(file, analysisMode, callbacks);
      return result;
    } else {
      const input = urlOrTopic.trim();
      if (isValidUrl(input)) {
        return this.analyzeUrl(input, analysisMode, callbacks);
      } else {
        return this.performDeepSearch(input, callbacks);
      }
    }
  }

  private async analyzeContentAndGenerateSummary(
    contents: any,
    generateContentConfig: any,
  ): Promise<string> {
    const response = await this.client.models.generateContent({
      ...generateContentConfig,
      contents,
    });
    const text = response.text;
    if (!text?.trim()) {
      throw new Error('A análise retornou um resultado vazio.');
    }
    return text;
  }

  private createWorker(): Worker {
    const workerCode = `
      importScripts(
        "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
        "https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js"
      );

      self.onmessage = async (event) => {
        const { file } = event.data;
        const fileName = file.name.toLowerCase();
        const mimeType = file.type;

        try {
          let result;

          if (
            fileName.endsWith('.csv') || mimeType === 'text/csv' ||
            fileName.endsWith('.xlsx') || mimeType.includes('spreadsheet') || fileName.endsWith('.xls')
          ) {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = self.XLSX.read(arrayBuffer, { type: 'array' });
            const sheetNames = workbook.SheetNames;
            let fullCsvContent = '';
            for (const sheetName of sheetNames) {
              const worksheet = workbook.Sheets[sheetName];
              const csv = self.XLSX.utils.sheet_to_csv(worksheet);
              fullCsvContent += \`--- INÍCIO DA PLANILHA: \${sheetName} ---\\n\\n\${csv}\\n\\n--- FIM DA PLANILHA: \${sheetName} ---\\n\\n\`;
            }
            result = { type: 'csv', content: fullCsvContent, mimeType };
          } else if (
            fileName.endsWith('.doc') || fileName.endsWith('.docx') || mimeType.includes('wordprocessingml')
          ) {
            const arrayBuffer = await file.arrayBuffer();
            const { value: textContent } = await self.mammoth.extractRawText({ arrayBuffer });
            result = { type: 'text', content: textContent, mimeType };
          } else if (
            fileName.endsWith('.md') || mimeType === 'text/markdown' ||
            fileName.endsWith('.xlm') || mimeType === 'application/xml' || mimeType === 'text/xml'
          ) {
            const textContent = await file.text();
            result = { type: 'text', content: textContent, mimeType };
          } else {
              // For images, videos, and PDFs, which don't require heavy CPU parsing, we'll just get the base64 data.
               const base64 = await new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.readAsDataURL(file);
                  reader.onload = () => resolve((reader.result).split(',')[1]);
                  reader.onerror = (error) => reject(error);
              });
              result = { type: 'base64', content: base64, mimeType };
          }
          
          self.postMessage({ success: true, result });
        } catch (error) {
          self.postMessage({ success: false, error: error.message });
        }
      };
    `;
    const blob = new Blob([workerCode], {type: 'application/javascript'});
    return new Worker(URL.createObjectURL(blob));
  }

  private processFileInWorker(file: File): Promise<any> {
    return new Promise((resolve, reject) => {
      const worker = this.createWorker();
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(
          new Error(
            'O processamento do arquivo demorou muito e foi cancelado.',
          ),
        );
      }, 30000); // 30 second timeout
      worker.onmessage = (event) => {
        clearTimeout(timeout);
        if (event.data.success) {
          resolve(event.data.result);
        } else {
          reject(new Error(event.data.error));
        }
        worker.terminate();
      };
      worker.onerror = (error) => {
        clearTimeout(timeout);
        reject(new Error(`Erro no worker de processamento: ${error.message}`));
        worker.terminate();
      };
      worker.postMessage({file});
    });
  }

  private createHtmlPreview(text: string, title: string): string {
    // Sanitize text for HTML display
    const sanitizedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Preview: ${title}</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
            color: #e0e0e0; 
            background-color: #121212;
            margin: 0;
            padding: 1.5em;
          }
          pre {
            white-space: pre-wrap;
            word-break: break-word;
            font-size: 14px;
            line-height: 1.6;
          }
        </style>
      </head>
      <body><pre>${sanitizedText}</pre></body>
      </html>
    `;
    // Use btoa for base64 encoding. Need to handle Unicode characters correctly.
    const base64 = btoa(unescape(encodeURIComponent(htmlContent)));
    return `data:text/html;base64,${base64}`;
  }

  private async analyzeFile(
    file: File,
    analysisMode: 'default' | 'vibecode' | 'workflow',
    callbacks: AnalysisCallbacks,
  ): Promise<AnalysisResult> {
    const {setProcessingState, logEvent} = callbacks;
    const contentTitle = file.name;
    const contentSource = 'Arquivo Local';
    const fileName = file.name.toLowerCase();

    setProcessingState(true, `Processando arquivo...`, 20);
    logEvent(`Processando arquivo: ${contentTitle}`, 'process');

    const processedData = await this.processFileInWorker(file);
    const {type: processedType, content, mimeType} = processedData;

    let contents: any;
    let persona: Analysis['persona'] = 'assistant';
    let type: Analysis['type'] = 'file';
    let previewData: string | undefined = undefined;
    const generateContentConfig: any = {model: 'gemini-2.5-flash'};

    if (mimeType.startsWith('image/')) {
      setProcessingState(true, `Analisando imagem...`, 50);
      previewData = `data:${mimeType};base64,${content}`;
      const analysisPrompt =
        'Analise esta imagem em detalhes. Descreva todos os elementos visuais, o contexto e quaisquer textos visíveis. Lembre-se, sua resposta deve ser inteiramente em português do Brasil.';
      contents = {
        parts: [
          {text: analysisPrompt},
          {inlineData: {mimeType, data: content}},
        ],
      };
    } else if (mimeType.startsWith('video/')) {
      type = 'video';
      setProcessingState(true, `Analisando vídeo...`, 50);
      previewData = `data:${mimeType};base64,${content}`;
      let analysisPrompt: string;
      if (analysisMode === 'vibecode') {
        type = 'video';
        analysisPrompt = `Você é um especialista em engenharia reversa de interfaces de aplicativos em modo 'Vibecode'. Sua tarefa é analisar este vídeo, que demonstra o uso de um aplicativo, e fornecer uma análise visual e funcional detalhada, passo a passo, para que um desenvolvedor possa recriar a funcionalidade. Sua resposta deve ser em português do Brasil e estruturada da seguinte forma:\n\n1.  **Visão Geral da Interface (UI):** Descreva o layout principal, paleta de cores, tipografia e componentes visíveis.\n2.  **Fluxo de Interação Passo a Passo:** Narre a jornada do usuário no vídeo. Para cada ação, descreva: Ação do Usuário, Elemento Interagido e Feedback Visual/Resultado.\n3.  **Análise de Ferramentas e Funcionalidades:** Para cada funcionalidade, detalhe: Propósito, Inputs, Lógica Inferida e Outputs.\n\nSeja meticuloso com todos os detalhes visuais. Este resumo será seu único conhecimento sobre o vídeo.`;
      } else if (analysisMode === 'workflow') {
        type = 'workflow';
        generateContentConfig.config = {responseMimeType: 'application/json'};
        analysisPrompt = `Você é um especialista em n8n. Sua tarefa é analisar este vídeo que demonstra um fluxo de trabalho (workflow) do n8n e extrair sua estrutura completa. O resultado final DEVE ser um objeto JSON único contendo duas chaves: "summary_base64" e "workflow_json".

1.  **summary_base64**: Crie um resumo detalhado em markdown explicando o propósito geral, cada nó, sua função e como estão conectados. Em seguida, codifique esta string markdown em Base64. Este campo deve conter APENAS a string Base64.
2.  **workflow_json**: Um objeto JSON válido que representa o fluxo de trabalho e pode ser importado diretamente no n8n. Analise meticulosamente os nós, seus parâmetros e as conexões para construir este JSON. Siga a estrutura padrão do n8n com as chaves "name", "nodes", "connections", "active", "settings", etc.

Sua resposta deve ser APENAS o objeto JSON, sem nenhum texto adicional antes ou depois.`;
      } else {
        type = 'video';
        analysisPrompt =
        'Você é um assistente multimodal. Analise este vídeo em detalhes. Descreva todos os elementos visuais e de áudio, o contexto e quaisquer textos visíveis. Crie um resumo detalhado. Lembre-se, sua resposta deve ser inteiramente em português do Brasil.';
      }

      contents = {
        parts: [
          {text: analysisPrompt},
          {inlineData: {mimeType, data: content}},
        ],
      };
    } else if (mimeType === 'application/pdf') {
      setProcessingState(true, `Analisando PDF...`, 50);
      previewData = `data:${mimeType};base64,${content}`;
      const analysisPrompt =
        'Analise este documento PDF. Extraia um resumo detalhado, os pontos principais e quaisquer conclusões importantes. Lembre-se, sua resposta deve ser inteiramente em português do Brasil.';
      contents = {
        parts: [
          {text: analysisPrompt},
          {inlineData: {mimeType, data: content}},
        ],
      };
    } else if (processedType === 'csv') {
      persona = 'analyst';
      type = 'spreadsheet';
      setProcessingState(true, `Analisando planilha...`, 50);
      previewData = this.createHtmlPreview(content, contentTitle);
      const analysisPrompt = `Você é um analista de dados especialista. O seguinte texto contém dados extraídos de uma planilha, possivelmente com múltiplas abas, em formato CSV. Sua tarefa é analisar esses dados profundamente. Lembre-se, sua resposta deve ser inteiramente em português do Brasil.

**Análise Requerida:**
1.  **Resumo Geral:** Forneça uma visão geral dos dados.
2.  **Estrutura dos Dados:** Identifique as colunas e o tipo de dados que elas contêm.
3.  **Principais Métricas:** Calcule ou identifique métricas importantes (médias, totais, contagens, etc.).
4.  **Insights e Tendências:** Aponte quaisquer padrões, correlações ou tendências interessantes que você observar.

Este resumo detalhado será seu único conhecimento sobre a planilha. Prepare-se para responder a perguntas específicas sobre ela.

--- CONTEÚDO DA PLANILHA ---
${content}`;
      contents = {parts: [{text: analysisPrompt}]};
    } else if (processedType === 'text') {
      let analysisPrompt: string;
      const isXml =
        fileName.endsWith('.xlm') ||
        mimeType === 'application/xml' ||
        mimeType === 'text/xml';
      const isMarkdown =
        fileName.endsWith('.md') || mimeType === 'text/markdown';
      setProcessingState(true, `Analisando documento...`, 50);
      previewData = this.createHtmlPreview(content, contentTitle);

      if (isXml) {
        analysisPrompt = `Analise este documento XML. Descreva a sua estrutura de dados, os elementos principais e o propósito geral do conteúdo. Lembre-se, sua resposta deve ser inteiramente em português do Brasil.

--- CONTEÚDO DO XML ---
${content}`;
      } else if (isMarkdown) {
        analysisPrompt = `Analise este documento Markdown. Extraia um resumo detalhado, os pontos principais, a estrutura dos títulos e quaisquer conclusões importantes. Lembre-se, sua resposta deve ser inteiramente em português do Brasil.

--- CONTEÚDO DO MARKDOWN ---
${content}`;
      } else {
        analysisPrompt = `Analise este documento de texto. Extraia um resumo detalhado, os pontos principais e quaisquer conclusões importantes. Lembre-se, sua resposta deve ser inteiramente em português do Brasil.

--- CONTEÚDO DO DOCUMENTO ---
${content}`;
      }
      contents = {parts: [{text: analysisPrompt}]};
    } else {
      throw new Error(
        `Tipo de arquivo não suportado: ${
          mimeType || fileName
        }. Por favor, use imagens, PDFs, planilhas ou documentos.`,
      );
    }
    const summary = await this.analyzeContentAndGenerateSummary(
      contents,
      generateContentConfig,
    );
    return {
      summary,
      title: contentTitle,
      source: contentSource,
      persona,
      type,
      previewData,
    };
  }

  private async analyzeYouTubeUrl(
    url: string,
    analysisMode: 'default' | 'vibecode' | 'workflow',
    callbacks: AnalysisCallbacks,
  ): Promise<AnalysisResult> {
    const {setProcessingState, logEvent} = callbacks;
    setProcessingState(true, 'Buscando informações do vídeo...', 15);
    const title = await getYouTubeVideoTitle(url);
    const embedUrl = getYoutubeEmbedUrl(url);
    setProcessingState(true, 'Analisando vídeo com IA...', 50);
    logEvent(`Analisando YouTube: ${title}`, 'process');

    let analysisPrompt: string;
    let type: Analysis['type'] = 'youtube';
    const generateContentConfig: any = {model: 'gemini-2.5-flash'};

    if (analysisMode === 'vibecode') {
      analysisPrompt = `Você é um especialista em engenharia reversa de interfaces de aplicativos em modo 'Vibecode'. Sua tarefa é analisar o vídeo do YouTube intitulado "${title}", que demonstra o uso de um aplicativo, e fornecer uma análise visual e funcional detalhada, passo a passo, para que um desenvolvedor possa recriar a funcionalidade. Sua resposta deve ser em português do Brasil e estruturada da seguinte forma:\n\n1.  **Visão Geral da Interface (UI):** Descreva o layout principal, paleta de cores, tipografia e componentes visíveis.\n2.  **Fluxo de Interação Passo a Passo:** Narre a jornada do usuário no vídeo. Para cada ação, descreva: Ação do Usuário, Elemento Interagido e Feedback Visual/Resultado.\n3.  **Análise de Ferramentas e Funcionalidades:** Para cada funcionalidade, detalhe: Propósito, Inputs, Lógica Inferida e Outputs.\n\nSeja meticuloso com todos os detalhes visuais. Este resumo será seu único conhecimento sobre o vídeo.`
    } else if (analysisMode === 'workflow') {
        type = 'workflow';
        generateContentConfig.config = {responseMimeType: 'application/json'};
        analysisPrompt = `Você é um especialista em n8n. Sua tarefa é analisar este vídeo do YouTube intitulado "${title}" que demonstra um fluxo de trabalho (workflow) do n8n e extrair sua estrutura completa. O resultado final DEVE ser um objeto JSON único contendo duas chaves: "summary_base64" e "workflow_json".

1.  **summary_base64**: Crie um resumo detalhado em markdown explicando o propósito geral, cada nó, sua função e como estão conectados. Em seguida, codifique esta string markdown em Base64. Este campo deve conter APENAS a string Base64.
2.  **workflow_json**: Um objeto JSON válido que representa o fluxo de trabalho e pode ser importado diretamente no n8n. Analise meticulosamente os nós, seus parâmetros e as conexões para construir este JSON. Siga a estrutura padrão do n8n com as chaves "name", "nodes", "connections", "active", "settings", etc.

Sua resposta deve ser APENAS o objeto JSON, sem nenhum texto adicional antes ou depois.`;
    } else {
      analysisPrompt = `Você é um assistente multimodal. Analise o vídeo do YouTube intitulado "${title}" a partir da URL fornecida de forma completa, processando tanto o áudio quanto os quadros visuais. Crie um resumo detalhado para que você possa responder perguntas sobre o vídeo. Sua análise deve incluir:
1. **Conteúdo Falado**: Tópicos principais, argumentos e conclusões.
2. **Análise Visual**: Descrição de cenas importantes, pessoas (e suas ações ou aparências, como cor de roupa), objetos, textos na tela e o ambiente geral.
3. **Eventos Chave**: Uma cronologia de eventos importantes, combinando informações visuais e de áudio, com timestamps se possível.

Seja o mais detalhado possível. Este resumo será seu único conhecimento sobre o vídeo. Lembre-se, sua resposta deve ser inteiramente em português do Brasil.`;
    }

    const contents = {
      parts: [
        {text: analysisPrompt},
        {fileData: {mimeType: 'video/mp4', fileUri: url}},
      ],
    };

    const summary = await this.analyzeContentAndGenerateSummary(
      contents,
      generateContentConfig,
    );
    return {
      summary,
      title,
      source: url,
      persona: 'assistant',
      type: type,
      previewData: embedUrl ?? undefined,
    };
  }

  private parseGitHubUrl(url: string) {
    const repoMatch = url.match(/github\.com\/([^\/]+\/[^\/]+)/);
    if (!repoMatch) return null;
    const repoPath = repoMatch[1].replace(/\.git$/, '').replace(/\/$/, '');
    const [owner, repo] = repoPath.split('/');
    return {owner, repo};
  }

  private async fetchGitHubRepoInfo(
    owner: string,
    repo: string,
    callbacks: AnalysisCallbacks,
  ) {
    const {setProcessingState} = callbacks;
    setProcessingState(true, `Buscando README...`, 25);
    const readmeResponse = await fetchWithRetry(
      `https://api.github.com/repos/${owner}/${repo}/readme`,
    );

    let readmeContent = '';
    if (readmeResponse.ok) {
      const readmeData = await readmeResponse.json();
      readmeContent = atob((readmeData.content || '').replace(/\s/g, ''));
    } else if (readmeResponse.status !== 404) {
      // If it's not 404, and not ok, then it's an actual error.
      // A 404 just means no README, which is fine.
      throw new Error(
        `Não foi possível buscar o README do repositório ${owner}/${repo}. Status: ${readmeResponse.status}`,
      );
    }

    setProcessingState(true, `Buscando estrutura de arquivos...`, 40);
    const repoInfoResponse = await fetchWithRetry(
      `https://api.github.com/repos/${owner}/${repo}`,
    );
    if (repoInfoResponse.status === 404) {
      throw new Error(
        `Repositório não encontrado ou é privado: ${owner}/${repo}.`,
      );
    }
    if (!repoInfoResponse.ok) {
      throw new Error(
        `Não foi possível buscar informações do repositório ${owner}/${repo}.`,
      );
    }
    const repoInfo = await repoInfoResponse.json();
    const defaultBranch = repoInfo.default_branch;

    const treeResponse = await fetchWithRetry(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
    );
    if (!treeResponse.ok) {
      throw new Error(
        `Não foi possível buscar a estrutura de arquivos de ${owner}/${repo}.`,
      );
    }
    const treeData = await treeResponse.json();
    const fileTreeText = treeData.tree
      .map((file: any) => file.path)
      .join('\n');

    return {readmeContent, fileTreeText, isTruncated: treeData.truncated};
  }

  private async analyzeGitHubUrl(
    url: string,
    callbacks: AnalysisCallbacks,
  ): Promise<AnalysisResult> {
    const {setProcessingState, logEvent} = callbacks;
    const repoParts = this.parseGitHubUrl(url);
    if (!repoParts) {
      throw new Error(
        'URL do GitHub inválida. Use o formato https://github.com/owner/repo.',
      );
    }
    const {owner, repo} = repoParts;
    const contentTitle = `${owner}/${repo}`;
    logEvent(`Iniciando análise do repositório: ${contentTitle}`, 'process');
    const {readmeContent, fileTreeText, isTruncated} =
      await this.fetchGitHubRepoInfo(owner, repo, callbacks);
    if (isTruncated) {
      logEvent(
        'A estrutura de arquivos é muito grande e foi truncada.',
        'info',
      );
    }
    setProcessingState(true, `Analisando com IA...`, 50);
    const analysisPrompt = `Você é um especialista em análise de repositórios do GitHub. Analise o seguinte repositório: "${contentTitle}".
Abaixo estão o conteúdo do arquivo README.md e a estrutura de arquivos do projeto.
Sua tarefa é criar um resumo detalhado para que você possa responder a perguntas sobre o repositório. Sua análise deve incluir:
1. **Propósito do Repositório**: Qual problema ele resolve? Qual é o seu objetivo principal?
2. **Tecnologias Utilizadas**: Com base na estrutura de arquivos e no README, quais são as principais linguagens, frameworks e ferramentas usadas?
3. **Como Começar**: Como um novo desenvolvedor poderia configurar e rodar o projeto?
4. **Estrutura do Projeto**: Descreva a organização das pastas e arquivos importantes.

Seja o mais detalhado possível. Este resumo será seu único conhecimento sobre o repositório. Lembre-se, sua resposta deve ser inteiramente em português do Brasil.

--- CONTEÚDO DO README.md ---
${readmeContent}

--- ESTRUTURA DE ARQUIVOS ---
${fileTreeText}
`;
    const response = await this.client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: analysisPrompt,
      config: {
        tools: [{googleSearch: {}}],
      },
    });
    const summary = response.text;
    if (!summary?.trim()) {
      throw new Error('A análise do GitHub retornou um resultado vazio.');
    }
    return {
      summary,
      title: contentTitle,
      source: `GitHub: ${url}`,
      persona: 'assistant',
      type: 'github',
    };
  }

  private async analyzeGoogleSheetUrl(
    url: string,
    callbacks: AnalysisCallbacks,
  ): Promise<AnalysisResult> {
    const {setProcessingState, logEvent} = callbacks;
    setProcessingState(true, `Acessando Google Sheet...`, 20);
    logEvent('Analisando Google Sheets', 'process');
    const sheetKeyMatch = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!sheetKeyMatch) {
      throw new Error('URL do Google Sheets inválida.');
    }
    const sheetKey = sheetKeyMatch[1];
    const scrapeResult = await scrapeUrl(url);
    const contentTitle =
      (scrapeResult.data && scrapeResult.data.metadata.title) ||
      'Planilha do Google';
    const csvExportUrl = `https://docs.google.com/spreadsheets/d/${sheetKey}/export?format=csv`;
    const response = await fetchWithRetry(csvExportUrl);
    if (!response.ok) {
      throw new Error(
        'Falha ao buscar dados da planilha. Verifique se ela é pública.',
      );
    }
    const csvData = await response.text();
    setProcessingState(true, `Analisando com IA...`, 50);
    const analysisPrompt = `Você é um analista de dados especialista. O seguinte texto contém dados extraídos de uma planilha do Google Sheets, em formato CSV. Sua tarefa é analisar esses dados profundamente. Lembre-se, sua resposta deve ser inteiramente em português do Brasil.

**Análise Requerida:**
1.  **Resumo Geral:** Forneça uma visão geral dos dados.
2.  **Principais Métricas:** Identifique e resuma as métricas chave.
3.  **Insights e Tendências:** Aponte padrões ou tendências importantes.

Prepare-se para responder a perguntas específicas sobre a planilha.

--- CONTEÚDO DA PLANILHA ---
${csvData}`;
    const contents = {parts: [{text: analysisPrompt}]};
    const generateContentConfig = {model: 'gemini-2.5-flash'};
    const summary = await this.analyzeContentAndGenerateSummary(
      contents,
      generateContentConfig,
    );
    return {
      summary,
      title: contentTitle,
      source: url,
      persona: 'analyst',
      type: 'spreadsheet',
    };
  }

  private async analyzeGenericUrl(
    url: string,
    callbacks: AnalysisCallbacks,
  ): Promise<AnalysisResult> {
    const {setProcessingState, logEvent} = callbacks;
    const logMsg = url.includes('docs.google.com/document/')
      ? 'Analisando Google Docs'
      : `Analisando URL`;
    setProcessingState(true, 'Extraindo conteúdo da URL...', 25);
    logEvent(logMsg, 'process');
    const scrapeResult = await scrapeUrl(url);
    if (!scrapeResult.success || !scrapeResult.data) {
      throw new Error(
        scrapeResult.error || 'Falha ao extrair conteúdo da URL.',
      );
    }
    const contentTitle = scrapeResult.data.metadata.title || url;
    const scrapedMarkdown = scrapeResult.data.markdown;
    setProcessingState(true, 'Analisando ...', 50);
    const analysisPrompt = `O seguinte é o conteúdo em markdown de uma página da web. Analise-o e extraia um resumo detalhado, os pontos principais e as conclusões. Prepare-se para responder a perguntas sobre ele. Lembre-se, sua resposta deve ser inteiramente em português do Brasil.

--- CONTEÚDO DA PÁGINA ---
${scrapedMarkdown}`;
    const contents = {parts: [{text: analysisPrompt}]};
    const generateContentConfig = {model: 'gemini-2.5-flash'};
    const summary = await this.analyzeContentAndGenerateSummary(
      contents,
      generateContentConfig,
    );
    return {
      summary,
      title: contentTitle,
      source: url,
      persona: 'assistant',
      type: 'url',
    };
  }

  private async performDeepSearch(
    topic: string,
    callbacks: AnalysisCallbacks,
  ): Promise<AnalysisResult> {
    const {setProcessingState, logEvent} = callbacks;
    const contentTitle = topic;
    const contentSource = 'Pesquisa Aprofundada na Web';

    const displayTopic =
      topic.length > 25 ? `${topic.substring(0, 22)}...` : topic;
    setProcessingState(true, `Pesquisando: "${displayTopic}"`, 50);

    logEvent(`Iniciando pesquisa sobre: "${contentTitle}"`, 'process');
    const analysisPrompt = `Realize uma pesquisa aprofundada e abrangente sobre o seguinte tópico: "${contentTitle}".
Sua tarefa é atuar como um pesquisador especialista. Use o Google Search para reunir informações de diversas fontes confiáveis.
Após a pesquisa, sintetize os resultados em uma análise estruturada e detalhada. A análise deve ser formatada em markdown e cobrir os seguintes pontos:

- **Introdução**: Uma visão geral do tópico.
- **Principais Conceitos**: Definições e explicações dos termos-chave.
- **Estado da Arte**: O status atual, incluindo os desenvolvimentos mais recentes e dados relevantes.
- **Impactos e Implicações**: As consequências positivas e negativas do tópico em diferentes áreas.
- **Desafios e Controvérsias**: Quais são os principais obstáculos, debates ou críticas associados.
- **Perspectivas Futuras**: O que esperar para o futuro, incluindo tendências e previsões.
- **Conclusão**: Um resumo dos pontos mais importantes.

Lembre-se, sua resposta deve ser inteiramente em português do Brasil.`;
    const response = await this.client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: analysisPrompt,
      config: {
        tools: [{googleSearch: {}}],
      },
    });
    const summary = response.text;
    if (!summary?.trim()) {
      throw new Error('A pesquisa aprofundada retornou um resultado vazio.');
    }
    return {
      summary,
      title: contentTitle,
      source: contentSource,
      persona: 'assistant',
      type: 'search',
    };
  }

  private async analyzeUrl(
    url: string,
    analysisMode: 'default' | 'vibecode' | 'workflow',
    callbacks: AnalysisCallbacks,
  ): Promise<AnalysisResult> {
    if (getYouTubeVideoId(url)) {
      return this.analyzeYouTubeUrl(url, analysisMode, callbacks);
    } else if (url.includes('github.com/')) {
      return this.analyzeGitHubUrl(url, callbacks);
    } else if (url.includes('docs.google.com/spreadsheets/')) {
      return this.analyzeGoogleSheetUrl(url, callbacks);
    } else {
      return this.analyzeGenericUrl(url, callbacks);
    }
  }
}