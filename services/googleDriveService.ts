
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
    console.log("[DrivePurge] Detected Origin:", window.location.origin);
    
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
          await this.gapi.client.init({
            discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
          });
          
          this.tokenClient = this.google.accounts.oauth2.initTokenClient({
            client_id: MASTER_CLIENT_ID,
            scope: SCOPES,
            callback: (resp: any) => {
              if (resp.error) {
                console.error("[DrivePurge] GIS Auth Error:", resp);
                return;
              }
              this.authenticated = true;
              this.gapi.client.setToken(resp);
              onAuthChange(true);
            },
          });
          
          this.initialized = true;
          console.log("[DrivePurge] Service Ready.");
          resolve();
        } catch (e) {
          console.error("[DrivePurge] Initialization Failed:", e);
          resolve();
        }
      });
    });
  }

  async login() {
    if (!this.tokenClient) {
      throw new Error("The Google Identity Service is still loading. Please wait a few seconds.");
    }
    // Using select_account to force a clean handshake
    this.tokenClient.requestAccessToken({ prompt: 'select_account' });
  }

  async listFiles(pageSize: number = 200): Promise<DriveFile[]> {
    if (!this.authenticated) throw new Error("Connection lost. Please reconnect.");
    const response = await this.gapi.client.drive.files.list({
      pageSize,
      fields: 'files(id, name, size, mimeType, modifiedTime, md5Checksum, webViewLink, thumbnailLink)',
      q: "trashed = false"
    });
    return response.result.files || [];
  }

  async trashFile(fileId: string): Promise<void> {
    if (fileId.startsWith('m')) return; // Ignore mock files
    await this.gapi.client.drive.files.update({
      fileId,
      trashed: true
    });
  }
}

export const driveService = new GoogleDriveService();
