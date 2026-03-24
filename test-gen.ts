import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, ".env") });

async function testGen() {
  const prompt = "A professional studio shot of a leather wallet on a wooden table, high-key lighting";
  console.log("Using API Key:", process.env.GEMINI_API_KEY?.substring(0, 5) + "...");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  const json: any = await response.json();
  console.log("Status:", response.status);
  
  if (!response.ok) {
    console.error("Error:", JSON.stringify(json, null, 2));
    return;
  }

  console.log("Response structure keys:", Object.keys(json));
  if (json.candidates) {
      console.log("Number of candidates:", json.candidates.length);
      const candidate = json.candidates[0];
      console.log("Candidate keys:", Object.keys(candidate));
      if (candidate.content) {
          console.log("Content keys:", Object.keys(candidate.content));
          if (candidate.content.parts) {
              console.log("Number of parts:", candidate.content.parts.length);
              const part = candidate.content.parts[0];
              console.log("Part keys:", Object.keys(part));
              if (part.inline_data) {
                  console.log("inline_data keys:", Object.keys(part.inline_data));
                  console.log("Mime type:", part.inline_data.mime_type);
                  console.log("Data length:", part.inline_data.data?.length);
              }
              if (part.text) {
                  console.log("Text content detected instead of image:", part.text);
              }
          }
      }
      if (candidate.finishReason) {
          console.log("Finish reason:", candidate.finishReason);
      }
  }

  if (json.promptFeedback) {
      console.log("Prompt feedback:", json.promptFeedback);
  }
}

testGen().catch(console.error);
