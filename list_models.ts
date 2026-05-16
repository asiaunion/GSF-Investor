import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const key = process.env.GEMINI_API_KEY;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
  const data = await res.json();
  if (data.models) {
    const proModels = data.models
      .filter((m: any) => m.name.includes("pro"))
      .map((m: any) => m.name);
    console.log("Available Pro Models:", proModels);
    const flashModels = data.models
      .filter((m: any) => m.name.includes("flash"))
      .map((m: any) => m.name);
    console.log("Available Flash Models:", flashModels);
  } else {
    console.log("Error:", data);
  }
}
main();
