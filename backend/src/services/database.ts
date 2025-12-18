import { promises as fs } from 'fs';
import path from 'path';
import { PDFDocument, Database, Screenshot, Exercise, PageData } from '../types/pdf';

const DB_PATH = path.join(__dirname, '../../database/db.json');

// Ensure database file exists
async function ensureDatabaseExists(): Promise<void> {
  const dbDir = path.dirname(DB_PATH);
  try {
    await fs.access(dbDir);
  } catch {
    await fs.mkdir(dbDir, { recursive: true });
  }

  try {
    await fs.access(DB_PATH);
  } catch {
    const initialData: Database = { pdfs: [], screenshots: [] };
    await fs.writeFile(DB_PATH, JSON.stringify(initialData, null, 2));
  }
}

// Migrate old PDFs to include 'name' field
function migratePDFs(pdfs: any[]): PDFDocument[] {
  return pdfs.map((pdf: any) => {
    // Se o PDF não tiver o campo 'name', usa o originalName como fallback
    if (!pdf.name) {
      pdf.name = pdf.originalName || 'Sem nome';
    }
    // Inicializa pages se não existir
    if (!pdf.pages) {
      pdf.pages = [];
    }
    return pdf as PDFDocument;
  });
}

// Migrate old database structure (screenshots array) to new hierarchical structure (pages in PDFs)
async function migrateToHierarchicalStructure(db: any): Promise<Database> {
  // Se já está migrado (não tem screenshots ou está vazio), retorna como está
  if (!db.screenshots || db.screenshots.length === 0) {
    // Garante que todos os PDFs têm pages inicializado
    if (db.pdfs) {
      db.pdfs = db.pdfs.map((pdf: any) => {
        if (!pdf.pages) {
          pdf.pages = [];
        }
        return pdf;
      });
    }
    return db as Database;
  }

  console.log('🔄 Migrando estrutura de dados para formato hierárquico...');
  
  // Garante que todos os PDFs têm pages inicializado
  db.pdfs = db.pdfs.map((pdf: any) => {
    if (!pdf.pages) {
      pdf.pages = [];
    }
    return pdf;
  });

  // Migra screenshots para pages dentro dos PDFs
  for (const screenshot of db.screenshots) {
    const pdf = db.pdfs.find((p: any) => p.id === screenshot.pdfId);
    if (!pdf) {
      console.warn(`⚠️ PDF não encontrado para screenshot ${screenshot.id}`);
      continue;
    }

    // Verifica se a página já existe
    let pageData = pdf.pages.find((p: any) => p.page === screenshot.page);
    
    if (!pageData) {
      // Cria nova entrada de página
      pageData = {
        page: screenshot.page,
        screenshot: {
          id: screenshot.id,
          filename: screenshot.filename,
          path: screenshot.path,
          url: screenshot.url,
          size: screenshot.size,
          createdAt: screenshot.createdAt
        }
      };
      pdf.pages.push(pageData);
    } else {
      // Atualiza screenshot existente
      pageData.screenshot = {
        id: screenshot.id,
        filename: screenshot.filename,
        path: screenshot.path,
        url: screenshot.url,
        size: screenshot.size,
        createdAt: screenshot.createdAt
      };
    }

    // Migra dados de audio, html e exercises se existirem
    if (screenshot.audioPath && screenshot.audioUrl) {
      pageData.audio = {
        path: screenshot.audioPath,
        url: screenshot.audioUrl,
        subtitleText: screenshot.subtitleText,
        lrcUrl: screenshot.lrcUrl
      };
    }

    if (screenshot.htmlPath && screenshot.htmlUrl) {
      pageData.html = {
        path: screenshot.htmlPath,
        url: screenshot.htmlUrl
      };
    }

    if (screenshot.exercises) {
      pageData.exercises = screenshot.exercises;
    }

    if (screenshot.processedAt) {
      pageData.processedAt = screenshot.processedAt;
    }
  }

  // Ordena páginas por número
  db.pdfs.forEach((pdf: any) => {
    if (pdf.pages) {
      pdf.pages.sort((a: any, b: any) => a.page - b.page);
    }
  });

  // Remove array de screenshots antigo (mantém por compatibilidade, mas vazio)
  db.screenshots = [];
  
  console.log('✅ Migração concluída!');
  return db as Database;
}

// Migrate old database to include screenshots array (legacy)
function migrateDatabase(db: any): Database {
  if (!db.screenshots) {
    db.screenshots = [];
  }
  return db as Database;
}

// Read database
export async function readDatabase(): Promise<Database> {
  await ensureDatabaseExists();
  const data = await fs.readFile(DB_PATH, 'utf-8');
  let db: any = JSON.parse(data);
  
  // Migra PDFs antigos que não têm o campo 'name'
  const needsPDFMigration = db.pdfs && db.pdfs.some((pdf: any) => !pdf.name);
  if (needsPDFMigration) {
    db.pdfs = migratePDFs(db.pdfs);
  }
  
  // Migra estrutura antiga (screenshots) para nova estrutura hierárquica (pages)
  const needsHierarchicalMigration = db.screenshots && db.screenshots.length > 0;
  if (needsHierarchicalMigration) {
    db = await migrateToHierarchicalStructure(db);
    await writeDatabase(db); // Salva após migração
  } else {
    // Garante que todos os PDFs têm pages inicializado
    db.pdfs = db.pdfs.map((pdf: any) => {
      if (!pdf.pages) {
        pdf.pages = [];
      }
      return pdf;
    });
  }
  
  // Migra banco antigo para incluir screenshots (legacy)
  db = migrateDatabase(db);
  
  if (needsPDFMigration && !needsHierarchicalMigration) {
    await writeDatabase(db);
  }
  
  return db;
}

// Write to database
export async function writeDatabase(data: Database): Promise<void> {
  await ensureDatabaseExists();
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
}

// Add PDF to database
export async function addPDF(pdf: PDFDocument): Promise<PDFDocument> {
  const db = await readDatabase();
  // Garante que o PDF tem pages inicializado
  if (!pdf.pages) {
    pdf.pages = [];
  }
  db.pdfs.push(pdf);
  await writeDatabase(db);
  return pdf;
}

// Get all PDFs
export async function getAllPDFs(): Promise<PDFDocument[]> {
  const db = await readDatabase();
  return db.pdfs;
}

// Get PDF by ID
export async function getPDFById(id: string): Promise<PDFDocument | null> {
  const db = await readDatabase();
  return db.pdfs.find(pdf => pdf.id === id) || null;
}

// Delete PDF from database
export async function deletePDF(id: string): Promise<boolean> {
  const db = await readDatabase();
  const index = db.pdfs.findIndex(pdf => pdf.id === id);
  if (index === -1) return false;
  
  db.pdfs.splice(index, 1);
  await writeDatabase(db);
  return true;
}

// Helper: Find page data by screenshot ID
function findPageByScreenshotId(pdf: PDFDocument, screenshotId: string): PageData | null {
  if (!pdf.pages) return null;
  return pdf.pages.find(p => p.screenshot.id === screenshotId) || null;
}

// Helper: Convert PageData to Screenshot (legacy compatibility)
function pageDataToScreenshot(pdfId: string, pageData: PageData): Screenshot {
  return {
    id: pageData.screenshot.id,
    pdfId,
    page: pageData.page,
    filename: pageData.screenshot.filename,
    path: pageData.screenshot.path,
    url: pageData.screenshot.url,
    size: pageData.screenshot.size,
    createdAt: pageData.screenshot.createdAt,
    audioPath: pageData.audio?.path,
    audioUrl: pageData.audio?.url,
    subtitleText: pageData.audio?.subtitleText,
    lrcUrl: pageData.audio?.lrcUrl,
    htmlPath: pageData.html?.path,
    htmlUrl: pageData.html?.url,
    exercises: pageData.exercises,
    processedAt: pageData.processedAt
  };
}

// Add screenshot to database (nova estrutura hierárquica)
export async function addScreenshot(screenshot: Screenshot): Promise<Screenshot> {
  const db = await readDatabase();
  const pdf = db.pdfs.find(p => p.id === screenshot.pdfId);
  if (!pdf) {
    throw new Error(`PDF não encontrado: ${screenshot.pdfId}`);
  }

  if (!pdf.pages) {
    pdf.pages = [];
  }

  // Verifica se a página já existe
  let pageData = pdf.pages.find(p => p.page === screenshot.page);
  
  if (!pageData) {
    // Cria nova entrada de página
    pageData = {
      page: screenshot.page,
      screenshot: {
        id: screenshot.id,
        filename: screenshot.filename,
        path: screenshot.path,
        url: screenshot.url,
        size: screenshot.size,
        createdAt: screenshot.createdAt
      }
    };
    pdf.pages.push(pageData);
    // Ordena páginas por número
    pdf.pages.sort((a, b) => a.page - b.page);
  } else {
    // Atualiza screenshot existente
    pageData.screenshot = {
      id: screenshot.id,
      filename: screenshot.filename,
      path: screenshot.path,
      url: screenshot.url,
      size: screenshot.size,
      createdAt: screenshot.createdAt
    };
  }

  await writeDatabase(db);
  return screenshot;
}

// Get all screenshots (legacy compatibility - converte de pages para screenshots)
export async function getAllScreenshots(): Promise<Screenshot[]> {
  const db = await readDatabase();
  const screenshots: Screenshot[] = [];
  
  for (const pdf of db.pdfs) {
    if (pdf.pages) {
      for (const pageData of pdf.pages) {
        screenshots.push(pageDataToScreenshot(pdf.id, pageData));
      }
    }
  }
  
  return screenshots;
}

// Get screenshots by PDF ID
export async function getScreenshotsByPDFId(pdfId: string): Promise<Screenshot[]> {
  const db = await readDatabase();
  const pdf = db.pdfs.find(p => p.id === pdfId);
  if (!pdf || !pdf.pages) return [];
  
  return pdf.pages.map(pageData => pageDataToScreenshot(pdfId, pageData));
}

// Get screenshot by ID
export async function getScreenshotById(id: string): Promise<Screenshot | null> {
  const db = await readDatabase();
  
  for (const pdf of db.pdfs) {
    if (pdf.pages) {
      const pageData = findPageByScreenshotId(pdf, id);
      if (pageData) {
        return pageDataToScreenshot(pdf.id, pageData);
      }
    }
  }
  
  return null;
}

// Get screenshot by PDF ID and page number
export async function getScreenshotByPDFIdAndPage(pdfId: string, page: number): Promise<Screenshot | null> {
  const db = await readDatabase();
  const pdf = db.pdfs.find(p => p.id === pdfId);
  if (!pdf || !pdf.pages) return null;
  
  const pageData = pdf.pages.find(p => p.page === page);
  if (!pageData) return null;
  
  return pageDataToScreenshot(pdfId, pageData);
}

// Delete screenshot from database
export async function deleteScreenshot(id: string): Promise<boolean> {
  const db = await readDatabase();
  
  for (const pdf of db.pdfs) {
    if (pdf.pages) {
      const index = pdf.pages.findIndex(p => p.screenshot.id === id);
      if (index !== -1) {
        pdf.pages.splice(index, 1);
        await writeDatabase(db);
        return true;
      }
    }
  }
  
  return false;
}

// Update screenshot with audio path, subtitle text, and LRC URL
export async function updateScreenshotAudio(id: string, audioPath: string, audioUrl: string, subtitleText?: string, lrcUrl?: string): Promise<Screenshot | null> {
  const db = await readDatabase();
  
  for (const pdf of db.pdfs) {
    if (pdf.pages) {
      const pageData = findPageByScreenshotId(pdf, id);
      if (pageData) {
        pageData.audio = { 
          path: audioPath, 
          url: audioUrl,
          subtitleText: subtitleText,
          lrcUrl: lrcUrl
        };
        await writeDatabase(db);
        return pageDataToScreenshot(pdf.id, pageData);
      }
    }
  }
  
  return null;
}

// Update screenshot with exercises
export async function updateScreenshotExercises(id: string, exercises: Exercise[]): Promise<Screenshot | null> {
  const db = await readDatabase();
  
  for (const pdf of db.pdfs) {
    if (pdf.pages) {
      const pageData = findPageByScreenshotId(pdf, id);
      if (pageData) {
        pageData.exercises = exercises;
        pageData.processedAt = new Date().toISOString();
        await writeDatabase(db);
        return pageDataToScreenshot(pdf.id, pageData);
      }
    }
  }
  
  return null;
}

// Update screenshot with HTML path and URL
export async function updateScreenshotHTML(id: string, htmlPath: string, htmlUrl: string): Promise<Screenshot | null> {
  const db = await readDatabase();
  
  for (const pdf of db.pdfs) {
    if (pdf.pages) {
      const pageData = findPageByScreenshotId(pdf, id);
      if (pageData) {
        pageData.html = { path: htmlPath, url: htmlUrl };
        await writeDatabase(db);
        return pageDataToScreenshot(pdf.id, pageData);
      }
    }
  }
  
  return null;
}

// NEW: Get page data by PDF ID and page number (nova estrutura)
export async function getPageData(pdfId: string, page: number): Promise<PageData | null> {
  const db = await readDatabase();
  const pdf = db.pdfs.find(p => p.id === pdfId);
  if (!pdf || !pdf.pages) return null;
  
  return pdf.pages.find(p => p.page === page) || null;
}

// NEW: Get all pages for a PDF
export async function getPagesByPDFId(pdfId: string): Promise<PageData[]> {
  const db = await readDatabase();
  const pdf = db.pdfs.find(p => p.id === pdfId);
  if (!pdf || !pdf.pages) return [];
  
  return pdf.pages;
}
