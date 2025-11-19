import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AspectRatio } from "../types";

// Initialize the client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates the visual background using Imagen 4.0.
 * Supports explicit aspect ratios.
 */
export const generateBackgroundImage = async (prompt: string, aspectRatio: AspectRatio, orientation: 'landscape' | 'portrait' = 'landscape'): Promise<string> => {
  try {
    // Determine the API-compatible aspect ratio string
    // API supports: "1:1", "3:4", "4:3", "9:16", "16:9"
    let targetRatio = '1:1';
    
    if (aspectRatio === '1:1') {
        targetRatio = '1:1';
    } else if (aspectRatio === '16:9') {
        targetRatio = orientation === 'portrait' ? '9:16' : '16:9';
    } else if (aspectRatio === '4:3') {
        targetRatio = orientation === 'portrait' ? '3:4' : '4:3';
    } else if (aspectRatio === '3:2') {
        // 3:2 is not supported natively by Imagen 4 (only 1:1, 3:4, 4:3, 9:16, 16:9)
        // Fallback to closest.
        targetRatio = orientation === 'portrait' ? '3:4' : '4:3';
    } else {
        // Fallback
        targetRatio = orientation === 'portrait' ? '3:4' : '4:3'; 
    }

    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: `${prompt}. High quality, cinematic lighting, negative space for text overlay, polished design aesthetic.`,
      config: {
        numberOfImages: 1,
        aspectRatio: targetRatio,
        outputMimeType: 'image/jpeg'
      },
    });

    const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (imageBytes) {
      return `data:image/jpeg;base64,${imageBytes}`;
    }
    throw new Error("No image data received");
  } catch (error) {
    console.error("Image generation failed:", error);
    throw error;
  }
};

/**
 * Edits the existing image based on a prompt using Gemini 2.5 Flash Image.
 */
export const editImage = async (imageBase64: string, prompt: string): Promise<string> => {
  try {
    // Extract pure base64 and mime type from Data URL
    const matches = imageBase64.match(/^data:(.+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error("Invalid image format");
    }
    const mimeType = matches[1];
    const data = matches[2];

    // Use Gemini 2.5 Flash Image for editing/inpainting capabilities
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: data,
              mimeType: mimeType,
            },
          },
          {
            text: `${prompt}. Maintain high quality and photorealism.`,
          },
        ],
      },
      config: {
          responseModalities: [Modality.IMAGE],
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (part?.inlineData?.data) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
    
    throw new Error("No image generated from edit request");

  } catch (error) {
    console.error("Image editing failed:", error);
    throw error;
  }
};