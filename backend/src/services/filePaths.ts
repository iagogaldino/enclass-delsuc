import path from 'path';
import { promises as fs } from 'fs';

const BASE_DIR = path.join(__dirname, '../../pdfs');

/**
 * Get the directory path for a specific PDF
 * Structure: pdfs/{pdfId}/
 */
export function getPDFDir(pdfId: string): string {
  return path.join(BASE_DIR, pdfId);
}

/**
 * Get the directory path for a specific page of a PDF
 * Structure: pdfs/{pdfId}/page-{pageNumber}/
 */
export function getPageDir(pdfId: string, pageNumber: number): string {
  return path.join(BASE_DIR, pdfId, `page-${pageNumber}`);
}

/**
 * Get the directory path for generated images of a specific page
 * Structure: pdfs/{pdfId}/page-{pageNumber}/generated-images/
 */
export function getGeneratedImagesDir(pdfId: string, pageNumber: number): string {
  return path.join(BASE_DIR, pdfId, `page-${pageNumber}`, 'generated-images');
}

/**
 * Ensure directory exists (creates if it doesn't)
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Get screenshot file path for a page
 */
export function getScreenshotPath(pdfId: string, pageNumber: number, filename?: string): string {
  const pageDir = getPageDir(pdfId, pageNumber);
  const defaultFilename = `screenshot.png`;
  return path.join(pageDir, filename || defaultFilename);
}

/**
 * Get audio file path for a page
 */
export function getAudioPath(pdfId: string, pageNumber: number, filename?: string): string {
  const pageDir = getPageDir(pdfId, pageNumber);
  const defaultFilename = `audio.mp3`;
  return path.join(pageDir, filename || defaultFilename);
}

/**
 * Get HTML file path for a page
 */
export function getHTMLPath(pdfId: string, pageNumber: number, filename?: string): string {
  const pageDir = getPageDir(pdfId, pageNumber);
  const defaultFilename = `page.html`;
  return path.join(pageDir, filename || defaultFilename);
}

/**
 * Get generated image path for a page
 */
export function getGeneratedImagePath(pdfId: string, pageNumber: number, imageFilename: string): string {
  const imagesDir = getGeneratedImagesDir(pdfId, pageNumber);
  return path.join(imagesDir, imageFilename);
}

/**
 * Get URL path for serving files (relative to base URL)
 * Structure: /pdfs/{pdfId}/page-{pageNumber}/{filename}
 */
export function getPageFileUrl(pdfId: string, pageNumber: number, filename: string): string {
  return `/pdfs/${pdfId}/page-${pageNumber}/${filename}`;
}

/**
 * Get URL path for generated images
 * Structure: /pdfs/{pdfId}/page-{pageNumber}/generated-images/{filename}
 */
export function getGeneratedImageUrl(pdfId: string, pageNumber: number, filename: string): string {
  return `/pdfs/${pdfId}/page-${pageNumber}/generated-images/${filename}`;
}

/**
 * Get LRC file path for a page
 */
export function getLRCPath(pdfId: string, pageNumber: number, filename?: string): string {
  const pageDir = getPageDir(pdfId, pageNumber);
  const defaultFilename = `audio.lrc`;
  return path.join(pageDir, filename || defaultFilename);
}

/**
 * Get URL path for LRC file
 * Structure: /pdfs/{pdfId}/page-{pageNumber}/{filename}
 */
export function getLRCUrl(pdfId: string, pageNumber: number, filename?: string): string {
  const defaultFilename = `audio.lrc`;
  return getPageFileUrl(pdfId, pageNumber, filename || defaultFilename);
}
