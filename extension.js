// The module 'vscode' contains the VS Code extensibility API
const vscode = require("vscode");
const fetch = require('node-fetch');

module.exports = {
  activate,
  deactivate,
};

// This method is called when your extension is activated
function activate(context) {
  const commandID = "example.helloWorld";

  let disposable = vscode.commands.registerCommand(commandID, async () => {

    let document = vscode.window.activeTextEditor.document;

    let panel = vscode.window.createWebviewPanel('codeSuggestions', 'Code Suggestions', vscode.ViewColumn.Two, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: []
    });

    panel.webview.html = getWebviewContent();

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'getSuggestion':
            const originalCode = document.getText();
            let conversationText = "Please, first write an improved version of my code, with proper, but minimal comments if they are not present already. then give me explanations in a succinct manner on why you changed what you did \n\n";
            if (message.message.trim() === '') {
              conversationText += "my code: " + originalCode;
            } else {
              conversationText += "the explanation of what the code does: " + message.message + "\nmy code: " + originalCode;
            }
            const suggestion = await getSuggestion(message.apiKey, conversationText);
            panel.webview.postMessage({ suggestion: suggestion });
            return;
          case 'replaceCode':
            replaceCode(message.text, document);
            return;
        }
      },
      undefined,
      context.subscriptions
    );
  });

  context.subscriptions.push(disposable);
}

// API details
const API_ENDPOINT = 'https://api.openai.com/v1/engines/davinci-codex/completions';
const API_HEADERS = { 'content-type': 'application/json' };

async function getSuggestion(apiKey, message) {
  if (apiKey === '') {
    return '';
  }
  try {
    let response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        ...API_HEADERS,
        'authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        prompt: message,
        temperature: 0.5,
        max_tokens: 100
      })
    });

    if (response.status !== 200) {
      return '';
    }

    let data = await response.json();
    return data.choices[0].text;

  } catch (err) {
    console.error(err);
    return '';
  }
}

function getWebviewContent() {
  return `
    <!DOCTYPE html>
    <html>
    <body>
      <label>OpenAI API Key</label><br>
      <input type="text" id="apiKey"/><br>
      <label>Message</label><br>
      <input type="text" id="message"/><br>
      <button id="getSuggestionButton">Get Suggestion</button>
      <br><br>
      <label>Suggested Code</label><br>
      <textarea id="codeArea" style="width: 600px; height: 400px;"></textarea><br>
      <button id="replaceButton">Use Suggested Code</button>
      <script>
        const vscodeApi = acquireVsCodeApi();

        window.addEventListener('message', event => {
          const message = event.data; 
          document.getElementById('codeArea').value = message.suggestion;
        });

        document.getElementById('getSuggestionButton').addEventListener('click', () => {
          vscodeApi.postMessage({
            command: 'getSuggestion',
            apiKey: document.getElementById('apiKey').value,
            message: document.getElementById('message').value
          });
        });

        document.getElementById('replaceButton').addEventListener('click', () => {
          vscodeApi.postMessage({
            command: 'replaceCode',
            text: document.getElementById('codeArea').value
          });
        });
      </script>
    </body>
    </html>`;
}

async function replaceCode(newCode, document) {
  const replacement = newCode;
  let edit = new vscode.WorkspaceEdit();
  edit.replace(
    document.uri,
    new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length)
    ),
    replacement
  );
  return vscode.workspace.applyEdit(edit);
}

exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() { }