export interface PDFDocument {
  id: string;
  filename: string;
  originalName: string;
  name: string; // Nome customizado fornecido pelo usuário
  path: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  pages?: PageData[]; // Estrutura hierárquica: PDF -> Pages
}

// Dados de uma página específica do PDF
export interface PageData {
  page: number; // Número da página (1-indexed)
  screenshot: {
    id: string;
    filename: string;
    path: string;
    url: string;
    size: number;
    createdAt: string;
  };
  audio?: {
    path: string;
    url: string;
    subtitleText?: string; // Texto da legenda em inglês
    lrcUrl?: string; // URL do arquivo LRC
  };
  html?: {
    path: string;
    url: string;
  };
  exercises?: Exercise[];
  analysis?: string; // Análise de texto da página
  processedAt?: string;
}

// Interface legada para compatibilidade (será migrada)
export interface Screenshot {
  id: string;
  pdfId: string;
  page: number;
  filename: string;
  path: string;
  url: string;
  size: number;
  createdAt: string;
  audioPath?: string;
  audioUrl?: string;
  subtitleText?: string; // Texto da legenda em inglês
  lrcUrl?: string; // URL do arquivo LRC
  exercises?: Exercise[];
  processedAt?: string;
  htmlPath?: string;
  htmlUrl?: string;
}

export interface Exercise {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface Database {
  pdfs: PDFDocument[];
  screenshots?: Screenshot[]; // Mantido para migração, será removido depois
}
