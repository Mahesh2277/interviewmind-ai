import PDFDocument from 'pdfkit';

/**
 * Generates a professional PDF report and streams it to the response.
 * @param {Object} report - Complete report object including interview, questions, and answers
 * @param {Response} res - Express response stream
 */
export const generatePDFReport = (report, res) => {
  const doc = new PDFDocument({
    margin: 50,
    size: 'A4',
    bufferPages: true
  });

  // Pipe to client response stream
  doc.pipe(res);

  // Layout Helper: Colors
  const colors = {
    primary: '#1e3a8a', // dark blue
    secondary: '#3b82f6', // blue
    dark: '#0f172a', // slate-900
    text: '#334155', // slate-700
    lightBg: '#f8fafc', // slate-50
    border: '#cbd5e1', // slate-300
    success: '#059669', // green-600
    warning: '#d97706', // amber-600
    danger: '#dc2626' // red-600
  };

  // 1. HEADER SECTION
  doc.rect(0, 0, 595.28, 120).fill(colors.primary);
  doc.fillColor('#ffffff');
  doc.font('Helvetica-Bold').fontSize(26).text('InterviewMind AI', 50, 35);
  doc.font('Helvetica').fontSize(14).text('AI-Powered Interview Evaluation Engine', 50, 68);

  // 2. CANDIDATE & SESSION DETAILS
  doc.fillColor(colors.dark);
  doc.font('Helvetica-Bold').fontSize(16).text('Interview Report Card', 50, 140);
  doc.moveTo(50, 160).lineTo(545.28, 160).strokeColor(colors.border).stroke();

  // Detail fields in a grid
  doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.dark).text('Candidate Name:', 50, 175);
  doc.font('Helvetica').fillColor(colors.text).text(report.interview.user.name, 150, 175);

  doc.font('Helvetica-Bold').fillColor(colors.dark).text('Target Role:', 50, 195);
  doc.font('Helvetica').fillColor(colors.text).text(report.interview.targetRole, 150, 195);

  doc.font('Helvetica-Bold').fillColor(colors.dark).text('Difficulty Level:', 50, 215);
  doc.font('Helvetica').fillColor(colors.text).text(report.interview.difficulty, 150, 215);

  doc.font('Helvetica-Bold').fillColor(colors.dark).text('Interview Date:', 300, 175);
  doc.font('Helvetica').fillColor(colors.text).text(new Date(report.createdAt).toLocaleDateString(), 400, 175);

  doc.font('Helvetica-Bold').fillColor(colors.dark).text('Overall Score:', 300, 195);
  doc.font('Helvetica-Bold').fillColor(colors.primary).text(`${(report.overallScore * 10).toFixed(1)}%`, 400, 195);

  // Recommendation Badge
  const rec = report.recommendation;
  let badgeColor = colors.secondary;
  if (rec === 'Strongly Recommended') badgeColor = colors.success;
  else if (rec === 'Recommended') badgeColor = colors.success;
  else if (rec === 'Needs Improvement') badgeColor = colors.warning;
  else if (rec === 'Not Recommended Yet') badgeColor = colors.danger;

  doc.font('Helvetica-Bold').fillColor(colors.dark).text('Recommendation:', 300, 215);
  doc.rect(400, 212, 130, 18).fill(badgeColor);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9).text(rec, 405, 216, { width: 120, align: 'center' });

  // 3. SCORE BREAKDOWN BOXES
  doc.fillColor(colors.dark).font('Helvetica-Bold').fontSize(14).text('Performance Metric Breakdown', 50, 250);
  
  // Draw score grid cards
  const drawScoreCard = (label, score, x, y) => {
    doc.rect(x, y, 110, 60).fillAndStroke(colors.lightBg, colors.border);
    doc.fillColor(colors.text).font('Helvetica').fontSize(9).text(label, x + 5, y + 10, { width: 100, align: 'center' });
    doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(18).text(`${(score * 10).toFixed(0)}%`, x + 5, y + 30, { width: 100, align: 'center' });
  };

  drawScoreCard('Technical', report.technicalAverage, 50, 275);
  drawScoreCard('Completeness', report.completenessAverage, 175, 275);
  drawScoreCard('Clarity', report.clarityAverage, 300, 275);
  drawScoreCard('Project Knowl.', report.projectKnowledgeScore, 425, 275);

  // 4. HIGHLIGHTS & SKILL GAP ANALYSIS
  let strengths = [];
  let weaknesses = [];
  let missingSkills = [];
  let roadmap = [];

  try { strengths = JSON.parse(report.strengths); } catch (e) { strengths = [report.strengths]; }
  try { weaknesses = JSON.parse(report.weaknesses); } catch (e) { weaknesses = [report.weaknesses]; }
  try { missingSkills = JSON.parse(report.missingSkills); } catch (e) { missingSkills = [report.missingSkills]; }
  try { roadmap = JSON.parse(report.roadmap); } catch (e) { roadmap = [report.roadmap]; }

  // Strengths & Weaknesses side-by-side
  doc.fillColor(colors.dark).font('Helvetica-Bold').fontSize(14).text('Strengths & Weaknesses', 50, 355);
  
  // Strengths col
  doc.fillColor(colors.success).font('Helvetica-Bold').fontSize(11).text('Key Strengths', 50, 380);
  let strengthsY = 400;
  strengths.slice(0, 4).forEach(s => {
    doc.fillColor(colors.text).font('Helvetica').fontSize(9.5).text(`• ${s}`, 50, strengthsY, { width: 220 });
    strengthsY += doc.heightOfString(`• ${s}`, { width: 220 }) + 6;
  });

  // Weaknesses col
  doc.fillColor(colors.danger).font('Helvetica-Bold').fontSize(11).text('Areas to Improve', 290, 380);
  let weaknessesY = 400;
  weaknesses.slice(0, 4).forEach(w => {
    doc.fillColor(colors.text).font('Helvetica').fontSize(9.5).text(`• ${w}`, 290, weaknessesY, { width: 220 });
    weaknessesY += doc.heightOfString(`• ${w}`, { width: 220 }) + 6;
  });

  // Next section position depending on lists height
  const section2Y = Math.max(strengthsY, weaknessesY) + 15;

  // Skill Gap & Roadmap
  doc.moveTo(50, section2Y - 5).lineTo(545.28, section2Y - 5).strokeColor(colors.border).stroke();
  doc.fillColor(colors.dark).font('Helvetica-Bold').fontSize(14).text('Skill Gap Detection & Recommended Learning', 50, section2Y);

  // Missing Skills tags
  doc.fillColor(colors.text).font('Helvetica-Bold').fontSize(10).text('Detected Missing Skills:', 50, section2Y + 25);
  let skillTagX = 50;
  let skillTagY = section2Y + 42;
  missingSkills.forEach(skill => {
    const textWidth = doc.widthOfString(skill, { size: 9 }) + 16;
    if (skillTagX + textWidth > 545) {
      skillTagX = 50;
      skillTagY += 22;
    }
    doc.rect(skillTagX, skillTagY, textWidth, 16).fillAndStroke('#fee2e2', '#fecaca');
    doc.fillColor(colors.danger).font('Helvetica').fontSize(9).text(skill, skillTagX + 8, skillTagY + 3);
    skillTagX += textWidth + 8;
  });

  // Learning Roadmap
  doc.fillColor(colors.dark).font('Helvetica-Bold').fontSize(11).text('Personalized Roadmap:', 50, skillTagY + 28);
  let roadmapY = skillTagY + 45;
  roadmap.slice(0, 5).forEach((step, index) => {
    doc.fillColor(colors.text).font('Helvetica').fontSize(9.5).text(`${index + 1}. ${step}`, 50, roadmapY, { width: 495 });
    roadmapY += doc.heightOfString(`${index + 1}. ${step}`, { width: 495 }) + 8;
  });

  // 5. DETAIL QUESTIONS SECTION (NEW PAGES)
  report.interview.questions.forEach((q, index) => {
    const ans = report.interview.answers.find(a => a.questionId === q.id);
    
    doc.addPage();
    
    // Header for details page
    doc.rect(0, 0, 595.28, 40).fill(colors.primary);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12).text(`Question ${index + 1} Detailed Evaluation`, 50, 15);

    // Question
    doc.fillColor(colors.dark).font('Helvetica-Bold').fontSize(12).text(`Question Text:`, 50, 60);
    doc.fillColor(colors.text).font('Helvetica').fontSize(10.5).text(q.questionText, 50, 78, { width: 495 });

    // Answer
    doc.fillColor(colors.dark).font('Helvetica-Bold').fontSize(12).text(`Candidate Answer:`, 50, 120);
    if (ans) {
      doc.fillColor('#475569').font('Helvetica-Oblique').fontSize(10).text(ans.answerText, 50, 138, { width: 495 });

      // Answer Score
      doc.rect(50, 250, 495, 40).fill(colors.lightBg);
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(colors.primary);
      doc.text(`Final Score: ${ans.finalAnswerScore}/10 | Tech Accuracy: ${ans.technicalScore} | Clarity: ${ans.clarityScore} | Completeness: ${ans.completenessScore} | Similarity: ${ans.semanticSimilarityScore}`, 60, 264);

      // Feedback
      doc.fillColor(colors.dark).font('Helvetica-Bold').fontSize(12).text(`AI Evaluation & Feedback:`, 50, 310);
      doc.fillColor(colors.text).font('Helvetica').fontSize(10).text(ans.feedback, 50, 328, { width: 495 });

      // Strengths & Weaknesses
      let ansStrengths = [];
      let ansWeaknesses = [];
      try { ansStrengths = JSON.parse(ans.strengths); } catch (e) {}
      try { ansWeaknesses = JSON.parse(ans.weaknesses); } catch (e) {}

      doc.font('Helvetica-Bold').fontSize(11).fillColor(colors.success).text('Strengths:', 50, 395);
      let listY = 412;
      ansStrengths.forEach(s => {
        doc.fillColor(colors.text).font('Helvetica').fontSize(9.5).text(`• ${s}`, 50, listY, { width: 495 });
        listY += doc.heightOfString(`• ${s}`, { width: 495 }) + 4;
      });

      doc.font('Helvetica-Bold').fontSize(11).fillColor(colors.danger).text('Missing Details / Weaknesses:', 50, listY + 10);
      listY += 27;
      ansWeaknesses.forEach(w => {
        doc.fillColor(colors.text).font('Helvetica').fontSize(9.5).text(`• ${w}`, 50, listY, { width: 495 });
        listY += doc.heightOfString(`• ${w}`, { width: 495 }) + 4;
      });

      // Ideal Answer
      doc.fillColor(colors.dark).font('Helvetica-Bold').fontSize(12).text(`Ideal Reference Answer Guide:`, 50, listY + 15);
      doc.fillColor(colors.success).font('Helvetica').fontSize(10).text(ans.improvedAnswer, 50, listY + 33, { width: 495 });

    } else {
      doc.fillColor(colors.danger).font('Helvetica-Bold').fontSize(12).text('No Answer Submitted', 50, 138);
    }
  });

  // Footer: page numbers
  const pagesCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pagesCount; i++) {
    doc.switchToPage(i);
    doc.fillColor('#94a3b8').font('Helvetica').fontSize(8);
    doc.text(`Page ${i + 1} of ${pagesCount}`, 50, 785, { align: 'center', width: 495 });
  }

  // Finalize document
  doc.end();
};
