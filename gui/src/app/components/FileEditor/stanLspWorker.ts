// import startLanguageServer from "stan-language-server";
import {
  // createConnection,
  BrowserMessageReader,
  BrowserMessageWriter,
} from "vscode-languageserver/browser";

import rawStancJS from "./stanc.js?raw"; // https://vitejs.dev/guide/assets#importing-asset-as-string

eval(rawStancJS);

const messageReader = new BrowserMessageReader(
  self as DedicatedWorkerGlobalScope,
);
const messageWriter = new BrowserMessageWriter(
  self as DedicatedWorkerGlobalScope,
);

(self as any).lsp(messageReader, messageWriter);
