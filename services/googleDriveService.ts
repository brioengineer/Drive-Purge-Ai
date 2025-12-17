
import { DriveFile } from "../types.ts";

const MASTER_CLIENT_ID = '226301323416-fjko3npic0p35ldf5quauabu5ujbrl82.apps.googleusercontent.com'; 
const SCOPES = 'https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/drive.file';

class GoogleDriveService {
  private gapi: any = null;
  private google: any = null;
  private tokenClient: any = null;
  public authenticated: boolean = false;
  public initialized: boolean = false;

  async init(onAuthChange: (auth: boolean) => void) {
    console.log("[DriveService] Initializing with Origin:", window.location.origin);
    
    return new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        const gapi = (window as any).gapi;
        const google = (window as any).google;
        
        if (gapi && google) {
          clearInterval(checkInterval);
          this.gapi = gapi;
          this.google = google;
          this.setupGisClient(onAuthChange).then(resolve);
        }
      }, 500);
    });
  }

  private async setupGisClient(onAuthChange: (auth: boolean) => void) {
    try {
      this.tokenClient = this.google.accounts.oauth2.initTokenClient({
        client_id: MASTER_CLIENT_ID,
        scope: SCOPES,
        callback: async (resp: any) => {
          if (resp.error) {
            console.error("[DriveService] OAuth Callback Error:", resp);
            return;
          }
          await this.initGapi(resp.access_token);
          this.authenticated = true;
          onAuthChange(true);
        },
      });
      this.initialized = true;
    } catch (e) {
      console.error("[DriveService] GIS Setup Error:", e);
    }
  }

  private async initGapi(accessToken: string) {
    return new Promise<void>((resolve) => {
      this.gapi.load('client', async () => {
        try {
          await this.gapi.client.init({
            discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
          });
          this.gapi.client.setToken({ access_token: accessToken });
          resolve();
        } catch (e) {
          console.error("[DriveService] GAPI Client Init Error:", e);
          resolve();
        }
      });
    });
  }

  async login() {
    if (!this.tokenClient) {
      const msg = "Google Identity Services (GIS) library not ready. This might be caused by blocked scripts or trackers.";
      console.error("[DriveService]", msg);
      throw new Error(msg);
    }
    
    console.log("[DriveService] Requesting Access Token...");
    try {
      // 'select_account' helps when multiple sessions cause cookie relay issues
      this.tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (err) {
      console.error("[DriveService] Login trigger failure:", err);
      throw err;
    }
  }

  async listFiles(pageSize: number = 200): Promise<DriveFile[]> {
    if (!this.authenticated) throw new Error("Not authenticated.");
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
