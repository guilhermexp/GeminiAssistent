# Live Audio AI Assistant with Content Analysis, Deep Research & Image Generation

This is a sophisticated web application that functions as a real-time, voice and text-driven AI assistant powered by the Google Gemini API. It features a dynamic 3D audio visualization and has the unique capability to analyze content from various sources—web pages, YouTube videos, GitHub repositories, and local files (images, PDFs, spreadsheets, Word documents)—or perform a deep web search on any topic. After analysis, the assistant becomes a conversational expert on the provided material, capable of handling multiple contexts at once, and can even generate and edit images on demand.

## Required Setup

To use all features of this application, you must configure the following API key as an environment variable before building/running the project:

-   `API_KEY`: Your Google API key for the Gemini models.

## Key Features

-   **Real-Time Voice & Text Conversation**: Engage in natural, spoken conversations or use a streaming text chat interface.
-   **Dynamic 3D Visualization**: A stunning **Three.js**-based 3D sphere visualizes the user's voice (input) and the assistant's voice (output) in real-time.
-   **Cumulative, Multi-Context Sessions**: The assistant can ingest and retain knowledge from multiple sources within a single session. Start with a YouTube video, add a spreadsheet, and then a PDF—the assistant builds a cumulative knowledge base to answer questions that may span across different documents.
-   **AI-Powered Chat & Image Tools**:
    -   **Streaming Chat with Google Search**: The text-based chat assistant provides streaming responses for immediate feedback and can use Google Search to find up-to-date information.
    -   **AI Image Generation**: Generate one or multiple images from a text prompt using the `imagen-4.0-generate-001` model.
    -   **AI Image Editing**: Edit the most recently generated image with new instructions using the `gemini-2.5-flash-image-preview` model.
    -   **Interactive Image Tools**: Easily download any generated image or insert it directly into the current analysis summary with a single click.
-   **Advanced Content Analysis Engine**:
    -   **Data Analyst Persona**: Upload a spreadsheet (`.csv`, `.xlsx`, `.xls`) or provide a link to a public Google Sheet. The assistant ingests the data, assumes the role of a data analyst, and is ready to answer questions about metrics, trends, and insights.
    -   **GitHub Repository Expert**: Provide a GitHub repository URL. The assistant analyzes its README and file structure to answer questions about its purpose, technology, and setup.
    -   **Document Analysis**: Upload a Word document (`.doc`, `.docx`), a PDF, a Markdown file (`.md`), or an XML-based file.
    -   **Deep Research**: Provide any topic (e.g., "The future of renewable energy"), and the assistant will perform a comprehensive web search to generate a structured analysis.
    -   **Web Pages & Google Docs**: Provide any URL, and the app will analyze its content.
    -   **Multimodal YouTube Analysis**: Input a YouTube URL. The multimodal AI directly processes the video's content (both visual frames and audio track). This includes specialized modes for **Vibecode** (UI/UX analysis) and **Workflow** (extracting n8n JSON).
    -   **Image Analysis**: Upload images (`.jpg`, `.png`, etc.) for detailed visual description.
-   **Action Timeline & Session History**: A dedicated chronological log of all assistant actions, and the ability to save, load, and manage entire sessions.
-   **Customizable AI Personas**: Switch the AI's personality (Tutor, Coder, Data Analyst, etc.) to tailor its responses to your needs.
-   **Responsive & Modern UI**: A clean, responsive interface with dockable panels for managing contexts, viewing content previews, and interacting with the chat.

## How It Works (Technical Overview)

The application is built as a single-page application using modern web technologies.

1.  **Frontend**: Built with **LitElement**, a simple library for creating fast, lightweight web components. The main component (`<gdm-live-audio>`) manages the application state, user interactions, and API calls.
2.  **AI & Voice**:
    -   The core voice interaction uses the `@google/genai` SDK to connect to the **`gemini-2.5-flash-preview-native-audio-dialog`** model via a live, bidirectional stream.
    -   The text-based chat uses a streaming connection to the **`gemini-2.5-flash`** model.
    -   The `systemInstruction` sent to the models is dynamically generated. It combines the summaries of all content analyzed in the current session, instructing the AI to act as an expert on the cumulative knowledge base.
3.  **AI Image Tools**:
    -   The text chat model is instructed to recognize specific commands. When a user asks to generate an image, the model outputs a special token like `[generate_images(N): 'prompt']`.
    -   The application intercepts this token and calls the **`imagen-4.0-generate-001`** model to generate the image(s).
    -   For editing, the model outputs `[edit_image: 'prompt']`, which triggers a call to the **`gemini-2.5-flash-image-preview`** model, sending the last generated image along with the new prompt.
4.  **Content Analysis & Research**:
    -   The app intelligently detects the input type: a URL, a search topic, or a file. A new analysis is **appended** to the session's knowledge sources.
    -   It uses specialized libraries like **SheetJS (xlsx)** for spreadsheets and **Mammoth.js** for Word documents.
    -   For most analyses and searches, the **`gemini-2.5-flash`** model is given access to the **Google Search tool** to gather information and build its initial summary.
5.  **3D Visualization**: A dedicated web component (`<gdm-live-audio-visuals-3d>`) uses **Three.js** and the Web Audio API's `AnalyserNode` to create a dynamic 3D visualization that reacts to both input and output audio streams.

## Code Structure

-   `index.tsx`: The main Lit component (`gdm-live-audio`) that orchestrates the entire application.
-   `src/services/state-service.ts`: The heart of the application, managing all state, API calls (voice, text, image), session logic, and analysis processing.
-   `src/services/analysis-service.ts`: Handles the logic for analyzing different types of content (files, URLs, searches).
-   `src/components/`: Contains all the UI web components for the shell, sidebar, main view, chat panel, etc.
-   `src/utils/system-instruction-builder.ts`: Dynamically creates the complex system prompts for the AI based on the current context, persona, and available tools.
-   `visual-3d.ts`: The Three.js visualization component.

## How to Use the Application

The UI is divided into three main columns: the **Sidebar** on the left, the **Main View** in the center, and the **Visualizer Panel** on the right.

### 1. Analyzing Content

1.  Use the form at the top of the **Main View**. You can paste a URL, type a research topic, or upload a file.
2.  Select a specialized analysis mode if needed (e.g., **Vibecode** for app videos, **Workflow** for n8n content).
3.  Click **"Analisar"**. The app will process the content, and a new "note" will appear in the **Sidebar**. The analysis summary will appear in the **Main View**, and any visual preview (like a video player or image) will appear in the **Visualizer Panel**.
4.  You can add multiple analyses to the same session. The AI will have cumulative knowledge of all of them.

### 2. Voice Conversation

1.  Click the **play button** in the bottom media controls to start recording.
2.  Speak your query. The 3D sphere in the center will react to your voice.
3.  The assistant will respond with audio, and the sphere will react to its voice.
4.  Click the **stop button** to end the recording.

### 3. Text Chat & Image Tools

1.  When an analysis is selected, the **Visualizer Panel** on the right becomes active. Click the **"Conversar" (Chat)** tab.
2.  **Chatting**: Type your message in the input box at the bottom and press Enter. The assistant's response will stream in real-time. The chat is aware of all the content you've analyzed.
3.  **Generating Images**: Ask the assistant to create an image.
    -   *Example prompts:* `"crie uma imagem de um astronauta em um cavalo"`, `"gere 3 fotos de paisagens futuristas"`
    -   The assistant will confirm and then display loading indicators while the images are being generated.
4.  **Editing Images**: After an image has been generated, ask for a modification.
    -   *Example prompts:* `"agora, adicione uma lua no céu"`, `"mude o fundo para um deserto"`, `"faça o cavalo ser azul"`
    -   The assistant will use the most recently generated image as the base for the edit.
5.  **Interacting with Images**:
    -   Hover over any generated image to see two buttons.
    -   **Download**: Click the download icon to save the image to your computer.
    -   **Insert into Analysis**: Click the plus icon to add the image directly into the summary of the currently selected analysis, making it part of the AI's knowledge base for future questions.

### 4. Managing Your Session

-   **Sidebar**: Click on different notes to switch the primary context and view their analysis/preview. Use the search bar or tags to filter your analyses.
-   **User Profile (Bottom-Left)**: Click your avatar to change the AI's **Persona**, view **History** (saved sessions, past searches), or reset the current session.
-   **Timeline (Bottom Media Controls)**: Click the list icon to see a detailed log of all actions taken during the session.
-   **Reset**: Click the refresh icon in the media controls to clear **all** loaded contexts and start a fresh session.