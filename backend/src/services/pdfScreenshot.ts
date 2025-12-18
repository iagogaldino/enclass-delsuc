import path from 'path';
import { promises as fs } from 'fs';
import puppeteer from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';
import { PDFDocument, Screenshot } from '../types/pdf';
import { addScreenshot } from './database';
import { getPageDir, getScreenshotPath, getPageFileUrl, ensureDir } from './filePaths';

// Get total pages of PDF
async function getPDFPageCount(pdfPath: string): Promise<number> {
  const { PDFDocument } = await import('pdf-lib');
  const pdfBytes = await fs.readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  return pdfDoc.getPageCount();
}

// Generate screenshot of a specific page using Puppeteer
export async function generateScreenshot(
  pdf: PDFDocument,
  pageNumber: number
): Promise<{ imagePath: string; filename: string; screenshot: Screenshot }> {
  // Check if PDF file exists
  try {
    await fs.access(pdf.path);
  } catch {
    throw new Error(`Arquivo PDF não encontrado: ${pdf.path}`);
  }

  // Validate page number
  const totalPages = await getPDFPageCount(pdf.path);
  if (pageNumber < 1 || pageNumber > totalPages) {
    throw new Error(`Página inválida. O PDF tem ${totalPages} página(s). Página solicitada: ${pageNumber}`);
  }

  // Ensure page directory exists
  const pageDir = getPageDir(pdf.id, pageNumber);
  await ensureDir(pageDir);

  let browser;
  try {
    // Generate filename and path using new structure
    const filename = `screenshot.png`;
    const imagePath = getScreenshotPath(pdf.id, pageNumber, filename);
    
    // Launch Puppeteer browser
    browser = await puppeteer.launch({
      headless: 'new', // Use new headless mode
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    
    // Set viewport size
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Read PDF file and convert to base64
    const pdfBytes = await fs.readFile(pdf.path);
    const pdfBase64 = pdfBytes.toString('base64');
    
    // Get pdfjs-dist files path
    const pdfjsPath = path.join(__dirname, '../../node_modules/pdfjs-dist');
    const pdfjsBuildPath = path.join(pdfjsPath, 'build');
    
    // Check if pdfjs-dist is available locally
    let useLocalPdfjs = false;
    try {
      await fs.access(pdfjsBuildPath);
      useLocalPdfjs = true;
    } catch {
      // Will use CDN fallback
    }
    
    // Create HTML page with PDF.js to render the specific page
    // Use CDN for better compatibility, fallback to local if CDN fails
    const pdfjsScript = `<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>`;
    const pdfjsWorker = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        ${pdfjsScript}
        <style>
          body { 
            margin: 0; 
            padding: 0; 
            background: white; 
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
          }
          canvas { 
            display: block;
            max-width: 100%;
            height: auto;
          }
        </style>
      </head>
      <body>
        <canvas id="pdf-canvas"></canvas>
        <div id="status" style="display: none;">Rendering...</div>
        <script>
          (async () => {
            try {
              // Wait for pdfjs to be available
              let pdfjsLib;
              let attempts = 0;
              const maxAttempts = 100; // Increased attempts
              
              while (!pdfjsLib && attempts < maxAttempts) {
                pdfjsLib = window['pdfjs-dist'] || window['pdfjsLib'] || window['pdfjs'];
                if (!pdfjsLib) {
                  await new Promise(resolve => setTimeout(resolve, 200));
                  attempts++;
                }
              }
              
              if (!pdfjsLib) {
                throw new Error('PDF.js não carregou após ' + maxAttempts + ' tentativas');
              }
              
              console.log('PDF.js carregado, versão:', pdfjsLib.version || 'desconhecida');
              
              pdfjsLib.GlobalWorkerOptions.workerSrc = '${pdfjsWorker}';
              
              console.log('Carregando PDF... Tamanho base64:', '${pdfBase64}'.length, 'caracteres');
              
              // Decode base64
              const pdfData = atob('${pdfBase64}');
              console.log('PDF decodificado. Tamanho:', pdfData.length, 'bytes');
              
              // Convert to Uint8Array
              const pdfBytes = new Uint8Array(pdfData.length);
              for (let i = 0; i < pdfData.length; i++) {
                pdfBytes[i] = pdfData.charCodeAt(i);
              }
              
              const loadingTask = pdfjsLib.getDocument({
                data: pdfBytes
              });
              
              const pdfDocument = await loadingTask.promise;
              const totalPages = pdfDocument.numPages;
              console.log('PDF carregado. Total de páginas:', totalPages);
              
              // User reports: requesting page 7 captures page 6 (happens for ALL pages)
              // This means we're always off by -1
              // Currently: pageNumber - 1 = 6 for page 7 (shows page 6) ❌
              // To show page 7, we need index 7, which is pageNumber directly
              // Solution: use pageNumber directly without subtracting 1
              // Note: PDF.js getPage() uses 0-based, but based on user feedback,
              // we need to use pageNumber directly (1-based) for all pages
              const pdfjsIndex = ${pageNumber}; // Use pageNumber directly
              
              // Validate range (1 to totalPages)
              if (pdfjsIndex < 1 || pdfjsIndex > totalPages) {
                throw new Error('Página inválida. PDF tem ' + totalPages + ' página(s). Página solicitada: ${pageNumber}');
              }
              
              // Use pageNumber directly (no -1 conversion)
              // This means: page 7 -> index 7, page 1 -> index 1
              console.log('Carregando página', ${pageNumber}, '(índice PDF.js:', pdfjsIndex + ')');
              const pdfPage = await pdfDocument.getPage(pdfjsIndex);
              
              // Use a higher scale for better quality
              const scale = 2.5;
              const viewport = pdfPage.getViewport({ scale });
              
              const canvas = document.getElementById('pdf-canvas');
              if (!canvas) {
                throw new Error('Canvas element not found');
              }
              
              const context = canvas.getContext('2d');
              if (!context) {
                throw new Error('Cannot get 2d context from canvas');
              }
              
              // Set canvas dimensions
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              
              // Don't clear with white - let PDF.js render directly
              // This ensures we capture the actual PDF content
              
              console.log('Renderizando página... Canvas size:', canvas.width, 'x', canvas.height, 'Scale:', scale);
              console.log('Viewport size:', viewport.width, 'x', viewport.height);
              
              const renderContext = {
                canvasContext: context,
                viewport: viewport
              };
              
              console.log('Iniciando renderização...');
              const renderTask = pdfPage.render(renderContext);
              const renderPromise = renderTask.promise;
              
              // Wait for render to complete
              await renderPromise;
              console.log('Renderização concluída');
              
              // Wait a bit more to ensure all rendering is complete
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Verify canvas actually has content (not just white)
              const testCtx = canvas.getContext('2d');
              const sampleX = Math.floor(canvas.width / 2);
              const sampleY = Math.floor(canvas.height / 2);
              const imageData = testCtx.getImageData(sampleX, sampleY, 1, 1);
              const [r, g, b] = imageData.data;
              
              // Check if center pixel is not white
              const hasContent = r < 250 || g < 250 || b < 250;
              
              if (!hasContent) {
                // Try checking multiple points
                const points = [
                  { x: Math.floor(canvas.width * 0.1), y: Math.floor(canvas.height * 0.1) },
                  { x: Math.floor(canvas.width * 0.9), y: Math.floor(canvas.height * 0.9) },
                  { x: Math.floor(canvas.width * 0.5), y: Math.floor(canvas.height * 0.5) }
                ];
                
                let foundContent = false;
                for (const point of points) {
                  const testData = testCtx.getImageData(point.x, point.y, 1, 1);
                  if (testData.data[0] < 250 || testData.data[1] < 250 || testData.data[2] < 250) {
                    foundContent = true;
                    break;
                  }
                }
                
                if (!foundContent) {
                  console.warn('Canvas pode estar em branco. Continuando mesmo assim...');
                }
              }
              
              console.log('Página renderizada com sucesso! Canvas:', canvas.width, 'x', canvas.height, 'Sample color:', { r, g, b });
              
              // Mark as rendered
              document.getElementById('status').textContent = 'Rendered';
              document.body.setAttribute('data-rendered', 'true');
            } catch (error) {
              console.error('Error rendering PDF:', error);
              const errorMsg = error.message || String(error);
              document.getElementById('status').textContent = 'Error: ' + errorMsg;
              document.body.setAttribute('data-error', errorMsg);
              throw error; // Re-throw to be caught by waitForFunction
            }
          })();
        </script>
      </body>
      </html>
    `;
    
    // Set content and wait for rendering
    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait for PDF.js library to load
    try {
      await page.waitForFunction(
        'typeof window["pdfjs-dist"] !== "undefined" || typeof window["pdfjsLib"] !== "undefined" || typeof window["pdfjs"] !== "undefined"',
        { timeout: 20000 }
      );
      console.log('PDF.js carregado com sucesso');
    } catch (error) {
      // Check if there's an error message
      const errorMsg = await page.evaluate(() => {
        return document.body.getAttribute('data-error');
      });
      if (errorMsg) {
        throw new Error(`Erro ao carregar PDF.js: ${errorMsg}`);
      }
      throw new Error('PDF.js não carregou a tempo. Verifique sua conexão com a internet.');
    }
    
    // Wait for PDF to render (check for data-rendered attribute)
    try {
      await page.waitForFunction(
        'document.body.getAttribute("data-rendered") === "true"',
        { timeout: 30000 }
      );
      console.log('PDF renderizado com sucesso');
    } catch (error) {
      // Check for errors
      const errorMsg = await page.evaluate(() => {
        return document.body.getAttribute('data-error');
      });
      if (errorMsg) {
        throw new Error(`Erro ao renderizar PDF: ${errorMsg}`);
      }
      // If timeout but no error, try to proceed anyway
      console.warn('Timeout ao esperar renderização, tentando continuar...');
    }
    
    // Additional wait to ensure rendering is complete
    await page.waitForTimeout(1500);
    
    // Verify canvas has content before taking screenshot
    const canvasCheck = await page.evaluate(() => {
      const canvasEl = document.getElementById('pdf-canvas') as HTMLCanvasElement | null;
      if (!canvasEl) return { valid: false, reason: 'Canvas not found' };
      
      const ctx = canvasEl.getContext('2d');
      if (!ctx) return { valid: false, reason: 'Cannot get context' };
      
      const width = canvasEl.width;
      const height = canvasEl.height;
      
      if (width === 0 || height === 0) {
        return { valid: false, reason: 'Zero dimensions', width, height };
      }
      
      // Check multiple points for non-white content
      const checkPoints = [
        { x: Math.floor(width * 0.1), y: Math.floor(height * 0.1) },
        { x: Math.floor(width * 0.5), y: Math.floor(height * 0.5) },
        { x: Math.floor(width * 0.9), y: Math.floor(height * 0.9) },
        { x: Math.floor(width * 0.25), y: Math.floor(height * 0.75) },
        { x: Math.floor(width * 0.75), y: Math.floor(height * 0.25) }
      ];
      
      let nonWhiteCount = 0;
      const colors: Array<{ r: number; g: number; b: number }> = [];
      
      for (const point of checkPoints) {
        const imageData = ctx.getImageData(point.x, point.y, 1, 1);
        const [r, g, b] = imageData.data;
        colors.push({ r, g, b });
        if (r < 250 || g < 250 || b < 250) {
          nonWhiteCount++;
        }
      }
      
      return {
        valid: true,
        width,
        height,
        nonWhiteCount,
        totalChecks: checkPoints.length,
        sampleColors: colors
      };
    });
    
    console.log('Verificação do canvas antes do screenshot:', canvasCheck);
    
    if (!canvasCheck.valid) {
      throw new Error(`Canvas inválido: ${canvasCheck.reason}`);
    }
    
    if (canvasCheck.nonWhiteCount === 0) {
      console.warn('AVISO: Canvas parece estar em branco, mas continuando com screenshot...');
      console.warn('Cores amostradas:', canvasCheck.sampleColors);
    }
    
    // Take screenshot of the canvas
    const canvas = await page.$('#pdf-canvas');
    if (!canvas) {
      throw new Error('Canvas não encontrado');
    }
    
    console.log(`Capturando screenshot do canvas: ${canvasCheck.width}x${canvasCheck.height}`);
    
    await canvas.screenshot({
      path: imagePath,
      type: 'png',
      omitBackground: false
    });
    
    console.log(`Screenshot salvo em: ${imagePath}`);

    await browser.close();

    // Get file size
    const stats = await fs.stat(imagePath);
    const fileSize = stats.size;

    // Save screenshot info to database
    const screenshotData = {
      id: uuidv4(),
      pdfId: pdf.id,
      page: pageNumber,
      filename: filename,
      path: imagePath,
      url: getPageFileUrl(pdf.id, pageNumber, filename),
      size: fileSize,
      createdAt: new Date().toISOString()
    };

    const savedScreenshot = await addScreenshot(screenshotData);

    return {
      imagePath: imagePath,
      filename: filename,
      screenshot: savedScreenshot
    };
  } catch (error: any) {
    if (browser) {
      await browser.close();
    }
    
    // Provide more helpful error messages
    const errorMessage = error.message || String(error);
    
    if (errorMessage.includes('Cannot find module')) {
      throw new Error('Biblioteca de processamento de PDF não encontrada. Execute: npm install');
    }
    
    throw new Error(`Erro ao gerar screenshot: ${errorMessage}`);
  }
}

// Get PDF page count
export async function getPageCount(pdfPath: string): Promise<number> {
  return await getPDFPageCount(pdfPath);
}
