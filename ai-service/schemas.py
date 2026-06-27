from pydantic import BaseModel, Field
from typing import List, Optional

# --- REQUEST SCHEMAS ---

class GenerateQuestionsRequest(BaseModel):
    targetRole: str
    difficulty: str
    skills: List[str]
    experienceLevel: str
    projectTitle: str
    projectDescription: str
    techStack: List[str]

class EvaluateAnswerRequest(BaseModel):
    questionText: str
    questionType: str  # "TECHNICAL", "HR", "SCENARIO", "PROJECT"
    idealAnswer: str
    candidateAnswer: str

class SemanticScoreRequest(BaseModel):
    candidateAnswer: str
    idealAnswer: str
    requiredConcepts: List[str]

class GenerateCrossQuestionsRequest(BaseModel):
    projectTitle: str
    projectDescription: str
    techStack: List[str]
    parentQuestionText: str
    candidateAnswer: str
    weakPoints: List[str]

class CandidateAnswerDetail(BaseModel):
    questionText: str
    answerText: str
    strengths: List[str]
    weaknesses: List[str]
    missingPoints: List[str]

class DetectSkillGapsRequest(BaseModel):
    targetRole: str
    skills: List[str]
    candidateAnswers: List[CandidateAnswerDetail]

class GenerateFinalReportRequest(BaseModel):
    candidateName: str
    targetRole: str
    difficulty: str
    overallScore: float
    technicalAverage: float
    clarityAverage: float
    completenessAverage: float
    confidenceAverage: float
    projectKnowledgeScore: float
    questionEvaluations: List[CandidateAnswerDetail]
    missingSkills: List[str]
    recommendedTopics: List[str]


# --- RESPONSE SCHEMAS ---

class QuestionDetail(BaseModel):
    questionText: str
    questionType: str
    idealAnswer: str

class GenerateQuestionsResponse(BaseModel):
    questions: List[QuestionDetail]

class EvaluateAnswerResponse(BaseModel):
    technicalScore: float = Field(..., ge=0, le=10)
    clarityScore: float = Field(..., ge=0, le=10)
    completenessScore: float = Field(..., ge=0, le=10)
    confidenceScore: float = Field(..., ge=0, le=10)
    roleFitScore: float = Field(..., ge=0, le=100)
    strengths: List[str]
    weaknesses: List[str]
    missingPoints: List[str]
    feedback: str
    improvedAnswer: str

class SemanticScoreResponse(BaseModel):
    similarityScore: float = Field(..., ge=0.0, le=1.0)
    matchedConcepts: List[str]
    missingConcepts: List[str]

class CrossQuestionDetail(BaseModel):
    crossQuestionText: str
    reason: str

class GenerateCrossQuestionsResponse(BaseModel):
    crossQuestions: List[CrossQuestionDetail]

class DetectSkillGapsResponse(BaseModel):
    missingSkills: List[str]
    recommendedTopics: List[str]

class GenerateFinalReportResponse(BaseModel):
    overallScore: float
    strengths: List[str]
    weaknesses: List[str]
    missingSkills: List[str]
    roadmap: List[str]
    recommendation: str  # "Strongly Recommended", "Recommended", "Needs Improvement", "Not Recommended Yet"
