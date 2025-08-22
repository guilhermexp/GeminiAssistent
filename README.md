# Live Audio AI Assistant with Content Analysis & Deep Research

This is a sophisticated web application that functions as a real-time, voice-driven AI assistant powered by the Google Gemini API. It features a dynamic 3D audio visualization and has the unique capability to analyze content from various sources—web pages, YouTube videos, GitHub repositories, and local files (images, PDFs, spreadsheets, Word documents)—or perform a deep web search on any topic. After analysis, the assistant becomes a conversational expert on the provided material, capable of handling multiple contexts at once.

## Required Setup

To use all features of this application, you must configure the following API keys as environment variables before building/running the project:

-   `API_KEY`: Your Google API key for the Gemini models.
-   `FIRECRAWL_API_KEY`: Your API key for the [Firecrawl service](https://firecrawl.dev/). This is required for analyzing content from web pages and Google Docs.

## Key Features

-   **Real-Time Voice Conversation**: Engage in natural, spoken conversations with a Gemini-powered AI assistant.
-   **Dynamic 3D Visualization**: A stunning **Three.js**-based 3D sphere visualizes the user's voice (input) and the assistant's voice (output) in real-time.
-   **Cumulative, Multi-Context Sessions**: The assistant can ingest and retain knowledge from multiple sources within a single session. Start with a YouTube video, add a spreadsheet, and then a PDF—the assistant builds a cumulative knowledge base to answer questions that may span across different documents.
-   **Advanced Content Analysis Engine**:
    -   **Data Analyst Persona**: Upload a spreadsheet (`.csv`, `.xlsx`, `.xls`) or provide a link to a public Google Sheet. The assistant ingests the data, assumes the role of a data analyst, and is ready to answer questions about metrics, trends, and insights.
    -   **GitHub Repository Expert**: Provide a GitHub repository URL. The assistant analyzes its README and file structure—aided by Google Search—to answer questions about its purpose, technology, and setup.
    -   **Document Analysis**: Upload a Word document (`.doc`, `.docx`), a PDF, a Markdown file (`.md`), or an XML-based file (`.xlm`). The assistant extracts the content and can provide summaries or answer specific questions.
    -   **Deep Research**: Provide any topic (e.g., "The future of renewable energy"), and the assistant will perform a comprehensive web search using the Google Search tool to generate a structured analysis, becoming an instant expert.
    -   **Web Pages & Google Docs**: Provide any URL, including Google Docs, and the app will scrape its content using **Firecrawl** for analysis.
    -   **Multimodal YouTube Analysis**: Input a YouTube URL. The multimodal AI directly processes the video's content (both visual frames and audio track), enabling it to understand and answer questions about what is shown and said.
    -   **Image Analysis**: Upload images (`.jpg`, `.png`, etc.) for detailed visual description.
-   **Action Timeline**: A dedicated button opens a detailed, chronological log of all assistant actions, including session starts, content analyses, recordings, and errors, providing full transparency.
-   **Responsive & Modern UI**: A clean, responsive interface with modals for viewing detailed analysis (with export options for PDF/Markdown and a tabbed view for multiple contexts) and session history.

## How It Works (Technical Overview)

The application is built as a single-page application using modern web technologies.

1.  **Frontend**: Built with **LitElement**, a simple library for creating fast, lightweight web components. The main component (`<gdm-live-audio>`) manages the application state, user interactions, and API calls.
2.  **AI & Voice**:
    -   The core voice interaction uses the `@google/genai` SDK to connect to the **`gemini-2.5-flash-preview-native-audio-dialog`** model via a live, bidirectional stream.
    -   The `systemInstruction` sent to the model is dynamically generated. It combines the summaries of all content analyzed in the current session, instructing the AI to act as an expert on the cumulative knowledge base.
    -   Crucially, this ensures the assistant's responses are grounded *exclusively* in the pre-analyzed content provided by the user during the session.
3.  **Content Analysis & Research (The "Priming" Step)**:
    -   The app intelligently detects the input type: a URL, a search topic, or a file.
    -   A new analysis does not replace the old one; it is **appended** to a list of knowledge sources in the component's state.
    -   For **spreadsheets**, it uses the **SheetJS (xlsx)** library; for **Word documents**, it uses **Mammoth.js**.
    -   For URLs, the app uses the **Firecrawl API** to scrape content. For GitHub URLs, it uses the GitHub API.
    -   For "Deep Research" or GitHub analysis, the **`gemini-2.5-flash`** model is temporarily given access to the **Google Search tool** to gather information and build its initial summary. This search capability is *only* used during the analysis step.
    -   The generated summary from each analysis is added to the session's context. A new composite `systemInstruction` is created and the live session is updated with this expanded knowledge.
4.  **Timeline Logging**: A custom `logEvent` function captures and timestamps key application events, which are then displayed in a user-friendly modal.
5.  **3D Visualization**: A dedicated web component (`<gdm-live-audio-visuals-3d>`) uses **Three.js** and the Web Audio API's `AnalyserNode` to create a dynamic 3D visualization that reacts to both input and output audio streams.

## Code Structure

-   `index.tsx`: The main Lit component (`gdm-live-audio`) that contains the UI and all logic for recording, session management, timeline logging, and the advanced, **cumulative content analysis engine**.
-   `visual-3d.ts`: The Three.js visualization component.
-   `utils.ts`: Helper functions for encoding/decoding audio, and file conversions.
-   `firecrawl-utils.ts`: Abstraction for making requests to the Firecrawl API.
-   `youtube-utils.ts`: Helper functions for parsing YouTube URLs and fetching metadata.
-   `analyser.ts`: A wrapper for the Web Audio API's `AnalyserNode`.
-   `*-shader.ts`: GLSL vertex and fragment shaders for the 3D objects.
-   `index.html`: The main entry point, using an `importmap` to manage dependencies.
-   `metadata.json`: Defines application metadata and required permissions (`microphone`).

## How to Use the Application

The UI is divided into the analysis/research form at the top and the voice controls at the bottom.

### 1. Standard Voice Assistant

1.  Click the **red circle button** to start recording.
2.  Speak your query. The 3D sphere will react to your voice.
3.  The assistant will respond with audio, and the sphere will react to its voice.
4.  Click the **white square button** to stop.

### 2. Multi-Context Expert Assistant

1.  **Provide First Context**:
    -   Upload a file (spreadsheet, PDF, image, etc.), paste a URL (YouTube, GitHub, Google Docs), or type a research topic.
2.  **Analyze / Research**: Click the **"Analisar"** button. The app will process the content.
3.  **Provide More Context (Optional)**:
    -   Once the first analysis is done, a "pill" representing it will appear below the search bar.
    -   You can now provide another piece of content (e.g., upload a different file) and click the **"Adicionar"** button.
    -   Repeat this process to add as many knowledge sources as you need. You can remove a context by clicking the 'x' on its pill.
4.  **Converse**:
    -   Click the record button and ask specific questions. **The assistant will only answer based on the content you provided.** For example:
        -   After analyzing a sales report and a product spec sheet, you could ask: *"Com base no relatório de vendas, qual produto da ficha técnica teve o melhor desempenho?"*
        -   If you ask a question outside the scope of the analyzed content (e.g., "Qual a previsão do tempo?"), the assistant will state that it cannot answer.
5.  **View Analysis & Timeline**:
    -   In the control bar, two new buttons may appear:
        -   **Document Icon**: Click this to see the detailed text summaries the AI generated. A **tabbed view** lets you switch between the different analyses. You can download or share the selected summary.
        -   **List Icon**: Click this to open the **Timeline** and see a log of all actions.
6.  **Reset**: To go back to the general-purpose assistant, click the **refresh button**. This will clear **all** loaded contexts and start a fresh session.