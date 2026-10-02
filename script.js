const hfTokenInput = document.getElementById("hfToken");
const elevenLabsTokenInput = document.getElementById("elevenLabsToken");
const replicateTokenInput = document.getElementById("replicateToken");
const scriptInput = document.getElementById("scriptInput");
const generateBtn = document.getElementById("generateBtn");
const testBtn = document.getElementById("testBtn");
const statusEl = document.getElementById("status");
const progressBar = document.getElementById("progressBar");
const previewVideo = document.getElementById("previewVideo");
const downloadLink = document.getElementById("downloadLink");

const STORAGE_KEYS = {
  hfToken: "hfToken",
  elevenLabsToken: "elevenLabsToken",
  replicateToken: "replicateToken"
};

function saveTokens() {
  localStorage.setItem(STORAGE_KEYS.hfToken, hfTokenInput.value.trim());
  localStorage.setItem(STORAGE_KEYS.elevenLabsToken, elevenLabsTokenInput.value.trim());
  localStorage.setItem(STORAGE_KEYS.replicateToken, replicateTokenInput.value.trim());
  statusEl.textContent = "API keys saved locally in your browser.";
}

function loadTokens() {
  hfTokenInput.value = localStorage.getItem(STORAGE_KEYS.hfToken) || "";
  elevenLabsTokenInput.value = localStorage.getItem(STORAGE_KEYS.elevenLabsToken) || "";
  replicateTokenInput.value = localStorage.getItem(STORAGE_KEYS.replicateToken) || "";
}

document.getElementById("saveKeysBtn").addEventListener("click", saveTokens);

function updateProgress(value) {
  progressBar.style.width = `${value}%`;
}

async function testSetup() {
  const hf = hfTokenInput.value.trim();
  const eleven = elevenLabsTokenInput.value.trim();

  if (!hf || !eleven) {
    statusEl.textContent = "Please add your Hugging Face and ElevenLabs tokens first.";
    return;
  }

  statusEl.textContent = "Testing Hugging Face...";
  updateProgress(20);

  try {
    const res = await fetch("https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hf}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: "a cinematic sunset, ultra realistic, high detail"
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Hugging Face failed (${res.status}): ${text}`);
    }

    statusEl.textContent = "Hugging Face API is working.";
    updateProgress(50);

    statusEl.textContent = "Testing ElevenLabs...";
    const ttsRes = await fetch("https://api.elevenlabs.io/v1/voices", {
      method: "GET",
      headers: {
        "xi-api-key": eleven
      }
    });

    if (!ttsRes.ok) {
      const text = await ttsRes.text();
      throw new Error(`ElevenLabs failed (${ttsRes.status}): ${text}`);
    }

    statusEl.textContent = "Everything looks connected correctly.";
    updateProgress(100);

  } catch (error) {
    statusEl.textContent = "Connection test failed. " + error.message;
    console.error(error);
  }
}

async function generateVideo() {
  const script = scriptInput.value.trim();
  const hf = hfTokenInput.value.trim();
  const eleven = elevenLabsTokenInput.value.trim();

  if (!script) {
    statusEl.textContent = "Please paste a story or script first.";
    return;
  }

  if (!hf || !eleven) {
    statusEl.textContent = "Please add your Hugging Face and ElevenLabs tokens first.";
    return;
  }

  statusEl.textContent = "Generating storyboard...";
  updateProgress(10);

  try {
    const scenes = splitScriptIntoScenes(script);

    const images = [];
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      statusEl.textContent = `Generating image ${i + 1}/${scenes.length}...`;
      updateProgress((i + 1) / scenes.length * 100);

      const imageUrl = await generateImageFromHF(scene, hf);
      images.push(imageUrl);
    }

    statusEl.textContent = "Generating voiceover...";
    updateProgress(70);

    const audioBlob = await generateVoiceover("A calm sunrise. A young woman opens a window.", eleven);

    statusEl.textContent = "Generating final video...";
    updateProgress(85);

    const finalVideo = await composeVideo(images, audioBlob);
    previewVideo.src = URL.createObjectURL(finalVideo);
    downloadLink.href = URL.createObjectURL(finalVideo);
    downloadLink.classList.remove("hidden");
    downloadLink.textContent = "Download MP4";

    statusEl.textContent = "Video generation complete.";
    updateProgress(100);

  } catch (error) {
    statusEl.textContent = "Something went wrong during generation. " + error.message;
    console.error(error);
  }
}

function splitScriptIntoScenes(script) {
  const sentences = script.split(/[.!?]+/).filter(s => s.trim().length > 0);
  return sentences.slice(0, 5);
}

async function generateImageFromHF(prompt, token) {
  const response = await fetch("https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      inputs: prompt
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Image generation failed: ${response.status} ${text}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

async function generateVoiceover(text, token) {
  const voiceId = "21m00Tdm4aaJJqv6M9K8u4c";

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": token
    },
    body: JSON.stringify({
      text: text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Voice generation failed: ${response.status} ${errText}`);
  }

  const audioBlob = await response.blob();
  return audioBlob;
}

async function composeVideo(images, audioBlob) {
  if (!images || images.length === 0) {
    throw new Error("No images were generated.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;

  const stream = canvas.captureStream(20);
  const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });

  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const imageFrames = [];
  for (let i = 0; i < images.length; i++) {
    const img = new Image();
    img.src = images[i];

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const frameCanvas = document.createElement("canvas");
    frameCanvas.width = 1280;
    frameCanvas.height = 720;
    const frameCtx = frameCanvas.getContext("2d");
    frameCtx.drawImage(img, 0, 0, frameCanvas.width, frameCanvas.height);

    imageFrames.push(frameCanvas);
  }

  recorder.start();

  for (let i = 0; i < imageFrames.length; i++) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageFrames[i], 0, 0, canvas.width, canvas.height);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  recorder.stop();

  await new Promise((resolve) => {
    recorder.onstop = resolve;
  });

  return new Blob(chunks, { type: "video/webm" });
}

generateBtn.addEventListener("click", generateVideo);
testBtn.addEventListener("click", testSetup);
loadTokens();
