import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import { addPDF, getAllPDFs, getPDFById, getAllScreenshots, getScreenshotsByPDFId, getScreenshotById, getScreenshotByPDFIdAndPage, updateScreenshotAudio, updateScreenshotExercises, updateScreenshotHTML } from '../services/database';
import { PDFDocument } from '../types/pdf';
import { generateScreenshot, getPageCount } from '../services/pdfScreenshot';
import { analyzeScreenshot, generateHTMLFromScreenshot, generateAudioExplanation, generateExercises, processHTMLImages } from '../services/openaiService';
import { getPageDir, getAudioPath, getHTMLPath, getPageFileUrl, ensureDir, getGeneratedImagesDir, getGeneratedImagePath, getGeneratedImageUrl, getLRCPath, getLRCUrl } from '../services/filePaths';

const router = Router();

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

// File filter to only accept PDFs
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Apenas arquivos PDF são permitidos!'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Upload PDF endpoint
router.post('/pdf', upload.single('pdf'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
    }

    // Pega o nome customizado do body, se não fornecido usa o nome original
    const customName = req.body.name || req.body.title || req.file.originalname;

    const pdfDocument: PDFDocument = {
      id: uuidv4(),
      filename: req.file.filename,
      originalName: req.file.originalname,
      name: customName,
      path: req.file.path,
      size: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date().toISOString()
    };

    await addPDF(pdfDocument);

    res.status(201).json({
      message: 'PDF enviado com sucesso!',
      pdf: pdfDocument
    });
  } catch (error: any) {
    console.error('Erro ao fazer upload:', error);
    res.status(500).json({ 
      error: 'Erro ao processar o upload',
      message: error.message 
    });
  }
});

// Get all PDFs
router.get('/pdfs', async (req: Request, res: Response) => {
  try {
    const pdfs = await getAllPDFs();
    res.json({ pdfs, count: pdfs.length });
  } catch (error: any) {
    console.error('Erro ao buscar PDFs:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar PDFs',
      message: error.message 
    });
  }
});

// Get PDF by ID
router.get('/pdf/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pdf = await getPDFById(id);
    
    if (!pdf) {
      return res.status(404).json({ error: 'PDF não encontrado' });
    }

    res.json({ pdf });
  } catch (error: any) {
    console.error('Erro ao buscar PDF:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar PDF',
      message: error.message 
    });
  }
});

// Generate screenshot of a PDF page
router.get('/pdf/:id/screenshot/:page', async (req: Request, res: Response) => {
  try {
    const { id, page } = req.params;
    const pageNumber = parseInt(page, 10);

    if (isNaN(pageNumber) || pageNumber < 1) {
      return res.status(400).json({ error: 'Número de página inválido' });
    }

    // Get PDF from database
    const pdf = await getPDFById(id);
    if (!pdf) {
      return res.status(404).json({ error: 'PDF não encontrado' });
    }

    // Generate screenshot
    const screenshotResult = await generateScreenshot(pdf, pageNumber);

    res.json({
      message: 'Screenshot gerado com sucesso!',
      screenshot: screenshotResult.screenshot
    });
  } catch (error: any) {
    console.error('Erro ao gerar screenshot:', error);
    res.status(500).json({ 
      error: 'Erro ao gerar screenshot',
      message: error.message 
    });
  }
});

// Get PDF page count
router.get('/pdf/:id/pages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pdf = await getPDFById(id);
    
    if (!pdf) {
      return res.status(404).json({ error: 'PDF não encontrado' });
    }

    const pageCount = await getPageCount(pdf.path);

    res.json({
      pdfId: id,
      totalPages: pageCount
    });
  } catch (error: any) {
    console.error('Erro ao obter número de páginas:', error);
    res.status(500).json({ 
      error: 'Erro ao obter número de páginas',
      message: error.message 
    });
  }
});

// Get all screenshots
router.get('/screenshots', async (req: Request, res: Response) => {
  try {
    const screenshots = await getAllScreenshots();
    res.json({ screenshots, count: screenshots.length });
  } catch (error: any) {
    console.error('Erro ao buscar screenshots:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar screenshots',
      message: error.message 
    });
  }
});

// Get screenshots by PDF ID
router.get('/pdf/:id/screenshots', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pdf = await getPDFById(id);
    
    if (!pdf) {
      return res.status(404).json({ error: 'PDF não encontrado' });
    }

    const screenshots = await getScreenshotsByPDFId(id);
    res.json({ pdfId: id, screenshots, count: screenshots.length });
  } catch (error: any) {
    console.error('Erro ao buscar screenshots do PDF:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar screenshots do PDF',
      message: error.message 
    });
  }
});

// Get screenshot by ID
router.get('/screenshot/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const screenshot = await getScreenshotById(id);
    
    if (!screenshot) {
      return res.status(404).json({ error: 'Screenshot não encontrado' });
    }

    res.json({ screenshot });
  } catch (error: any) {
    console.error('Erro ao buscar screenshot:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar screenshot',
      message: error.message 
    });
  }
});

// Get screenshot by PDF ID and page number
router.get('/pdf/:pdfId/screenshot/page/:page', async (req: Request, res: Response) => {
  try {
    const { pdfId, page } = req.params;
    const pageNumber = parseInt(page, 10);
    const autoProcess = req.query.autoProcess === 'true';

    if (isNaN(pageNumber) || pageNumber < 1) {
      return res.status(400).json({ error: 'Número de página inválido' });
    }

    // Verify PDF exists
    const pdf = await getPDFById(pdfId);
    if (!pdf) {
      return res.status(404).json({ error: 'PDF não encontrado' });
    }

    // Check if screenshot exists, if not generate it
    let screenshot = await getScreenshotByPDFIdAndPage(pdfId, pageNumber);
    
    if (!screenshot) {
      // Generate screenshot if it doesn't exist
      try {
        const screenshotResult = await generateScreenshot(pdf, pageNumber);
        screenshot = screenshotResult.screenshot;
      } catch (error: any) {
        return res.status(500).json({ 
          error: 'Erro ao gerar screenshot',
          message: error.message 
        });
      }
    }

    // Auto-process if requested and not already processed
    if (autoProcess && (!screenshot.audioPath || !screenshot.exercises || screenshot.exercises.length === 0)) {
      // Process in background (don't wait)
      processScreenshotAsync(screenshot.id).catch(err => {
        console.error('Erro ao processar screenshot em background:', err);
      });
    }

    res.json({ screenshot });
  } catch (error: any) {
    console.error('Erro ao buscar screenshot:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar screenshot',
      message: error.message 
    });
  }
});

// Async function to process screenshot
async function processScreenshotAsync(screenshotId: string): Promise<void> {
  try {
    const screenshot = await getScreenshotById(screenshotId);
    if (!screenshot) return;

    // Process audio if not already processed
    if (!screenshot.audioPath || !screenshot.audioUrl) {
      try {
        const { audioBuffer, subtitleText, lrcData } = await generateAudioExplanation(screenshot.path);
        // Use new hierarchical structure
        const pageDir = getPageDir(screenshot.pdfId, screenshot.page);
        await ensureDir(pageDir);
        const audioFilename = `audio.mp3`;
        const audioFilePath = getAudioPath(screenshot.pdfId, screenshot.page, audioFilename);
        await fs.writeFile(audioFilePath, audioBuffer);
        const audioUrl = getPageFileUrl(screenshot.pdfId, screenshot.page, audioFilename);
        
        // Save LRC file
        let lrcUrl: string | undefined;
        if (lrcData) {
          const lrcFilename = `audio.lrc`;
          const lrcFilePath = getLRCPath(screenshot.pdfId, screenshot.page, lrcFilename);
          await fs.writeFile(lrcFilePath, lrcData, 'utf-8');
          lrcUrl = getLRCUrl(screenshot.pdfId, screenshot.page, lrcFilename);
        }
        
        await updateScreenshotAudio(screenshotId, audioFilePath, audioUrl, subtitleText, lrcUrl);
        console.log(`✅ Áudio processado para screenshot ${screenshotId}`);
      } catch (error: any) {
        console.error(`❌ Erro ao processar áudio para screenshot ${screenshotId}:`, error.message);
      }
    }

    // Process exercises if not already processed
    if (!screenshot.exercises || screenshot.exercises.length === 0) {
      try {
        const exercisesResponse = await generateExercises(screenshot.path);
        await updateScreenshotExercises(screenshotId, exercisesResponse.exercises);
        console.log(`✅ Exercícios processados para screenshot ${screenshotId}`);
      } catch (error: any) {
        console.error(`❌ Erro ao processar exercícios para screenshot ${screenshotId}:`, error.message);
      }
    }
  } catch (error: any) {
    console.error(`❌ Erro ao processar screenshot ${screenshotId}:`, error.message);
  }
}

// Analyze screenshot with OpenAI
router.post('/screenshot/:id/analyze', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt é obrigatório e deve ser uma string não vazia' });
    }

    // Get screenshot from database
    const screenshot = await getScreenshotById(id);
    if (!screenshot) {
      return res.status(404).json({ error: 'Screenshot não encontrado' });
    }

    // Analyze screenshot with OpenAI
    const analysis = await analyzeScreenshot(screenshot.path, prompt);

    res.json({
      message: 'Análise realizada com sucesso!',
      screenshotId: id,
      prompt: prompt,
      analysis: analysis
    });
  } catch (error: any) {
    console.error('Erro ao analisar screenshot:', error);
    res.status(500).json({ 
      error: 'Erro ao analisar screenshot',
      message: error.message 
    });
  }
});

// Generate HTML from screenshot
router.get('/screenshot/:id/generate-html', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate screenshot ID
    if (!id || id.trim().length === 0) {
      return res.status(400).json({ 
        error: 'ID do screenshot inválido',
        message: 'O ID do screenshot é obrigatório' 
      });
    }

    // Get screenshot from database
    const screenshot = await getScreenshotById(id);
    if (!screenshot) {
      return res.status(404).json({ 
        error: 'Screenshot não encontrado',
        message: `Nenhum screenshot encontrado com o ID: ${id}` 
      });
    }

    // Check if HTML already exists
    if (screenshot.htmlPath && screenshot.htmlUrl) {
      try {
        const { promises: fs } = await import('fs');
        // Use the stored path directly
        const htmlContent = await fs.readFile(screenshot.htmlPath, 'utf-8');
        
        // Return cached HTML
        console.log(`✅ Retornando HTML salvo para screenshot ${id}`);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Length', Buffer.byteLength(htmlContent, 'utf8').toString());
        res.setHeader('X-HTML-Cached', 'true');
        return res.send(htmlContent);
      } catch (fileError) {
        // HTML file doesn't exist, will generate new one
        console.log('Arquivo HTML não encontrado no caminho salvo, gerando novo HTML...');
      }
    }

    // Validate screenshot file exists
    try {
      const { promises: fs } = await import('fs');
      await fs.access(screenshot.path);
    } catch (fileError) {
      return res.status(404).json({ 
        error: 'Arquivo de screenshot não encontrado',
        message: `O arquivo do screenshot não existe no caminho: ${screenshot.path}` 
      });
    }

    // Generate HTML from screenshot with OpenAI
    let html: string;
    try {
      html = await generateHTMLFromScreenshot(screenshot.path);
    } catch (openaiError: any) {
      console.error('Erro ao gerar HTML com OpenAI:', openaiError);
      
      // Provide more specific error messages
      if (openaiError.message?.includes('API')) {
        return res.status(503).json({ 
          error: 'Serviço de IA temporariamente indisponível',
          message: 'Não foi possível conectar ao serviço de IA. Verifique a configuração da API key ou tente novamente mais tarde.'
        });
      } else if (openaiError.message?.includes('tokens') || openaiError.message?.includes('length')) {
        return res.status(413).json({ 
          error: 'Conteúdo muito grande',
          message: 'A imagem é muito complexa para gerar HTML. Tente com uma imagem mais simples.'
        });
      } else {
        return res.status(500).json({ 
          error: 'Erro ao gerar HTML',
          message: openaiError.message || 'Erro desconhecido ao processar a imagem'
        });
      }
    }

    // Validate generated HTML
    if (!html || typeof html !== 'string' || html.trim().length === 0) {
      return res.status(500).json({ 
        error: 'HTML gerado inválido',
        message: 'O serviço de IA retornou um HTML vazio ou inválido' 
      });
    }

    // Process images in HTML (generate images with DALL-E if needed)
    let processedHTML = html;
    try {
      console.log('🖼️ Processando imagens no HTML...');
      processedHTML = await processHTMLImages(html, id);
      console.log('✅ Processamento de imagens concluído');
    } catch (imageError: any) {
      console.error('⚠️ Erro ao processar imagens, usando HTML original:', imageError);
      // Continue with original HTML if image processing fails
      processedHTML = html;
    }

    // Save HTML to file using new hierarchical structure
    try {
      const { promises: fs } = await import('fs');
      const pageDir = getPageDir(screenshot.pdfId, screenshot.page);
      await ensureDir(pageDir);
      
      const htmlFilename = `page.html`;
      const htmlFilePath = getHTMLPath(screenshot.pdfId, screenshot.page, htmlFilename);
      await fs.writeFile(htmlFilePath, processedHTML, 'utf-8');
      
      // Update screenshot with HTML path and URL
      const htmlUrl = getPageFileUrl(screenshot.pdfId, screenshot.page, htmlFilename);
      await updateScreenshotHTML(id, htmlFilePath, htmlUrl);
      
      console.log(`✅ HTML salvo para screenshot ${id}`);
    } catch (saveError: any) {
      console.error('Erro ao salvar HTML:', saveError);
      // Continue even if save fails - still return the HTML
    }

    // Send HTML response (use processed HTML with generated images)
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(processedHTML, 'utf8').toString());
    res.setHeader('X-HTML-Cached', 'false');
    res.send(processedHTML);
  } catch (error: any) {
    console.error('Erro inesperado ao gerar HTML:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: error.message || 'Ocorreu um erro inesperado ao processar a solicitação' 
    });
  }
});

// Generate audio explanation from screenshot
router.get('/screenshot/:id/generate-audio', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get screenshot from database
    const screenshot = await getScreenshotById(id);
    if (!screenshot) {
      return res.status(404).json({ error: 'Screenshot não encontrado' });
    }

    // If audio already exists, return it
    if (screenshot.audioPath && screenshot.audioUrl) {
      const audioPath = path.join(__dirname, '../../audio', path.basename(screenshot.audioPath));
      try {
        const audioBuffer = await fs.readFile(audioPath);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', audioBuffer.length.toString());
        return res.send(audioBuffer);
      } catch {
        // If file doesn't exist, regenerate
      }
    }

    // Generate audio explanation from screenshot with OpenAI
    const { audioBuffer, subtitleText, lrcData } = await generateAudioExplanation(screenshot.path);
    
    // Save audio to file using new hierarchical structure
    const pageDir = getPageDir(screenshot.pdfId, screenshot.page);
    await ensureDir(pageDir);
    const audioFilename = `audio.mp3`;
    const audioFilePath = getAudioPath(screenshot.pdfId, screenshot.page, audioFilename);
    await fs.writeFile(audioFilePath, audioBuffer);
    
    // Save LRC file
    let lrcUrl: string | undefined;
    if (lrcData) {
      const lrcFilename = `audio.lrc`;
      const lrcFilePath = getLRCPath(screenshot.pdfId, screenshot.page, lrcFilename);
      await fs.writeFile(lrcFilePath, lrcData, 'utf-8');
      lrcUrl = getLRCUrl(screenshot.pdfId, screenshot.page, lrcFilename);
    }
    
    // Update screenshot with audio path, subtitle text, and LRC URL
    const audioUrl = getPageFileUrl(screenshot.pdfId, screenshot.page, audioFilename);
    await updateScreenshotAudio(id, audioFilePath, audioUrl, subtitleText, lrcUrl);

    // Set headers for audio response
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="explicacao-${id}.mp3"`);
    res.setHeader('Content-Length', audioBuffer.length.toString());

    // Send audio buffer
    res.send(audioBuffer);
  } catch (error: any) {
    console.error('Erro ao gerar áudio:', error);
    res.status(500).json({ 
      error: 'Erro ao gerar áudio',
      message: error.message 
    });
  }
});

// Get subtitles for a screenshot
router.get('/screenshot/:id/subtitles', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get screenshot from database
    const screenshot = await getScreenshotById(id);
    if (!screenshot) {
      return res.status(404).json({ error: 'Screenshot não encontrado' });
    }

    // Return subtitle text if available
    if (screenshot.subtitleText) {
      return res.json({ subtitleText: screenshot.subtitleText });
    }

    // If no subtitles available, return empty
    return res.json({ subtitleText: null });
  } catch (error: any) {
    console.error('Erro ao buscar legendas:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar legendas',
      message: error.message 
    });
  }
});

// Get LRC file for a screenshot
router.get('/screenshot/:id/lrc', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get screenshot from database
    const screenshot = await getScreenshotById(id);
    if (!screenshot) {
      return res.status(404).json({ error: 'Screenshot não encontrado' });
    }

    // Check if LRC URL is available
    if (!screenshot.lrcUrl) {
      return res.status(404).json({ error: 'Arquivo LRC não encontrado para este screenshot' });
    }

    // Read LRC file using the URL path
    // lrcUrl format: /pdfs/{pdfId}/page-{pageNumber}/audio.lrc
    const lrcPath = path.join(__dirname, '../../pdfs', screenshot.lrcUrl.replace(/^\/pdfs\//, ''));
    try {
      const lrcContent = await fs.readFile(lrcPath, 'utf-8');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.send(lrcContent);
    } catch (fileError: any) {
      console.error('Erro ao ler arquivo LRC:', fileError);
      return res.status(404).json({ 
        error: 'Arquivo LRC não encontrado no sistema de arquivos',
        message: fileError.message 
      });
    }
  } catch (error: any) {
    console.error('Erro ao buscar arquivo LRC:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar arquivo LRC',
      message: error.message 
    });
  }
});

// Generate exercises from screenshot
router.get('/screenshot/:id/generate-exercises', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const screenshot = await getScreenshotById(id);
    if (!screenshot) {
      return res.status(404).json({ error: 'Screenshot não encontrado' });
    }

    // If exercises already exist, return them
    if (screenshot.exercises && screenshot.exercises.length > 0) {
      return res.json({ exercises: screenshot.exercises });
    }

    // Generate exercises
    const exercisesResponse = await generateExercises(screenshot.path);

    // Save exercises to database
    await updateScreenshotExercises(id, exercisesResponse.exercises);

    res.json(exercisesResponse);
  } catch (error: any) {
    console.error('Erro ao gerar exercícios:', error);
    res.status(500).json({ 
      error: 'Erro ao gerar exercícios',
      message: error.message 
    });
  }
});

// Process screenshot automatically (generate audio and exercises)
router.post('/screenshot/:id/process', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const screenshot = await getScreenshotById(id);
    if (!screenshot) {
      return res.status(404).json({ error: 'Screenshot não encontrado' });
    }

    const results: any = {
      screenshotId: id,
      audio: null,
      exercises: null,
      errors: []
    };

    // Process audio if not already processed
    if (!screenshot.audioPath || !screenshot.audioUrl) {
      try {
        const { audioBuffer, subtitleText, lrcData } = await generateAudioExplanation(screenshot.path);
        // Use new hierarchical structure
        const pageDir = getPageDir(screenshot.pdfId, screenshot.page);
        await ensureDir(pageDir);
        const audioFilename = `audio.mp3`;
        const audioFilePath = getAudioPath(screenshot.pdfId, screenshot.page, audioFilename);
        await fs.writeFile(audioFilePath, audioBuffer);
        const audioUrl = getPageFileUrl(screenshot.pdfId, screenshot.page, audioFilename);
        
        // Save LRC file
        let lrcUrl: string | undefined;
        if (lrcData) {
          const lrcFilename = `audio.lrc`;
          const lrcFilePath = getLRCPath(screenshot.pdfId, screenshot.page, lrcFilename);
          await fs.writeFile(lrcFilePath, lrcData, 'utf-8');
          lrcUrl = getLRCUrl(screenshot.pdfId, screenshot.page, lrcFilename);
        }
        
        await updateScreenshotAudio(id, audioFilePath, audioUrl, subtitleText, lrcUrl);
        results.audio = { success: true, url: audioUrl };
      } catch (error: any) {
        results.errors.push({ type: 'audio', message: error.message });
        results.audio = { success: false, error: error.message };
      }
    } else {
      results.audio = { success: true, url: screenshot.audioUrl, cached: true };
    }

    // Process exercises if not already processed
    if (!screenshot.exercises || screenshot.exercises.length === 0) {
      try {
        const exercisesResponse = await generateExercises(screenshot.path);
        await updateScreenshotExercises(id, exercisesResponse.exercises);
        results.exercises = { success: true, count: exercisesResponse.exercises.length };
      } catch (error: any) {
        results.errors.push({ type: 'exercises', message: error.message });
        results.exercises = { success: false, error: error.message };
      }
    } else {
      results.exercises = { success: true, count: screenshot.exercises.length, cached: true };
    }

    res.json(results);
  } catch (error: any) {
    console.error('Erro ao processar screenshot:', error);
    res.status(500).json({ 
      error: 'Erro ao processar screenshot',
      message: error.message 
    });
  }
});

export default router;
