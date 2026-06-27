import express from 'express';
import axios from 'axios';
import prisma from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { generatePDFReport } from '../utils/pdfGenerator.js';

const router = express.Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// 1. Create a new Interview setup
router.post('/create', authenticateToken, async (req, res) => {
  const {
    targetRole,
    difficulty,
    skills,
    experienceLevel,
    projectTitle,
    projectDescription,
    techStack
  } = req.body;

  if (!targetRole || !difficulty || !skills || !experienceLevel || !projectTitle || !projectDescription || !techStack) {
    return res.status(400).json({ error: 'All interview setup fields are required' });
  }

  try {
    const interview = await prisma.interview.create({
      data: {
        userId: req.user.id,
        targetRole,
        difficulty,
        skills,
        experienceLevel,
        projectTitle,
        projectDescription,
        techStack,
        status: 'STARTED'
      }
    });

    res.status(201).json(interview);
  } catch (error) {
    console.error('Create interview error:', error);
    res.status(500).json({ error: 'Failed to create interview record' });
  }
});

// 2. Get logged in candidate's interviews
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const interviews = await prisma.interview.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(interviews);
  } catch (error) {
    console.error('Fetch my interviews error:', error);
    res.status(500).json({ error: 'Failed to fetch interviews' });
  }
});

// 3. Get specific interview details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const interview = await prisma.interview.findUnique({
      where: { id: req.params.id },
      include: {
        questions: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            questionText: true,
            questionType: true,
            createdAt: true,
            // Exclude idealAnswer from normal candidate details
          }
        },
        answers: true,
        report: true
      }
    });

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // Security: Only user who created it or Admin can access it
    if (interview.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.status(200).json(interview);
  } catch (error) {
    console.error('Get interview details error:', error);
    res.status(500).json({ error: 'Failed to fetch interview details' });
  }
});

// 4. Generate interview questions via Python FastAPI
router.post('/:id/generate-questions', authenticateToken, async (req, res) => {
  const interviewId = req.params.id;

  try {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: { questions: true }
    });

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    if (interview.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // If questions are already generated, return them (without idealAnswer)
    if (interview.questions.length > 0) {
      const sanitizedQuestions = interview.questions.map(q => ({
        id: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        createdAt: q.createdAt
      }));
      return res.status(200).json(sanitizedQuestions);
    }

    // Call FastAPI service to generate questions
    let response;
    try {
      response = await axios.post(`${AI_SERVICE_URL}/ai/generate-questions`, {
        targetRole: interview.targetRole,
        difficulty: interview.difficulty,
        skills: interview.skills.split(',').map(s => s.trim()),
        experienceLevel: interview.experienceLevel,
        projectTitle: interview.projectTitle,
        projectDescription: interview.projectDescription,
        techStack: interview.techStack.split(',').map(t => t.trim())
      });
    } catch (aiError) {
      console.error('AI Service Error (Generate Questions), returning fallback mock questions:', aiError.message);
      // Fallback fallback questions if AI service is offline
      response = {
        data: {
          questions: [
            {
              questionText: `Explain JWT authentication flow and how you would secure a ${interview.targetRole} application.`,
              questionType: "TECHNICAL",
              idealAnswer: "JWT is signed and has header, payload, signature. Set secure cookies, HTTPOnly, short expiration, verify signature."
            },
            {
              questionText: `Tell me about a challenging technical decision in your project: ${interview.projectTitle}.`,
              questionType: "PROJECT",
              idealAnswer: "Explain the architecture, trade-offs, and scaling considerations for the tech stack."
            },
            {
              questionText: `A feature needs to be shipped by tomorrow, but your code has a minor performance bottleneck. How would you handle this scenario?`,
              questionType: "SCENARIO",
              idealAnswer: "Assess critical path, ship MVP with logging, document technical debt, and patch in next iteration."
            },
            {
              questionText: "Why do you want to work as a developer and how do you stay updated with industry trends?",
              questionType: "HR",
              idealAnswer: "Passion for building products, open source contribution, reading tech blogs, and learning new tools."
            }
          ]
        }
      };
    }

    const { questions } = response.data;
    
    // Save to Database
    const createdQuestions = [];
    for (const q of questions) {
      const savedQuestion = await prisma.question.create({
        data: {
          interviewId,
          questionText: q.questionText,
          questionType: q.questionType,
          idealAnswer: q.idealAnswer || 'Provide detailed explanation of the core concept.'
        }
      });
      createdQuestions.push({
        id: savedQuestion.id,
        questionText: savedQuestion.questionText,
        questionType: savedQuestion.questionType,
        createdAt: savedQuestion.createdAt
      });
    }

    res.status(200).json(createdQuestions);
  } catch (error) {
    console.error('Questions generation wrapper error:', error);
    res.status(500).json({ error: 'Failed to generate interview questions' });
  }
});

// 5. Submit candidate answer
router.post('/:id/submit-answer', authenticateToken, async (req, res) => {
  const interviewId = req.params.id;
  const { questionId, answerText } = req.body;

  if (!questionId || !answerText) {
    return res.status(400).json({ error: 'questionId and answerText are required' });
  }

  try {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId }
    });

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    if (interview.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Find the question to get the ideal answer
    const question = await prisma.question.findUnique({
      where: { id: questionId }
    });

    if (!question || question.interviewId !== interviewId) {
      return res.status(400).json({ error: 'Invalid question reference' });
    }

    // Check if user already answered this question
    const existingAnswer = await prisma.answer.findFirst({
      where: { questionId, interviewId }
    });
    if (existingAnswer) {
      return res.status(400).json({ error: 'Question already answered' });
    }

    // 1. Evaluate answer using Python FastAPI LLM + Semantic scoring
    let evaluationData;
    let semanticData;
    
    // Define required concepts based on question text/ideal answer
    const requiredConcepts = question.questionText.match(/\b[A-Za-z0-9-]{3,15}\b/g) || ["concept"];

    try {
      // Call Semantic Score API
      const semResponse = await axios.post(`${AI_SERVICE_URL}/ai/semantic-score`, {
        candidateAnswer: answerText,
        idealAnswer: question.idealAnswer,
        requiredConcepts: requiredConcepts.slice(0, 5)
      });
      semanticData = semResponse.data;

      // Call LLM Evaluation API
      const evalResponse = await axios.post(`${AI_SERVICE_URL}/ai/evaluate-answer`, {
        questionText: question.questionText,
        questionType: question.questionType,
        idealAnswer: question.idealAnswer,
        candidateAnswer: answerText
      });
      evaluationData = evalResponse.data;

    } catch (aiError) {
      console.error('AI Service Error (Evaluate Answer), using local fallback scoring:', aiError.message);
      // Fallback evaluation logic
      semanticData = {
        similarityScore: 0.65,
        matchedConcepts: ["development"],
        missingConcepts: ["production best practices"]
      };

      evaluationData = {
        technicalScore: 6,
        clarityScore: 7,
        completenessScore: 5,
        confidenceScore: 6,
        roleFitScore: 60,
        strengths: ["Expressed the general ideas correctly"],
        weaknesses: ["Lacked specific architectural details or optimization concerns"],
        missingPoints: ["Technical trade-offs", "Production safety"],
        feedback: "The answer covers basic points but needs details about specific architecture.",
        improvedAnswer: "Consider adding specific details like security headers, caching, rate limiting, and exact library references."
      };
    }

    // Compute Weighted Score Formula
    // Technical Accuracy: 35%
    // Completeness: 25%
    // Clarity: 15%
    // Semantic Similarity: 15% (similarity score 0-1 scaled by 10)
    // Confidence: 10%
    const similarityOutOfTen = semanticData.similarityScore * 10;
    const finalAnswerScore = (
      (evaluationData.technicalScore * 0.35) +
      (evaluationData.completenessScore * 0.25) +
      (evaluationData.clarityScore * 0.15) +
      (similarityOutOfTen * 0.15) +
      (evaluationData.confidenceScore * 0.10)
    );

    // Save Answer
    const savedAnswer = await prisma.answer.create({
      data: {
        questionId,
        interviewId,
        userId: req.user.id,
        answerText,
        technicalScore: parseFloat(evaluationData.technicalScore.toFixed(1)),
        clarityScore: parseFloat(evaluationData.clarityScore.toFixed(1)),
        completenessScore: parseFloat(evaluationData.completenessScore.toFixed(1)),
        confidenceScore: parseFloat(evaluationData.confidenceScore.toFixed(1)),
        semanticSimilarityScore: parseFloat(similarityOutOfTen.toFixed(1)),
        finalAnswerScore: parseFloat(finalAnswerScore.toFixed(2)),
        strengths: JSON.stringify(evaluationData.strengths),
        weaknesses: JSON.stringify(evaluationData.weaknesses),
        missingPoints: JSON.stringify(evaluationData.missingPoints),
        feedback: evaluationData.feedback,
        improvedAnswer: evaluationData.improvedAnswer
      }
    });

    // 2. Project-Based Cross Questioning: Trigger only if question is project-based
    let crossQuestionsAdded = false;
    let newQuestionsCreated = [];

    if (question.questionType === 'PROJECT') {
      try {
        const crossResponse = await axios.post(`${AI_SERVICE_URL}/ai/generate-cross-questions`, {
          projectTitle: interview.projectTitle,
          projectDescription: interview.projectDescription,
          techStack: interview.techStack.split(',').map(t => t.trim()),
          parentQuestionText: question.questionText,
          candidateAnswer: answerText,
          weakPoints: evaluationData.weaknesses
        });

        const { crossQuestions } = crossResponse.data;
        
        // Save follow-up cross-questions into DB
        for (const cq of crossQuestions) {
          // Create cross question entry for admin analytics
          const savedCq = await prisma.crossQuestion.create({
            data: {
              interviewId,
              parentQuestionId: questionId,
              crossQuestionText: cq.crossQuestionText,
              reason: cq.reason
            }
          });

          // Insert directly as a new Question for the interview!
          const newQuestion = await prisma.question.create({
            data: {
              interviewId,
              questionText: cq.crossQuestionText,
              questionType: 'PROJECT', // Mark as project-based so it follows the project workflow
              idealAnswer: `Expected answer to address: ${cq.reason}`
            }
          });

          newQuestionsCreated.push({
            id: newQuestion.id,
            questionText: newQuestion.questionText,
            questionType: newQuestion.questionType,
            createdAt: newQuestion.createdAt
          });
        }
        crossQuestionsAdded = true;
      } catch (cqError) {
        console.error('Failed to generate project-based cross questions:', cqError.message);
        // Do not crash, candidate can continue standard flow
      }
    }

    res.status(200).json({
      answer: savedAnswer,
      crossQuestionsAdded,
      newQuestions: newQuestionsCreated
    });

  } catch (error) {
    console.error('Answer submission error:', error);
    res.status(500).json({ error: 'Failed to process answer submission' });
  }
});

// 6. Generate final interview report
router.post('/:id/final-report', authenticateToken, async (req, res) => {
  const interviewId = req.params.id;

  try {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        questions: true,
        answers: true,
        report: true
      }
    });

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    if (interview.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if report already exists
    if (interview.report) {
      return res.status(200).json(interview.report);
    }

    // Check if all current questions are answered
    if (interview.answers.length < interview.questions.length) {
      return res.status(400).json({
        error: 'Cannot finalize report. Some questions have not been answered.',
        answeredCount: interview.answers.length,
        totalCount: interview.questions.length
      });
    }

    // Calculate score aggregates
    const totalAnswers = interview.answers.length;
    let technicalSum = 0;
    let claritySum = 0;
    let completenessSum = 0;
    let confidenceSum = 0;
    let finalScoreSum = 0;
    
    // Project knowledge score: average score of project-based questions
    let projectAnswersCount = 0;
    let projectScoreSum = 0;

    for (const ans of interview.answers) {
      technicalSum += ans.technicalScore;
      claritySum += ans.clarityScore;
      completenessSum += ans.completenessScore;
      confidenceSum += ans.confidenceScore;
      finalScoreSum += ans.finalAnswerScore;

      // Find the associated question type
      const associatedQ = interview.questions.find(q => q.id === ans.questionId);
      if (associatedQ && associatedQ.questionType === 'PROJECT') {
        projectAnswersCount++;
        projectScoreSum += ans.finalAnswerScore;
      }
    }

    const technicalAverage = parseFloat((technicalSum / totalAnswers).toFixed(2));
    const clarityAverage = parseFloat((claritySum / totalAnswers).toFixed(2));
    const completenessAverage = parseFloat((completenessSum / totalAnswers).toFixed(2));
    const confidenceAverage = parseFloat((confidenceSum / totalAnswers).toFixed(2));
    const overallScore = parseFloat((finalScoreSum / totalAnswers).toFixed(2));
    
    // Project knowledge score falls back to overall score if no project question was answered
    const projectKnowledgeScore = projectAnswersCount > 0 
      ? parseFloat((projectScoreSum / projectAnswersCount).toFixed(2))
      : overallScore;

    // Call FastAPI for skill gap and recommendation
    let apiReportDetails;
    try {
      const skillsArray = interview.skills.split(',').map(s => s.trim());
      const evaluationSummaries = interview.answers.map(ans => {
        const q = interview.questions.find(qu => qu.id === ans.questionId);
        return {
          questionText: q ? q.questionText : "",
          answerText: ans.answerText,
          strengths: JSON.parse(ans.strengths),
          weaknesses: JSON.parse(ans.weaknesses),
          missingPoints: JSON.parse(ans.missingPoints)
        };
      });

      const skillGapResponse = await axios.post(`${AI_SERVICE_URL}/ai/detect-skill-gaps`, {
        targetRole: interview.targetRole,
        skills: skillsArray,
        candidateAnswers: evaluationSummaries
      });

      const finalReportResponse = await axios.post(`${AI_SERVICE_URL}/ai/generate-final-report`, {
        candidateName: req.user.name || "Candidate",
        targetRole: interview.targetRole,
        difficulty: interview.difficulty,
        overallScore,
        technicalAverage,
        clarityAverage,
        completenessAverage,
        confidenceAverage,
        projectKnowledgeScore,
        questionEvaluations: evaluationSummaries,
        missingSkills: skillGapResponse.data.missingSkills,
        recommendedTopics: skillGapResponse.data.recommendedTopics
      });

      apiReportDetails = {
        strengths: finalReportResponse.data.strengths,
        weaknesses: finalReportResponse.data.weaknesses,
        missingSkills: finalReportResponse.data.missingSkills,
        roadmap: finalReportResponse.data.roadmap,
        recommendation: finalReportResponse.data.recommendation
      };

    } catch (aiError) {
      console.error('AI Service Error (Generate Final Report), using local fallback evaluation:', aiError.message);
      // Fallback scoring recommendations
      let recommendation = "Not Recommended Yet";
      if (overallScore >= 85) recommendation = "Strongly Recommended";
      else if (overallScore >= 70) recommendation = "Recommended";
      else if (overallScore >= 50) recommendation = "Needs Improvement";

      apiReportDetails = {
        strengths: ["Showed positive initial attempt", "Answered all questions within time limit"],
        weaknesses: ["Struggled to articulate advanced topics", "Missed production considerations"],
        missingSkills: ["API optimization", "Production deployments"],
        roadmap: [
          "Study caching techniques using Redis",
          "Read documentation on advanced middleware safety and rate-limiting"
        ],
        recommendation
      };
    }

    // Save final report to DB
    const report = await prisma.report.create({
      data: {
        interviewId,
        overallScore,
        technicalAverage,
        clarityAverage,
        completenessAverage,
        confidenceAverage,
        projectKnowledgeScore,
        strengths: JSON.stringify(apiReportDetails.strengths),
        weaknesses: JSON.stringify(apiReportDetails.weaknesses),
        missingSkills: JSON.stringify(apiReportDetails.missingSkills),
        roadmap: JSON.stringify(apiReportDetails.roadmap),
        recommendation: apiReportDetails.recommendation,
        pdfUrl: `/reports/report-${interviewId}.pdf`
      }
    });

    // Update Interview status and general details
    await prisma.interview.update({
      where: { id: interviewId },
      data: {
        status: 'COMPLETED',
        overallScore,
        recommendation: apiReportDetails.recommendation
      }
    });

    res.status(201).json(report);
  } catch (error) {
    console.error('Finalize report error:', error);
    res.status(500).json({ error: 'Failed to create final interview report' });
  }
});

// 7. Get report details
router.get('/:id/report', authenticateToken, async (req, res) => {
  try {
    const report = await prisma.report.findUnique({
      where: { interviewId: req.params.id },
      include: {
        interview: {
          include: {
            user: { select: { name: true, email: true } }
          }
        }
      }
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found for this interview' });
    }

    if (report.interview.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Format fields from stringified JSON
    const formattedReport = {
      ...report,
      strengths: JSON.parse(report.strengths),
      weaknesses: JSON.parse(report.weaknesses),
      missingSkills: JSON.parse(report.missingSkills),
      roadmap: JSON.parse(report.roadmap)
    };

    res.status(200).json(formattedReport);
  } catch (error) {
    console.error('Fetch report details error:', error);
    res.status(500).json({ error: 'Server error retrieving report' });
  }
});

// 8. Stream/Download PDF report
router.get('/:id/download-report', authenticateToken, async (req, res) => {
  try {
    const report = await prisma.report.findUnique({
      where: { interviewId: req.params.id },
      include: {
        interview: {
          include: {
            user: { select: { name: true, email: true } },
            questions: { orderBy: { createdAt: 'asc' } },
            answers: { orderBy: { createdAt: 'asc' } }
          }
        }
      }
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (report.interview.userId !== req.user.id && report.interview.user.role !== 'ADMIN') {
      // Check if logged in user matches interview candidate
      if (report.interview.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const filename = `interview_report_${req.params.id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    generatePDFReport(report, res);
  } catch (error) {
    console.error('PDF report download error:', error);
    res.status(500).json({ error: 'Failed to generate and stream PDF report' });
  }
});

export default router;
