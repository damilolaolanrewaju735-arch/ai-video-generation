const hfTokenInput = document.getElementById("hfToken");
const elevenLabsTokenInput = document.getElementById("elevenLabsToken");
const scriptInput = document.getElementById("scriptInput");
const generateBtn = document.getElementById("generateBtn");
const testBtn = document.getElementById("testBtn");
const statusEl = document.getElementById("status");
const progressBar = document.getElementById("progressBar");
const previewVideo = document.getElementById("previewVideo");
const downloadLink = document.getElementById("downloadLink");

const STORAGE_KEYS = {
  hfToken: "hfToken",
  elevenLabsToken: "elevenLabsToken"
};

function saveTokens() {
  localStorage.setItem(STORAGE_KEYS.hfToken, hfTokenInput.value.trim());
  localStorage.setItem(STORAGE_KEYS.elevenLabsToken, elevenLabsTokenInput.value.trim());
  statusEl.textContent = "API keys saved locally in your browser.";
}

function loadTokens() {
  hfTokenInput.value = localStorage.getItem(STORAGE_KEYS.hfToken) || "";
  elevenLabsTokenInput.value = localStorage.getItem(STORAGE_KEYS.elevenLabsToken) || "";
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

  statusEl.textContent = "Testing Hugging Face image API...";
  updateProgress(20);

  try {
    const res = await fetch("https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hf}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: "cinematic sunrise, ultra realistic, detailed"
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Hugging Face failed: ${res.status} ${text}`);
    }

    const imageBlob = await res.blob();
    const imageUrl = URL.createObjectURL(imageBlob);

    statusEl.textContent = "Hugging Face works. Testing ElevenLabs...";
    updateProgress(50);

    const voiceRes = await fetch("https://api.elevenlabs.io/v1/voices", {
      method: "GET",
      headers: {
        "xi-api-key": eleven
      }
    });

    if (!voiceRes.ok) {
      const text = await voiceRes.text();
      throw new Error(`ElevenLabs failed: ${voiceRes.status} ${text}`);
    }

    const voiceData = await voiceRes.json();
    console.log("ElevenLabs voice list:", voiceData);

    statusEl.textContent = "Everything is connected correctly.";
    updateProgress(100);

    // If you want to preview the image for testing
    const tempImage = document.createElement("img");
    tempImage.src = imageUrl;
    tempImage.style.width = "200px";
    tempImage.style.marginTop = "12px";
    tempImage.style.borderRadius = "12px";
    tempImage.style.display = "block";

    const existing = document.querySelector(".debug-image");
    if (existing) existing.remove();

    tempImage.className = "debug-image";
    document.getElementById("status").appendChild(tempImage);

  } catch (error) {
    console.error(error);
    statusEl.textContent = "Connection failed: " + error.message;
  }
}

async function generateImageOnly() {
  const hf = hfTokenInput.value.trim();
  if (!hf) {
    statusEl.textContent = "Add your Hugging Face token first.";
    return;
  }

  const prompt = scriptInput.value.trim() || "a cinematic mountain landscape at sunrise";

  statusEl.textContent = "Generating one image...";
  updateProgress(20);

  try {
    const res = await fetch("https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hf}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: prompt
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Image generation failed: ${res.status} ${text}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    previewVideo.src = url;
    previewVideo.style.display = "block";
    downloadLink.href = url;
    downloadLink.classList.remove("hidden");
    downloadLink.textContent = "Download image";

    statusEl.textContent = "Image generated successfully.";
    updateProgress(100);

  } catch (error) {
    console.error(error);
    statusEl.textContent = "Image generation failed: " + error.message;
  }
}

async function generateVoiceOnly() {
  const eleven = elevenLabsTokenInput.value.trim();
  if (!eleven) {
    statusEl.textContent = "Add your ElevenLabs token first.";
    return;
  }

  const text = (scriptInput.value.trim() || "Hello world, this is a test.").slice(0, 400);

  statusEl.textContent = "Generating voice...";
  updateProgress(30);

  try {
    const voiceListRes = await fetch("https://api.elevenlabs.io/v1/voices", {
      method: "GET",
      headers: {
        "xi-api-key": eleven
      }
    });

    if (!voiceListRes.ok) {
      const textResp = await voiceListRes.text();
      throw new Error(`Voice listing failed: ${voiceListRes.status} ${textResp}`);
    }

    const voiceList = await voiceListRes.json();
    console.log("Available voices:", voiceList);

    const voiceId = voiceList.voices?.[0]?.voice_id || "21m00Tdm4aaJJqv6M9K8u4c";

    const voiceRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": eleven
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8
        }
      })
    });

    if (!voiceRes.ok) {
      const errorText = await voiceRes.text();
      throw new Error(`Voice generation failed: ${voiceRes.status} ${errorText}`);
    }

    const audioBlob = await voiceRes.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    const audioPlayer = document.createElement("audio");
    audioPlayer.controls = true;
    audioPlayer.src = audioUrl;
    audioPlayer.style.marginTop = "12px";
    audioPlayer.style.width = "100%";

    const existingAudio = document.querySelector(".debug-audio");
    if (existingAudio) existingAudio.remove();

    audioPlayer.className = "debug-audio";
    statusEl.appendChild(audioPlayer);

    statusEl.textContent = "Voice generated successfully.";
    updateProgress(100);

  } catch (error) {
    console.error(error);
    statusEl.textContent = "Voice generation failed: " + error.message;
  }
}

async function generateVideoFromWorkingParts() {
  const hf = hfTokenInput.value.trim();
  const eleven = elevenLabsTokenInput.value.trim();

  if (!hf || !eleven) {
    statusEl.textContent = "Add both tokens first.";
    return;
  }

  statusEl.textContent = "Generating image and audio separately...";
  updateProgress(10);

  try {
    const imagePrompt = scriptInput.value.trim() || "sunset over ocean";
    const imageRes = await fetch("https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hf}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: imagePrompt
      })
    });

    if (!imageRes.ok) {
      throw new Error("Image step failed");
    }

    const imageBlob = await imageRes.blob();
    const imageUrl = URL.createObjectURL(imageBlob);

    const voiceListRes = await fetch("https://api.elevenlabs.io/v1/voices", {
      method: "GET",
      headers: {
        "xi-api-key": eleven
      }
    });

    if (!voiceListRes.ok) {
      throw new Error("Voice list failed");
    }

    const voiceList = await voiceListRes.json();
    const voiceId = voiceList.voices?.[0]?.voice_id || "21m00Tdm4aaJJqv6M9K8u4c";

    const voiceRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": eleven
      },
      body: JSON.stringify({
        text: "This is a test audio sample.",
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8
        }
      })
    });

    if (!voiceRes.ok) {
      throw new Error("Voice step failed");
    }

    const audioBlob = await voiceRes.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    previewVideo.src = imageUrl;
    previewVideo.style.display = "block";
    downloadLink.href = imageUrl;
    downloadLink.classList.remove("hidden");
    downloadLink.textContent = "Download image";

    const audioPlayer = document.createElement("audio");
    audioPlayer.controls = true;
    audioPlayer.src = audioUrl;
    audioPlayer.style.marginTop = "12px";
    audioPlayer.style.width = "100%";

    const existingAudio = document.querySelector(".debug-audio");
    if (existingAudio) existingAudio.remove();

    audioPlayer.className = "debug-audio";
    statusEl.appendChild(audioPlayer);

    statusEl.textContent = "Image and voice parts are working.";
    updateProgress(100);

  } catch (error) {
    console.error(error);
    statusEl.textContent = "One of the parts failed: " + error.message;
  }
}

generateBtn.addEventListener("click", generateImageOnly);
testBtn.addEventListener("click", testSetup);
loadTokens();
