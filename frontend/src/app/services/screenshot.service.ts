import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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

export interface ExercisesResponse {
  exercises: Exercise[];
}

@Injectable({
  providedIn: 'root'
})
export class ScreenshotService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/api';

  /**
   * Get screenshot information by ID
   * @param screenshotId - ID of the screenshot
   * @returns Observable with screenshot data
   */
  getScreenshot(screenshotId: string): Observable<{ screenshot: Screenshot }> {
    return this.http.get<{ screenshot: Screenshot }>(`${this.apiUrl}/screenshot/${screenshotId}`);
  }

  /**
   * Get screenshot by PDF ID and page number
   * @param pdfId - ID of the PDF
   * @param page - Page number
   * @param autoProcess - Whether to automatically process audio and exercises
   * @returns Observable with screenshot data
   */
  getScreenshotByPDFAndPage(pdfId: string, page: number, autoProcess: boolean = true): Observable<{ screenshot: Screenshot }> {
    const url = `${this.apiUrl}/pdf/${pdfId}/screenshot/page/${page}`;
    const options = autoProcess ? { params: { autoProcess: 'true' } } : {};
    return this.http.get<{ screenshot: Screenshot }>(url, options);
  }

  /**
   * Generate HTML from a screenshot by ID
   * @param screenshotId - ID of the screenshot
   * @returns Observable with HTML content as string
   */
  generateHTML(screenshotId: string): Observable<string> {
    return this.http.get(`${this.apiUrl}/screenshot/${screenshotId}/generate-html`, {
      responseType: 'text'
    });
  }

  /**
   * Generate audio explanation from a screenshot by ID
   * @param screenshotId - ID of the screenshot
   * @returns Observable with audio blob
   */
  generateAudio(screenshotId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/screenshot/${screenshotId}/generate-audio`, {
      responseType: 'blob'
    });
  }

  /**
   * Generate exercises from a screenshot by ID
   * @param screenshotId - ID of the screenshot
   * @returns Observable with exercises data
   */
  generateExercises(screenshotId: string): Observable<ExercisesResponse> {
    return this.http.get<ExercisesResponse>(`${this.apiUrl}/screenshot/${screenshotId}/generate-exercises`);
  }

  /**
   * Get subtitles for a screenshot by ID
   * @param screenshotId - ID of the screenshot
   * @returns Observable with subtitle text
   */
  getSubtitles(screenshotId: string): Observable<{ subtitleText: string | null }> {
    return this.http.get<{ subtitleText: string | null }>(`${this.apiUrl}/screenshot/${screenshotId}/subtitles`);
  }

  /**
   * Get total page count for a PDF
   * @param pdfId - ID of the PDF
   * @returns Observable with page count
   */
  getPageCount(pdfId: string): Observable<{ totalPages: number }> {
    return this.http.get<{ totalPages: number }>(`${this.apiUrl}/pdf/${pdfId}/pages`);
  }

  /**
   * Get LRC file for a screenshot by ID
   * @param screenshotId - ID of the screenshot
   * @returns Observable with LRC file content as string
   */
  getLRC(screenshotId: string): Observable<string> {
    return this.http.get(`${this.apiUrl}/screenshot/${screenshotId}/lrc`, {
      responseType: 'text'
    });
  }
}
