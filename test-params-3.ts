import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, ".env") });

async function testParam(bodySubset: any) {
  console.log(`\n--- Testing: ${JSON.stringify(bodySubset)} ---`);
  const prompt = "A photorealistic cactus in a pot, daylight";

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    ...bodySubset
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
  } else {
    console.log("FAILED:", json.error?.message?.split('\n')[0]);
  }
}

async function run() {
    // Try image_size in generationConfig
    await testParam({ generationConfig: { image_size: "1024x768" } });
    
    // Try top-level image_size
    await testParam({ image_size: "1024x768" });
    
    // Try top-level imageSize
    await testParam({ imageSize: "1024x768" });

    // Try a completely different approach: what if the parameter is in the PART?
    // Some versions of Gemini use a specialized Part type for config.
}

run().catch(console.error);
