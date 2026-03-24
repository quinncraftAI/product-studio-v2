import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, ".env") });

async function testParam(config: any) {
  console.log(`\n--- Testing config: ${JSON.stringify(config)} ---`);
  const prompt = "A high-end luxury watch on a dark background, professional product photography";

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: config
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  const json: any = await response.json();
  if (response.ok) {
    console.log("SUCCESS");
    console.log("Response part keys:", Object.keys(json.candidates[0].content.parts[0]));
  } else {
    console.log("FAILED:", json.error?.message?.split('\n')[0]);
  }
}

async function run() {
    // Try some more camelCase variations
    await testParam({ aspectRatio: "16:9" });
    await testParam({ targetAspectRatio: "16:9" });
    await testParam({ imageAspectRatio: "16:9" });
    await testParam({ responseMimeType: "image/png" });
}

run().catch(console.error);
