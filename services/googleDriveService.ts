
import { DriveFile } from "../types";

/**
 * MASTER CONFIGURATION
 * 1. Create a Client ID in Google Cloud Console
 * 2. Add your GitHub Pages URL to "Authorized JavaScript origins"
 * 3. Replace the string below with your Client ID.
 */
const MASTER_CLIENT_ID = '226301323416-fjko3npic0p35ldf5quauabu5ujbrl82.apps.googleusercontent.com'; 
const SCOPES = 'https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/drive.file';

class GoogleDriveService {
  private gapi: any = null;
  private google: any = null;
  private tokenClient: any = null;
  public authenticated: boolean = false;
  public initialized: boolean = false;

  async init(onAuthChange: (auth: boolean) => void) {
    return new Promise<void>((resolve) => {
      const gapi = (window as any).gapi;
      const google = (window as any).google;
      
      if (!gapi || !google) {
        resolve();
        return;
      }

      this.gapi = gapi;
      this.google = google;

      this.gapi.load('client', async () => {
        try {
          await this.gapi.client.init({
            discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
          });
          
          if (MASTER_CLIENT_ID && !MASTER_CLIENT_ID.startsWith('YOUR_')) {
            this.tokenClient = this.google.accounts.oauth2.initTokenClient({
              client_id: MASTER_CLIENT_ID,
              scope: SCOPES,
              callback: (resp: any) => {
                if (resp.error) return;
                this.authenticated = true;
                onAuthChange(true);
              },
            });
          }
          
          this.initialized = true;
          resolve();
        } catch (e) {
          console.error("GAPI init error", e);
          resolve();
        }
      });
    });
  }

  isConfigured(): boolean {
    return !!MASTER_CLIENT_ID && !MASTER_CLIENT_ID.startsWith('YOUR_');
  }

  async login() {
    if (!this.tokenClient) {
      throw new Error("Google Authentication is not configured. Please add your Client ID to services/googleDriveService.ts");
    }
    this.tokenClient.requestAccessToken({ prompt: 'consent' });
  }

  async listFiles(pageSize: number = 150): Promise<DriveFile[]> {
    if (!this.authenticated) throw new Error("Not authenticated");
    const response = await this.gapi.client.drive.files.list({
      pageSize,
      fields: 'nextPageToken, files(id, name, size, mimeType, modifiedTime, md5Checksum, webViewLink, thumbnailLink)',
      q: "trashed = false"
    });
    return response.result.files || [];
  }

  async trashFile(fileId: string): Promise<void> {
    if (fileId.startsWith('m')) {
        return new Promise(resolve => setTimeout(resolve, 200));
    }
    if (!this.authenticated) throw new Error("Not authenticated");
    await this.gapi.client.drive.files.update({
      fileId: fileId,
      trashed: true
    });
  }
}

export const driveService = new GoogleDriveService();
