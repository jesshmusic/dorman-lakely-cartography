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
      // Determine the storage source based on path
      const source = this.getFilePickerSource(targetPath);

      // Create a File object from the blob
      const fileName = targetPath.split('/').pop() || 'file';
      const file = new File([blob], fileName, { type: blob.type });

      // Get the directory path
      const directory = targetPath.substring(0, targetPath.lastIndexOf('/'));

      // Upload the file
      await FilePicker.upload(source, directory, file, {});

      console.log(`Dorman Lakely Cartography | Uploaded file: ${targetPath}`);
    } catch (error) {
      console.error(`Dorman Lakely Cartography | Error uploading file ${targetPath}:`, error);
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

      const result = await FilePicker.browse(source, directory);

      if (result && result.files) {
        // Check if the file is in the list
        return result.files.some((f: string) => f === filePath || f.endsWith('/' + filePath));
      }

      return false;
    } catch (error) {
      // If browse fails, assume file doesn't exist
      return false;
    }
  }

  /**
   * Disable media optimizer to prevent automatic optimization during upload
   */
  async disableMediaOptimizer(): Promise<void> {
    try {
      // @ts-ignore - Accessing Foundry's media optimizer setting
      const currentSetting = game.settings.get('core', 'noCanvas');
      this.mediaOptimizerOriginalState = currentSetting;

      // @ts-ignore
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
        // @ts-ignore
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
   * Create directory structure if it doesn't exist
   */
  async ensureDirectory(directoryPath: string): Promise<void> {
    try {
      const source = this.getFilePickerSource(directoryPath);

      // Attempt to browse the directory
      await FilePicker.browse(source, directoryPath);
    } catch (error) {
      // Directory might not exist, but Foundry will create it on upload
      console.log(
        `Dorman Lakely Cartography | Directory may not exist, will be created on upload: ${directoryPath}`
      );
    }
  }

  /**
   * Get file size from storage
   */
  async getFileSize(filePath: string): Promise<number | null> {
    try {
      const source = this.getFilePickerSource(filePath);
      const directory = filePath.substring(0, filePath.lastIndexOf('/'));

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
