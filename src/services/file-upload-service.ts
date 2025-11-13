/**
 * File Upload Service
 * Handles uploading downloaded files to Foundry's file storage
 */

export class FileUploadService {
  private mediaOptimizerOriginalState: boolean | null = null;

  /**
   * Upload a blob to Foundry storage
   */
  async uploadFile(blob: Blob, targetPath: string): Promise<void> {
    try {
      console.log(`Dorman Lakely Cartography | Starting upload: ${targetPath}`);
      console.log(`Dorman Lakely Cartography | Blob size: ${blob.size} bytes, type: ${blob.type}`);

      // Skip scene.json - it will be used in-memory only
      const fileName = targetPath.split('/').pop() || 'file';
      if (fileName === 'scene.json') {
        console.log(
          `Dorman Lakely Cartography | ⏭️  Skipping scene.json upload (will be used in-memory)`
        );
        return;
      }

      // Determine the storage source based on path
      const source = this.getFilePickerSource(targetPath);
      console.log(`Dorman Lakely Cartography | Using source: ${source}`);

      // Get the directory path
      const directory = targetPath.substring(0, targetPath.lastIndexOf('/'));
      console.log(`Dorman Lakely Cartography | Upload directory: ${directory}`);

      // Ensure directory exists before upload
      await this.ensureDirectory(directory);

      // Create a File object from the blob
      const file = new File([blob], fileName, { type: blob.type });
      console.log(`Dorman Lakely Cartography | Created file object: ${fileName}`);

      // Upload the file
      console.log(`Dorman Lakely Cartography | Calling FilePicker.upload...`);
      const FilePicker = foundry.applications.apps.FilePicker;
      const result = await FilePicker.upload(source, directory, file, {});
      console.log(`Dorman Lakely Cartography | Upload result:`, result);

      console.log(`Dorman Lakely Cartography | ✓ Uploaded file: ${targetPath}`);
    } catch (error) {
      console.error(`Dorman Lakely Cartography | ✗ Error uploading file ${targetPath}:`, error);
      if (error instanceof Error) {
        console.error(`Dorman Lakely Cartography | Error stack:`, error.stack);
      }
      throw error;
    }
  }

  /**
   * Check if a file exists in Foundry storage
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      const source = this.getFilePickerSource(filePath);
      const directory = filePath.substring(0, filePath.lastIndexOf('/'));

      const FilePicker = foundry.applications.apps.FilePicker;
      const result = await FilePicker.browse(source, directory);

      if (result && result.files) {
        // Check if the file is in the list
        return result.files.some((f: string) => f === filePath || f.endsWith('/' + filePath));
      }

      return false;
    } catch {
      // If browse fails, assume file doesn't exist
      return false;
    }
  }

  /**
   * Disable media optimizer to prevent automatic optimization during upload
   */
  async disableMediaOptimizer(): Promise<void> {
    try {
      // @ts-expect-error - Accessing Foundry's media optimizer setting
      const currentSetting = game.settings.get('core', 'noCanvas');
      this.mediaOptimizerOriginalState = currentSetting;

      // @ts-expect-error - Accessing Foundry's media optimizer setting
      await game.settings.set('core', 'noCanvas', true);

      console.log('Dorman Lakely Cartography | Media optimizer disabled');
    } catch (error) {
      console.warn('Dorman Lakely Cartography | Could not disable media optimizer:', error);
    }
  }

  /**
   * Re-enable media optimizer after upload
   */
  async enableMediaOptimizer(): Promise<void> {
    try {
      if (this.mediaOptimizerOriginalState !== null) {
        // @ts-expect-error - Accessing Foundry's media optimizer setting
        await game.settings.set('core', 'noCanvas', this.mediaOptimizerOriginalState);
        this.mediaOptimizerOriginalState = null;

        console.log('Dorman Lakely Cartography | Media optimizer restored');
      }
    } catch (error) {
      console.warn('Dorman Lakely Cartography | Could not restore media optimizer:', error);
    }
  }

  /**
   * Determine the FilePicker source based on the path
   */
  private getFilePickerSource(path: string): string {
    // Check if path starts with a known source
    if (path.startsWith('s3/')) return 's3';
    if (path.startsWith('data/')) return 'data';
    if (path.startsWith('public/')) return 'public';

    // Default to 'data' source for module files
    return 'data';
  }

  /**
   * Create directory structure recursively if it doesn't exist
   */
  async ensureDirectory(directoryPath: string): Promise<void> {
    const source = this.getFilePickerSource(directoryPath);

    try {
      // Attempt to browse the directory
      const FilePicker = foundry.applications.apps.FilePicker;
      await FilePicker.browse(source, directoryPath);
      console.log(`Dorman Lakely Cartography | Directory exists: ${directoryPath}`);
    } catch {
      // Directory doesn't exist, create it recursively
      console.log(`Dorman Lakely Cartography | Creating directory: ${directoryPath}`);
      await this.createFolderRecursive(directoryPath, source);
    }
  }

  /**
   * Create folder structure recursively (like FA Battlemaps)
   */
  private async createFolderRecursive(path: string, source: string): Promise<void> {
    try {
      const parts = path.split('/').filter(p => p);
      let currentPath = '';

      const FilePicker = foundry.applications.apps.FilePicker;

      for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        try {
          await FilePicker.createDirectory(source, currentPath);
          console.log(`Dorman Lakely Cartography | ✓ Created directory: ${currentPath}`);
        } catch (error: any) {
          // Ignore error if folder already exists
          if (error?.message?.includes('EEXIST') || error?.message?.includes('exists')) {
            console.log(`Dorman Lakely Cartography | Directory already exists: ${currentPath}`);
          } else {
            console.warn(
              `Dorman Lakely Cartography | Could not create directory ${currentPath}:`,
              error
            );
            // Continue trying to create remaining directories
          }
        }
      }
    } catch (error) {
      console.error(
        `Dorman Lakely Cartography | Failed to create folder structure for ${path}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get file size from storage
   */
  async getFileSize(filePath: string): Promise<number | null> {
    try {
      const source = this.getFilePickerSource(filePath);
      const directory = filePath.substring(0, filePath.lastIndexOf('/'));

      const FilePicker = foundry.applications.apps.FilePicker;
      const result = await FilePicker.browse(source, directory);

      if (result && result.files) {
        // Find the file in the list
        const fileInfo = result.files.find(
          (f: any) => typeof f === 'string' && (f === filePath || f.endsWith('/' + filePath))
        );

        // Note: FilePicker.browse might not return size info
        // This is a limitation of the Foundry API
        return fileInfo ? null : null;
      }

      return null;
    } catch (error) {
      console.error(`Dorman Lakely Cartography | Error getting file size for ${filePath}:`, error);
      return null;
    }
  }
}
