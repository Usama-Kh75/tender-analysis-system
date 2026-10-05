declare const __APP_VERSION__: string;

// pdf.js يعمل في الخيط الرئيسي (src/utils/pdfService.ts): يُستورد ملف الـworker كوحدة عادية
declare module 'pdfjs-dist/build/pdf.worker.min.mjs' {
  export const WorkerMessageHandler: unknown;
}

// ملفات WebAssembly لمفككي صور pdf.js مضمّنة كنص base64 (embeddedPdfWasm في vite.config.ts)
declare module 'virtual:pdf-wasm' {
  const files: Record<string, string>;
  export default files;
}
