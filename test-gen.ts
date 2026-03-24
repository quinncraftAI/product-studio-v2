import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, ".env") });

async function testGen() {
  const prompt = "A futuristic product shot of a high-end sneaker, floating in neon atmosphere, 4k, professional photography";
  console.log("Using API Key:", process.env.GEMINI_API_KEY?.substring(0, 5) + "...");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          aspect_ratio: "16:9",
          resolution: "1K"
        }
      }),
    }
  );

  const json: any = await response.json();
  console.log("Status:", response.status);
  
  if (!response.ok) {
    console.error("Error:", JSON.stringify(json, null, 2));
    return;
  }

  const part = json.candidates?.[0]?.content?.parts?.[0];
  if (part?.inline_data) {
    console.log("SUCCESS: Found inline_data image.");
    console.log("Mime Type:", part.inline_data.mime_type);
    console.log("Data Length:", part.inline_data.data.length);
  } else if (part?.text) {
    console.log("FAILURE: Received text instead of image.");
    console.log("Text:", part.text);
  } else {
    console.log("FAILURE: No recognized content in response.");
    console.log(JSON.stringify(json, null, 2));
  }
}

testGen().catch(console.error);
