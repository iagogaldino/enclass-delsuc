import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { promises as fs } from 'fs';
import uploadRoutes from './routes/upload';

// Load environment variables from .env file
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Create necessary directories
async function createDirectories() {
  // Use process.cwd() for consistency between dev and production
  const baseDir = process.cwd();
  const uploadsDir = path.join(baseDir, 'uploads');
  const databaseDir = path.join(baseDir, 'database');
  const pdfsDir = path.join(baseDir, 'pdfs'); // New hierarchical structure
  // Legacy directories (kept for backward compatibility)
  const screenshotsDir = path.join(baseDir, 'screenshots');
  const audioDir = path.join(baseDir, 'audio');
  const htmlDir = path.join(baseDir, 'html');
  const generatedImagesDir = path.join(baseDir, 'generated-images');
  
  try {
    await fs.access(uploadsDir);
  } catch {
    await fs.mkdir(uploadsDir, { recursive: true });
  }
  
  try {
    await fs.access(databaseDir);
  } catch {
    await fs.mkdir(databaseDir, { recursive: true });
  }
  
  try {
    await fs.access(pdfsDir);
  } catch {
    await fs.mkdir(pdfsDir, { recursive: true });
  }
  
  // Legacy directories (kept for backward compatibility)
  try {
    await fs.access(screenshotsDir);
  } catch {
    await fs.mkdir(screenshotsDir, { recursive: true });
  }
  
  try {
    await fs.access(audioDir);
  } catch {
    await fs.mkdir(audioDir, { recursive: true });
  }
  
  try {
    await fs.access(htmlDir);
  } catch {
    await fs.mkdir(htmlDir, { recursive: true });
  }
  
  try {
    await fs.access(generatedImagesDir);
  } catch {
    await fs.mkdir(generatedImagesDir, { recursive: true });
  }
}

// Initialize directories
createDirectories();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req: Request, res: Response) => {
  res.json({ 
    message: 'Bem-vindo ao servidor Brinks!',
    status: 'online'
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Test route for generated images
app.get('/test-generated-images', async (req: Request, res: Response) => {
  try {
    const imagesDir = path.join(process.cwd(), 'generated-images');
    const files = await fs.readdir(imagesDir);
    res.json({ 
      path: imagesDir,
      files: files.slice(0, 5),
      total: files.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Serve static files BEFORE API routes to avoid conflicts
// Use process.cwd() for consistency between dev and production
const baseDir = process.cwd();

// Serve files from new hierarchical structure: /pdfs/{pdfId}/page-{pageNumber}/
const pdfsDir = path.join(baseDir, 'pdfs');
console.log(`📁 Servindo arquivos de: ${pdfsDir}`);

// Middleware to log all requests to /pdfs
app.use('/pdfs', (req: Request, res: Response, next) => {
  console.log(`📥 Requisição para /pdfs: ${req.method} ${req.url}`);
  console.log(`📥 Path: ${req.path}`);
  console.log(`📥 Original URL: ${req.originalUrl}`);
  next();
});

// Route for generated images in subdirectory (MUST BE FIRST - more specific route)
app.get('/pdfs/:pdfId/page-:pageNumber/generated-images/:filename', async (req: Request, res: Response) => {
  const { pdfId, pageNumber, filename } = req.params;
  const filePath = path.join(pdfsDir, pdfId, `page-${pageNumber}`, 'generated-images', filename);
  const absolutePath = path.resolve(filePath);
  
  console.log(`🔍 [ROTA ESPECÍFICA] Requisição para imagem gerada: ${filename}`);
  console.log(`📁 PDF ID: ${pdfId}`);
  console.log(`📁 Page Number: ${pageNumber}`);
  console.log(`📁 Filename: ${filename}`);
  console.log(`📁 Caminho relativo: ${filePath}`);
  console.log(`📁 Caminho absoluto: ${absolutePath}`);
  console.log(`📁 PDFs Dir: ${pdfsDir}`);
  
  try {
    await fs.access(filePath);
    console.log(`✅ Arquivo existe e é acessível`);
    
    // Set proper content type
    if (filename.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filename.endsWith('.gif')) {
      res.setHeader('Content-Type', 'image/gif');
    } else if (filename.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    }
    
    res.sendFile(absolutePath, (err) => {
      if (err) {
        console.log(`❌ Erro ao enviar arquivo: ${err.message}`);
        if (!res.headersSent) {
          res.status(500).json({ 
            error: 'Erro ao servir imagem',
            message: err.message,
            pdfId,
            pageNumber,
            filename,
            attemptedPath: absolutePath
          });
        }
      } else {
        console.log(`✅ Imagem servida com sucesso: ${filename}`);
      }
    });
  } catch (error: any) {
    console.log(`❌ Erro ao acessar arquivo: ${filePath}`);
    console.log(`❌ Erro: ${error.message}`);
    console.log(`❌ Stack: ${error.stack}`);
    res.status(404).json({ 
      error: 'Imagem não encontrada',
      pdfId,
      pageNumber,
      filename,
      attemptedPath: filePath,
      absolutePath: absolutePath,
      pdfsDir: pdfsDir
    });
  }
});

// Add explicit route handler for regular page files (screenshot, audio, html)
app.get('/pdfs/:pdfId/page-:pageNumber/:filename', async (req: Request, res: Response) => {
  const { pdfId, pageNumber, filename } = req.params;
  
  // Skip if it's trying to access generated-images (should use the route above)
  if (filename === 'generated-images') {
    return;
  }
  
  const filePath = path.join(pdfsDir, pdfId, `page-${pageNumber}`, filename);
  
  try {
    await fs.access(filePath);
    
    // Set proper content type
    if (filename.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filename.endsWith('.mp3')) {
      res.setHeader('Content-Type', 'audio/mpeg');
    } else if (filename.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
    
    res.sendFile(path.resolve(filePath));
  } catch (error: any) {
    console.log(`❌ Erro ao servir arquivo: ${filePath}`, error.message);
    res.status(404).json({ 
      error: 'Arquivo não encontrado',
      pdfId,
      pageNumber,
      filename,
      attemptedPath: filePath
    });
  }
});

// Also use static middleware as fallback
app.use('/pdfs', express.static(pdfsDir, {
  dotfiles: 'allow',
  setHeaders: (res, filePath) => {
    // Set proper content types
    if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.mp3')) {
      res.setHeader('Content-Type', 'audio/mpeg');
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
  }
}));

// Legacy routes for backward compatibility (redirect to new structure if possible)
app.use('/screenshots', express.static(path.join(baseDir, 'screenshots')));
app.use('/audio', express.static(path.join(baseDir, 'audio')));
app.use('/html', express.static(path.join(baseDir, 'html')));

// Serve generated images statically
// Use process.cwd() to ensure it works in both dev and production
const generatedImagesPath = path.join(process.cwd(), 'generated-images');
console.log(`📁 Caminho de imagens geradas: ${generatedImagesPath}`);
console.log(`📁 __dirname: ${__dirname}`);
console.log(`📁 process.cwd(): ${process.cwd()}`);

// Debug: Check if directory exists and list files
(async () => {
  try {
    const files = await fs.readdir(generatedImagesPath);
    console.log(`✅ Diretório de imagens encontrado com ${files.length} arquivo(s)`);
    if (files.length > 0) {
      console.log(`📄 Primeiro arquivo: ${files[0]}`);
      // Test if file exists
      const testFile = path.join(generatedImagesPath, files[0]);
      try {
        await fs.access(testFile);
        console.log(`✅ Arquivo de teste acessível: ${testFile}`);
      } catch {
        console.log(`❌ Arquivo de teste não acessível: ${testFile}`);
      }
    }
  } catch (error: any) {
    console.log(`❌ Erro ao acessar diretório de imagens: ${error.message}`);
  }
})();

// Middleware to log all requests to /generated-images
app.use('/generated-images', (req: Request, res: Response, next) => {
  console.log(`📥 Requisição recebida: ${req.method} ${req.url}`);
  console.log(`📥 Path: ${req.path}`);
  console.log(`📥 Original URL: ${req.originalUrl}`);
  next();
});

// Serve generated images with explicit route handler for better control and debugging
app.get('/generated-images/:filename', async (req: Request, res: Response) => {
  const filename = req.params.filename;
  const filePath = path.join(generatedImagesPath, filename);
  
  console.log(`🔍 Requisição para imagem: ${filename}`);
  console.log(`📁 Caminho completo: ${filePath}`);
  
  try {
    // Check if file exists
    await fs.access(filePath);
    
    // Set proper content type
    if (filename.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filename.endsWith('.gif')) {
      res.setHeader('Content-Type', 'image/gif');
    } else if (filename.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    }
    
    // Send file with absolute path
    const absolutePath = path.resolve(filePath);
    console.log(`📤 Enviando arquivo: ${absolutePath}`);
    res.sendFile(absolutePath, (err) => {
      if (err) {
        console.log(`❌ Erro ao enviar arquivo: ${err.message}`);
        if (!res.headersSent) {
          res.status(500).json({ 
            error: 'Erro ao servir imagem',
            message: err.message,
            filename,
            attemptedPath: filePath
          });
        }
      } else {
        console.log(`✅ Imagem servida com sucesso: ${filename}`);
      }
    });
  } catch (error: any) {
    console.log(`❌ Erro ao servir imagem ${filename}: ${error.message}`);
    console.log(`📁 Caminho tentado: ${filePath}`);
    console.log(`📁 Diretório de imagens: ${generatedImagesPath}`);
    console.log(`📁 CWD: ${process.cwd()}`);
    res.status(404).json({ 
      error: 'Imagem não encontrada',
      filename,
      attemptedPath: filePath,
      imagesDir: generatedImagesPath,
      cwd: process.cwd()
    });
  }
});

// Upload routes (after static files)
app.use('/api', uploadRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`📤 Upload endpoint: POST http://localhost:${PORT}/api/pdf`);
  
  // Verify environment variables are loaded
  if (process.env.OPENAI_API_KEY) {
    console.log(`✅ OPENAI_API_KEY configurada (${process.env.OPENAI_API_KEY.substring(0, 15)}...)`);
  } else {
    console.log(`❌ AVISO: OPENAI_API_KEY não está configurada!`);
    console.log(`💡 Certifique-se de que o arquivo .env está em: ${path.join(process.cwd(), '.env')}`);
  }
});
