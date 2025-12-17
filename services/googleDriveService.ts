
import { DriveFile } from "../types.ts";

// This ID must have 'https://brioengineer.github.io' in its Authorized JavaScript Origins
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
      const checkInterval = setInterval(() => {
        const gapi = (window as any).gapi;
        const google = (window as any).google;
        
        if (gapi && google) {
          clearInterval(checkInterval);
          this.gapi = gapi;
          this.google = google;
          this.setupClient(onAuthChange).then(resolve);
        }
      }, 500);
    });
  }

  private async setupClient(onAuthChange: (auth: boolean) => void) {
    return new Promise<void>((resolve) => {
      this.gapi.load('client', async () => {
        try {
          // Initialize GAPI client for Drive API calls
          await this.gapi.client.init({
            discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
          });
          
          // Initialize GIS (Google Identity Services) for token management
          if (MASTER_CLIENT_ID) {
            this.tokenClient = this.google.accounts.oauth2.initTokenClient({
              client_id: MASTER_CLIENT_ID,
              scope: SCOPES,
              callback: (resp: any) => {
                if (resp.error) {
                  console.error("GIS Callback Error:", resp);
                  return;
                }
                this.authenticated = true;
                onAuthChange(true);
              },
            });
          }
          this.initialized = true;
          resolve();
        } catch (e) {
          console.error("GAPI/GIS Init Error:", e);
          resolve();
        }
      });
    });
  }

  async login() {
    if (!this.tokenClient) {
      throw new Error("The Google Identity library is still initializing. Please wait 3 seconds and try again.");
    }
    
    // Explicitly request access token
    // The 'storagerelay' error usually triggers here if the origin isn't white-listed
    try {
      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      console.error("Login trigger error:", err);
      throw err;
    }
  }

  async listFiles(pageSize: number = 200): Promise<DriveFile[]> {
    if (!this.authenticated) throw new Error("Please connect your Drive account first.");
    const response = await this.gapi.client.drive.files.list({
      pageSize,
      fields: 'files(id, name, size, mimeType, modifiedTime, md5Checksum, webViewLink, thumbnailLink)',
      q: "trashed = false"
    });
    return response.result.files || [];
  }

  async trashFile(fileId: string): Promise<void> {
    if (fileId.startsWith('m')) return;
    await this.gapi.client.drive.files.update({
      fileId,
      trashed: true
    });
  }
}

export const driveService = new GoogleDriveService();
