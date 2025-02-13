// https://github.com/emscripten-core/emscripten/issues/21937
if (!ENVIRONMENT_IS_PTHREAD) {
    Module['mainScriptUrlOrBlob'] = new Blob([`importScripts('${_scriptName}');`])
}
