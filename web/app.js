if (!localStorage.getItem("cvault_profile") && window.chrome?.runtime) {
  try {
    chrome.runtime.sendMessage({ type: "REQUEST_CVAULT_PROFILE" });
  } catch {}
}

const raw = localStorage.getItem("cvault_profile");
let data = {};
let photoBase64 = "";

document.getElementById("photo").addEventListener("change", e => {
  const reader = new FileReader();
  reader.onload = () => photoBase64 = reader.result;
  reader.readAsDataURL(e.target.files[0]);
});

async function analyze() {
  if (!raw) return alert("Use the extension first.");
  const key = apiKey.value;
  if (!key) return alert("Groq API key required.");

  const prompt = `
Extract LinkedIn profile into this JSON schema ONLY:
${JSON.stringify(SCHEMA, null, 2)}

Rules:
- Merge multiple roles under same company
- Do not hallucinate
- Leave empty arrays if missing
- Ignore UI text

Profile text:
${raw}
`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1
    })
  });

  const json = await res.json();
  data = JSON.parse(json.choices[0].message.content);
  renderEditor();
}

function renderEditor() {
  editor.classList.remove("hidden");
  content.innerHTML = `
    <p><strong>${data.name}</strong> – ${data.headline}</p>
    <p>${data.summary}</p>
  `;
}

function renderExperience() {
  return data.experience.map(c => `
    <div class="job">
      <strong>${c.company}</strong>
      ${c.roles.map(r => `
        <p><em>${r.title}</em> (${r.period})<br>${r.description}</p>
      `).join("")}
    </div>
  `).join("");
}

async function buildCV() {
  let html = await fetch(`templates/${template.value}.html`).then(r => r.text());

  html = html
    .replace("{{PHOTO}}", photoBase64 || "")
    .replace("{{NAME}}", data.name)
    .replace("{{HEADLINE}}", data.headline)
    .replace("{{LOCATION}}", data.location)
    .replace("{{SUMMARY}}", data.summary)
    .replace("{{EXPERIENCE}}", renderExperience())
    .replace("{{EDUCATION}}", data.education.map(e =>
      `<p>${e.degree} in ${e.field} – ${e.institution} (${e.period})</p>`
    ).join(""))
    .replace("{{SKILLS}}", data.skills.map(s => `<span>${s}</span>`).join(""));

  if (!photoBase64) html = html.replace(/{{PHOTO_BLOCK}}[\s\S]*?{{\/PHOTO_BLOCK}}/, "");

  cv.innerHTML = html;
  preview.classList.remove("hidden");
}

function exportPDF() {
  html2pdf().from(cv).save("cv.pdf");
}

function exportDOCX() {
  const doc = new docx.Document({
    sections: [{ children: [new docx.Paragraph(cv.innerText)] }]
  });
  docx.Packer.toBlob(doc).then(b => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = "cv.docx";
    a.click();
  });
}
