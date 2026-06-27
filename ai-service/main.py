import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any

from schemas import (
    GenerateQuestionsRequest, GenerateQuestionsResponse,
    EvaluateAnswerRequest, EvaluateAnswerResponse,
    SemanticScoreRequest, SemanticScoreResponse,
    GenerateCrossQuestionsRequest, GenerateCrossQuestionsResponse,
    DetectSkillGapsRequest, DetectSkillGapsResponse,
    GenerateFinalReportRequest, GenerateFinalReportResponse
)
from llm_client import query_llm_json
from nlp_engine import calculate_semantic_similarity, check_concept_coverage
import prompts

app = FastAPI(
    title="InterviewMind AI Evaluation Engine",
    description="Python FastAPI service handling NLP similarity scoring, question generation, and candidate report compilation.",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "active", "nlp_ready": True}


@app.post("/ai/generate-questions", response_model=GenerateQuestionsResponse)
def generate_questions(request: GenerateQuestionsRequest):
    """
    Generates 4 distinct questions (Technical, Project, Scenario, HR) for the interview setup.
    """
    user_prompt = prompts.QUESTION_GENERATION_PROMPT.format(
        targetRole=request.targetRole,
        difficulty=request.difficulty,
        experienceLevel=request.experienceLevel,
        skills=", ".join(request.skills),
        projectTitle=request.projectTitle,
        projectDescription=request.projectDescription,
        techStack=", ".join(request.techStack)
    )

    fallback = {
        "questions": [
            {
                "questionText": f"Explain the architectural trade-offs you considered when selecting tools for your project: {request.projectTitle}.",
                "questionType": "PROJECT",
                "idealAnswer": "Assess scalability, operational overhead, database selection guidelines (SQL vs NoSQL), and caching strategies."
            },
            {
                "questionText": f"What are the best practices for handling asynchronous performance bottlenecks in a {request.targetRole} environment?",
                "questionType": "TECHNICAL",
                "idealAnswer": "Mention connection pooling, batch processing, queueing systems like RabbitMQ/Redis, and profile monitoring."
            },
            {
                "questionText": "A critical production system experiences an unexpected high CPU load spike right before a weekend release. What is your immediate debug procedure?",
                "questionType": "SCENARIO",
                "idealAnswer": "Check log servers, view active queries, assess recent releases, throttle traffic if needed, scale resources, and run hotfix procedures."
            },
            {
                "questionText": "Describe a scenario where you disagreed with a senior developer's technical design. How did you resolve the conflict?",
                "questionType": "HR",
                "idealAnswer": "Active listening, objective research, building prototypes to compare performance, focusing on team success, and respecting the final design decision."
            }
        ]
    }

    raw_json = query_llm_json(prompts.SYSTEM_JSON_INSTRUCTION, user_prompt, fallback)
    
    try:
        # Enforce validation matching Pydantic model
        validated = GenerateQuestionsResponse(**raw_json)
        return validated
    except Exception as validation_err:
        print("Pydantic Validation Error in generate-questions, returning fallback:", validation_err)
        return GenerateQuestionsResponse(**fallback)


@app.post("/ai/evaluate-answer", response_model=EvaluateAnswerResponse)
def evaluate_answer(request: EvaluateAnswerRequest):
    """
    Evaluates a candidate's answer based on the question context and ideal reference.
    """
    user_prompt = prompts.ANSWER_EVALUATION_PROMPT.format(
        questionType=request.questionType,
        questionText=request.questionText,
        idealAnswer=request.idealAnswer,
        candidateAnswer=request.candidateAnswer
    )

    fallback = {
        "technicalScore": 5.0,
        "clarityScore": 5.0,
        "completenessScore": 5.0,
        "confidenceScore": 5.0,
        "roleFitScore": 50.0,
        "strengths": ["Offered an initial answer outline."],
        "weaknesses": ["Answer lacked technical details, correct terminology, or concrete examples."],
        "missingPoints": ["Reference ideal concepts", "Implementation details"],
        "feedback": "Your answer covers basic ideas but lacks technical detail, architectural considerations, and depth.",
        "improvedAnswer": "A complete response should clearly mention core design patterns, runtime optimizations, and database considerations."
    }

    raw_json = query_llm_json(prompts.SYSTEM_JSON_INSTRUCTION, user_prompt, fallback)

    try:
        validated = EvaluateAnswerResponse(**raw_json)
        return validated
    except Exception as validation_err:
        print("Pydantic Validation Error in evaluate-answer, returning fallback:", validation_err)
        return EvaluateAnswerResponse(**fallback)


@app.post("/ai/semantic-score", response_model=SemanticScoreResponse)
def semantic_score(request: SemanticScoreRequest):
    """
    Uses sentence-transformers / scikit-learn cosine similarity to score
    the answer against the ideal guide, and performs concept coverage check.
    """
    try:
        score = calculate_semantic_similarity(request.candidateAnswer, request.idealAnswer)
        matched, missing = check_concept_coverage(request.candidateAnswer, request.requiredConcepts)
        
        return SemanticScoreResponse(
            similarityScore=score,
            matchedConcepts=matched,
            missingConcepts=missing
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"NLP semantic analysis failed: {str(e)}")


@app.post("/ai/generate-cross-questions", response_model=GenerateCrossQuestionsResponse)
def generate_cross_questions(request: GenerateCrossQuestionsRequest):
    """
    Generates follow-up interview drill-down questions based on the candidate's project
    and answer shortcomings.
    """
    user_prompt = prompts.CROSS_QUESTION_PROMPT.format(
        projectTitle=request.projectTitle,
        projectDescription=request.projectDescription,
        techStack=", ".join(request.techStack),
        parentQuestionText=request.parentQuestionText,
        candidateAnswer=request.candidateAnswer,
        weakPoints=", ".join(request.weakPoints)
    )

    fallback = {
        "crossQuestions": [
            {
                "crossQuestionText": f"In your project {request.projectTitle}, how did you handle data validation and error containment between layers?",
                "reason": "Verify candidate can isolate failures in their described stack."
            },
            {
                "crossQuestionText": f"Given your tech stack ({', '.join(request.techStack)}), how do you secure user credentials and restrict unauthorized API calls?",
                "reason": "Test candidate's understanding of core web security practices."
            }
        ]
    }

    raw_json = query_llm_json(prompts.SYSTEM_JSON_INSTRUCTION, user_prompt, fallback)

    try:
        validated = GenerateCrossQuestionsResponse(**raw_json)
        return validated
    except Exception as validation_err:
        print("Pydantic Validation Error in generate-cross-questions, returning fallback:", validation_err)
        return GenerateCrossQuestionsResponse(**fallback)


@app.post("/ai/detect-skill-gaps", response_model=DetectSkillGapsResponse)
def detect_skill_gaps(request: DetectSkillGapsRequest):
    """
    Compares candidate answers with role requirements to spot gaps and recommend topics.
    """
    transcript_text = ""
    for idx, ans in enumerate(request.candidateAnswers):
        transcript_text += f"\nQ{idx+1}: {ans.questionText}\nAns: {ans.answerText}\nStrengths: {', '.join(ans.strengths)}\nWeaknesses: {', '.join(ans.weaknesses)}\n"

    user_prompt = prompts.SKILL_GAP_PROMPT.format(
        targetRole=request.targetRole,
        skills=", ".join(request.skills),
        transcript=transcript_text
    )

    fallback = {
        "missingSkills": ["Production Security Best Practices", "Database query optimization"],
        "recommendedTopics": ["JWT token expiration handling", "Indexed fields in database systems"]
    }

    raw_json = query_llm_json(prompts.SYSTEM_JSON_INSTRUCTION, user_prompt, fallback)

    try:
        validated = DetectSkillGapsResponse(**raw_json)
        return validated
    except Exception as validation_err:
        print("Pydantic Validation Error in detect-skill-gaps, returning fallback:", validation_err)
        return DetectSkillGapsResponse(**fallback)


@app.post("/ai/generate-final-report", response_model=GenerateFinalReportResponse)
def generate_final_report(request: GenerateFinalReportRequest):
    """
    Summarizes overall interview stats and generates roadmap and recommendation.
    """
    transcript_text = ""
    for idx, ans in enumerate(request.questionEvaluations):
        transcript_text += f"\nQ{idx+1}: {ans.questionText}\nAns: {ans.answerText}\nStrengths: {', '.join(ans.strengths)}\nWeaknesses: {', '.join(ans.weaknesses)}\n"

    user_prompt = prompts.FINAL_REPORT_PROMPT.format(
        candidateName=request.candidateName,
        targetRole=request.targetRole,
        difficulty=request.difficulty,
        overallScore=request.overallScore,
        technicalAverage=request.technicalAverage,
        clarityAverage=request.clarityAverage,
        completenessAverage=request.completenessAverage,
        confidenceAverage=request.confidenceAverage,
        projectKnowledgeScore=request.projectKnowledgeScore,
        transcript=transcript_text,
        missingSkills=", ".join(request.missingSkills),
        recommendedTopics=", ".join(request.recommendedTopics)
    )

    # Base recommendation category logic
    overall_val = request.overallScore * 10
    rec_val = "Not Recommended Yet"
    if overall_val >= 85:
        rec_val = "Strongly Recommended"
    elif overall_val >= 70:
        rec_val = "Recommended"
    elif overall_val >= 50:
        rec_val = "Needs Improvement"

    fallback = {
        "overallScore": request.overallScore,
        "strengths": ["Understands basic programming logic", "Willing to discuss engineering trade-offs"],
        "weaknesses": ["Struggles with advanced design patterns", "Missed production configurations"],
        "missingSkills": request.missingSkills or ["Production deployments"],
        "roadmap": ["Study standard API design guides", "Build 1 full-stack app with unit test suites"],
        "recommendation": rec_val
    }

    raw_json = query_llm_json(prompts.SYSTEM_JSON_INSTRUCTION, user_prompt, fallback)

    try:
        validated = GenerateFinalReportResponse(**raw_json)
        return validated
    except Exception as validation_err:
        print("Pydantic Validation Error in generate-final-report, returning fallback:", validation_err)
        return GenerateFinalReportResponse(**fallback)


if __name__ == "__main__":
    import os
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
