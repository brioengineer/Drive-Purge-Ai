
import { DriveFile } from "../types.ts";

const DEFAULT_CLIENT_ID = '226301323416-fjko3npic0p35ldf5quauabu5ujbrl82.apps.googleusercontent.com'; 
const SCOPES = 'https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/drive.file';

class GoogleDriveService {
  private gapi: any = null;
  private google: any = null;
  private tokenClient: any = null;
  public authenticated: boolean = false;
  public initialized: boolean = false;
  private onAuthChangeCallback: ((auth: boolean) => void) | null = null;

  getClientId() {
    return localStorage.getItem('DRIVE_CLIENT_ID') || DEFAULT_CLIENT_ID;
  }

  setClientId(id: string) {
    localStorage.setItem('DRIVE_CLIENT_ID', id);
    // Force re-init on next login attempt
    this.tokenClient = null;
  }

  async init(onAuthChange: (auth: boolean) => void) {
    this.onAuthChangeCallback = onAuthChange;
    console.log("[DrivePurge] Origin:", window.location.origin);
    
    return new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        const gapi = (window as any).gapi;
        const google = (window as any).google;
        
        if (gapi && google) {
          clearInterval(checkInterval);
          this.gapi = gapi;
          this.google = google;
          this.setupClient().then(resolve);
        }
      }, 500);
    });
  }

  private async setupClient() {
    return new Promise<void>((resolve) => {
      this.gapi.load('client', async () => {
        try {
          await this.gapi.client.init({
            discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
          });
          
          const clientId = this.getClientId();
          this.tokenClient = this.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: SCOPES,
            callback: (resp: any) => {
              if (resp.error) {
                console.error("[DrivePurge] GIS Auth Error:", resp);
                return;
              }
              this.authenticated = true;
              this.gapi.client.setToken(resp);
              if (this.onAuthChangeCallback) this.onAuthChangeCallback(true);
            },
          });
          
          this.initialized = true;
          resolve();
        } catch (e) {
          console.error("[DrivePurge] GAPI/GIS Init Failed:", e);
          resolve();
        }
      });
    });
  }

  async login() {
    if (!this.tokenClient) {
      await this.setupClient();
    }
    if (!this.tokenClient) {
      throw new Error("Google Identity Service failed to initialize.");
    }
    this.tokenClient.requestAccessToken({ prompt: 'select_account' });
  }

  async listFiles(pageSize: number = 200): Promise<DriveFile[]> {
    if (!this.authenticated) throw new Error("No active session.");
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
