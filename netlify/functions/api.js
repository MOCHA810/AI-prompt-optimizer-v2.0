// netlify/functions/api.js
// DEPRECATED: This file is no longer used.
// The application now uses the @google/genai SDK directly in the browser (services/geminiService.ts)
// to support Google AI Studio / IDX environments natively.

exports.handler = async function(event, context) {
  return {
    statusCode: 410,
    body: JSON.stringify({ message: "This API endpoint is deprecated. Please reload the application." })
  };
};
