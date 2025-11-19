
import { GoogleGenAI, Type } from "@google/genai";
import { DesignSuggestion, AspectRatio, Orientation } from "../types";

// Initialize the client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates the visual background using Imagen 4.0.
 * Supports explicit aspect ratios.
 */
export const generateBackgroundImage = async (prompt: string, aspectRatio: AspectRatio, orientation: Orientation): Promise<string> => {
  try {
    // Determine the API-compatible aspect ratio string
    let targetRatio = '1:1';
    
    if (aspectRatio === '1:1') {
        targetRatio = '1:1';
    } else {
        // Map user selection to API supported values (1:1, 3:4, 4:3, 9:16, 16:9)
        // Note: 3:2 is not natively supported, mapping to 4:3/3:4
        if (orientation === 'portrait') {
            if (aspectRatio === '16:9') targetRatio = '9:16';
            else targetRatio = '3:4'; // Covers 4:3 and 3:2
        } else {
            if (aspectRatio === '16:9') targetRatio = '16:9';
            else targetRatio = '4:3'; // Covers 4:3 and 3:2
        }
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
 * Acts as an "Art Director". Analyzes the user's prompt and suggests
 * the best CSS typography settings (Font, Color, Blend Mode).
 */
export const generateDesignTokens = async (prompt: string): Promise<DesignSuggestion> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are an expert Graphic Designer and Typography Director. 
      Analyze this design prompt: "${prompt}". 
      Suggest the best typography settings to overlay text onto an image generated from this prompt.
      
      Choose from these fonts ONLY: 
      'Abril Fatface', 'Alfa Slab One', 'Amatic SC', 'Anton', 'Bangers', 'Bebas Neue', 'Bodoni Moda', 'Cinzel', 
      'Cormorant Garamond', 'Crimson Text', 'DM Serif Display', 'Dancing Script', 'Eduardo Tunni', 'Fira Code', 
      'Gloria Hallelujah', 'Great Vibes', 'Inter', 'Italiana', 'Josefin Sans', 'Lato', 'League Gothic', 
      'Libre Baskerville', 'Lobster', 'Lora', 'Merriweather', 'Monoton', 'Montserrat', 'Noto Sans', 'Open Sans', 
      'Orbitron', 'Oswald', 'PT Sans', 'PT Serif', 'Pacifico', 'Permanent Marker', 'Playfair Display', 'Poppins', 
      'Raleway', 'Righteous', 'Roboto', 'Rubik Glitch', 'Shadows Into Light', 'Source Sans 3', 'Space Grotesque', 
      'Space Mono', 'Syne', 'Unbounded', 'VT323'.
      
      Return a JSON object.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fontFamily: { type: Type.STRING },
            textColor: { type: Type.STRING, description: "Hex code" },
            shadowColor: { type: Type.STRING, description: "Hex code for text shadow/glow" },
            blendMode: { type: Type.STRING, description: "CSS mix-blend-mode like normal, overlay, screen, difference" },
            vibeReasoning: { type: Type.STRING, description: "Short explanation of why these styles fit the prompt" }
          },
          required: ["fontFamily", "textColor", "shadowColor", "blendMode", "vibeReasoning"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as DesignSuggestion;
    }
    throw new Error("Failed to parse design suggestions");
  } catch (error) {
    console.error("Design direction failed:", error);
    // Fallback default
    return {
      fontFamily: 'Inter',
      textColor: '#FFFFFF',
      shadowColor: '#000000',
      blendMode: 'normal',
      vibeReasoning: 'Fallback due to error.'
    };
  }
};
