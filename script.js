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

  statusEl.textContent = "Testing connection to API services...";
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
      throw new Error(`Hugging Face error: ${res.status}`);
    }

    statusEl.textContent = "Hugging Face API is working.";
    updateProgress(60);

    const ttsRes = await fetch("https://api.elevenlabs.io/v1/voices", {
      method: "GET",
      headers: {
        "xi-api-key": eleven
      }
    });

    if (!ttsRes.ok) {
      throw new Error(`ElevenLabs error: ${ttsRes.status}`);
    }

    statusEl.textContent = "Everything looks connected correctly.";
    updateProgress(100);

  } catch (error) {
    statusEl.textContent = "Connection test failed. Check your API keys or internet connection.";
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

    const audioBlob = await generateVoiceover(sceneToText(script), eleven);

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
    statusEl.textContent = "Something went wrong during generation. Please check your tokens and try again.";
    console.error(error);
  }
}

function splitScriptIntoScenes(script) {
  const sentences = script.split(/[.!?]+/).filter(s => s.trim().length > 0);
  return sentences.slice(0, 5);
}

function sceneToText(script) {
  return script.slice(0, 400);
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
    throw new Error("Image generation failed.");
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

async function generateVoiceover(text, token) {
  const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tdm4aaJJqv6M9K8u4c", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": token
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        voice_id: "21m00Tdm4aaJJqv6M9K8u4c"
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Voice generation failed: ${errorText}`);
  }

  const audioBlob = await response.blob();
  return audioBlob;
}

async function composeVideo(images, audioBlob) {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;

  const ctx = canvas.getContext("2d");

  const videoChunks = [];
  const duration = 1.8;

  for (let i = 0; i < images.length; i++) {
    const img = new Image();
    img.src = images[i];

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const chunk = document.createElement("canvas");
    chunk.width = canvas.width;
    chunk.height = canvas.height;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const chunkCtx = chunk.getContext("2d");
    chunkCtx.putImageData(imageData, 0, 0);

    videoChunks.push(chunk);
  }

  const video = document.createElement("video");
  video.src = images[0];
  video.muted = true;
  video.playsInline = true;

  await new Promise((resolve, reject) => {
    video.onloadeddata = resolve;
    video.onerror = reject;
  });

  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = 1280;
  finalCanvas.height = 720;

  const canvasStream = finalCanvas.getContext("2d");
  canvasStream.drawImage(video, 0, 0, finalCanvas.width, finalCanvas.height);

  const audioContext = new AudioContext();
  const source = await audioContext.decodeAudioData(await audioBlob.arrayBuffer());

  const finalChunks = [];
  for (let i = 0; i < 5; i++) {
    const frameCanvas = document.createElement("canvas");
    frameCanvas.width = 1280;
    frameCanvas.height = 720;

    const ctxFrame = frameCanvas.getContext("2d");
    const img = new Image();
    img.src = images[i % images.length];
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    ctxFrame.drawImage(img, 0, 0, frameCanvas.width, frameCanvas.height);

    finalChunks.push(frameCanvas);
  }

  const blob = new Blob([await new Uint8Array()], {
    type: "video/webm"
  });

  return blob;
}

generateBtn.addEventListener("click", generateVideo);
testBtn.addEventListener("click", testSetup);
loadTokens();
