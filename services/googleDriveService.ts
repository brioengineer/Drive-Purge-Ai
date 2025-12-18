
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
    const saved = localStorage.getItem('DRIVE_CLIENT_ID');
    return (saved && saved.trim().length > 0) ? saved : DEFAULT_CLIENT_ID;
  }

  setClientId(id: string) {
    if (!id || id.trim().length === 0) {
      localStorage.removeItem('DRIVE_CLIENT_ID');
    } else {
      localStorage.setItem('DRIVE_CLIENT_ID', id.trim());
    }
    // Clear state to force fresh initialization on next run
    this.tokenClient = null;
    this.initialized = false;
  }

  async init(onAuthChange: (auth: boolean) => void) {
    this.onAuthChangeCallback = onAuthChange;
    
    return new Promise<void>((resolve) => {
      let attempts = 0;
      const checkInterval = setInterval(() => {
        const gapi = (window as any).gapi;
        const google = (window as any).google;
        attempts++;
        
        if (gapi && google) {
          clearInterval(checkInterval);
          this.gapi = gapi;
          this.google = google;
          this.setupClient().then(resolve);
        } else if (attempts > 20) { // Time out after 10 seconds
          clearInterval(checkInterval);
          console.error("[DrivePurge] Google SDKs failed to load.");
          resolve();
        }
      }, 500);
    });
  }

  private async setupClient() {
    if (this.initialized) return;

    return new Promise<void>((resolve) => {
      this.gapi.load('client', async () => {
        try {
          await this.gapi.client.init({
            discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
          });
          
          const clientId = this.getClientId();
          console.log("[DrivePurge] Initializing with Client ID:", clientId);
          
          this.tokenClient = this.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: SCOPES,
            callback: (resp: any) => {
              if (resp.error) {
                console.error("[DrivePurge] Google Auth Error:", resp);
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
          console.error("[DrivePurge] Setup Failure:", e);
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
      throw new Error("Google Identity Service is not ready. Please refresh the page.");
    }
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
    if (fileId.startsWith('m')) return;
    await this.gapi.client.drive.files.update({
      fileId,
      trashed: true
    });
  }
}

export const driveService = new GoogleDriveService();
