import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, ".env") });

async function testParams(paramObj: any, label: string) {
  console.log(`\n--- Testing ${label} ---`);
  const prompt = "A minimalist product shot of a watch, professional lighting";

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    ...paramObj
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
    console.log(`SUCCESS with ${label}`);
  } else {
    console.log(`FAILED with ${label}:`, json.error?.message?.split('\n')[0]);
  }
}

async function runTests() {
  // Try generation_config with aspect_ratio
  await testParams({ generationConfig: { aspect_ratio: "4:5" } }, "generation_config.aspect_ratio");
  
  // Try top-level parameters
  await testParams({ parameters: { aspect_ratio: "4:5" } }, "top-level parameters.aspect_ratio");
  
  // Try generation_config with target_aspect_ratio
  await testParams({ generationConfig: { target_aspect_ratio: "4:5" } }, "generation_config.target_aspect_ratio");
  
  // Try top-level aspect_ratio
  await testParams({ aspect_ratio: "4:5" }, "top-level aspect_ratio");
}

runTests().catch(console.error);
