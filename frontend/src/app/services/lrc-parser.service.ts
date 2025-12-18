import { Injectable } from '@angular/core';

export interface LRCLine {
  timestamp: number; // em segundos
  text: string;
}

export interface LRCParagraph {
  timestamp: number; // timestamp da primeira palavra do parágrafo
  text: string; // texto completo do parágrafo
  endTimestamp?: number; // timestamp da última palavra (opcional)
  words?: LRCWord[]; // palavras individuais com timestamps (opcional)
}

export interface LRCWord {
  timestamp: number; // timestamp da palavra
  text: string; // texto da palavra
  index: number; // índice da palavra no parágrafo
}

@Injectable({
  providedIn: 'root'
})
export class LRCParserService {
  /**
   * Parse LRC content string into array of LRCLine objects
   * @param lrcContent - LRC file content as string
   * @returns Array of LRCLine objects sorted by timestamp
   */
  parseLRC(lrcContent: string): LRCLine[] {
    if (!lrcContent || lrcContent.trim().length === 0) {
      return [];
    }

    const lines: LRCLine[] = [];
    const lrcLines = lrcContent.split('\n');

    for (const line of lrcLines) {
      const trimmedLine = line.trim();
      if (trimmedLine.length === 0) {
        continue;
      }

      // Match LRC format: [mm:ss.xx]text
      // Example: [00:05.20]Verbs are action words.
      const match = trimmedLine.match(/^\[(\d{2}):(\d{2})\.(\d{2})\](.+)$/);
      
      if (match) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const centiseconds = parseInt(match[3], 10);
        const text = match[4].trim();

        // Convert to total seconds
        const timestamp = minutes * 60 + seconds + centiseconds / 100;

        if (text.length > 0) {
          lines.push({
            timestamp,
            text
          });
        }
      }
    }

    // Sort by timestamp to ensure correct order
    lines.sort((a, b) => a.timestamp - b.timestamp);

    return lines;
  }

  /**
   * Find the current line index based on audio currentTime
   * Uses binary search for efficiency
   * @param lrcLines - Array of LRCLine objects
   * @param currentTime - Current audio time in seconds
   * @returns Index of the current line, or -1 if not found
   */
  findCurrentLineIndex(lrcLines: LRCLine[], currentTime: number): number {
    if (lrcLines.length === 0 || currentTime < 0) {
      return -1;
    }

    // Binary search for the line that should be active
    let left = 0;
    let right = lrcLines.length - 1;
    let result = -1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      
      if (lrcLines[mid].timestamp <= currentTime) {
        // This line could be active, but check if there's a later one
        result = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return result;
  }

  /**
   * Group LRC lines into paragraphs based on sentence endings
   * A paragraph ends when a sentence ends (., !, ?) followed by space or newline
   * @param lrcLines - Array of LRCLine objects
   * @returns Array of LRCParagraph objects with word-level timestamps
   */
  groupIntoParagraphs(lrcLines: LRCLine[]): LRCParagraph[] {
    if (lrcLines.length === 0) {
      return [];
    }

    // If we have only one line with a lot of text, split it into sentences first
    if (lrcLines.length === 1 && lrcLines[0].text.length > 100) {
      return this.splitLongTextIntoParagraphs(lrcLines[0]);
    }

    // Check if we have word-level timestamps (many lines with single words)
    const hasWordLevelTimestamps = lrcLines.length > 10 && 
      lrcLines.every(line => line.text.trim().split(/\s+/).length <= 2);

    const paragraphs: LRCParagraph[] = [];
    let currentParagraph: { 
      timestamp: number; 
      words: LRCWord[]; 
      sentenceCount: number;
      textParts: string[];
    } | null = null;

    for (let i = 0; i < lrcLines.length; i++) {
      const line = lrcLines[i];
      const text = line.text.trim();
      
      if (text.length === 0) {
        continue;
      }

      // Check if this word/text ends a sentence (ends with ., !, or ?)
      const endsSentence = /[.!?]+$/.test(text);
      
      if (!currentParagraph) {
        // Start new paragraph
        const wordIndex = 0;
        currentParagraph = {
          timestamp: line.timestamp,
          words: hasWordLevelTimestamps ? [{
            timestamp: line.timestamp,
            text: text,
            index: wordIndex
          }] : [],
          sentenceCount: endsSentence ? 1 : 0,
          textParts: [text]
        };
      } else {
        // Add word with timestamp
        const wordIndex = currentParagraph.words.length;
        if (hasWordLevelTimestamps) {
          currentParagraph.words.push({
            timestamp: line.timestamp,
            text: text,
            index: wordIndex
          });
        }
        
        // Add to text parts for building full text
        const lastPart = currentParagraph.textParts[currentParagraph.textParts.length - 1];
        const needsSpace = !lastPart.endsWith(' ') && !text.startsWith(' ') && 
                          !lastPart.match(/[.!?]+$/) && // Don't add space after punctuation
                          !text.match(/^[.!?,:;]/); // Don't add space before punctuation
        
        if (needsSpace) {
          currentParagraph.textParts.push(' ' + text);
        } else {
          currentParagraph.textParts.push(text);
        }
        
        // Update sentence count
        if (endsSentence) {
          currentParagraph.sentenceCount++;
        }
      }

      // If this line ends a sentence, check if we should start a new paragraph
      // Group 2-3 sentences per paragraph for better readability
      if (endsSentence && currentParagraph.sentenceCount >= 2) {
        // Finalize paragraph after 2-3 sentences
        const paragraphText = currentParagraph.textParts.join('').trim();
        if (paragraphText.length > 0) {
          paragraphs.push({
            timestamp: currentParagraph.timestamp,
            text: paragraphText,
            endTimestamp: line.timestamp,
            words: hasWordLevelTimestamps ? currentParagraph.words : undefined
          });
        }
        currentParagraph = null;
      }
    }

    // Add remaining paragraph if exists
    if (currentParagraph) {
      const paragraphText = currentParagraph.textParts.join('').trim();
      if (paragraphText.length > 0) {
        paragraphs.push({
          timestamp: currentParagraph.timestamp,
          text: paragraphText,
          endTimestamp: lrcLines[lrcLines.length - 1]?.timestamp,
          words: hasWordLevelTimestamps ? currentParagraph.words : undefined
        });
      }
    }

    return paragraphs;
  }

  /**
   * Find the current word index within a paragraph based on audio currentTime
   * @param words - Array of LRCWord objects
   * @param currentTime - Current audio time in seconds
   * @returns Index of the current word, or -1 if not found
   */
  findCurrentWordIndex(words: LRCWord[], currentTime: number): number {
    if (words.length === 0 || currentTime < 0) {
      return -1;
    }

    // Binary search for the word that should be active
    let left = 0;
    let right = words.length - 1;
    let result = -1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      
      if (words[mid].timestamp <= currentTime) {
        result = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return result;
  }

  /**
   * Split a long text line into paragraphs based on sentence endings
   * Used when LRC has only one line with all text
   * Creates word-level timestamps for karaoke effect
   */
  private splitLongTextIntoParagraphs(line: LRCLine): LRCParagraph[] {
    const text = line.text;
    const paragraphs: LRCParagraph[] = [];
    
    // Split text into words first (for word-level timestamps)
    const words = text.match(/\S+/g) || []; // Match all non-whitespace sequences
    if (words.length === 0) {
      return [{
        timestamp: line.timestamp,
        text: text.trim()
      }];
    }
    
    // Estimate time per word: average speaking rate is ~150 words per minute = 2.5 words/second
    const timePerWord = 1 / 2.5; // ~0.4 seconds per word
    
    // Split text into sentences for paragraph grouping
    const sentenceRegex = /([^.!?]+[.!?]+)\s*/g;
    const sentences: { text: string; startWordIndex: number; endWordIndex: number }[] = [];
    let lastIndex = 0;
    let match;
    let currentWordIndex = 0;
    
    while ((match = sentenceRegex.exec(text)) !== null) {
      const sentenceText = match[1].trim();
      const sentenceWords = sentenceText.match(/\S+/g) || [];
      const startWordIndex = currentWordIndex;
      const endWordIndex = currentWordIndex + sentenceWords.length - 1;
      
      sentences.push({
        text: sentenceText,
        startWordIndex,
        endWordIndex
      });
      
      currentWordIndex = endWordIndex + 1;
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text as last sentence
    if (lastIndex < text.length) {
      const remaining = text.substring(lastIndex).trim();
      if (remaining.length > 0) {
        const remainingWords = remaining.match(/\S+/g) || [];
        sentences.push({
          text: remaining,
          startWordIndex: currentWordIndex,
          endWordIndex: currentWordIndex + remainingWords.length - 1
        });
      }
    }
    
    // Group sentences into paragraphs (2-3 sentences per paragraph)
    let currentParagraph: {
      sentences: typeof sentences;
      words: LRCWord[];
      startTime: number;
    } | null = null;
    
    let paragraphStartTime = line.timestamp;
    let globalWordIndex = 0;
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      
      if (!currentParagraph) {
        currentParagraph = {
          sentences: [sentence],
          words: [],
          startTime: paragraphStartTime
        };
      } else {
        currentParagraph.sentences.push(sentence);
      }
      
      // Add words from this sentence to paragraph
      for (let w = sentence.startWordIndex; w <= sentence.endWordIndex && w < words.length; w++) {
        const wordText = words[w];
        const wordTimestamp = paragraphStartTime + (w * timePerWord);
        currentParagraph.words.push({
          timestamp: wordTimestamp,
          text: wordText,
          index: currentParagraph.words.length
        });
      }
      
      // Create paragraph every 2-3 sentences
      const shouldBreak = 
        currentParagraph.sentences.length >= 3 || // 3 sentences max
        (currentParagraph.sentences.length >= 2 && i < sentences.length - 1 && 
         (sentence.text.endsWith('.') || sentence.text.endsWith('!') || sentence.text.endsWith('?')));
      
      if (shouldBreak || i === sentences.length - 1) {
        const paragraphText = currentParagraph.sentences.map(s => s.text).join(' ').trim();
        const paragraphEndTime = paragraphStartTime + (currentParagraph.words.length * timePerWord);
        
        paragraphs.push({
          timestamp: currentParagraph.startTime,
          text: paragraphText,
          endTimestamp: paragraphEndTime,
          words: currentParagraph.words
        });
        
        paragraphStartTime = paragraphEndTime;
        currentParagraph = null;
      }
    }
    
    return paragraphs;
  }

  /**
   * Find the current paragraph index based on audio currentTime
   * @param paragraphs - Array of LRCParagraph objects
   * @param currentTime - Current audio time in seconds
   * @returns Index of the current paragraph, or 0 if not found (to show first paragraph)
   */
  findCurrentParagraphIndex(paragraphs: LRCParagraph[], currentTime: number): number {
    if (paragraphs.length === 0) {
      return -1;
    }

    // If time is 0 or very close to 0, show first paragraph
    if (currentTime <= 0.1) {
      return 0;
    }

    // Find paragraph where currentTime falls within its range
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      const nextParagraph = paragraphs[i + 1];
      
      // Check if currentTime is within this paragraph's range
      if (currentTime >= paragraph.timestamp) {
        // If there's a next paragraph, check if we've passed this one
        if (nextParagraph) {
          // If we've reached the next paragraph's timestamp, move to it
          if (currentTime >= nextParagraph.timestamp) {
            continue; // Move to next paragraph
          }
        }
        
        // Check if we're still within this paragraph's end time (if available)
        if (paragraph.endTimestamp && currentTime > paragraph.endTimestamp) {
          // We've passed this paragraph, check next
          if (nextParagraph) {
            continue;
          }
        }
        
        // This is the current paragraph
        return i;
      }
    }

    // If we're before the first paragraph (shouldn't happen with the 0.1 check above), return first
    if (currentTime < paragraphs[0].timestamp) {
      return 0;
    }

    // If we're past all paragraphs, return the last one
    return paragraphs.length - 1;
  }
}
