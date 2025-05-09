import axios, { AxiosError } from 'axios';
import dotenv from 'dotenv';
import FormData from 'form-data';

dotenv.config();

interface ModerationResult {
  isAccepted: boolean;
  confidence: number;
  categories: string[];
  moderationDetails?: any;
}

interface HivePredictions {
  [key: string]: number;
}

export class HiveModeration {
  private readonly apiKey: string;
  private readonly endpoint = 'https://api.thehive.ai/api/v2/task/sync';

  constructor() {
    this.apiKey = process.env.HIVE_API_KEY || '';

    if (!this.apiKey) {
      console.error('❌ ERROR: HIVE_API_KEY is not set.');
      process.exit(1);
    }

    console.log('✅ Hive Moderation service initialized');
  }

  async moderateFile(
    buffer: Buffer,
    mimeType: string,
    metadata: { cid: string }
  ): Promise<ModerationResult> {
    if (!this.isSupportedMimeType(mimeType)) {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }

    try {
      const form = this.prepareForm(buffer, mimeType);
      const response = await axios.post(this.endpoint, form, {
        headers: {
          Authorization: `Token ${this.apiKey}`,
          ...form.getHeaders()
        },
        timeout: 30000
      });

      const predictions = this.extractPredictions(response.data);
      const result = this.evaluate(predictions);

      console.log('🧠 Moderation result:', {
        isAccepted: result.categories.length === 0,
        confidence: result.confidence,
        categories: result.categories
      });

      return {
        isAccepted: result.categories.length === 0,
        confidence: result.confidence,
        categories: result.categories,
        moderationDetails: {
          predictions,
          metadata,
          rawResponse: response.data
        }
      };
    } catch (error: unknown) {
      throw new Error(`Content moderation failed: ${this.parseError(error)}`);
    }
  }

  // ──────────────────────────────── HELPERS ────────────────────────────────

  private isSupportedMimeType(mimeType: string): boolean {
    return (
      mimeType.startsWith('image/') ||
      mimeType.startsWith('video/') ||
      mimeType === 'text/plain' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  }

  private prepareForm(buffer: Buffer, mimeType: string): FormData {
    const form = new FormData();
    const isText = mimeType === 'text/plain';
    const isImage = mimeType.startsWith('image/');

    if (isText) {
      form.append('text', buffer.toString('utf-8'));
      form.append('models', JSON.stringify(['text_moderation_v2']));
    } else {
      form.append(isImage ? 'image' : 'video', buffer, {
        filename: `upload.${mimeType.split('/')[1]}`,
        contentType: mimeType
      });
      form.append('models', JSON.stringify(['nsfw_v2', 'suggestive', 'gore_v2']));
    }

    return form;
  }

  private extractPredictions(data: any): HivePredictions {
    const output = data?.status?.[0]?.response?.output?.[0];
    if (!output?.classes) {
      console.error('❌ Invalid Hive response:', data);
      throw new Error('Hive response format is invalid.');
    }

    return output.classes as HivePredictions;
  }

  private evaluate(predictions: HivePredictions): {
    categories: string[];
    confidence: number;
  } {
    const thresholds: HivePredictions = {
      nsfw: 0.6,
      suggestive: 0.7,
      gore: 0.5,
      hate: 0.6,
      harassment: 0.6,
      offensive: 0.6
    };

    const violating = Object.entries(predictions)
      .filter(([key, value]) => value > (thresholds[key] ?? 1))
      .map(([key]) => key);

    const confidence = Math.max(...Object.values(predictions), 0);

    return {
      categories: violating,
      confidence
    };
  }

  private parseError(error: unknown): string {
    if (error instanceof AxiosError && error.response) {
      const { status, statusText, data } = error.response;
      console.error('❌ Hive API Error:', { status, statusText, data });

      if (status === 403) return 'Invalid Hive API key. Please check HIVE_API_KEY in your .env file.';
      if (status === 400) return `Bad request: ${JSON.stringify(data)}`;
      return statusText || error.message;
    }

    return error instanceof Error ? error.message : 'Unknown error occurred';
  }
}

export default HiveModeration;