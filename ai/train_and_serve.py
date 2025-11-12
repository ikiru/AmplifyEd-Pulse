"""Train a TF-IDF + Logistic Regression classifier and expose it via FastAPI."""

from __future__ import annotations

from pathlib import Path
from typing import Dict

import pandas as pd
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

CSV_PATH = (
    Path(__file__).resolve().parents[1]
    / "training CSV"
    / "AmplifyEd_Feedback_Labeling_Starter.csv"
)

if not CSV_PATH.exists():
    raise FileNotFoundError(f"Expected training CSV at {CSV_PATH}.")

app = FastAPI(title="YesAndAI Classifier")


class ClassifyRequest(BaseModel):
    comment: str


class ClassifyResponse(BaseModel):
    label: str
    scores: Dict[str, float]


print(f"Loading training data from {CSV_PATH}")
training_df = (
    pd.read_csv(CSV_PATH, usecols=["comment_text", "label"])
    .dropna(subset=["comment_text", "label"])
    .reset_index(drop=True)
)

X_train = training_df["comment_text"].astype(str).tolist()
y_train = training_df["label"].astype(str).tolist()

pipeline = Pipeline(
    [
        (
            "tfidf",
            TfidfVectorizer(
                stop_words="english",
                ngram_range=(1, 2),
                max_df=0.9,
                min_df=2,
            ),
        ),
        ("clf", LogisticRegression(max_iter=1000)),
    ]
)

# Fit the model once at startup so predictions can be served quickly.
pipeline.fit(X_train, y_train)


@app.get("/health")
def health() -> Dict[str, str]:
    """Quick healthcheck for the classifier service."""
    return {"status": "ok"}


@app.post("/classify", response_model=ClassifyResponse)
def classify(request: ClassifyRequest) -> ClassifyResponse:
    """Return the most likely label and per-class probabilities for a comment."""
    comment = request.comment.strip()
    if not comment:
        raise HTTPException(status_code=400, detail="Comment is required.")

    proba = pipeline.predict_proba([comment])[0]
    label = pipeline.classes_[proba.argmax()]
    scores = {cls: float(score) for cls, score in zip(pipeline.classes_, proba)}

    return ClassifyResponse(label=label, scores=scores)


if __name__ == "__main__":
    # Run with: uvicorn ai.train_and_serve:app --reload --port 8001
    uvicorn.run("ai.train_and_serve:app", host="127.0.0.1", port=8001, reload=True)
