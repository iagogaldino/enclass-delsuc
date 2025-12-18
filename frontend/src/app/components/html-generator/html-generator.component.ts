import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { ScreenshotService, Screenshot, Exercise, ExercisesResponse } from '../../services/screenshot.service';
import { LRCParserService, LRCLine, LRCParagraph, LRCWord } from '../../services/lrc-parser.service';
import { SettingsModalComponent } from './settings-modal.component';

@Component({
  selector: 'app-html-generator',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatDialogModule
  ],
  templateUrl: './html-generator.component.html',
  styleUrl: './html-generator.component.scss'
})
export class HtmlGeneratorComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private screenshotService = inject(ScreenshotService);
  private lrcParser = inject(LRCParserService);
  private dialog = inject(MatDialog);
  private sanitizer = inject(DomSanitizer);

  pdfId = signal<string>('');
  pageNumber = signal<number>(0);
  screenshotId = signal<string>('');
  screenshot = signal<Screenshot | null>(null);
  screenshotUrl = signal<string>('');
  htmlContent = signal<SafeHtml | null>(null);
  loading = signal<boolean>(false);
  loadingScreenshot = signal<boolean>(false);
  generatingHTML = signal<boolean>(false);
  generatingAudio = signal<boolean>(false);
  audioUrl = signal<string | null>(null);
  generatingExercises = signal<boolean>(false);
  exercises = signal<Exercise[]>([]);
  selectedAnswers = signal<Map<number, number>>(new Map());
  showAnswers = signal<boolean>(false);
  showExercises = signal<boolean>(false);
  showHTMLView = signal<boolean>(false);
  error = signal<string>('');
  sidenavOpened = signal<boolean>(true);
  totalPages = signal<number>(0);
  loadingPageCount = signal<boolean>(false);
  processing = signal<boolean>(false);
  isAudioPlaying = signal<boolean>(false);
  subtitleText = signal<string | null>(null);
  showSubtitles = signal<boolean>(true);
  subtitleWords = signal<string[]>([]);
  currentWordIndex = signal<number>(-1);
  lrcData = signal<LRCLine[]>([]);
  lrcParagraphs = signal<LRCParagraph[]>([]);
  currentLRCIndex = signal<number>(-1);
  currentParagraphIndex = signal<number>(-1);
  private processingCheckInterval: any = null;
  private currentAudio: HTMLAudioElement | null = null;

  ngOnInit(): void {
    // Prevenir scroll no body quando componente está ativo
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';
    document.body.style.maxHeight = '100vh';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.height = '100vh';
    document.documentElement.style.maxHeight = '100vh';
    
    // Get PDF ID and page number from route parameters
    this.route.params.subscribe(params => {
      const pdfId = params['pdfId'];
      const page = params['page'];
      
      if (pdfId && page) {
        const pageNum = parseInt(page, 10);
        if (isNaN(pageNum) || pageNum < 1) {
          this.error.set('Número de página inválido. Use a rota: /screenshot/:pdfId/:page');
          this.loading.set(false);
          return;
        }
        
        this.pdfId.set(pdfId);
        this.pageNumber.set(pageNum);
        this.loadPageCount(pdfId);
        this.loadScreenshotByPDFAndPage(pdfId, pageNum);
      } else {
        // No parameters provided in route
        this.error.set('PDF ID e número da página não fornecidos na URL. Use a rota: /screenshot/:pdfId/:page');
        this.loading.set(false);
      }
    });
  }

  loadScreenshotByPDFAndPage(pdfId: string, page: number): void {
    this.loadingScreenshot.set(true);
    this.processing.set(true);
    this.error.set('');

    // Clear any existing interval
    if (this.processingCheckInterval) {
      clearInterval(this.processingCheckInterval);
      this.processingCheckInterval = null;
    }

    this.screenshotService.getScreenshotByPDFAndPage(pdfId, page, true).subscribe({
      next: (response) => {
        this.screenshot.set(response.screenshot);
        this.screenshotId.set(response.screenshot.id);
        // Build full URL for the screenshot image
        this.screenshotUrl.set(`http://localhost:3000${response.screenshot.url}`);
        
        // Check if processing is needed
        const needsProcessing = !response.screenshot.audioPath || !response.screenshot.exercises || response.screenshot.exercises.length === 0;
        
        if (needsProcessing) {
          // Start checking for completion
          this.startProcessingCheck(pdfId, page);
        } else {
          // Everything is ready, load content
          this.loadContent(response.screenshot);
          this.processing.set(false);
          this.loadingScreenshot.set(false);
        }
      },
      error: (err) => {
        console.error('Erro ao carregar screenshot:', err);
        this.error.set(err.error?.message || 'Erro ao carregar screenshot. Certifique-se de que o screenshot foi gerado para esta página.');
        this.processing.set(false);
        this.loadingScreenshot.set(false);
      }
    });
  }

  private loadContent(screenshot: Screenshot): void {
    // Load audio if available
    if (screenshot.audioUrl) {
      this.loadAudioFromUrl(screenshot.audioUrl);
    }
    
    // Load LRC file if available (preferred method)
    if (screenshot.lrcUrl) {
      this.loadLRC(screenshot.id);
    } else if (screenshot.subtitleText) {
      // Fallback: Load subtitles if LRC not available
      this.subtitleText.set(screenshot.subtitleText);
      // Always split text into words for karaoke effect
      const words = this.splitTextIntoWords(screenshot.subtitleText);
      if (words.length > 0) {
        this.subtitleWords.set(words);
        console.log('Legendas carregadas do screenshot:', words.length, 'palavras');
      } else {
        // If splitting failed, try to split again with fallback
        const fallbackWords = screenshot.subtitleText.split(/\s+/).filter(w => w.length > 0);
        this.subtitleWords.set(fallbackWords);
        console.log('Legendas carregadas (fallback):', fallbackWords.length, 'palavras');
      }
    } else {
      // Try to fetch subtitles from API if not in screenshot object
      this.loadSubtitles(screenshot.id);
    }
    
    // Load exercises if available (but don't show them automatically)
    if (screenshot.exercises && screenshot.exercises.length > 0) {
      this.exercises.set(screenshot.exercises);
      // Don't auto-show exercises - user must click to view them
      this.showExercises.set(false);
    } else {
      this.exercises.set([]);
      this.showExercises.set(false);
    }
    
    // Load HTML if available (preferred view)
    if (screenshot.htmlUrl) {
      this.loadExistingHTML(screenshot.id);
    } else {
      // If no HTML, show screenshot view
      this.showHTMLView.set(false);
    }
  }
  
  private loadExistingHTML(screenshotId: string): void {
    this.screenshotService.generateHTML(screenshotId).subscribe({
      next: (html) => {
        try {
          if (!html || typeof html !== 'string' || html.trim().length === 0) {
            console.warn('HTML vazio retornado');
            this.showHTMLView.set(false);
            return;
          }
          
          // Process HTML to convert relative image URLs to absolute URLs
          const processedHtml = this.processImageUrls(html);
          
          // Sanitize HTML before setting it
          const sanitizedHtml = this.sanitizeHTML(processedHtml);
          this.htmlContent.set(sanitizedHtml);
          this.showHTMLView.set(true); // Auto-show HTML view when available
          console.log('✅ HTML existente carregado e exibido');
        } catch (err: any) {
          console.error('Erro ao processar HTML existente:', err);
          this.showHTMLView.set(false);
        }
      },
      error: (err) => {
        console.error('Erro ao carregar HTML existente:', err);
        // If HTML loading fails, show screenshot view
        this.showHTMLView.set(false);
      }
    });
  }

  private loadLRC(screenshotId: string): void {
    this.screenshotService.getLRC(screenshotId).subscribe({
      next: (lrcContent) => {
        const lrcLines = this.lrcParser.parseLRC(lrcContent);
        this.lrcData.set(lrcLines);
        
        // Group lines into paragraphs
        const paragraphs = this.lrcParser.groupIntoParagraphs(lrcLines);
        this.lrcParagraphs.set(paragraphs);
        this.currentParagraphIndex.set(-1); // Reset to -1 initially
        console.log('LRC carregado:', lrcLines.length, 'linhas,', paragraphs.length, 'parágrafos');
        paragraphs.forEach((p, i) => {
          console.log(`Parágrafo ${i}:`, {
            timestamp: p.timestamp,
            words: p.words?.length || 0,
            text: p.text.substring(0, 50) + '...'
          });
        });
      },
      error: (err) => {
        console.error('Erro ao carregar LRC:', err);
        // Fallback to subtitle text if LRC fails
        const screenshot = this.screenshot();
        if (screenshot?.subtitleText) {
          this.subtitleText.set(screenshot.subtitleText);
          const words = this.splitTextIntoWords(screenshot.subtitleText);
          this.subtitleWords.set(words);
        }
      }
    });
  }

  private loadSubtitles(screenshotId: string): void {
    this.screenshotService.getSubtitles(screenshotId).subscribe({
      next: (response) => {
        if (response.subtitleText) {
          this.subtitleText.set(response.subtitleText);
          // Always split text into words for karaoke effect
          const words = this.splitTextIntoWords(response.subtitleText);
          if (words.length > 0) {
            this.subtitleWords.set(words);
            console.log('Legendas carregadas:', words.length, 'palavras');
          } else {
            // If splitting failed, try to split again with fallback
            const fallbackWords = response.subtitleText.split(/\s+/).filter(w => w.length > 0);
            this.subtitleWords.set(fallbackWords);
            console.log('Legendas carregadas (fallback):', fallbackWords.length, 'palavras');
          }
        } else {
          console.log('Nenhuma legenda disponível para este screenshot');
        }
      },
      error: (err) => {
        console.error('Erro ao carregar legendas:', err);
        // Don't show error, just leave subtitles as null
      }
    });
  }

  private splitTextIntoWords(text: string): string[] {
    if (!text || text.trim().length === 0) {
      return [];
    }
    
    // Split text into words, preserving spaces
    // Split by spaces but keep the spaces as separate tokens
    const words: string[] = [];
    const parts = text.split(/(\s+)/);
    
    for (const part of parts) {
      if (part.trim().length > 0) {
        // It's a word
        words.push(part);
      } else if (part.length > 0) {
        // It's whitespace (spaces, tabs, etc.)
        words.push(' ');
      }
    }
    
    return words.length > 0 ? words : [];
  }

  private updateKaraokeSubtitles(): void {
    if (!this.currentAudio) {
      return;
    }

    const audio = this.currentAudio;
    const currentTime = audio.currentTime;
    
    // Prefer LRC paragraphs if available (paragraph-by-paragraph display with word highlighting)
    const paragraphs = this.lrcParagraphs();
    if (paragraphs.length > 0) {
      const currentIndex = this.lrcParser.findCurrentParagraphIndex(paragraphs, currentTime);
      // Always ensure we have a valid index (0 or higher)
      const validIndex = currentIndex >= 0 ? currentIndex : 0;
      
      // Update paragraph index if changed
      if (this.currentParagraphIndex() !== validIndex) {
        this.currentParagraphIndex.set(validIndex);
        this.currentWordIndex.set(-1); // Reset word index when paragraph changes
      }
      
      // If current paragraph has word-level timestamps, find current word
      const currentParagraph = paragraphs[validIndex];
      if (currentParagraph?.words && currentParagraph.words.length > 0) {
        const wordIndex = this.lrcParser.findCurrentWordIndex(currentParagraph.words, currentTime);
        if (this.currentWordIndex() !== wordIndex) {
          this.currentWordIndex.set(wordIndex);
        }
      }
      
      return;
    }

    // Fallback: use LRC lines if paragraphs not available
    const lrcLines = this.lrcData();
    if (lrcLines.length > 0) {
      const currentIndex = this.lrcParser.findCurrentLineIndex(lrcLines, currentTime);
      if (this.currentLRCIndex() !== currentIndex) {
        this.currentLRCIndex.set(currentIndex);
      }
      return;
    }

    // Fallback to word-based synchronization
    if (!this.subtitleText()) {
      return;
    }

    const words = this.subtitleWords();
    
    if (words.length === 0) {
      return;
    }

    const duration = audio.duration || 0;
    
    if (duration === 0 || isNaN(duration)) {
      return;
    }

    // Calculate which word should be highlighted based on progress
    // Distribute words evenly across the audio duration
    const progress = Math.min(1, Math.max(0, currentTime / duration));
    const wordIndex = Math.floor(progress * words.length);
    
    // Clamp to valid range and ensure we don't go beyond array bounds
    const clampedIndex = Math.max(0, Math.min(wordIndex, words.length - 1));
    
    // Only update if index changed to avoid unnecessary re-renders
    if (this.currentWordIndex() !== clampedIndex) {
      this.currentWordIndex.set(clampedIndex);
    }
  }

  private startProcessingCheck(pdfId: string, page: number): void {
    // Check every 2 seconds if processing is complete
    this.processingCheckInterval = setInterval(() => {
      this.screenshotService.getScreenshotByPDFAndPage(pdfId, page, false).subscribe({
        next: (response) => {
          const screenshot = response.screenshot;
          // Check if both audio and exercises are ready
          const audioReady = !!screenshot.audioPath && !!screenshot.audioUrl;
          const exercisesReady = !!screenshot.exercises && screenshot.exercises.length > 0;
          
          if (audioReady && exercisesReady) {
            // Processing complete!
            if (this.processingCheckInterval) {
              clearInterval(this.processingCheckInterval);
              this.processingCheckInterval = null;
            }
            
            // Update screenshot and load content
            this.screenshot.set(screenshot);
            this.loadContent(screenshot);
            this.processing.set(false);
            this.loadingScreenshot.set(false);
          }
        },
        error: (err) => {
          console.error('Erro ao verificar processamento:', err);
          // Continue checking, don't stop on error
        }
      });
    }, 2000); // Check every 2 seconds
  }

  loadAudioFromUrl(audioUrl: string): void {
    const fullUrl = `http://localhost:3000${audioUrl}`;
    fetch(fullUrl)
      .then(response => response.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        this.audioUrl.set(url);
      })
      .catch(err => {
        console.error('Erro ao carregar áudio:', err);
      });
  }

  generateHTML(): void {
    const id = this.screenshotId();
    if (!id) {
      this.error.set('ID do screenshot não disponível. Por favor, recarregue a página.');
      return;
    }

    this.generatingHTML.set(true);
    this.error.set('');
    this.htmlContent.set(null);

    this.screenshotService.generateHTML(id).subscribe({
      next: (html) => {
        try {
          // Validate HTML before sanitizing
          if (!html || typeof html !== 'string') {
            throw new Error('Resposta inválida do servidor: HTML não é uma string válida');
          }

          // Process HTML to convert relative image URLs to absolute URLs
          const processedHtml = this.processImageUrls(html);

          // Sanitize HTML before setting it
          const sanitizedHtml = this.sanitizeHTML(processedHtml);
          this.htmlContent.set(sanitizedHtml);
          this.showHTMLView.set(true); // Auto-show HTML view when generated
          this.generatingHTML.set(false);
          this.error.set(''); // Clear any previous errors
        } catch (err: any) {
          console.error('Erro ao processar HTML:', err);
          const errorMessage = err?.message || 'Erro desconhecido';
          
          if (errorMessage.includes('vazio') || errorMessage.includes('inválido')) {
            this.error.set('O HTML gerado está vazio ou em formato inválido. Tente gerar novamente.');
          } else if (errorMessage.includes('servidor')) {
            this.error.set('Erro na resposta do servidor. Verifique sua conexão e tente novamente.');
          } else {
            this.error.set(`Erro ao processar HTML: ${errorMessage}`);
          }
          this.generatingHTML.set(false);
          this.htmlContent.set(null);
        }
      },
      error: (err) => {
        console.error('Erro ao gerar HTML:', err);
        
        let errorMessage = 'Erro ao gerar HTML do screenshot';
        
        if (err.status === 404) {
          errorMessage = 'Screenshot não encontrado. Por favor, recarregue a página.';
        } else if (err.status === 500) {
          errorMessage = err.error?.message || 'Erro interno do servidor. Tente novamente mais tarde.';
        } else if (err.status === 0 || err.status === undefined) {
          errorMessage = 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet.';
        } else if (err.error?.message) {
          errorMessage = err.error.message;
        } else if (err.message) {
          errorMessage = err.message;
        }
        
        this.error.set(errorMessage);
        this.generatingHTML.set(false);
        this.htmlContent.set(null);
      }
    });
  }

  /**
   * Sanitize HTML content to make it safe for rendering
   * @param html - Raw HTML string from the API
   * @returns SafeHtml object that can be used with [innerHTML]
   * @throws Error if HTML is invalid or empty
   */
  private sanitizeHTML(html: string): SafeHtml {
    if (!html) {
      throw new Error('HTML vazio: nenhum conteúdo recebido');
    }

    if (typeof html !== 'string') {
      throw new Error(`HTML inválido: esperado string, recebido ${typeof html}`);
    }

    const trimmedHtml = html.trim();
    if (trimmedHtml.length === 0) {
      throw new Error('HTML vazio: conteúdo está vazio após remoção de espaços');
    }

    // Basic validation: check for minimum HTML structure
    const hasHTMLTags = /<[a-z][\s\S]*>/i.test(trimmedHtml);
    if (!hasHTMLTags && trimmedHtml.length < 10) {
      throw new Error('HTML inválido: não contém tags HTML válidas');
    }

    // Use bypassSecurityTrustHtml to allow HTML rendering
    // Note: This is safe because the HTML comes from our own backend/OpenAI API
    // In production, you might want to use a more restrictive sanitizer
    try {
      return this.sanitizer.bypassSecurityTrustHtml(trimmedHtml);
    } catch (sanitizeError: any) {
      throw new Error(`Erro ao sanitizar HTML: ${sanitizeError?.message || 'Erro desconhecido'}`);
    }
  }

  /**
   * Toggle between HTML view and screenshot view
   */
  toggleViewMode(): void {
    if (this.htmlContent()) {
      this.showHTMLView.set(!this.showHTMLView());
    }
  }

  /**
   * Generate HTML if not exists, or toggle view if already generated
   */
  generateOrShowHTML(): void {
    if (this.htmlContent()) {
      // HTML already generated, toggle view
      this.toggleViewMode();
    } else {
      // Generate HTML
      this.generateHTML();
    }
  }

  /**
   * Process HTML to convert relative image URLs to absolute URLs
   * @param html - HTML content with relative URLs
   * @returns HTML with absolute URLs
   */
  private processImageUrls(html: string): string {
    const backendUrl = 'http://localhost:3000';
    
    // Convert relative URLs for new hierarchical structure: /pdfs/{pdfId}/page-{pageNumber}/...
    // Pattern: src="/pdfs/..." -> src="http://localhost:3000/pdfs/..."
    html = html.replace(/src=["'](\/pdfs\/[^"']+)["']/gi, 
      (match, url) => `src="${backendUrl}${url}"`);
    
    // Convert relative URLs for legacy structure: /generated-images, /screenshots, /audio, /html
    // Pattern: src="/generated-images/..." -> src="http://localhost:3000/generated-images/..."
    html = html.replace(/src=["'](\/(?:generated-images|screenshots|audio|html)\/[^"']+)["']/gi, 
      (match, url) => `src="${backendUrl}${url}"`);
    
    // Also handle URLs without quotes for new structure
    html = html.replace(/src=(\/pdfs\/[^\s>]+)/gi, 
      (match, url) => `src="${backendUrl}${url}"`);
    
    // Also handle URLs without quotes for legacy structure
    html = html.replace(/src=(\/(?:generated-images|screenshots|audio|html)\/[^\s>]+)/gi, 
      (match, url) => `src="${backendUrl}${url}"`);
    
    return html;
  }

  reload(): void {
    const pdfId = this.pdfId();
    const page = this.pageNumber();
    if (pdfId && page > 0) {
      this.htmlContent.set(null);
      this.showHTMLView.set(false);
      this.audioUrl.set(null);
      this.exercises.set([]);
      this.selectedAnswers.set(new Map());
      this.showAnswers.set(false);
      this.showExercises.set(false);
      this.loadScreenshotByPDFAndPage(pdfId, page);
    }
  }

  generateAudio(): void {
    const id = this.screenshotId();
    if (!id) {
      this.error.set('ID do screenshot não disponível');
      return;
    }

    // Check if audio already exists
    const screenshot = this.screenshot();
    if (screenshot?.audioUrl) {
      this.loadAudioFromUrl(screenshot.audioUrl);
      return;
    }

    this.generatingAudio.set(true);
    this.error.set('');

    this.screenshotService.generateAudio(id).subscribe({
      next: (audioBlob) => {
        // Create object URL from blob
        const url = URL.createObjectURL(audioBlob);
        this.audioUrl.set(url);
        this.generatingAudio.set(false);
        
        // Load LRC or subtitles after generating audio
        const screenshot = this.screenshot();
        if (screenshot?.lrcUrl) {
          this.loadLRC(id);
        } else {
          this.loadSubtitles(id);
        }
        
        // Reload screenshot to get updated audioUrl
        const pdfId = this.pdfId();
        const page = this.pageNumber();
        if (pdfId && page > 0) {
          this.loadScreenshotByPDFAndPage(pdfId, page);
        }
        
        // Auto-play the audio
        const audio = new Audio(url);
        audio.play().catch(err => {
          console.error('Erro ao reproduzir áudio:', err);
          this.error.set('Erro ao reproduzir áudio. Clique no botão de play para tentar novamente.');
        });
      },
      error: (err) => {
        console.error('Erro ao gerar áudio:', err);
        this.error.set(err.error?.message || 'Erro ao gerar áudio explicativo');
        this.generatingAudio.set(false);
      }
    });
  }

  playAudio(): void {
    // Stop current audio if playing
    if (this.currentAudio && !this.currentAudio.paused) {
      this.stopAudio();
    }

    const url = this.audioUrl();
    if (url) {
      this.currentAudio = new Audio(url);
      
      // Set up event listeners
      this.currentAudio.addEventListener('play', () => {
        this.isAudioPlaying.set(true);
      });
      
      this.currentAudio.addEventListener('pause', () => {
        this.isAudioPlaying.set(false);
        // Keep current word index when paused
      });
      
      this.currentAudio.addEventListener('ended', () => {
        this.isAudioPlaying.set(false);
        this.currentAudio = null;
      });
      
      // Sync subtitles with audio playback (karaoke effect)
      this.currentAudio.addEventListener('timeupdate', () => {
        this.updateKaraokeSubtitles();
      });
      
      // Initialize karaoke when audio metadata is loaded
      this.currentAudio.addEventListener('loadedmetadata', () => {
        this.updateKaraokeSubtitles();
      });
      
      this.currentAudio.addEventListener('error', () => {
        this.isAudioPlaying.set(false);
        this.currentAudio = null;
        this.error.set('Erro ao reproduzir áudio. Verifique se o áudio está disponível.');
      });

      this.currentAudio.play().catch(err => {
        console.error('Erro ao reproduzir áudio:', err);
        this.error.set('Erro ao reproduzir áudio. Verifique se o áudio está disponível.');
        this.isAudioPlaying.set(false);
        this.currentAudio = null;
      });
    } else {
      // If audio URL is not available, try to load it from screenshot
      const screenshot = this.screenshot();
      if (screenshot?.audioUrl) {
        this.loadAudioFromUrl(screenshot.audioUrl);
        // Wait a bit and try again
        setTimeout(() => {
          const newUrl = this.audioUrl();
          if (newUrl) {
            this.currentAudio = new Audio(newUrl);
            
            // Set up event listeners
            this.currentAudio.addEventListener('play', () => {
              this.isAudioPlaying.set(true);
            });
            
            this.currentAudio.addEventListener('pause', () => {
              this.isAudioPlaying.set(false);
            });
            
      this.currentAudio.addEventListener('ended', () => {
        this.isAudioPlaying.set(false);
        this.currentAudio = null;
        this.currentWordIndex.set(-1);
        this.currentLRCIndex.set(-1);
        this.currentParagraphIndex.set(-1);
      });
            
            this.currentAudio.addEventListener('error', () => {
              this.isAudioPlaying.set(false);
              this.currentAudio = null;
              this.error.set('Erro ao reproduzir áudio. Verifique se o áudio está disponível.');
            });

            this.currentAudio.play().catch(err => {
              console.error('Erro ao reproduzir áudio:', err);
              this.error.set('Erro ao reproduzir áudio. Verifique se o áudio está disponível.');
              this.isAudioPlaying.set(false);
              this.currentAudio = null;
            });
          }
        }, 500);
      } else {
        this.error.set('Áudio não disponível. Gere o áudio primeiro.');
      }
    }
  }

  stopAudio(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
      this.isAudioPlaying.set(false);
      this.currentWordIndex.set(-1);
      this.currentLRCIndex.set(-1);
      this.currentParagraphIndex.set(-1);
    }
  }

  generateExercises(): void {
    const id = this.screenshotId();
    if (!id) {
      this.error.set('ID do screenshot não disponível');
      return;
    }

    // Check if exercises already exist
    const screenshot = this.screenshot();
    if (screenshot?.exercises && screenshot.exercises.length > 0) {
      this.exercises.set(screenshot.exercises);
      this.showExercises.set(true);
      return;
    }

    this.generatingExercises.set(true);
    this.error.set('');
    this.exercises.set([]);
    this.selectedAnswers.set(new Map());
    this.showAnswers.set(false);
    this.showExercises.set(false);

    this.screenshotService.generateExercises(id).subscribe({
      next: (response: ExercisesResponse) => {
        this.exercises.set(response.exercises);
        this.showExercises.set(true);
        this.generatingExercises.set(false);
        
        // Reload screenshot to get updated exercises
        const pdfId = this.pdfId();
        const page = this.pageNumber();
        if (pdfId && page > 0) {
          this.loadScreenshotByPDFAndPage(pdfId, page);
        }
      },
      error: (err) => {
        console.error('Erro ao gerar exercícios:', err);
        this.error.set(err.error?.message || 'Erro ao gerar exercícios');
        this.generatingExercises.set(false);
      }
    });
  }

  toggleExercises(): void {
    if (this.exercises().length > 0) {
      this.showExercises.set(!this.showExercises());
    }
  }

  selectAnswer(exerciseIndex: number, optionIndex: number): void {
    if (this.showAnswers()) return; // Don't allow changes after showing answers
    
    const currentAnswers = new Map(this.selectedAnswers());
    currentAnswers.set(exerciseIndex, optionIndex);
    this.selectedAnswers.set(currentAnswers);
  }

  toggleAnswers(): void {
    this.showAnswers.set(!this.showAnswers());
  }

  isCorrect(exerciseIndex: number, optionIndex: number): boolean {
    if (!this.showAnswers()) return false;
    const exercise = this.exercises()[exerciseIndex];
    return exercise && exercise.correctAnswer === optionIndex;
  }

  isSelected(exerciseIndex: number, optionIndex: number): boolean {
    return this.selectedAnswers().get(exerciseIndex) === optionIndex;
  }

  getScore(): number {
    const exercises = this.exercises();
    const answers = this.selectedAnswers();
    let correct = 0;
    
    exercises.forEach((exercise, index) => {
      if (answers.get(index) === exercise.correctAnswer) {
        correct++;
      }
    });
    
    return exercises.length > 0 ? Math.round((correct / exercises.length) * 100) : 0;
  }

  getOptionLabel(index: number): string {
    return String.fromCharCode(65 + index);
  }

  closeExercises(): void {
    this.exercises.set([]);
    this.selectedAnswers.set(new Map());
    this.showAnswers.set(false);
  }

  loadPageCount(pdfId: string): void {
    this.loadingPageCount.set(true);
    this.screenshotService.getPageCount(pdfId).subscribe({
      next: (response) => {
        this.totalPages.set(response.totalPages);
        this.loadingPageCount.set(false);
      },
      error: (err) => {
        console.error('Erro ao carregar número de páginas:', err);
        this.loadingPageCount.set(false);
      }
    });
  }

  downloadLRC(): void {
    const screenshotId = this.screenshotId();
    if (!screenshotId) {
      this.error.set('ID do screenshot não disponível.');
      return;
    }

    // Force regenerate audio (which will regenerate LRC)
    this.generatingAudio.set(true);
    this.error.set('');

    this.screenshotService.generateAudio(screenshotId).subscribe({
      next: (audioBlob) => {
        // Create object URL from blob
        const url = URL.createObjectURL(audioBlob);
        this.audioUrl.set(url);
        this.generatingAudio.set(false);
        
        // Wait a bit for LRC to be saved, then download it
        setTimeout(() => {
          this.screenshotService.getLRC(screenshotId).subscribe({
            next: (lrcContent) => {
              // Create a blob and download
              const blob = new Blob([lrcContent], { type: 'text/plain;charset=utf-8' });
              const downloadUrl = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = downloadUrl;
              link.download = `audio-${screenshotId}.lrc`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(downloadUrl);
              
              // Reload screenshot to get updated LRC URL
              const pdfId = this.pdfId();
              const page = this.pageNumber();
              if (pdfId && page > 0) {
                this.loadScreenshotByPDFAndPage(pdfId, page);
              }
              
              // Load LRC for display
              this.loadLRC(screenshotId);
            },
            error: (err) => {
              console.error('Erro ao baixar LRC:', err);
              this.error.set('Erro ao baixar arquivo LRC. Tente novamente.');
            }
          });
        }, 2000); // Wait 2 seconds for LRC to be generated and saved
      },
      error: (err) => {
        console.error('Erro ao regenerar áudio:', err);
        this.generatingAudio.set(false);
        this.error.set('Erro ao regenerar áudio e LRC. Tente novamente.');
      }
    });
  }

  navigateToPage(page: number): void {
    const pdfId = this.pdfId();
    const totalPages = this.totalPages();
    
    if (page < 1 || (totalPages > 0 && page > totalPages)) {
      return;
    }

    // Clear current content
    this.htmlContent.set(null);
    this.showHTMLView.set(false);
    this.audioUrl.set(null);
    this.subtitleText.set(null);
    this.subtitleWords.set([]);
    this.currentWordIndex.set(-1);
    this.lrcData.set([]);
    this.lrcParagraphs.set([]);
    this.currentLRCIndex.set(-1);
    this.currentParagraphIndex.set(-1);
    this.exercises.set([]);
    this.selectedAnswers.set(new Map());
    this.showAnswers.set(false);
    this.showExercises.set(false);
    this.error.set('');

    // Navigate to new page
    this.router.navigate(['/screenshot', pdfId, page]);
  }

  previousPage(): void {
    const currentPage = this.pageNumber();
    if (currentPage > 1) {
      this.navigateToPage(currentPage - 1);
    }
  }

  nextPage(): void {
    const currentPage = this.pageNumber();
    const totalPages = this.totalPages();
    
    if (totalPages > 0 && currentPage < totalPages) {
      this.navigateToPage(currentPage + 1);
    } else if (totalPages === 0) {
      // If we don't know total pages yet, try to navigate anyway
      this.navigateToPage(currentPage + 1);
    }
  }

  canGoPrevious(): boolean {
    return this.pageNumber() > 1;
  }

  canGoNext(): boolean {
    const currentPage = this.pageNumber();
    const totalPages = this.totalPages();
    return totalPages === 0 || currentPage < totalPages;
  }

  openSettingsModal(): void {
    const dialogRef = this.dialog.open(SettingsModalComponent, {
      width: '400px',
      data: {
        generateHTML: () => {
          this.generateHTML();
        },
        generateAudio: () => {
          this.generateAudio();
        },
        generateExercises: () => {
          this.generateExercises();
        },
        reload: () => {
          this.reload();
          dialogRef.close();
        },
        downloadLRC: () => {
          this.downloadLRC();
        },
        hasLRC: !!this.screenshot()?.lrcUrl,
        generatingHTML: this.generatingHTML(),
        generatingAudio: this.generatingAudio(),
        generatingExercises: this.generatingExercises(),
        loadingScreenshot: this.loadingScreenshot()
      }
    });
  }

  ngOnDestroy(): void {
    // Restaurar scroll do body quando componente é destruído
    document.body.style.overflow = '';
    document.body.style.height = '';
    document.body.style.maxHeight = '';
    document.documentElement.style.overflow = '';
    document.documentElement.style.height = '';
    document.documentElement.style.maxHeight = '';
    
    // Clear processing interval
    if (this.processingCheckInterval) {
      clearInterval(this.processingCheckInterval);
      this.processingCheckInterval = null;
    }
    
    // Stop and clean up audio
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
      this.isAudioPlaying.set(false);
    }
    
    // Clean up object URL to prevent memory leaks
    const url = this.audioUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
  }
}
