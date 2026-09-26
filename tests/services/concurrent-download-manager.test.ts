/**
 * Concurrent download manager progress tests
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ConcurrentDownloadManager } from '../../src/services/concurrent-download-manager';
import { DLCFile, DownloadStatus } from '../../src/types/module';

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

const files: DLCFile[] = [
  { path: 'scene.json', size: 10, type: 'scene' as any },
  { path: 'map.webp', size: 100, type: 'background' as any },
  { path: 'tile.webp', size: 50, type: 'tile' as any }
];

function makeServices(existing: string[] = []) {
  const apiService: any = {
    downloadFile: jest.fn(async (_mapId: string, path: string) => new Blob([path]))
  };
  const fileService: any = {
    disableMediaOptimizer: jest.fn(async () => {}),
    enableMediaOptimizer: jest.fn(async () => {}),
    fileExists: jest.fn(async (path: string) => existing.includes(path)),
    uploadFile: jest.fn(async () => {})
  };
  return { apiService, fileService };
}

describe('ConcurrentDownloadManager', () => {
  it('reports the full file count while files are still in flight', async () => {
    const { apiService, fileService } = makeServices();
    const totals: number[] = [];
    const manager = new ConcurrentDownloadManager(3, apiService, fileService, {
      onProgress: progress => totals.push(progress.totalFiles)
    });

    await manager.process('232', files);

    expect(totals.length).toBeGreaterThan(0);
    expect(new Set(totals)).toEqual(new Set([3]));
  });

  it('has final stats that count every completed file, including skipped ones', async () => {
    const { apiService, fileService } = makeServices(['map.webp']);
    const completed: string[] = [];
    const manager = new ConcurrentDownloadManager(2, apiService, fileService, {
      onFileComplete: (file, status) => {
        if (status === DownloadStatus.Completed) completed.push(file.path);
      }
    });

    await manager.process('232', files);

    expect(completed.sort()).toEqual(['map.webp', 'scene.json', 'tile.webp']);
    expect(manager.getStats()).toMatchObject({ totalFiles: 3, completedFiles: 3, failedFiles: 0 });
    expect(apiService.downloadFile).toHaveBeenCalledTimes(2);
  });
});
