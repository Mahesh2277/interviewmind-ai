import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Apply admin protection to all routes in this file
router.use(authenticateToken);
router.use(requireAdmin);

// 1. Get all candidates
router.get('/candidates', async (req, res) => {
  try {
    const candidates = await prisma.user.findMany({
      where: { role: 'CANDIDATE' },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        _count: {
          select: { interviews: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.status(200).json(candidates);
  } catch (error) {
    console.error('Fetch admin candidates error:', error);
    res.status(500).json({ error: 'Server error retrieving candidates list' });
  }
});

// 2. Get all interviews
router.get('/interviews', async (req, res) => {
  try {
    const interviews = await prisma.interview.findMany({
      include: {
        user: { select: { name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(interviews);
  } catch (error) {
    console.error('Fetch admin interviews error:', error);
    res.status(500).json({ error: 'Server error retrieving interviews' });
  }
});

// 3. Get all reports
router.get('/reports', async (req, res) => {
  try {
    const reports = await prisma.report.findMany({
      include: {
        interview: {
          include: {
            user: { select: { name: true, email: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedReports = reports.map(r => ({
      ...r,
      strengths: JSON.parse(r.strengths),
      weaknesses: JSON.parse(r.weaknesses),
      missingSkills: JSON.parse(r.missingSkills),
      roadmap: JSON.parse(r.roadmap)
    }));

    res.status(200).json(formattedReports);
  } catch (error) {
    console.error('Fetch admin reports error:', error);
    res.status(500).json({ error: 'Server error retrieving reports list' });
  }
});

// 4. Get specific report
router.get('/reports/:id', async (req, res) => {
  try {
    const report = await prisma.report.findUnique({
      where: { id: req.params.id },
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

    const formattedReport = {
      ...report,
      strengths: JSON.parse(report.strengths),
      weaknesses: JSON.parse(report.weaknesses),
      missingSkills: JSON.parse(report.missingSkills),
      roadmap: JSON.parse(report.roadmap)
    };

    res.status(200).json(formattedReport);
  } catch (error) {
    console.error('Fetch admin report detail error:', error);
    res.status(500).json({ error: 'Server error retrieving report details' });
  }
});

// 5. Analytics Dashboard Data
router.get('/analytics', async (req, res) => {
  try {
    const totalInterviews = await prisma.interview.count();
    const completedCount = await prisma.interview.count({ where: { status: 'COMPLETED' } });
    const candidatesCount = await prisma.user.count({ where: { role: 'CANDIDATE' } });

    // Averages from reports
    const reportAggregates = await prisma.report.aggregate({
      _avg: {
        overallScore: true,
        technicalAverage: true,
        clarityAverage: true,
        completenessAverage: true,
        confidenceAverage: true,
        projectKnowledgeScore: true
      }
    });

    // Recommendations distribution
    const interviews = await prisma.interview.findMany({
      where: { status: 'COMPLETED' },
      select: { recommendation: true, targetRole: true }
    });

    const recommendations = {};
    const roles = {};

    interviews.forEach(i => {
      const rec = i.recommendation || 'Pending';
      const role = i.targetRole || 'Unknown';

      recommendations[rec] = (recommendations[rec] || 0) + 1;
      roles[role] = (roles[role] || 0) + 1;
    });

    res.status(200).json({
      summary: {
        totalInterviews,
        completedInterviews: completedCount,
        registeredCandidates: candidatesCount
      },
      averages: {
        overallScore: reportAggregates._avg.overallScore ? parseFloat(reportAggregates._avg.overallScore.toFixed(2)) : 0,
        technical: reportAggregates._avg.technicalAverage ? parseFloat(reportAggregates._avg.technicalAverage.toFixed(2)) : 0,
        clarity: reportAggregates._avg.clarityAverage ? parseFloat(reportAggregates._avg.clarityAverage.toFixed(2)) : 0,
        completeness: reportAggregates._avg.completenessAverage ? parseFloat(reportAggregates._avg.completenessAverage.toFixed(2)) : 0,
        confidence: reportAggregates._avg.confidenceAverage ? parseFloat(reportAggregates._avg.confidenceAverage.toFixed(2)) : 0,
        projectKnowledge: reportAggregates._avg.projectKnowledgeScore ? parseFloat(reportAggregates._avg.projectKnowledgeScore.toFixed(2)) : 0
      },
      distributions: {
        recommendations,
        roles
      }
    });
  } catch (error) {
    console.error('Fetch admin analytics error:', error);
    res.status(500).json({ error: 'Server error building analytics summary' });
  }
});

export default router;
