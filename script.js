const hfTokenInput = document.getElementById("hfToken");
const testBtn = document.getElementById("testBtn");
const statusEl = document.getElementById("status");

document.getElementById("saveKeysBtn").addEventListener("click", () => {
  localStorage.setItem("hfToken", hfTokenInput.value.trim());
  statusEl.textContent = "Token saved.";
});

testBtn.addEventListener("click", async () => {
  const token = hfTokenInput.value.trim();

  if (!token) {
    statusEl.textContent = "Paste your token first.";
    return;
  }

  statusEl.textContent = "Testing token...";

  try {
    const res = await fetch("https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: "a cat"
      })
    });

    console.log("Response status:", res.status);
    console.log("Response ok:", res.ok);

    const text = await res.text();
    console.log("Response text:", text);

    if (res.ok) {
      statusEl.textContent = "Token works!";
    } else {
      statusEl.textContent = `Error ${res.status}: ${text}`;
    }

  } catch (error) {
    console.error("Fetch error:", error);
    statusEl.textContent = "Fetch failed: " + error.message;
  }
});

hfTokenInput.value = localStorage.getItem("hfToken") || "";
