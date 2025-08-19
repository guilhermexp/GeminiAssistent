import {css} from 'lit';

export const styles = css`
  #status {
    position: absolute;
    bottom: calc(2vh + 100px); /* Position above the control bar */
    left: 0;
    right: 0;
    z-index: 10;
    text-align: center;
    color: rgba(255, 255, 255, 0.7);
    font-family: sans-serif;
    transition: color 0.3s ease;
    text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
    pointer-events: none; /* Avoid interfering with controls */
  }

  #status.error {
    color: #ff8a80; /* A less harsh red */
  }

  .input-container {
    position: absolute;
    top: 2vh;
    left: 50%;
    transform: translateX(-50%);
    width: 90%;
    max-width: 550px;
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .input-form {
    width: 100%;
    display: flex;
    gap: 8px;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 24px;
    padding: 4px;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  .input-form input[type='text'] {
    flex-grow: 1;
    border: none;
    background: transparent;
    color: white;
    padding: 10px 18px;
    font-size: 14px;
    outline: none;
    height: 40px;
    box-sizing: border-box;
  }

  .input-form button {
    outline: none;
    border: none;
    color: white;
    border-radius: 20px;
    background: rgba(80, 120, 255, 0.5);
    height: 40px;
    cursor: pointer;
    font-size: 14px;
    white-space: nowrap;
    transition: background-color 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 16px;
  }

  .input-form button.icon-button {
    background: transparent;
    width: 40px;
    padding: 0;
  }

  .input-form button:hover {
    background: rgba(80, 120, 255, 0.8);
  }

  .input-form button.icon-button:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .input-form button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .input-form button[type='submit'] {
    position: relative;
    overflow: hidden;
    transition: all 0.2s ease;
  }

  .input-form button[type='submit']:disabled {
    background: rgba(80, 120, 255, 0.4);
    opacity: 1; /* Override general disabled opacity */
    cursor: not-allowed;
  }

  .input-form button.icon-button:disabled {
    background: transparent;
  }

  .progress-bar {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: rgba(80, 120, 255, 0.8);
    border-radius: 20px;
    transition: width 0.3s ease-in-out;
    z-index: 1;
  }

  .progress-text {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 12px;
    color: white;
  }

  /* Spinner for processing button */
  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .loader {
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    animation: spin 1s linear infinite;
  }

  .content-pills-container {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    margin-top: 8px;
  }
  .content-pill {
    display: flex;
    align-items: center;
    background: rgba(0, 0, 0, 0.4);
    padding: 6px 12px;
    border-radius: 16px;
    font-family: sans-serif;
    font-size: 13px;
    color: #eee;
    border: 1px solid #5078ff;
    backdrop-filter: blur(10px);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 250px;
  }
  .content-pill span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .content-pill button {
    background: none;
    border: none;
    color: #aaa;
    margin-left: 8px;
    padding: 0;
    font-size: 16px;
    cursor: pointer;
    line-height: 1;
  }
  .content-pill button:hover {
    color: #fff;
  }

  .bottom-container {
    position: absolute;
    bottom: 2vh;
    left: 50%;
    transform: translateX(-50%);
    width: 90%;
    max-width: 800px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    z-index: 10;
    align-items: center;
  }

  .media-controls {
    display: flex;
    gap: 8px;
  }

  .media-controls button {
    outline: none;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.2);
    width: 48px;
    height: 48px;
    cursor: pointer;
    font-size: 24px;
    padding: 0;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  .media-controls button:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .media-controls button[disabled] {
    display: none;
  }

  .search-results {
    background: rgba(0, 0, 0, 0.3);
    padding: 8px 16px;
    border-radius: 12px;
    font-family: sans-serif;
    font-size: 14px;
    color: #ccc;
    max-width: 100%;
    backdrop-filter: blur(10px);
  }

  .search-results p {
    margin: 0 0 8px 0;
    font-weight: bold;
  }

  .search-results ul {
    margin: 0;
    padding: 0;
    list-style: none;
    max-height: 100px;
    overflow-y: auto;
  }

  .search-results li {
    margin-bottom: 4px;
  }

  .search-results a {
    color: #87cefa;
    text-decoration: none;
  }
  .search-results a:hover {
    text-decoration: underline;
  }
`;
