/**
 * File logger for saving classifications to a text file for analysis
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Path to server/classifications.txt
export const LOG_FILE_PATH = path.resolve(__dirname, '../../classifications.txt');

/**
 * Appends a classification entry to classifications.txt
 * @param {string} videoId
 * @param {string} title
 * @param {boolean} isEducational
 */
export function logClassificationToFile(videoId, title, isEducational) {
  try {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const action = isEducational ? 'KEEP (EDUCATIONAL)    ' : 'BLUR (NON_EDUCATIONAL)';
    const cleanTitle = (title || '').replace(/[\r\n\t]+/g, ' ').trim();
    const line = `[${timestamp}] [${action}] [${videoId}] "${cleanTitle}"\n`;

    fs.appendFile(LOG_FILE_PATH, line, 'utf8', (err) => {
      if (err) {
        console.error('[FileLogger] Failed to write to classifications.txt:', err.message);
      }
    });
  } catch (err) {
    console.error('[FileLogger] Error logging classification:', err.message);
  }
}

/**
 * Batch logging helper
 * @param {Array<{ videoId: string, title: string, isEducational: boolean }>} entries
 */
export function logBatchClassificationsToFile(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return;

  try {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const lines = entries.map(e => {
      const action = e.isEducational ? 'KEEP (EDUCATIONAL)    ' : 'BLUR (NON_EDUCATIONAL)';
      const cleanTitle = (e.title || '').replace(/[\r\n\t]+/g, ' ').trim();
      return `[${timestamp}] [${action}] [${e.videoId}] "${cleanTitle}"\n`;
    }).join('');

    fs.appendFile(LOG_FILE_PATH, lines, 'utf8', (err) => {
      if (err) {
        console.error('[FileLogger] Failed to write batch to classifications.txt:', err.message);
      }
    });
  } catch (err) {
    console.error('[FileLogger] Error batch logging:', err.message);
  }
}
