import axios from 'axios';

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
    private apiKey: string;
    private endpoint: string;

    constructor() {
        this.apiKey = process.env.HIVE_API_KEY || '';
        this.endpoint = 'https://api.thehive.ai/api/v2/task/sync';
        
        // Add initialization logging
        if (!this.apiKey) {
            console.error('WARNING: HIVE_API_KEY is not set. Content moderation will not work properly.');
        }
        console.log('HiveModeration service initialized with endpoint:', this.endpoint);
    }

    async moderateFile(
        buffer: Buffer,
        mimeType: string,
        metadata: { cid: string }
    ): Promise<ModerationResult> {
        try {
            console.log('Starting content moderation for file:', metadata.cid);
            console.log('File type:', mimeType);
            
            if (!this.apiKey) {
                console.error('Moderation failed: No API key available');
                throw new Error('Hive API key not configured');
            }

            const base64Data = buffer.toString('base64');
            console.log('File converted to base64');
            
            console.log('Sending request to Hive AI...');
            const response = await axios.post(
                this.endpoint,
                {
                    image: base64Data,
                    models: [
                        'nsfw_v2',
                        'text_moderation_v2',
                        'suggestive',
                        'gore_v2'
                    ]
                },
                {
                    headers: {
                        'Authorization': `token ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('Received response from Hive AI');
            console.log('Raw response:', JSON.stringify(response.data, null, 2));

            if (!response.data?.status?.[0]?.response?.output?.[0]?.classes) {
                console.error('Unexpected response format from Hive AI:', response.data);
                throw new Error('Invalid response format from Hive AI');
            }

            const predictions = response.data.status[0].response.output[0].classes as HivePredictions;
            console.log('Predictions received:', predictions);
            
            // Define thresholds for different categories
            const thresholds: HivePredictions = {
                nsfw: 0.6,
                suggestive: 0.7,
                gore: 0.5,
                hate: 0.6,
                harassment: 0.6
            };

            console.log('Checking against thresholds:', thresholds);

            // Check predictions against thresholds
            const violatingCategories = Object.entries(predictions)
                .filter(([category, confidence]) => {
                    const threshold = thresholds[category];
                    const isViolating = threshold && confidence > threshold;
                    console.log(`Category ${category}: confidence ${confidence}, threshold ${threshold}, violating: ${isViolating}`);
                    return isViolating;
                })
                .map(([category]) => category);

            const confidenceValues = Object.values(predictions) as number[];
            const maxConfidence = Math.max(...confidenceValues);
            
            console.log('Moderation result:', {
                isAccepted: violatingCategories.length === 0,
                confidence: maxConfidence,
                violatingCategories
            });
            
            return {
                isAccepted: violatingCategories.length === 0,
                confidence: maxConfidence,
                categories: violatingCategories,
                moderationDetails: {
                    predictions,
                    metadata
                }
            };

        } catch (error: unknown) {
            console.error('Hive moderation error:', error);
            if (axios.isAxiosError(error)) {
                console.error('Axios error details:', {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data
                });
            }
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            throw new Error(`Content moderation failed: ${errorMessage}`);
        }
    }
} 
export default HiveModeration;