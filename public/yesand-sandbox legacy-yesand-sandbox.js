// Edit this list to change the available categories for YesAndAI suggestions.
const CATEGORIES = [
  "none",
  "Praise / Appreciation",
  "Confusion",
  "Frustration / Overload",
  "Skepticism",
  "Logistics",
  "Humor",
  "Reflection",
  "Implementation Question",
];

const MAX_HISTORY = 10;
const history = [];

let csvExamples = [];
let currentCsvIndex = 0;
let currentTeacherMessage = "";
let currentModelCategory = "";
let currentSuggestionText = "";
let feedbackLogged = false;

const teacherInput = document.getElementById("teacherMessage");
const categorySelect = document.getElementById("categorySelect");
const generateBtn = document.getElementById("generateBtn");
const errorMessage = document.getElementById("errorMessage");
const suggestionText = document.getElementById("suggestionText");
const categoryBadge = document.getElementById("categoryBadge");
const trainerTeacher = document.getElementById("trainerTeacher");
const trainerCategory = document.getElementById("trainerCategory");
const trainerSuggestion = document.getElementById("trainerSuggestion");
const historyList = document.getElementById("historyList");
const csvUpload = document.getElementById("csvUpload");
const csvStatus = document.getElementById("csvStatus");
const csvCounter = document.getElementById("csvCounter");
const nextMessageBtn = document.getElementById("nextMessageBtn");
const thumbsUpBtn = document.getElementById("thumbsUpBtn");
const thumbsDownBtn = document.getElementById("thumbsDownBtn");
const rewritePanel = document.getElementById("rewritePanel");
const trainerImprovement = document.getElementById("trainerImprovement");
const submitFeedbackBtn = document.getElementById("submitFeedbackBtn");
const feedbackStatus = document.getElementById("feedbackStatus");
const scoreList = document.getElementById("scoreList");

const sanitize = (value) =>
  value ? value.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";

// CSV label should match exactly one of the category strings in CATEGORIES to auto-select it.
const normalizeCategoryLabel = (label) => {
  if (!label) return CATEGORIES[0];
  return CATEGORIES.find((category) => category === label) || CATEGORIES[0];
};

const parseCsvLine = (line) => {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current.trim());
  return values;
};

const parseCsv = (text) => {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (rows.length === 0) return [];

  const headers = parseCsvLine(rows[0]).map((h) =>
    h.replace(/^"|"$/g, "").trim().toLowerCase()
  );
  const commentIdx = headers.indexOf("comment_text");
  const labelIdx = headers.indexOf("label");
  if (commentIdx === -1) return [];

  return rows.slice(1).map((row) => {
    const values = parseCsvLine(row);
    return {
      comment_text: values[commentIdx] || "",
      label: labelIdx >= 0 ? values[labelIdx] || "" : "",
    };
  });
};

function populateCategories() {
  CATEGORIES.forEach((label) => {
    const option = document.createElement("option");
    option.value = label;
    option.textContent = label;
    categorySelect.appendChild(option);
  });
}

function renderHistory() {
  if (!history.length) {
    historyList.innerHTML = `
      <div class="recent-card">
        <p>No interactions yet.</p>
      </div>
    `;
    return;
  }

  historyList.innerHTML = history
    .map(
      (entry) => `
        <div class="recent-card">
          <p><strong>Teacher:</strong> ${sanitize(entry.teacher)}</p>
          <p><strong>Category:</strong> ${sanitize(entry.category)}</p>
          <p><strong>YesAndAI:</strong> ${sanitize(entry.suggestion)}</p>
        </div>
      `
    )
    .join("");
}

function addToHistory(entry) {
  history.unshift(entry);
  if (history.length > MAX_HISTORY) {
    history.pop();
  }
  renderHistory();
}

function setTrainerView(message, category, suggestion) {
  trainerTeacher.textContent = message;
  trainerCategory.textContent = category;
  trainerSuggestion.textContent = suggestion;
}

function resetFeedbackUI() {
  feedbackStatus.textContent = "";
  thumbsUpBtn.disabled = false;
  thumbsDownBtn.disabled = false;
  submitFeedbackBtn.disabled = false;
  rewritePanel.classList.add("hidden");
  trainerImprovement.value = "";
}

function revealRewritePanel() {
  rewritePanel.classList.remove("hidden");
  feedbackStatus.textContent = "";
}

function clearScoreBoard() {
  if (!scoreList) return;
  scoreList.innerHTML = `<p>No scores yet.</p>`;
}

function renderScoreBoard(scores = {}) {
  if (!scoreList) return;
  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
  if (!sorted.length) {
    clearScoreBoard();
    return;
  }
  scoreList.innerHTML = sorted
    .map(
      ([label, value]) => `
        <div class="score-item">
          <span>${sanitize(label)}</span>
          <span>${(value * 100).toFixed(1)}%</span>
        </div>
      `
    )
    .join("");
}

const updateCsvStatus = (count = 0) => {
  csvStatus.textContent = count
    ? `Loaded ${count} message${count === 1 ? "" : "s"}`
    : "No file loaded";
  if (!count) {
    csvCounter.textContent = "";
  }
};

function loadNextCsvMessage() {
  if (!csvExamples.length) return;
  const row = csvExamples[currentCsvIndex];
  const targetCategory = normalizeCategoryLabel(row.label);
  teacherInput.value = row.comment_text;
  categorySelect.value = targetCategory;
  csvCounter.textContent = `Example ${currentCsvIndex + 1} of ${csvExamples.length}`;
  currentCsvIndex = (currentCsvIndex + 1) % csvExamples.length;
  currentTeacherMessage = "";
  currentModelCategory = "";
  currentSuggestionText = "";
  feedbackLogged = false;
  resetFeedbackUI();
  clearScoreBoard();
}

function handleCsvUpload(event) {
  const file = event.target.files?.[0];
  if (!file) {
    csvExamples = [];
    currentCsvIndex = 0;
    nextMessageBtn.disabled = true;
    updateCsvStatus(0);
    clearScoreBoard();
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const parsed = parseCsv(reader.result);
    if (!parsed.length) {
      csvExamples = [];
      currentCsvIndex = 0;
      nextMessageBtn.disabled = true;
      updateCsvStatus(0);
      csvStatus.textContent = "No valid rows found";
      clearScoreBoard();
      return;
    }

    csvExamples = parsed;
    currentCsvIndex = 0;
    nextMessageBtn.disabled = false;
    updateCsvStatus(csvExamples.length);
    csvCounter.textContent = `Example 1 of ${csvExamples.length}`;
  };
  reader.readAsText(file);
}

async function submitFeedback(rating, revision = "") {
  if (!currentTeacherMessage) {
    feedbackStatus.textContent = "Please generate a suggestion before logging feedback.";
    return;
  }
  if (feedbackLogged) {
    feedbackStatus.textContent = "Feedback already recorded for this suggestion.";
    return;
  }

  const payload = {
    teacherMessage: currentTeacherMessage,
    modelCategory: currentModelCategory,
    correctedCategory: categorySelect.value || "none",
    suggestion: currentSuggestionText,
    rating,
    trainerRevision: revision,
  };

  thumbsUpBtn.disabled = true;
  thumbsDownBtn.disabled = true;
  submitFeedbackBtn.disabled = true;

  try {
    // Sends trainer ratings to /api/yesand/log so the server appends rows to data/yesand_feedback_log.csv.
    const response = await fetch("/api/yesand/log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Unable to save feedback right now.");
    }

    feedbackStatus.textContent = "Feedback recorded — thank you.";
    feedbackLogged = true;
    rewritePanel.classList.add("hidden");
    trainerImprovement.value = "";
  } catch (err) {
    feedbackStatus.textContent = err.message;
    thumbsUpBtn.disabled = false;
    thumbsDownBtn.disabled = false;
    submitFeedbackBtn.disabled = false;
  }
}

async function handleGenerate() {
  const teacherMessage = teacherInput.value.trim();
  const category = categorySelect.value || "none";

  errorMessage.textContent = "";
  if (!teacherMessage) {
    errorMessage.textContent = "Please enter a teacher message before generating a suggestion.";
    return;
  }

  generateBtn.disabled = true;
  generateBtn.textContent = "Generating...";

  try {
    const response = await fetch("/api/ai/classify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ comment: teacherMessage }),
    });

    if (!response.ok) {
      throw new Error("Could not reach AI classifier. Is the Python service running?");
    }

    const payload = await response.json();
    const label = payload.label || "none";
    const scores = payload.scores || {};
    const displaySuggestion = `Classifier predicts: ${label}`;

    suggestionText.textContent = displaySuggestion;
    categoryBadge.textContent = `Category: ${label}`;
    setTrainerView(teacherMessage, label, displaySuggestion);
    currentTeacherMessage = teacherMessage;
    currentModelCategory = label;
    currentSuggestionText = displaySuggestion;
    feedbackLogged = false;
    resetFeedbackUI();
    renderScoreBoard(scores);
    if (CATEGORIES.includes(label)) {
      categorySelect.value = label;
    }
    addToHistory({
      teacher: teacherMessage,
      category: label,
      suggestion: snapshotSuggestion(displaySuggestion, 90),
    });
    teacherInput.value = "";
  } catch (err) {
    errorMessage.textContent = err.message;
    clearScoreBoard();
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "Generate Yes, and... Suggestion";
  }
}

function snapshotSuggestion(text, maxLength = 80) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}...`;
}

generateBtn.addEventListener("click", handleGenerate);

teacherInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    handleGenerate();
  }
});

nextMessageBtn.addEventListener("click", loadNextCsvMessage);
csvUpload.addEventListener("change", handleCsvUpload);
thumbsUpBtn.addEventListener("click", () => submitFeedback("good"));
thumbsDownBtn.addEventListener("click", () => revealRewritePanel());
submitFeedbackBtn.addEventListener("click", () => {
  const revision = trainerImprovement.value.trim();
  submitFeedback("bad", revision);
});

window.addEventListener("load", () => {
  populateCategories();
  renderHistory();
  updateCsvStatus(0);
  resetFeedbackUI();
});
