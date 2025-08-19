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
    callbacks: AnalysisCallbacks,
  ): Promise<AnalysisResult> {
    if (file) {
      const result = await this.analyzeFile(file, callbacks);
      return result;
    } else {
      const input = urlOrTopic.trim();
      if (isValidUrl(input)) {
        return this.analyzeUrl(input, callbacks);
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
        "https://cdn.jsdelivr.net/npm/mammoth@1.7.2/mammoth.browser.min.js"
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

  private async analyzeFile(
    file: File,
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
    const generateContentConfig: any = {model: 'gemini-2.5-flash'};

    if (mimeType.startsWith('image/')) {
      setProcessingState(true, `Analisando imagem...`, 50);
      const analysisPrompt =
        'Analise esta imagem em detalhes. Descreva todos os elementos visuais, o contexto e quaisquer textos visíveis. Responda em português.';
      contents = {
        parts: [
          {text: analysisPrompt},
          {inlineData: {mimeType, data: content}},
        ],
      };
    } else if (mimeType.startsWith('video/')) {
      type = 'video';
      setProcessingState(true, `Analisando vídeo...`, 50);
      const analysisPrompt =
        'Você é um assistente multimodal. Analise este vídeo em detalhes. Descreva todos os elementos visuais e de áudio, o contexto e quaisquer textos visíveis. Crie um resumo detalhado. Responda em português.';
      contents = {
        parts: [
          {text: analysisPrompt},
          {inlineData: {mimeType, data: content}},
        ],
      };
    } else if (mimeType === 'application/pdf') {
      setProcessingState(true, `Analisando PDF...`, 50);
      const analysisPrompt =
        'Analise este documento PDF. Extraia um resumo detalhado, os pontos principais e quaisquer conclusões importantes. Responda em português.';
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
      const analysisPrompt = `Você é um analista de dados especialista. O seguinte texto contém dados extraídos de uma planilha, possivelmente com múltiplas abas, em formato CSV. Sua tarefa é analisar esses dados profundamente. Responda em português.\n\n**Análise Requerida:**\n1.  **Resumo Geral:** Forneça uma visão geral dos dados.\n2.  **Estrutura dos Dados:** Identifique as colunas e o tipo de dados que elas contêm.\n3.  **Principais Métricas:** Calcule ou identifique métricas importantes (médias, totais, contagens, etc.).\n4.  **Insights e Tendências:** Aponte quaisquer padrões, correlações ou tendências interessantes que você observar.\n\nEste resumo detalhado será seu único conhecimento sobre a planilha. Prepare-se para responder a perguntas específicas sobre ela.\n\n--- CONTEÚDO DA PLANILHA ---\n${content}`;
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

      if (isXml) {
        analysisPrompt = `Analise este documento XML. Descreva a sua estrutura de dados, os elementos principais e o propósito geral do conteúdo. Responda em português.\n\n--- CONTEÚDO DO XML ---\n${content}`;
      } else if (isMarkdown) {
        analysisPrompt = `Analise este documento Markdown. Extraia um resumo detalhado, os pontos principais, a estrutura dos títulos e quaisquer conclusões importantes. Responda em português.\n\n--- CONTEÚDO DO MARKDOWN ---\n${content}`;
      } else {
        analysisPrompt = `Analise este documento de texto. Extraia um resumo detalhado, os pontos principais e quaisquer conclusões importantes. Responda em português.\n\n--- CONTEÚDO DO DOCUMENTO ---\n${content}`;
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
    return {summary, title: contentTitle, source: contentSource, persona, type};
  }

  private async analyzeYouTubeUrl(
    url: string,
    callbacks: AnalysisCallbacks,
  ): Promise<AnalysisResult> {
    const {setProcessingState, logEvent} = callbacks;
    setProcessingState(true, 'Buscando informações do vídeo...', 15);
    const title = await getYouTubeVideoTitle(url);
    setProcessingState(true, 'Analisando vídeo com IA...', 50);
    logEvent(`Analisando YouTube: ${title}`, 'process');

    const analysisPrompt = `Você é um assistente multimodal. Analise o vídeo do YouTube intitulado "${title}" a partir da URL fornecida de forma completa, processando tanto o áudio quanto os quadros visuais. Crie um resumo detalhado para que você possa responder perguntas sobre o vídeo. Sua análise deve incluir:
1. **Conteúdo Falado**: Tópicos principais, argumentos e conclusões.
2. **Análise Visual**: Descrição de cenas importantes, pessoas (e suas ações ou aparências, como cor de roupa), objetos, textos na tela e o ambiente geral.
3. **Eventos Chave**: Uma cronologia de eventos importantes, combinando informações visuais e de áudio, com timestamps se possível.

Seja o mais detalhado possível. Este resumo será seu único conhecimento sobre o vídeo. Responda em português.`;
    const contents = {
      parts: [
        {text: analysisPrompt},
        {fileData: {mimeType: 'video/mp4', fileUri: url}},
      ],
    };
    const generateContentConfig = {model: 'gemini-2.5-flash'};
    const summary = await this.analyzeContentAndGenerateSummary(
      contents,
      generateContentConfig,
    );
    return {
      summary,
      title,
      source: url,
      persona: 'assistant',
      type: 'youtube',
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

Seja o mais detalhado possível. Este resumo será seu único conhecimento sobre o repositório. Responda em português.

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
    const analysisPrompt = `Você é um analista de dados especialista. O seguinte texto contém dados extraídos de uma planilha do Google Sheets, em formato CSV. Sua tarefa é analisar esses dados profundamente. Responda em português.\n\n**Análise Requerida:**\n1.  **Resumo Geral:** Forneça uma visão geral dos dados.\n2.  **Principais Métricas:** Identifique e resuma as métricas chave.\n3.  **Insights e Tendências:** Aponte padrões ou tendências importantes.\n\nPrepare-se para responder a perguntas específicas sobre a planilha.\n\n--- CONTEÚDO DA PLANILHA ---\n${csvData}`;
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
    setProcessingState(true, 'Analisando conteúdo com IA...', 50);
    const analysisPrompt = `O seguinte é o conteúdo em markdown de uma página da web. Analise-o e extraia um resumo detalhado, os pontos principais e as conclusões. Prepare-se para responder a perguntas sobre ele. Responda em português.\n\n--- CONTEÚDO DA PÁGINA ---\n${scrapedMarkdown}`;
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

Responda em português.`;
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
    callbacks: AnalysisCallbacks,
  ): Promise<AnalysisResult> {
    if (getYouTubeVideoId(url)) {
      return this.analyzeYouTubeUrl(url, callbacks);
    } else if (url.includes('github.com/')) {
      return this.analyzeGitHubUrl(url, callbacks);
    } else if (url.includes('docs.google.com/spreadsheets/')) {
      return this.analyzeGoogleSheetUrl(url, callbacks);
    } else {
      return this.analyzeGenericUrl(url, callbacks);
    }
  }
}
