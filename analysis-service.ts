/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI} from '@google/genai';
import {fetchWithRetry} from './utils';
import {getYouTubeVideoId, getYouTubeVideoTitle} from './youtube-utils';
import {scrapeUrl} from './firecrawl-utils';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

export interface Analysis {
  id: string;
  title: string;
  source: string;
  summary: string;
  type: 'youtube' | 'github' | 'spreadsheet' | 'file' | 'search' | 'url';
  persona: 'assistant' | 'analyst';
}

export type ProgressCallback = (step: string, progress: number) => void;

export class AnalysisService {
  private client: GoogleGenAI;

  constructor(client: GoogleGenAI) {
    this.client = client;
  }

  public async analyze(
    input: File | string,
    progressCallback: ProgressCallback,
  ): Promise<Analysis> {
    if (typeof input === 'string') {
      if (getYouTubeVideoId(input)) {
        return this.analyzeYouTubeUrl(input, progressCallback);
      } else if (input.includes('github.com/')) {
        return this.analyzeGitHubUrl(input, progressCallback);
      } else if (input.includes('docs.google.com/spreadsheets/')) {
        return this.analyzeGoogleSheetUrl(input, progressCallback);
      } else if (
        input.includes('docs.google.com/document/') ||
        /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i.test(input)
      ) {
        return this.analyzeGenericUrl(input, progressCallback);
      } else {
        return this.performDeepSearch(input, progressCallback);
      }
    } else {
      return this.analyzeFile(input, progressCallback);
    }
  }

  public generateSystemInstruction(analyses: Analysis[]): string {
    if (analyses.length === 0) {
      return 'Você é um assistente de voz prestativo que fala português do Brasil. Você não tem a capacidade de pesquisar na internet.';
    }
    if (analyses.length === 1) {
      return this.getSingleSystemInstruction(analyses[0]);
    }
    let instruction = `Você é um assistente de voz especialista com conhecimento de múltiplas fontes. Abaixo estão os resumos dos conteúdos que você analisou. Responda às perguntas com base estritamente nessas informações. Ao responder, se possível, mencione a fonte (título) da qual você está extraindo a informação.\n\n`;
    analyses.forEach((analysis, index) => {
      instruction += `--- INÍCIO DA FONTE ${index + 1}: "${analysis.title}" (${
        analysis.type
      }) ---\n`;
      instruction += `${analysis.summary}\n`;
      instruction += `--- FIM DA FONTE ${index + 1} ---\n\n`;
    });
    instruction += `Se a pergunta for sobre algo não contido nas fontes, indique que a informação não está disponível. Você não pode pesquisar informações externas. Fale em português do Brasil.`;
    return instruction;
  }

  private async generateSummary(
    contents: any,
    generateContentConfig: any,
  ): Promise<string> {
    const response = await this.client.models.generateContent({
      ...generateContentConfig,
      contents,
    });
    const summary = response.text;
    if (!summary?.trim()) {
      throw new Error('A análise retornou um resultado vazio.');
    }
    return summary;
  }

  private async analyzeFile(
    file: File,
    progress: ProgressCallback,
  ): Promise<Analysis> {
    progress(`Processando arquivo...`, 20);
    const processedData = await this.processFileInWorker(file);
    const {type: processedType, content, mimeType} = processedData;

    let contents: any;
    let persona: Analysis['persona'] = 'assistant';
    let contentType: Analysis['type'] = 'file';
    const generateContentConfig: any = {model: 'gemini-2.5-flash'};
    let analysisPrompt = '';

    if (mimeType.startsWith('image/')) {
      progress(`Analisando imagem...`, 50);
      analysisPrompt =
        'Analise esta imagem em detalhes. Descreva todos os elementos visuais, o contexto e quaisquer textos visíveis. Responda em português.';
      contents = {
        parts: [
          {text: analysisPrompt},
          {inlineData: {mimeType, data: content}},
        ],
      };
    } else if (mimeType === 'application/pdf') {
      progress(`Analisando PDF...`, 50);
      analysisPrompt =
        'Analise este documento PDF. Extraia um resumo detalhado, os pontos principais e quaisquer conclusões importantes. Responda em português.';
      contents = {
        parts: [
          {text: analysisPrompt},
          {inlineData: {mimeType, data: content}},
        ],
      };
    } else if (processedType === 'csv') {
      persona = 'analyst';
      contentType = 'spreadsheet';
      progress(`Analisando planilha...`, 50);
      analysisPrompt = `Você é um analista de dados especialista. O seguinte conteúdo CSV foi extraído de uma planilha. Analise os dados, identifique as colunas, resuma as principais tendências, padrões ou anomalias nos dados e forneça 3 insights acionáveis. Responda em português.\n\n${content}`;
      contents = {parts: [{text: analysisPrompt}]};
    } else if (processedType === 'text') {
      progress(`Analisando documento...`, 50);
      analysisPrompt = `Analise este documento de texto. Forneça um resumo conciso, identifique os pontos-chave e extraia quaisquer ações ou conclusões mencionadas. Responda em português.\n\n${content}`;
      contents = {parts: [{text: analysisPrompt}]};
    } else {
      throw new Error(`Tipo de arquivo não suportado: ${mimeType || file.name}`);
    }

    const summary = await this.generateSummary(contents, generateContentConfig);
    return {
      id: Date.now().toString(),
      title: file.name,
      source: 'Arquivo Local',
      summary,
      persona,
      type: contentType,
    };
  }

  private async analyzeYouTubeUrl(
    url: string,
    progress: ProgressCallback,
  ): Promise<Analysis> {
    progress('Buscando informações do vídeo...', 15);
    const title = await getYouTubeVideoTitle(url);
    progress('Analisando vídeo com IA...', 50);
    const analysisPrompt = `Você é um assistente multimodal. Analise este vídeo do YouTube, resumindo os pontos principais, o tópico geral e o tom do conteúdo. Responda em português.`;
    const contents = {
      parts: [
        {text: analysisPrompt},
        {fileData: {mimeType: 'video/mp4', fileUri: url}},
      ],
    };
    const summary = await this.generateSummary(contents, {
      model: 'gemini-2.5-flash',
    });
    return {
      id: Date.now().toString(),
      title,
      source: url,
      summary,
      persona: 'assistant',
      type: 'youtube',
    };
  }

  private async analyzeGitHubUrl(
    url: string,
    progress: ProgressCallback,
  ): Promise<Analysis> {
    progress('Analisando URL do GitHub...', 15);
    const repoInfo = this._parseGitHubUrl(url);
    if (!repoInfo) {
      throw new Error('URL do GitHub inválida.');
    }
    const contentTitle = `${repoInfo.owner}/${repoInfo.repo}`;
    const {readmeContent, fileTreeText} = await this.fetchGitHubRepoInfo(
      repoInfo.owner,
      repoInfo.repo,
      progress,
    );
    progress('Analisando com IA...', 50);
    const analysisPrompt = `Você é um especialista em análise de repositórios do GitHub. Analise o seguinte repositório com base em seu README e estrutura de arquivos.
    
--- CONTEÚDO DO README ---
${readmeContent}

--- ESTRUTURA DE ARQUIVOS ---
${fileTreeText}

Forneça um resumo do propósito do repositório, sua tecnologia principal e como um desenvolvedor pode começar a usá-lo. Responda em português.`;
    const contents = {parts: [{text: analysisPrompt}]};
    const summary = await this.generateSummary(contents, {
      model: 'gemini-2.5-flash',
    });
    return {
      id: Date.now().toString(),
      title: contentTitle,
      source: `GitHub: ${url}`,
      summary,
      persona: 'assistant',
      type: 'github',
    };
  }

  private async analyzeGoogleSheetUrl(
    url: string,
    progress: ProgressCallback,
  ): Promise<Analysis> {
    progress('Acessando Google Sheet...', 20);
    // This is a simplified example. Real implementation requires OAuth2.
    // For now, we'll treat it like a generic URL scrape.
    return this.analyzeGenericUrl(url, progress);
  }

  private async analyzeGenericUrl(
    url: string,
    progress: ProgressCallback,
  ): Promise<Analysis> {
    progress('Extraindo conteúdo da URL...', 25);
    const scrapeResult = await scrapeUrl(url);
    if (!scrapeResult.success || !scrapeResult.data) {
      throw new Error(scrapeResult.error || 'Falha ao extrair conteúdo da URL.');
    }
    const contentTitle = scrapeResult.data.metadata.title || url;
    progress('Analisando conteúdo com IA...', 50);
    const analysisPrompt = `O seguinte é o conteúdo em markdown de uma página da web. Leia-o e forneça um resumo detalhado, destacando os pontos principais, quaisquer conclusões e o propósito geral da página. Responda em português.\n\n${scrapeResult.data.markdown}`;
    const contents = {parts: [{text: analysisPrompt}]};
    const summary = await this.generateSummary(contents, {
      model: 'gemini-2.5-flash',
    });
    return {
      id: Date.now().toString(),
      title: contentTitle,
      source: url,
      summary,
      persona: 'assistant',
      type: 'url',
    };
  }

  private async performDeepSearch(
    topic: string,
    progress: ProgressCallback,
  ): Promise<Analysis> {
    progress(`Pesquisando sobre "${topic}"...`, 50);
    const analysisPrompt = `Realize uma pesquisa aprofundada na web sobre o tópico: "${topic}". Sintetize as informações de várias fontes para fornecer uma visão geral abrangente, incluindo definições, conceitos-chave e relevância atual. Responda em português.`;
    const contents = {parts: [{text: analysisPrompt}]};
    const summary = await this.generateSummary(contents, {
      model: 'gemini-2.5-flash',
      tools: [{googleSearch: {}}],
    });
    return {
      id: Date.now().toString(),
      title: topic,
      source: 'Pesquisa Aprofundada na Web',
      summary,
      persona: 'assistant',
      type: 'search',
    };
  }

  private getSingleSystemInstruction(analysis: Analysis): string {
    let personaInstruction = `Você é um assistente de voz prestativo que fala português do Brasil.`;
    if (analysis.persona === 'analyst') {
      personaInstruction = `Você é um analista de dados especialista que fala português do Brasil.`;
    }

    const instruction = `${personaInstruction} Sua expertise é baseada no seguinte documento:
- **Título:** ${analysis.title}
- **Fonte:** ${analysis.source}

Abaixo está um resumo detalhado do conteúdo. Responda às perguntas com base estritamente nessas informações.

--- INÍCIO DO RESUMO ---
${analysis.summary}
--- FIM DO RESUMO ---

Se a pergunta for sobre algo não contido na fonte, indique que a informação não está disponível. Você não pode pesquisar informações externas.`;

    return instruction;
  }

  private async processFileInWorker(
    file: File,
  ): Promise<{
    type: 'text' | 'csv' | 'image' | 'pdf';
    content: string;
    mimeType: string;
  }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const fileType = file.type;
      const fileName = file.name.toLowerCase();

      if (fileType.startsWith('image/')) {
        reader.readAsDataURL(file);
        reader.onload = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve({type: 'image', content: base64String, mimeType: file.type});
        };
      } else if (fileType === 'application/pdf') {
        reader.readAsDataURL(file);
        reader.onload = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve({type: 'pdf', content: base64String, mimeType: file.type});
        };
      } else if (
        fileName.endsWith('.csv') ||
        fileType === 'text/csv' ||
        fileName.endsWith('.xlsx') ||
        fileName.endsWith('.xls')
      ) {
        reader.readAsArrayBuffer(file);
        reader.onload = (e) => {
          const data = new Uint8Array(e.target.result as ArrayBuffer);
          const workbook = XLSX.read(data, {type: 'array'});
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const csvContent = XLSX.utils.sheet_to_csv(worksheet);
          resolve({type: 'csv', content: csvContent, mimeType: 'text/csv'});
        };
      } else if (fileName.endsWith('.docx')) {
        reader.readAsArrayBuffer(file);
        reader.onload = async (e) => {
          try {
            const result = await mammoth.extractRawText({
              arrayBuffer: e.target.result as ArrayBuffer,
            });
            resolve({
              type: 'text',
              content: result.value,
              mimeType: 'text/plain',
            });
          } catch (error) {
            reject(error);
          }
        };
      } else if (fileType.startsWith('text/') || fileName.endsWith('.md')) {
        reader.readAsText(file);
        reader.onload = (e) => {
          resolve({
            type: 'text',
            content: e.target.result as string,
            mimeType: 'text/plain',
          });
        };
      } else {
        reject(new Error(`Unsupported file type: ${file.type || file.name}`));
      }
      reader.onerror = (error) => reject(error);
    });
  }

  private _parseGitHubUrl(url: string): {owner: string; repo: string} | null {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname !== 'github.com') return null;
      const pathParts = parsedUrl.pathname.split('/').filter((p) => p);
      if (pathParts.length < 2) return null;
      return {owner: pathParts[0], repo: pathParts[1]};
    } catch (e) {
      return null;
    }
  }

  private async fetchGitHubRepoInfo(
    owner: string,
    repo: string,
    progress: ProgressCallback,
  ): Promise<{readmeContent: string; fileTreeText: string}> {
    progress('Buscando README do repositório...', 30);
    const readmeUrl = `https://api.github.com/repos/${owner}/${repo}/readme`;
    let readmeContent = 'README não encontrado.';
    try {
      const readmeResponse = await fetchWithRetry(readmeUrl, {
        headers: {Accept: 'application/vnd.github.v3.raw'},
      });
      if (readmeResponse.ok) {
        readmeContent = await readmeResponse.text();
      }
    } catch (e) {
      console.warn('Não foi possível buscar o README:', e);
    }

    progress('Buscando árvore de arquivos...', 40);
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`;
    let fileTreeText = 'Árvore de arquivos não disponível.';
    try {
      const treeResponse = await fetchWithRetry(treeUrl);
      if (treeResponse.ok) {
        const treeData = await treeResponse.json();
        fileTreeText = treeData.tree
          .map((item: {path: string}) => item.path)
          .join('\n');
      }
    } catch (e) {
      console.warn('Não foi possível buscar a árvore de arquivos:', e);
    }

    return {readmeContent, fileTreeText};
  }
}
