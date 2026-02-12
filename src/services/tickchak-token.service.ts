import * as fs from "fs";
import * as path from "path";

interface TickchakTokens {
  token: string;
  userId: number;
  lastUpdated: string;
}

class TickchakTokenService {
  private static instance: TickchakTokenService;
  private tokens: TickchakTokens | null = null;
  private readonly tokensFilePath: string;

  private constructor() {
    this.tokensFilePath = path.join(process.cwd(), "data", "tickchak_tokens.json");
    
    // Create data directory if it doesn't exist
    const dataDir = path.dirname(this.tokensFilePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.loadTokens();
  }

  public static getInstance(): TickchakTokenService {
    if (!TickchakTokenService.instance) {
      TickchakTokenService.instance = new TickchakTokenService();
    }
    return TickchakTokenService.instance;
  }

  private loadTokens(): void {
    try {
      if (fs.existsSync(this.tokensFilePath)) {
        const data = fs.readFileSync(this.tokensFilePath, "utf-8");
        this.tokens = JSON.parse(data);
        console.log("[TickchakTokenService] Tokens loaded from cache");
      }
    } catch (error: any) {
      console.error("[TickchakTokenService] Error loading tokens:", error.message);
      this.tokens = null;
    }
  }

  public saveTokens(token: string, userId: number): void {
    this.tokens = {
      token,
      userId,
      lastUpdated: new Date().toISOString(),
    };

    try {
      fs.writeFileSync(
        this.tokensFilePath,
        JSON.stringify(this.tokens, null, 2),
        "utf-8"
      );
      console.log("[TickchakTokenService] Tokens saved to cache");
    } catch (error: any) {
      console.error("[TickchakTokenService] Error saving tokens:", error.message);
    }
  }

  public getTokens(): TickchakTokens | null {
    return this.tokens;
  }

  public clearTokens(): void {
    this.tokens = null;
    if (fs.existsSync(this.tokensFilePath)) {
      fs.unlinkSync(this.tokensFilePath);
      console.log("[TickchakTokenService] Tokens cache cleared");
    }
  }
}

export default TickchakTokenService;
