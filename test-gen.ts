import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, ".env") });

async function testGen() {
  const prompt = "A wide shot of a beautiful car on a beach at sunset, 4k, professional photography";
  console.log("Testing with aspectRatio: '16:9'");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          aspectRatio: "16:9"
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

  console.log("SUCCESS: Response OK");
  console.log("Finish Reason:", json.candidates?.[0]?.finishReason);
}

testGen().catch(console.error);
