"""
MindTrace++ Text Emotion Service
Combines a lexicon-based affective scorer (NRC/ANEW-inspired word lists) with
TF-IDF + Logistic Regression trained on GoEmotions-like patterns.
No downloads required. Swap for RoBERTa fine-tune when HF Hub is accessible.
"""
from fastapi import FastAPI
from pydantic import BaseModel
import numpy as np
import time, re
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import LabelEncoder

app = FastAPI(title="MindTrace++ Text Emotion Service")

EMOTIONS = ["happy", "sad", "angry", "fear", "disgust", "surprise", "neutral"]

# ── Affective lexicon (NRC Emotion Lexicon inspired, condensed) ───────────────
LEXICON: dict[str, dict[str, float]] = {
    # happy
    "happy":0.9,"joy":0.9,"love":0.85,"excited":0.85,"wonderful":0.8,
    "great":0.75,"excellent":0.8,"fantastic":0.85,"amazing":0.8,"beautiful":0.75,
    "delighted":0.85,"pleased":0.75,"cheerful":0.8,"glad":0.75,"thrilled":0.85,
    "celebrate":0.8,"enjoy":0.75,"fun":0.7,"laugh":0.75,"smile":0.75,
    # sad
    "sad":0.9,"grief":0.9,"cry":0.85,"depressed":0.9,"miserable":0.85,
    "unhappy":0.8,"sorrow":0.85,"lonely":0.8,"heartbroken":0.9,"disappointed":0.75,
    "hopeless":0.85,"gloomy":0.8,"despair":0.9,"mourn":0.85,"regret":0.75,
    # angry
    "angry":0.9,"furious":0.95,"rage":0.95,"hate":0.85,"frustrated":0.8,
    "annoyed":0.75,"irritated":0.75,"outraged":0.9,"mad":0.8,"hostile":0.85,
    "aggressive":0.8,"livid":0.9,"infuriated":0.9,"resentment":0.8,"bitter":0.75,
    # fear
    "fear":0.9,"scared":0.9,"terrified":0.95,"anxious":0.8,"nervous":0.75,
    "worried":0.8,"panic":0.9,"dread":0.85,"horror":0.9,"phobia":0.85,
    "threatened":0.8,"uneasy":0.7,"apprehensive":0.75,"nightmare":0.8,
    # disgust
    "disgust":0.9,"disgusting":0.9,"revolting":0.85,"gross":0.8,"nasty":0.8,
    "repulsive":0.85,"loathe":0.85,"awful":0.75,"horrible":0.8,"nauseating":0.85,
    # surprise
    "surprised":0.85,"shocked":0.85,"astonished":0.9,"amazed":0.8,"unexpected":0.75,
    "sudden":0.65,"wow":0.8,"unbelievable":0.8,"incredible":0.75,"stunned":0.85,
    # neutral
    "okay":0.6,"fine":0.55,"normal":0.6,"usual":0.55,"regular":0.55,"just":0.4,
}

EMOTION_WORDS: dict[str, list[str]] = {
    "happy":   ["happy","joy","love","excited","wonderful","great","excellent",
                "fantastic","amazing","beautiful","delighted","pleased","cheerful",
                "glad","thrilled","celebrate","enjoy","fun","laugh","smile"],
    "sad":     ["sad","grief","cry","depressed","miserable","unhappy","sorrow",
                "lonely","heartbroken","disappointed","hopeless","gloomy","despair",
                "mourn","regret","tears","weep"],
    "angry":   ["angry","furious","rage","hate","frustrated","annoyed","irritated",
                "outraged","mad","hostile","aggressive","livid","infuriated",
                "resentment","bitter","anger"],
    "fear":    ["fear","scared","terrified","anxious","nervous","worried","panic",
                "dread","horror","phobia","threatened","uneasy","apprehensive",
                "nightmare","frighten","afraid"],
    "disgust": ["disgust","disgusting","revolting","gross","nasty","repulsive",
                "loathe","awful","horrible","nauseating","yuck","vile","putrid"],
    "surprise":["surprised","shocked","astonished","amazed","unexpected","sudden",
                "wow","unbelievable","incredible","stunned","whoa","startled"],
    "neutral": ["okay","fine","normal","usual","regular","just","think","know",
                "said","today","time","went","came","look","see"],
}

# ── Build TF-IDF + LR classifier from synthetic corpus ────────────────────────
_clf     = None
_vec     = None
_le      = None

def _build_text_classifier():
    rng = np.random.default_rng(0)
    corpus, labels = [], []
    templates = {
        "happy":   ["I feel so {} today", "This is {} news", "I am {} about this",
                    "What a {} day", "Feeling {} and {}", "I {} this so much"],
        "sad":     ["I feel so {} today", "This makes me {}", "I am {} about losing",
                    "Feeling {} and {}", "I {} every day", "Such a {} experience"],
        "angry":   ["I am so {} at this", "This {} me", "How {} can they be",
                    "I {} this situation", "Such {} behavior", "I feel {} and {}"],
        "fear":    ["I am so {} about", "This {} me greatly", "Feeling {} and {}",
                    "I {} what will happen", "Such a {} situation", "I {} every night"],
        "disgust": ["This is so {}", "I find this {}", "How {} is that",
                    "Such a {} thing", "I feel {} seeing this", "Completely {}"],
        "surprise":["I was so {} by", "This was so {}", "Never {} this coming",
                    "What a {} turn", "I am {} to see", "How {} is this"],
        "neutral": ["I {} this is okay", "It was {} today", "The {} went normally",
                    "I {} think about it", "Everything {} as usual", "Just a {} day"],
    }
    for emo, tmpl_list in templates.items():
        words = EMOTION_WORDS[emo]
        for _ in range(60):
            tmpl = rng.choice(tmpl_list)
            w1   = rng.choice(words)
            w2   = rng.choice(words)
            corpus.append(tmpl.format(w1, w2))
            labels.append(emo)
        # Add raw keyword sentences
        for w in words:
            corpus.append(f"I feel {w}")
            corpus.append(f"Feeling very {w}")
            labels += [emo, emo]

    vec = TfidfVectorizer(ngram_range=(1, 2), max_features=2000,
                          sublinear_tf=True, min_df=1)
    X   = vec.fit_transform(corpus)
    le  = LabelEncoder()
    y   = le.fit_transform(labels)
    clf = LogisticRegression(C=1.5, max_iter=500, random_state=42,
                             solver="lbfgs")
    clf.fit(X, y)
    return clf, vec, le


def lexicon_scores(text: str) -> dict[str, float]:
    words  = re.findall(r'\b\w+\b', text.lower())
    scores = {e: 0.0 for e in EMOTIONS}
    for w in words:
        if w in LEXICON:
            strength = LEXICON[w]
            for emo, word_list in EMOTION_WORDS.items():
                if w in word_list:
                    scores[emo] += strength
    total = sum(scores.values()) or 1.0
    return {e: v / total for e, v in scores.items()}


def get_classifier():
    global _clf, _vec, _le
    if _clf is None:
        _clf, _vec, _le = _build_text_classifier()
    return _clf, _vec, _le


class TextRequest(BaseModel):
    text: str
    session_id: str


@app.on_event("startup")
async def startup():
    get_classifier()


@app.post("/predict")
async def predict(body: TextRequest):
    start = time.time()
    clf, vec, le = get_classifier()

    # TF-IDF model scores
    X     = vec.transform([body.text])
    proba = clf.predict_proba(X)[0]
    model_scores = {le.classes_[i]: float(p) for i, p in enumerate(proba)}

    # Lexicon scores
    lex = lexicon_scores(body.text)

    # Ensemble: 60% model, 40% lexicon
    final = {}
    for e in EMOTIONS:
        final[e] = 0.6 * model_scores.get(e, 0.0) + 0.4 * lex.get(e, 0.0)

    total = sum(final.values()) or 1.0
    scores = [{"emotion": e, "confidence": round(v / total, 4)}
              for e, v in final.items()]
    scores.sort(key=lambda x: x["confidence"], reverse=True)
    dominant = scores[0]["emotion"]

    pos = sum(s["confidence"] for s in scores if s["emotion"] in ("happy","surprise"))
    neg = sum(s["confidence"] for s in scores if s["emotion"] in ("angry","sad","fear","disgust"))
    valence  = round(max(-1.0, min(1.0, pos - neg)), 4)
    sentiment = "positive" if valence > 0.1 else "negative" if valence < -0.1 else "neutral"

    return {
        "session_id":    body.session_id,
        "dominant":      dominant,
        "scores":        scores,
        "valence":       valence,
        "sentiment":     sentiment,
        "processing_ms": round((time.time() - start) * 1000, 2),
    }


@app.get("/health")
def health():
    return {"status": "ok", "service": "ml-text", "backend": "tfidf-lexicon-ensemble"}
